import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Runs daily. Finds tolls sent to FasTrak 14+ days ago that are still
 * in 'sent_to_agency' (not recovered or lost). Sends a follow-up email.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const allTolls = await base44.asServiceRole.entities.TollNotice.filter({
    dispute_status: 'sent_to_agency',
  });

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const overdue = allTolls.filter(t => {
    // Use updated_date as proxy for when it was sent
    const sentDate = new Date(t.updated_date || t.created_date);
    return sentDate < cutoff;
  });

  if (overdue.length === 0) {
    return Response.json({ status: 'no_followups_needed' });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const FASTRAK_EMAIL = 'CustomerService@BayAreaFasTrak.org';
  let sent = 0;

  for (const toll of overdue) {
    const subject = `FOLLOW-UP: Toll Dispute — Rental Vehicle — Plate: ${toll.license_plate} — Date: ${toll.occurrence_date}${toll.transaction_id ? ' — Notice: ' + toll.transaction_id : ''}`;

    const body = `Dear FasTrak Customer Service,\n\n` +
      `This is a follow-up to our dispute submitted 14+ days ago for vehicle ${toll.license_plate} regarding a toll on ${toll.occurrence_date}.\n\n` +
      `We have not received a response or confirmation. Please advise on the status of this dispute.\n\n` +
      `Vehicle: ${toll.license_plate}\nToll Date: ${toll.occurrence_date}\nAmount: $${(toll.amount || 0).toFixed(2)}\nTransaction ID: ${toll.transaction_id || 'N/A'}\n\n` +
      `We are available to provide additional documentation if needed.\n\nThank you,\nFleet Management`;

    const rawEmail = [
      `To: ${FASTRAK_EMAIL}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      body,
    ].join('\n');

    const encoded = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encoded }),
    });

    // Create alert for visibility
    await base44.asServiceRole.entities.Alert.create({
      type: 'toll_unmatched',
      title: '🔔 FasTrak Follow-Up Sent',
      message: `14-day follow-up sent for ${toll.license_plate} dispute (${toll.occurrence_date}). Amount: $${(toll.amount || 0).toFixed(2)}`,
      fleet: toll.fleet || 'concesionario',
      severity: 'warning',
      is_read: false,
      license_plate: toll.license_plate,
      related_entity_type: 'toll',
      related_entity_id: String(toll.id),
    });

    sent++;
  }

  return Response.json({ status: 'ok', follow_ups_sent: sent });
});