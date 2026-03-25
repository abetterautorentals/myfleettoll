import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { tenant_id } = await req.json();
  const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenant_id });
  const tenant = tenants[0];

  if (!tenant?.stripe_customer_id) {
    return Response.json({ error: 'No billing account found' }, { status: 404 });
  }

  const appUrl = req.headers.get('origin') || 'https://app.fleettollpro.com';

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${appUrl}/subscription`,
  });

  return Response.json({ url: session.url });
});