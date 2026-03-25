import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SENDERS = {
  turo: ['notifications@turo.com', 'noreply@turo.com', 'trips@turo.com'],
  upcar: ['upcar.com'],
  signnow: ['mail@signnow.com', 'noreply@signnow.com', 'notifications@signnow.com'],
  fastrak: ['bayareafastrak.org', 'fasttrak.org', 'goldengate.org', 'bayexpressway.com'],
};

function detectSource(from, subject) {
  const f = (from || '').toLowerCase();
  const s = (subject || '').toLowerCase();
  if (SENDERS.turo.some(d => f.includes(d))) return 'turo';
  if (SENDERS.upcar.some(d => f.includes(d))) return 'upcar';
  if (SENDERS.signnow.some(d => f.includes(d))) return 'signnow';
  if (SENDERS.fastrak.some(d => f.includes(d))) return 'fastrak';
  // subject fallback
  if (s.includes('turo')) return 'turo';
  if (s.includes('upcar')) return 'upcar';
  if (s.includes('signnow') || s.includes('sign now')) return 'signnow';
  if (s.includes('fastrak') || s.includes('toll') || s.includes('bay area express')) return 'fastrak';
  return null;
}

function extractText(payload) {
  if (!payload) return '';
  const parts = payload.parts || [payload];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.parts) {
      const sub = extractText(part);
      if (sub) return sub;
    }
  }
  // fallback html
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

function extractTuro(text, subject) {
  const result = { renterName: '', licensePlate: '', startDate: '', endDate: '', reservationId: '' };

  // Reservation ID
  const resMatch = text.match(/reservation\s*(?:#|id|number)?:?\s*([A-Z0-9\-]{5,20})/i)
    || subject.match(/#([A-Z0-9\-]{5,20})/i);
  if (resMatch) result.reservationId = resMatch[1];

  // Guest/renter name
  const nameMatch = text.match(/guest[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i)
    || text.match(/renter[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i)
    || text.match(/booked by[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
  if (nameMatch) result.renterName = nameMatch[1];

  // Dates
  const dateRange = text.match(/(\w{3,9}\s+\d{1,2},?\s+\d{4})[^\n]*(?:to|–|-|through)[^\n]*(\w{3,9}\s+\d{1,2},?\s+\d{4})/i);
  if (dateRange) { result.startDate = dateRange[1]; result.endDate = dateRange[2]; }

  // License plate (common formats)
  const plateMatch = text.match(/\b([A-Z0-9]{2,3}[A-Z0-9\-]{1,4}[A-Z0-9]{1,3})\b/);
  if (plateMatch) result.licensePlate = plateMatch[1];

  return result;
}

function extractFastrak(text, subject) {
  const result = { licensePlate: '', amount: 0, occurrenceDate: '', location: '', transactionId: '' };

  const plateMatch = text.match(/(?:license plate|plate|vehicle)[:\s]+([A-Z0-9]{2,8})/i)
    || text.match(/\b([A-Z0-9]{2,3}[0-9]{3,5}[A-Z0-9]{0,3})\b/);
  if (plateMatch) result.licensePlate = plateMatch[1].toUpperCase();

  const amountMatch = text.match(/\$\s*([\d,.]+)/);
  if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(',', ''));

  const dateMatch = text.match(/(?:date|occurred?|transaction)[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i)
    || text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (dateMatch) result.occurrenceDate = dateMatch[1];

  const txMatch = text.match(/(?:transaction|reference|notice)[:\s#]+([A-Z0-9\-]{6,20})/i);
  if (txMatch) result.transactionId = txMatch[1];

  const locMatch = text.match(/(?:bridge|plaza|toll|at)[:\s]+([A-Za-z0-9\s,]{5,40}?)(?:\n|\.|\$)/i);
  if (locMatch) result.location = locMatch[1].trim();

  return result;
}

async function fetchMessage(messageId, accessToken) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Failed to fetch message ${messageId}: ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

  const stats = {
    emails_scanned: 0, turo_found: 0, upcar_found: 0,
    signnow_found: 0, fastrak_found: 0,
    contracts_imported: 0, tolls_imported: 0, skipped: 0,
  };
  const errors = [];
  const rawItems = [];

  // Search relevant senders in last 7 days
  const query = encodeURIComponent(
    'from:(notifications@turo.com OR upcar.com OR mail@signnow.com OR bayareafastrak.org) newer_than:7d'
  );

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${query}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const err = await listRes.text();
    errors.push(`Gmail list error: ${err}`);
    return saveLogAndRespond(base44, stats, errors, rawItems, 'error');
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];
  stats.emails_scanned = messages.length;

  // Load already-processed message IDs from SyncState
  const syncStates = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_processed_ids' });
  const syncRecord = syncStates[0] || null;
  const processedIds = new Set(syncRecord ? JSON.parse(syncRecord.value || '[]') : []);
  const newlyProcessed = [];

  for (const msg of messages) {
    if (processedIds.has(msg.id)) {
      stats.skipped++;
      continue;
    }

    let message;
    try {
      message = await fetchMessage(msg.id, accessToken);
    } catch (e) {
      errors.push(e.message);
      continue;
    }

    const headers = message.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    const from = getHeader('From');
    const subject = getHeader('Subject');
    const dateStr = getHeader('Date');
    const body = extractText(message.payload);

    const source = detectSource(from, subject);
    const item = { subject, from, date: dateStr, source: source || 'unknown', action: 'skipped', extracted: '', skip_reason: '' };

    if (!source) {
      item.skip_reason = 'No matching sender';
      stats.skipped++;
      rawItems.push(item);
      newlyProcessed.push(msg.id);
      continue;
    }

    if (source === 'turo') stats.turo_found++;
    else if (source === 'upcar') stats.upcar_found++;
    else if (source === 'signnow') stats.signnow_found++;
    else if (source === 'fastrak') stats.fastrak_found++;

    try {
      if (source === 'turo' || source === 'upcar') {
        // Only import booking/reservation confirmations
        const isBooking = /reservation|booking|confirmed|new trip|trip started/i.test(subject);
        if (!isBooking) {
          item.skip_reason = 'Not a booking confirmation email';
          item.action = 'skipped';
          stats.skipped++;
        } else {
          const ext = extractTuro(body, subject);
          item.extracted = JSON.stringify(ext);

          if (!ext.renterName) {
            item.skip_reason = 'Could not extract renter name';
            item.action = 'skipped';
            stats.skipped++;
          } else {
            // Check duplicate
            const existing = ext.reservationId
              ? await base44.asServiceRole.entities.RentalContract.filter({ reservation_id: ext.reservationId })
              : [];

            if (existing.length > 0) {
              item.skip_reason = 'Already imported';
              item.action = 'duplicate';
              stats.skipped++;
            } else {
              const now = new Date().toISOString();
              const contract = await base44.asServiceRole.entities.RentalContract.create({
                renter_name: ext.renterName,
                license_plate: ext.licensePlate || '',
                start_date: ext.startDate ? new Date(ext.startDate).toISOString() : now,
                end_date: ext.endDate ? new Date(ext.endDate).toISOString() : now,
                platform: source,
                reservation_id: ext.reservationId || msg.id,
                signature_status: 'signed',
                status: 'active',
              });
              stats.contracts_imported++;
              item.action = 'imported_contract';

              await base44.asServiceRole.entities.Alert.create({
                type: 'trip_ending',
                title: `📧 New ${source === 'turo' ? 'Turo' : 'UpCar'} reservation imported`,
                message: `${ext.renterName} — ${ext.licensePlate || 'no plate'} — ${ext.startDate || '?'} to ${ext.endDate || '?'}`,
                severity: 'info',
                is_read: false,
                renter_name: ext.renterName,
                license_plate: ext.licensePlate,
              });
            }
          }
        }
      } else if (source === 'fastrak') {
        const isNotice = /toll|notice|violation|invoice|unpaid/i.test(subject);
        if (!isNotice) {
          item.skip_reason = 'Not a toll notice email';
          item.action = 'skipped';
          stats.skipped++;
        } else {
          const ext = extractFastrak(body, subject);
          item.extracted = JSON.stringify(ext);

          if (!ext.licensePlate) {
            item.skip_reason = 'Could not extract license plate';
            item.action = 'skipped';
            stats.skipped++;
          } else {
            const existing = ext.transactionId
              ? await base44.asServiceRole.entities.TollNotice.filter({ transaction_id: ext.transactionId })
              : [];

            if (existing.length > 0) {
              item.skip_reason = 'Already imported';
              item.action = 'duplicate';
              stats.skipped++;
            } else {
              await base44.asServiceRole.entities.TollNotice.create({
                license_plate: ext.licensePlate,
                occurrence_date: ext.occurrenceDate || new Date().toISOString().split('T')[0],
                amount: ext.amount || 0,
                agency: 'FasTrak',
                location: ext.location || '',
                transaction_id: ext.transactionId || msg.id,
                match_status: 'unmatched',
                dispute_status: 'not_started',
              });
              stats.tolls_imported++;
              item.action = 'imported_toll';

              await base44.asServiceRole.entities.Alert.create({
                type: 'toll_unmatched',
                title: `📧 New FasTrak toll imported`,
                message: `Plate: ${ext.licensePlate} — $${ext.amount || '?'} — ${ext.location || 'unknown location'}`,
                severity: 'warning',
                is_read: false,
                license_plate: ext.licensePlate,
              });
            }
          }
        }
      } else if (source === 'signnow') {
        item.skip_reason = 'SignNow emails handled by SignNow sync';
        item.action = 'skipped';
        stats.skipped++;
      }
    } catch (e) {
      errors.push(`Error processing ${msg.id}: ${e.message}`);
      item.action = 'error';
      item.skip_reason = e.message;
    }

    rawItems.push(item);
    newlyProcessed.push(msg.id);
  }

  // Persist processed IDs (keep last 500)
  const allProcessed = [...Array.from(processedIds), ...newlyProcessed].slice(-500);
  const now = new Date().toISOString();
  if (syncRecord) {
    await base44.asServiceRole.entities.SyncState.update(syncRecord.id, { value: JSON.stringify(allProcessed), last_synced: now });
  } else {
    await base44.asServiceRole.entities.SyncState.create({ key: 'gmail_processed_ids', value: JSON.stringify(allProcessed), last_synced: now });
  }

  return saveLogAndRespond(base44, stats, errors, rawItems, errors.length > 0 ? 'partial' : 'success');
});

async function saveLogAndRespond(base44, stats, errors, rawItems, status) {
  const logRecord = await base44.asServiceRole.entities.EmailImportLog.create({
    sync_time: new Date().toISOString(),
    ...stats,
    errors,
    raw_items: rawItems.slice(0, 100),
    status,
  });

  return Response.json({ status, ...stats, errors, logId: logRecord.id, rawItems });
}