import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Real-time Gmail webhook (Pub/Sub push).
 * Triggered by Gmail connector automation on every new email.
 * Routes to the correct fleet by matching the email recipient alias.
 * Extracts ALL individual toll transactions from FasTrak emails (PDF attachments + body).
 */

Deno.serve(async (req) => {
  const body = await req.json();
  const base44 = createClientFromRequest(req);

  // Support both connector automation payload and direct Pub/Sub
  let historyId;
  if (body?.data?.message?.data) {
    const decoded = JSON.parse(atob(body.data.message.data));
    historyId = String(decoded.historyId);
  } else if (body?.event) {
    // Called from connector automation — just run a full incremental sync
    historyId = null;
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // Load all fleets to map email aliases to fleet IDs
  const fleets = await base44.asServiceRole.entities.Fleet.list();
  const aliasToFleet = {};
  for (const f of fleets) {
    if (f.email_alias) {
      const alias = f.email_alias.split('@')[0].toLowerCase();
      aliasToFleet[alias] = f;
      aliasToFleet[f.email_alias.toLowerCase()] = f;
    }
  }

  // Load previous historyId
  const syncStates = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_history_id' });
  const syncRecord = syncStates[0] || null;

  if (!syncRecord) {
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: authHeader });
    const profile = await profileRes.json();
    await base44.asServiceRole.entities.SyncState.create({
      key: 'gmail_history_id',
      value: String(profile.historyId),
      last_synced: new Date().toISOString(),
    });
    return Response.json({ status: 'initialized' });
  }

  const startId = syncRecord.value;
  const historyRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startId}&historyTypes=messageAdded`,
    { headers: authHeader }
  );
  const historyData = await historyRes.json();

  const newHistoryId = historyId || String(historyData.historyId || startId);

  if (!historyData.history) {
    await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
      value: newHistoryId,
      last_synced: new Date().toISOString(),
    });
    return Response.json({ status: 'no_new_messages' });
  }

  const messageIds = [];
  for (const h of historyData.history || []) {
    for (const m of h.messagesAdded || []) messageIds.push(m.message.id);
  }

  let processedTolls = 0;
  let processedContracts = 0;

  for (const msgId of messageIds) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      { headers: authHeader }
    );
    const msg = await msgRes.json();
    const headers = msg.payload?.headers || [];

    const from = headers.find(h => h.name === 'From')?.value?.toLowerCase() || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const toHeader = headers.find(h => h.name === 'To')?.value?.toLowerCase() || '';
    const deliveredTo = headers.find(h => h.name === 'Delivered-To')?.value?.toLowerCase() || '';

    // Determine which fleet this email was sent to
    let targetFleet = null;
    const checkAddress = toHeader + ' ' + deliveredTo;
    for (const [alias, fleet] of Object.entries(aliasToFleet)) {
      if (checkAddress.includes(alias)) {
        targetFleet = fleet;
        break;
      }
    }
    // Fallback: use first active fleet
    if (!targetFleet && fleets.length > 0) {
      targetFleet = fleets[0];
    }

    // Determine sender type
    const SENDER_MAP = {
      turo: ['turo.com'],
      upcar: ['upcar.com'],
      signnow: ['signnow.com'],
      fastrak: ['bayareafastrak.org', 'tolls.ca.gov', 'fastrak.org'],
    };
    let senderType = null;
    for (const [type, domains] of Object.entries(SENDER_MAP)) {
      if (domains.some(d => from.includes(d))) { senderType = type; break; }
    }
    if (!senderType) continue; // Not a sender we care about

    // Extract text body + attachment URLs
    let textBody = '';
    const attachmentFileUrls = [];

    const collectParts = async (part) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
      // Download PDF/image attachments
      if (part.filename && part.body?.attachmentId && (
        part.mimeType === 'application/pdf' ||
        part.mimeType?.startsWith('image/')
      )) {
        const attRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${part.body.attachmentId}`,
          { headers: authHeader }
        );
        const attData = await attRes.json();
        if (attData.data) {
          // Convert base64 to blob and upload to storage
          const binary = atob(attData.data.replace(/-/g, '+').replace(/_/g, '/'));
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: part.mimeType });
          const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
          attachmentFileUrls.push(uploaded.file_url);
        }
      }
      for (const sub of part.parts || []) await collectParts(sub);
    };
    if (msg.payload) await collectParts(msg.payload);

    // ── FASTRAK TOLLS: extract ALL individual transactions ──
    if (senderType === 'fastrak' || (senderType !== 'turo' && senderType !== 'upcar' && senderType !== 'signnow')) {
      const promptContext = attachmentFileUrls.length > 0
        ? `Email subject: "${subject}"\n\nEmail body:\n${textBody.substring(0, 2000)}`
        : `Email subject: "${subject}"\n\nEmail body:\n${textBody.substring(0, 4000)}`;

      const extractResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are processing FasTrak toll notices for a car rental company.
Extract EVERY individual toll transaction from this email/document.
One email can contain multiple transactions for the same vehicle on different dates and times.
Each toll is a separate entry — extract each one individually.

${promptContext}

Return ALL toll transactions found. For each one extract:
- license_plate (string): vehicle plate number
- occurrence_date (string): YYYY-MM-DD — exact date car crossed the toll
- occurrence_time (string): HH:MM — exact time
- amount (number): dollar amount of this specific toll
- location (string): bridge or plaza name
- transaction_id (string): individual transaction/invoice ID
- agency (string): FasTrak, Bay Area Toll Authority, etc`,
        file_urls: attachmentFileUrls.length > 0 ? attachmentFileUrls : undefined,
        response_json_schema: {
          type: 'object',
          properties: {
            tolls: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  license_plate: { type: 'string' },
                  occurrence_date: { type: 'string' },
                  occurrence_time: { type: 'string' },
                  amount: { type: 'number' },
                  location: { type: 'string' },
                  transaction_id: { type: 'string' },
                  agency: { type: 'string' },
                }
              }
            }
          }
        }
      });

      const extractedTolls = extractResult?.tolls || [];

      for (const t of extractedTolls) {
        if (!t.license_plate || !t.occurrence_date) continue;

        // Check for duplicate (same transaction_id)
        if (t.transaction_id) {
          const existing = await base44.asServiceRole.entities.TollNotice.filter({ transaction_id: t.transaction_id });
          if (existing.length > 0) {
            // Update duplicate count — FasTrak is following up on unpaid toll
            await base44.asServiceRole.entities.TollNotice.update(existing[0].id, {
              duplicate_count: (existing[0].duplicate_count || 1) + 1,
            });
            await base44.asServiceRole.entities.Alert.create({
              type: 'toll_unmatched',
              title: '⚠️ FasTrak Follow-Up Notice',
              message: `FasTrak sent a follow-up for ${t.license_plate} on ${t.occurrence_date} (txn ${t.transaction_id}) — may be unpaid`,
              severity: 'warning',
              is_read: false,
              license_plate: t.license_plate,
            });
            continue;
          }
        }

        // Find matching contract
        const allContracts = await base44.asServiceRole.entities.RentalContract.filter({ license_plate: t.license_plate });
        const tollDate = new Date(t.occurrence_date);
        const match = allContracts.find(c => tollDate >= new Date(c.start_date) && tollDate <= new Date(c.end_date));

        const newToll = await base44.asServiceRole.entities.TollNotice.create({
          license_plate: t.license_plate,
          occurrence_date: t.occurrence_date,
          occurrence_time: t.occurrence_time || '',
          amount: t.amount || 0,
          agency: t.agency || 'FasTrak',
          location: t.location || '',
          transaction_id: t.transaction_id || '',
          fleet: targetFleet?.id || '',
          tenant_id: targetFleet?.tenant_id || '',
          notice_image_urls: attachmentFileUrls,
          match_status: match ? (match.signature_status === 'pending' ? 'pending_signature' : 'matched') : 'unmatched',
          matched_contract_id: match ? String(match.id) : undefined,
          matched_renter_name: match ? match.renter_name : undefined,
          matched_platform: match ? match.platform : undefined,
          dispute_status: 'not_started',
          duplicate_count: 1,
        });

        if (!match) {
          await base44.asServiceRole.entities.Alert.create({
            type: 'toll_unmatched',
            title: '🔴 Unmatched Toll (Auto)',
            message: `Auto-imported: ${t.license_plate} on ${t.occurrence_date} $${t.amount} — no contract found`,
            severity: 'critical',
            is_read: false,
            license_plate: t.license_plate,
          });
        }

        processedTolls++;
      }
    }

    // ── CONTRACT EMAILS (Turo, UpCar, SignNow) ──
    if (['turo', 'upcar', 'signnow'].includes(senderType)) {
      const extractResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Extract rental contract data from this ${senderType} email.
Subject: "${subject}"
Body: ${textBody.substring(0, 3000)}

Determine if this is a new booking, modification, or cancellation and extract all fields.`,
        response_json_schema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: '"contract", "toll", or "unknown"' },
            renter_name: { type: 'string' },
            renter_email: { type: 'string' },
            renter_phone: { type: 'string' },
            license_plate: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            reservation_id: { type: 'string' },
            signature_status: { type: 'string' },
            // In case a turo email is actually a toll charge
            occurrence_date: { type: 'string' },
            amount: { type: 'number' },
            location: { type: 'string' },
            transaction_id: { type: 'string' },
          }
        }
      });

      if (extractResult.type === 'contract' && extractResult.renter_name) {
        // Skip duplicates
        const existing = extractResult.reservation_id
          ? await base44.asServiceRole.entities.RentalContract.filter({ reservation_id: extractResult.reservation_id })
          : [];

        if (existing.length === 0) {
          await base44.asServiceRole.entities.RentalContract.create({
            renter_name: extractResult.renter_name,
            renter_email: extractResult.renter_email || '',
            renter_phone: extractResult.renter_phone || '',
            license_plate: extractResult.license_plate || '',
            start_date: extractResult.start_date || new Date().toISOString(),
            end_date: extractResult.end_date || new Date().toISOString(),
            platform: senderType,
            reservation_id: extractResult.reservation_id || '',
            fleet: targetFleet?.id || '',
            tenant_id: targetFleet?.tenant_id || '',
            signature_status: extractResult.signature_status === 'pending' ? 'pending' : 'signed',
            status: 'active',
          });
          processedContracts++;
          await base44.asServiceRole.entities.Alert.create({
            type: 'toll_matched',
            title: `📧 ${senderType.charAt(0).toUpperCase() + senderType.slice(1)} Contract Auto-Imported`,
            message: `${extractResult.renter_name} (${extractResult.license_plate || 'N/A'}) — auto-imported from email`,
            severity: 'success',
            is_read: false,
          });
        }
      } else if (extractResult.type === 'toll' && extractResult.license_plate && extractResult.occurrence_date) {
        // Turo sometimes sends toll charge emails too
        const allContracts = await base44.asServiceRole.entities.RentalContract.filter({ license_plate: extractResult.license_plate });
        const tollDate = new Date(extractResult.occurrence_date);
        const match = allContracts.find(c => tollDate >= new Date(c.start_date) && tollDate <= new Date(c.end_date));

        await base44.asServiceRole.entities.TollNotice.create({
          license_plate: extractResult.license_plate,
          occurrence_date: extractResult.occurrence_date,
          occurrence_time: extractResult.occurrence_time || '',
          amount: extractResult.amount || 0,
          agency: senderType === 'fastrak' ? 'FasTrak' : senderType,
          location: extractResult.location || '',
          transaction_id: extractResult.transaction_id || '',
          fleet: targetFleet?.id || '',
          tenant_id: targetFleet?.tenant_id || '',
          notice_image_urls: attachmentFileUrls,
          match_status: match ? 'matched' : 'unmatched',
          matched_contract_id: match ? String(match.id) : undefined,
          matched_renter_name: match ? match.renter_name : undefined,
          matched_platform: match ? match.platform : undefined,
          dispute_status: 'not_started',
          duplicate_count: 1,
        });
        processedTolls++;
      }
    }
  }

  // Update historyId
  await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
    value: newHistoryId,
    last_synced: new Date().toISOString(),
  });

  return Response.json({ status: 'ok', processedTolls, processedContracts, messagesChecked: messageIds.length });
});