import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

const PRICE_IDS = {
  starter:      { monthly: 'price_starter_monthly' },
  professional: { monthly: 'price_pro_monthly' },
  business:     { monthly: 'price_business_monthly' },
};

// Stripe prices — create these in your Stripe dashboard and replace the IDs above
// Or we create them dynamically below:
const PRICES = {
  starter:      2900,
  professional: 4900,
  business:     9900,
};

const PLAN_NAMES = {
  starter:      'FleetToll Pro Starter',
  professional: 'FleetToll Pro Professional',
  business:     'FleetToll Pro Business',
};

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan, tenant_id } = await req.json();

  if (!PRICES[plan]) return Response.json({ error: 'Invalid plan' }, { status: 400 });

  const appUrl = req.headers.get('origin') || 'https://app.fleettollpro.com';

  // Find or create Stripe customer
  const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenant_id });
  const tenant = tenants[0];
  if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404 });

  let customerId = tenant.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: tenant.company_name,
      metadata: { tenant_id, user_id: user.id },
    });
    customerId = customer.id;
    await base44.asServiceRole.entities.Tenant.update(tenant_id, { stripe_customer_id: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: PLAN_NAMES[plan] },
        unit_amount: PRICES[plan],
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    metadata: { tenant_id, plan },
    success_url: `${appUrl}/subscription?success=true&plan=${plan}`,
    cancel_url: `${appUrl}/subscription?canceled=true`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenant_id, plan },
    },
  });

  return Response.json({ url: session.url });
});