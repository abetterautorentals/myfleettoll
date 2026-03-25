import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * smartMatch — for a given toll_id, searches for contracts within ±7 days
 * and returns ranked suggestions. Also detects possible trip extensions.
 * If confirm=true and contract_id provided, applies the match.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { toll_id, confirm, contract_id } = await req.json();

  const tolls = await base44.asServiceRole.entities.TollNotice.filter({ id: toll_id });
  const toll = tolls[0];
  if (!toll) return Response.json({ error: 'Toll not found' }, { status: 404 });

  // ── CONFIRM MODE: apply the chosen match ──
  if (confirm && contract_id) {
    const contracts = await base44.asServiceRole.entities.RentalContract.filter({ id: contract_id });
    const contract = contracts[0];
    if (!contract) return Response.json({ error: 'Contract not found' }, { status: 404 });

    const tollDate = new Date(toll.occurrence_date);
    const contractEnd = new Date(contract.end_date);
    const isExtended = tollDate > contractEnd;

    await base44.asServiceRole.entities.TollNotice.update(toll_id, {
      match_status: 'matched',
      matched_contract_id: String(contract.id),
      matched_renter_name: contract.renter_name,
    });

    if (isExtended) {
      await base44.asServiceRole.entities.Alert.create({
        type: 'trip_extended',
        title: '⚠️ Trip Extension Detected',
        message: `${contract.renter_name} (${toll.license_plate}) toll on ${toll.occurrence_date} is AFTER contract end date ${contract.end_date?.split('T')[0]}. Trip likely extended without new contract.`,
        fleet: toll.fleet || contract.fleet,
        severity: 'warning',
        is_read: false,
        license_plate: toll.license_plate,
        renter_name: contract.renter_name,
        related_entity_type: 'toll',
        related_entity_id: toll_id,
      });
    }

    return Response.json({ status: 'matched', extended: isExtended });
  }

  // ── SEARCH MODE: find candidates ──
  const tollDate = new Date(toll.occurrence_date);
  const windowStart = new Date(tollDate);
  windowStart.setDate(windowStart.getDate() - 7);
  const windowEnd = new Date(tollDate);
  windowEnd.setDate(windowEnd.getDate() + 7);

  // Get all contracts for this plate (or all if no plate match)
  let candidates = await base44.asServiceRole.entities.RentalContract.filter({
    license_plate: toll.license_plate,
  });

  // If no plate match, widen search — same fleet, contracts overlapping ±7 day window
  if (candidates.length === 0) {
    const allContracts = await base44.asServiceRole.entities.RentalContract.list('-start_date', 200);
    candidates = allContracts.filter(c => {
      const start = new Date(c.start_date);
      const end = new Date(c.end_date);
      return start <= windowEnd && end >= windowStart;
    });
  }

  // Score each candidate
  const scored = candidates.map(c => {
    const start = new Date(c.start_date);
    const end = new Date(c.end_date);
    let score = 0;
    let flags = [];

    // Plate match = strong signal
    if (c.license_plate === toll.license_plate) score += 50;

    // Toll date within contract = perfect
    if (tollDate >= start && tollDate <= end) {
      score += 40;
    } else {
      // Outside contract window
      const daysAfterEnd = (tollDate - end) / (1000 * 60 * 60 * 24);
      const daysBeforeStart = (start - tollDate) / (1000 * 60 * 60 * 24);

      if (daysAfterEnd > 0 && daysAfterEnd <= 7) {
        score += 20 - daysAfterEnd * 2; // closer = higher
        flags.push(`⚠️ ${Math.round(daysAfterEnd)}d after contract end — possible extension`);
      } else if (daysBeforeStart > 0 && daysBeforeStart <= 7) {
        score += 15 - daysBeforeStart * 2;
        flags.push(`ℹ️ ${Math.round(daysBeforeStart)}d before contract start`);
      } else {
        score -= 20;
      }
    }

    // Active/completed contract = more likely
    if (c.status === 'active' || c.status === 'completed') score += 5;
    if (c.signature_status === 'signed') score += 5;

    return { contract: c, score, flags };
  });

  // Sort by score descending, return top 5
  scored.sort((a, b) => b.score - a.score);
  const suggestions = scored.slice(0, 5).filter(s => s.score > 0).map(s => ({
    id: s.contract.id,
    renter_name: s.contract.renter_name,
    license_plate: s.contract.license_plate,
    start_date: s.contract.start_date,
    end_date: s.contract.end_date,
    platform: s.contract.platform,
    reservation_id: s.contract.reservation_id,
    status: s.contract.status,
    score: s.score,
    flags: s.flags,
    is_best_match: s.score >= 80,
    is_extended: (() => {
      const end = new Date(s.contract.end_date);
      return tollDate > end;
    })(),
  }));

  return Response.json({ suggestions, toll_plate: toll.license_plate, toll_date: toll.occurrence_date });
});