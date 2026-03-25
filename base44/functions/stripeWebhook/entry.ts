import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
  const base44 = createClientFromRequest(req);

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;
  event = await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET'));

  const obj = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const tenantId = obj.metadata?.tenant_id;
    const plan = obj.metadata?.plan;
    if (tenantId && plan) {
      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        subscription_plan: plan,
        subscription_status: 'active',
        stripe_subscription_id: obj.subscription,
      });
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const sub = await stripe.subscriptions.retrieve(obj.subscription);
    const tenantId = sub.metadata?.tenant_id;
    if (tenantId) {
      // Reset monthly toll count
      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        subscription_status: 'active',
        tolls_this_month: 0,
      });
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const sub = await stripe.subscriptions.retrieve(obj.subscription);
    const tenantId = sub.metadata?.tenant_id;
    if (tenantId) {
      await base44.asServiceRole.entities.Tenant.update(tenantId, { subscription_status: 'past_due' });
      // Notify owner
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: Deno.env.get('OWNER_EMAIL'),
        subject: '⚠️ Payment failed for a FleetToll Pro customer',
        body: `Tenant ID: ${tenantId}\nSubscription: ${obj.subscription}\nAttempt: ${obj.attempt_count}`,
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const tenantId = obj.metadata?.tenant_id;
    if (tenantId) {
      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        subscription_status: 'canceled',
        subscription_plan: 'free',
      });
    }
  }

  return Response.json({ received: true });
});