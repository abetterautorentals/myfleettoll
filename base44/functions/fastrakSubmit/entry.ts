import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { jsPDF } from 'npm:jspdf@4.0.0';

// Official FasTrak dispute contact
const FASTRAK_DISPUTE_EMAIL = 'CustomerService@BayAreaFasTrak.org';
const FASTRAK_SUBJECT_FORMAT = 'Toll Dispute — Rental Vehicle — Plate: {PLATE} — Date: {DATE} — Notice: {NOTICE_ID}';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { toll_id } = await req.json();

  const tolls = await base44.asServiceRole.entities.TollNotice.filter({ id: toll_id });
  const toll = tolls[0];
  if (!toll) return Response.json({ error: 'Toll not found' }, { status: 404 });
  if (toll.dispute_status === 'sent_to_agency') {
    return Response.json({ error: 'Already submitted to FasTrak' }, { status: 400 });
  }

  let contract = null;
  if (toll.matched_contract_id) {
    const contracts = await base44.asServiceRole.entities.RentalContract.filter({ id: toll.matched_contract_id });
    contract = contracts[0] || null;
  }

  // Generate PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, 216, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL TOLL DISPUTE PACKAGE', 108, 18, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Submitted: ${today}`, 108, 30, { align: 'center' });

  doc.setTextColor(30, 30, 30);
  let y = 55;

  // FasTrak Address
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TO:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Bay Area FasTrak Customer Service', 30, y);
  doc.text('375 Beale Street, Suite 800', 30, y + 6);
  doc.text('San Francisco, CA 94105', 30, y + 12);
  doc.text('CustomerService@BayAreaFasTrak.org', 30, y + 18);
  y += 32;

  // RE line
  doc.setFont('helvetica', 'bold');
  doc.text('RE:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Toll Dispute — Rental Vehicle — Plate: ${toll.license_plate} — Date: ${toll.occurrence_date}${toll.transaction_id ? ' — Notice: ' + toll.transaction_id : ''}`,
    30, y
  );
  y += 15;

  // Body letter
  const letterLines = doc.splitTextToSize(
    `Dear FasTrak Customer Service,\n\n` +
    `We are writing to formally dispute the toll notice for vehicle with license plate ${toll.license_plate}.\n\n` +
    `At the time of the toll occurrence on ${toll.occurrence_date}${toll.occurrence_time ? ' at ' + toll.occurrence_time : ''}` +
    `${toll.location ? ' at ' + toll.location : ''}, this vehicle was under an active rental agreement. ` +
    `Under California Vehicle Code Section 40255.5, when a vehicle is rented through a rental company, ` +
    `the registered owner (rental company) may provide renter information, transferring liability to the renter.\n\n` +
    `RENTAL DETAILS:\n` +
    `• Renter: ${contract?.renter_name || toll.matched_renter_name || 'See attached contract'}\n` +
    `• Rental Period: ${contract ? new Date(contract.start_date).toLocaleDateString() + ' to ' + new Date(contract.end_date).toLocaleDateString() : 'See attached contract'}\n` +
    `• Reservation ID: ${contract?.reservation_id || 'N/A'}\n` +
    `• Platform: ${contract?.platform?.toUpperCase() || 'Direct Rental'}\n\n` +
    `Attached herein are:\n` +
    `  1. Signed rental agreement\n` +
    `  2. Toll transaction details\n` +
    `  3. Renter identification information\n\n` +
    `Please redirect this notice to the identified renter or dismiss the liability against our fleet. ` +
    `We are available to provide additional documentation upon request.\n\n` +
    `Sincerely,\nFleet Management\nFleetToll Pro`,
    175
  );
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(letterLines, 15, y);

  // Page 2 — contract details
  doc.addPage();
  y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RENTAL CONTRACT DETAILS', 108, y, { align: 'center' });
  y += 12;

  if (contract) {
    const fields = [
      ['Renter Name', contract.renter_name],
      ['Renter Email', contract.renter_email || 'N/A'],
      ['Renter Phone', contract.renter_phone || 'N/A'],
      ['License Plate', contract.license_plate],
      ['Rental Start', new Date(contract.start_date).toLocaleString()],
      ['Rental End', new Date(contract.end_date).toLocaleString()],
      ['Platform', contract.platform],
      ['Reservation ID', contract.reservation_id || 'N/A'],
      ['Signature Status', contract.signature_status?.toUpperCase()],
    ];
    doc.setFontSize(10);
    for (const [label, val] of fields) {
      doc.setFillColor(245, 247, 255);
      doc.rect(15, y - 4, 186, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, 18, y + 1);
      doc.setFont('helvetica', 'normal');
      doc.text(String(val || ''), 75, y + 1);
      y += 10;
    }
  } else {
    doc.setFontSize(10);
    doc.text('Contract information not available. Vehicle was under rental at time of toll.', 15, y);
  }

  // Toll details table
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOLL TRANSACTION', 15, y);
  y += 8;

  doc.setFillColor(99, 102, 241);
  doc.rect(15, y, 186, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('Date', 18, y + 5.5);
  doc.text('Time', 55, y + 5.5);
  doc.text('Location', 85, y + 5.5);
  doc.text('Agency', 140, y + 5.5);
  doc.text('Amount', 175, y + 5.5);
  y += 10;

  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFillColor(248, 248, 255);
  doc.rect(15, y - 3, 186, 8, 'F');
  doc.text(toll.occurrence_date || '', 18, y + 2);
  doc.text(toll.occurrence_time || '', 55, y + 2);
  doc.text((toll.location || '').substring(0, 30), 85, y + 2);
  doc.text(toll.agency || 'FasTrak', 140, y + 2);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${(toll.amount || 0).toFixed(2)}`, 175, y + 2);

  const pdfBytes = doc.output('arraybuffer');
  const pdfB64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

  // Build subject line in exact FasTrak format
  const subject = FASTRAK_SUBJECT_FORMAT
    .replace('{PLATE}', toll.license_plate)
    .replace('{DATE}', toll.occurrence_date)
    .replace('{NOTICE_ID}', toll.transaction_id || 'N/A');

  // Get Gmail access token
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

  // Build MIME email with PDF attachment
  const boundary = 'fastrak_dispute_boundary_xyz';
  const rawEmail = [
    `To: ${FASTRAK_DISPUTE_EMAIL}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    `Dear FasTrak Customer Service,\n\nPlease find the attached dispute package for toll notice on vehicle ${toll.license_plate} dated ${toll.occurrence_date}.\n\nThis vehicle was under an active rental agreement at the time of the toll. Full documentation is included in the attached PDF.\n\nThank you,\nFleet Management`,
    `--${boundary}`,
    `Content-Type: application/pdf`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="FasTrak_Dispute_${toll.license_plate}_${toll.occurrence_date}.pdf"`,
    '',
    pdfB64,
    `--${boundary}--`,
  ].join('\n');

  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.json();
    return Response.json({ error: 'Gmail send failed', details: err }, { status: 500 });
  }

  // Update toll status + record submission date
  await base44.asServiceRole.entities.TollNotice.update(toll_id, {
    dispute_status: 'sent_to_agency',
  });

  // Create alert to track follow-up
  await base44.asServiceRole.entities.Alert.create({
    type: 'toll_matched',
    title: '📬 Dispute Sent to FasTrak',
    message: `Dispute for ${toll.license_plate} on ${toll.occurrence_date} sent to FasTrak. Follow up if no response by ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}.`,
    fleet: toll.fleet || 'concesionario',
    severity: 'info',
    is_read: false,
    license_plate: toll.license_plate,
    related_entity_type: 'toll',
    related_entity_id: toll_id,
  });

  // Also send copy to REVIEW_EMAIL
  const reviewEmail = Deno.env.get('REVIEW_EMAIL');
  if (reviewEmail) {
    const ccEmail = [
      `To: ${reviewEmail}`,
      `Subject: [SENT] ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      `✅ FasTrak dispute successfully submitted.\n\nTo: ${FASTRAK_DISPUTE_EMAIL}\nSubject: ${subject}\nToll: ${toll.license_plate} on ${toll.occurrence_date}\nAmount: $${(toll.amount || 0).toFixed(2)}\n\nAutomatic follow-up will be triggered in 14 days if no response.`,
    ].join('\n');
    const encodedCc = btoa(unescape(encodeURIComponent(ccEmail)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encodedCc }),
    });
  }

  return Response.json({ status: 'sent', subject, to: FASTRAK_DISPUTE_EMAIL });
});