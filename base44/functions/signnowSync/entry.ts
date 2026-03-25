import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SIGNNOW_BASE = 'https://api.signnow.com';

async function signnowGet(path, token) {
  const res = await fetch(`${SIGNNOW_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SignNow API error ${res.status}: ${text}`);
  }
  return res.json();
}

function parseSignNowStatus(doc) {
  // Check all signers/roles
  const roles = doc.roles || [];
  const fieldsWithSigners = doc.fields?.filter(f => f.type === 'signature') || [];

  // If document has an explicit status field
  const status = doc.status?.toLowerCase() || '';
  if (status === 'completed' || status === 'signed') return 'signed';
  if (status === 'expired') return 'expired';

  // Check if all signature fields are filled
  if (fieldsWithSigners.length > 0 && fieldsWithSigners.every(f => f.fulfiller)) return 'signed';

  // Check via signatures array
  const signers = doc.signatures || doc.signature_requests || [];
  if (signers.length > 0 && signers.every(s => s.signed || s.status === 'fulfilled')) return 'signed';

  return 'pending';
}

function extractFromFields(doc) {
  let renterName = '', licensePlate = '', renterEmail = '', renterPhone = '', startDate = '', endDate = '';

  const allFields = [...(doc.fields || []), ...(doc.texts || [])];
  for (const field of allFields) {
    const name = (field.name || field.label || '').toLowerCase();
    const val = field.prefilled_text || field.content || '';
    if (!val) continue;

    if (name.includes('renter') || name.includes('tenant') || (name.includes('name') && !name.includes('last'))) {
      if (!renterName) renterName = val;
    }
    if (name.includes('plate') || name.includes('vehicle') || name.includes('car')) {
      if (!licensePlate) licensePlate = val.toUpperCase().replace(/\s/g, '');
    }
    if (name.includes('email')) {
      if (!renterEmail) renterEmail = val;
    }
    if (name.includes('phone') || name.includes('cell') || name.includes('mobile')) {
      if (!renterPhone) renterPhone = val;
    }
    if (name.includes('start') || name.includes('pickup') || name.includes('from') || name.includes('check_in')) {
      if (!startDate) startDate = val;
    }
    if (name.includes('end') || name.includes('return') || name.includes('to') || name.includes('check_out')) {
      if (!endDate) endDate = val;
    }
  }

  // Fallback: extract from document name
  if (!renterName && doc.document_name) {
    renterName = doc.document_name
      .replace(/rental|agreement|contract|vehicle|lease/gi, '')
      .replace(/[-_]/g, ' ')
      .trim();
  }

  return { renterName, licensePlate, renterEmail, renterPhone, startDate, endDate };
}

function tryParseDate(val) {
  if (!val) return null;
  // Try common date formats
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString();
  // Try MM/DD/YYYY
  const parts = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (parts) {
    const year = parts[3].length === 2 ? '20' + parts[3] : parts[3];
    const parsed = new Date(`${year}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`);
    if (!isNaN(parsed)) return parsed.toISOString();
  }
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = Deno.env.get('SIGNNOW_API_KEY');
  if (!apiKey) return Response.json({ error: 'SIGNNOW_API_KEY not set' }, { status: 500 });

  const debug = [];
  const errors = [];

  // Get last sync time
  const syncStates = await base44.asServiceRole.entities.SyncState.filter({ key: 'signnow_last_sync' });
  const syncRecord = syncStates.length > 0 ? syncStates[0] : null;
  // On first sync, go back 90 days to catch all existing docs
  const lastSync = syncRecord ? new Date(syncRecord.value) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  debug.push(`Last sync: ${lastSync.toISOString()}`);

  // Fetch documents from SignNow
  let docsResponse;
  try {
    docsResponse = await signnowGet('/user/documentsv2?per_page=100&page=1', apiKey);
  } catch (e) {
    errors.push(`Failed to fetch docs: ${e.message}`);
    return Response.json({ status: 'error', errors, debug }, { status: 500 });
  }

  const allDocs = docsResponse?.items || docsResponse?.documents || [];
  debug.push(`Total docs from SignNow: ${allDocs.length}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let alertsCreated = 0;
  const processedDocs = [];

  for (const doc of allDocs) {
    const updatedAt = doc.updated ? new Date(doc.updated * 1000) : new Date(0);
    const docInfo = { id: doc.id, name: doc.document_name, updated: updatedAt.toISOString() };

    // Fetch document detail
    let docDetail;
    try {
      docDetail = await signnowGet(`/document/${doc.id}`, apiKey);
    } catch (e) {
      errors.push(`Failed to fetch doc ${doc.id}: ${e.message}`);
      docInfo.error = e.message;
      processedDocs.push(docInfo);
      continue;
    }

    const sigStatus = parseSignNowStatus(docDetail);
    const isExpired = sigStatus === 'expired';
    const isSigned = sigStatus === 'signed';

    docInfo.sigStatus = sigStatus;

    const { renterName, licensePlate, renterEmail, renterPhone, startDate, endDate } = extractFromFields(docDetail);
    docInfo.renterName = renterName;
    docInfo.licensePlate = licensePlate;

    const startIso = tryParseDate(startDate) || new Date().toISOString();
    const endIso = tryParseDate(endDate) || new Date().toISOString();

    const mappedStatus = isSigned ? 'signed' : isExpired ? 'expired' : 'pending';

    // Check existing contract
    const existing = await base44.asServiceRole.entities.RentalContract.filter({ reservation_id: doc.id });

    if (existing.length > 0) {
      const contract = existing[0];
      const needsUpdate = contract.signature_status !== mappedStatus;
      if (needsUpdate) {
        await base44.asServiceRole.entities.RentalContract.update(contract.id, {
          signature_status: mappedStatus,
          contract_pdf_url: docDetail?.link || contract.contract_pdf_url || '',
        });

        if (isSigned) {
          await base44.asServiceRole.entities.Alert.create({
            type: 'toll_matched',
            title: '✍️ Contract Signed!',
            message: `${contract.renter_name} just signed their contract for ${contract.license_plate || 'vehicle'}`,
            severity: 'success',
            is_read: false,
            renter_name: contract.renter_name,
            license_plate: contract.license_plate,
          });
          alertsCreated++;
        } else if (isExpired) {
          await base44.asServiceRole.entities.Alert.create({
            type: 'pending_signature',
            title: '❌ Contract Expired Unsigned!',
            message: `URGENT: ${contract.renter_name}'s contract for ${contract.license_plate || 'vehicle'} expired without being signed`,
            severity: 'critical',
            is_read: false,
            renter_name: contract.renter_name,
            license_plate: contract.license_plate,
          });
          alertsCreated++;
        }
        updated++;
        docInfo.action = 'updated';
      } else {
        // Check if pending >24h → alert (check once per doc, only if no alert already fired)
        if (mappedStatus === 'pending') {
          const hoursAgo = (Date.now() - updatedAt.getTime()) / 3600000;
          if (hoursAgo > 24) {
            const existingAlerts = await base44.asServiceRole.entities.Alert.filter({
              renter_name: contract.renter_name,
              type: 'pending_signature',
            });
            const alreadyAlerted = existingAlerts.some(a => a.title?.includes('not signed'));
            if (!alreadyAlerted) {
              await base44.asServiceRole.entities.Alert.create({
                type: 'pending_signature',
                title: '⏳ Unsigned Contract 24h+',
                message: `Renter ${contract.renter_name} has not signed contract for ${contract.license_plate || 'vehicle'} — trip starts ${startDate || 'unknown'}`,
                severity: 'warning',
                is_read: false,
                renter_name: contract.renter_name,
                license_plate: contract.license_plate,
              });
              alertsCreated++;
            }
          }
        }
        skipped++;
        docInfo.action = 'no_change';
      }
    } else if (renterName) {
      await base44.asServiceRole.entities.RentalContract.create({
        renter_name: renterName,
        renter_email: renterEmail,
        renter_phone: renterPhone,
        license_plate: licensePlate,
        start_date: startIso,
        end_date: endIso,
        platform: 'signnow',
        reservation_id: doc.id,
        signature_status: mappedStatus,
        status: isSigned ? 'active' : isExpired ? 'cancelled' : 'upcoming',
        contract_pdf_url: docDetail?.link || '',
      });

      if (!isSigned && !isExpired) {
        await base44.asServiceRole.entities.Alert.create({
          type: 'pending_signature',
          title: '✍️ New Unsigned Contract',
          message: `${renterName} has not signed contract for ${licensePlate || 'vehicle'} — trip starts ${startDate || 'unknown'}`,
          severity: 'warning',
          is_read: false,
          renter_name: renterName,
          license_plate: licensePlate,
        });
        alertsCreated++;
      }
      imported++;
      docInfo.action = 'imported';
    } else {
      skipped++;
      docInfo.action = 'skipped_no_renter';
    }

    processedDocs.push(docInfo);
  }

  debug.push(`Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}, Alerts: ${alertsCreated}`);

  // Update sync time
  const now = new Date().toISOString();
  if (syncRecord) {
    await base44.asServiceRole.entities.SyncState.update(syncRecord.id, { value: now, last_synced: now });
  } else {
    await base44.asServiceRole.entities.SyncState.create({ key: 'signnow_last_sync', value: now, last_synced: now });
  }

  return Response.json({
    status: 'ok',
    imported,
    updated,
    skipped,
    alertsCreated,
    totalDocs: allDocs.length,
    debug,
    errors,
    processedDocs,
  });
});