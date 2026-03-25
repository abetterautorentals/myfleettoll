import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * IMPORTANT: This function sends emails only to users that are part of the app.
 * The SendEmail integration only works with app users, not external email addresses.
 */

/**
 * Runs on the 25th of each month.
 * Finds all Turo tolls that have been submitted but not yet collected,
 * and sends a reminder email per tenant.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // This is a scheduled function — use service role
  const allTolls = await base44.asServiceRole.entities.TollNotice.filter({
    matched_platform: 'turo',
    turo_collected: false,
    submission_status: 'submitted',
  });

  if (allTolls.length === 0) {
    return Response.json({ message: 'No pending Turo tolls to remind about.' });
  }

  // Group by tenant
  const byTenant = {};
  for (const toll of allTolls) {
    const tid = toll.tenant_id || 'unknown';
    if (!byTenant[tid]) byTenant[tid] = [];
    byTenant[tid].push(toll);
  }

  const tenants = await base44.asServiceRole.entities.Tenant.list();
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t]));

  const results = [];
  for (const [tenantId, tolls] of Object.entries(byTenant)) {
    const tenant = tenantMap[tenantId];
    if (!tenant?.owner_email) continue;

    const total = tolls.reduce((s, t) => s + (t.amount || 0), 0);
    const tollLines = tolls.map(t =>
      `• ${t.license_plate} — ${t.occurrence_date} — $${(t.amount || 0).toFixed(2)} (${t.location || 'Unknown location'}) — submitted ${t.submission_date || '?'}`
    ).join('\n');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: tenant.owner_email,
      subject: `💰 Turo Toll Collection Reminder — ${tolls.length} tolls pending ($${total.toFixed(2)})`,
      body: `Hi ${tenant.company_name || 'there'},

It's the 25th — time to check if Turo has collected this month's toll charges from your renters!

PENDING TURO TOLL COLLECTION:
${tollLines}

TOTAL PENDING: $${total.toFixed(2)} across ${tolls.length} toll${tolls.length !== 1 ? 's' : ''}

Once Turo processes collection, go to the Tolls page in FleetToll Pro and mark each toll as "Collected".

— FleetToll Pro`
    });

    // Also create an in-app alert
    await base44.asServiceRole.entities.Alert.create({
      type: 'monthly_summary',
      title: `💰 ${tolls.length} Turo Tolls Pending Collection`,
      message: `$${total.toFixed(2)} total — Turo should collect from renters at end of month. Check and mark collected.`,
      severity: 'warning',
      is_read: false,
    });

    results.push({ tenantId, count: tolls.length, total });
  }

  return Response.json({ reminded: results });
});