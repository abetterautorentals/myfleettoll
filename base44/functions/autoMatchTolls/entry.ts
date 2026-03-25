import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all unmatched tolls and all contracts (including match_status for backwards compat)
    const unmatchedTolls = await base44.entities.TollNotice.list('-occurrence_date', 500);
    const contracts = await base44.entities.RentalContract.list('-created_date', 1000);

    console.log(`[autoMatchTolls] Found ${unmatchedTolls.length} tolls, ${contracts.length} contracts`);

    let matchedCount = 0;
    const matched = [];

    // Match each unmatched toll to a contract if possible
    for (const toll of unmatchedTolls) {
      // Skip if already has a matched contract ID and status is matched, or not valid
      if (!toll.license_plate || !toll.occurrence_date) continue;
      
      const status = toll.lifecycle_status || toll.match_status || 'unmatched';
      // Skip if already matched (has both status=matched AND contract_id)
      if (status === 'matched' && toll.matched_contract_id) continue;

      // Find matching contract: same plate, toll date within contract date range
      const match = contracts.find(c => {
        if (!c.license_plate || !c.start_date || !c.end_date) return false;
        
        // Normalize plates: remove spaces and common prefixes
        const normalizePlate = (p) => {
          return p.toUpperCase().replace(/\s+/g, '').replace(/^CA|^[A-Z]{2}\d{5}$/, '');
        };
        const tollPlate = normalizePlate(toll.license_plate);
        const contractPlate = normalizePlate(c.license_plate);
        
        // Match full plate or last 7 chars (handles CA prefix variations)
        const fullMatch = tollPlate === contractPlate;
        const lastCharsMatch = tollPlate.length >= 7 && contractPlate.length >= 7 && 
                              tollPlate.slice(-7) === contractPlate.slice(-7);
        
        if (!fullMatch && !lastCharsMatch) return false;
        
        // Parse dates carefully - handle both ISO and date-only formats
        const tollDate = new Date(toll.occurrence_date);
        const startDate = new Date(c.start_date);
        const endDate = new Date(c.end_date);
        
        // Check if dates are valid
        if (isNaN(tollDate.getTime()) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return false;
        }
        
        return tollDate >= startDate && tollDate <= endDate;
      });

      if (match) {
        // Update toll to matched status
        await base44.entities.TollNotice.update(toll.id, {
          lifecycle_status: 'matched',
          match_status: 'matched',
          matched_contract_id: match.id,
          matched_renter_name: match.renter_name,
          matched_platform: match.platform,
        });
        matchedCount++;
        matched.push({ plate: toll.license_plate, date: toll.occurrence_date, renter: match.renter_name });
      }
    }

    return Response.json({
      success: true,
      matched: matchedCount,
      total: unmatchedTolls.length,
      matchedList: matched,
    });
  } catch (error) {
    console.error('[autoMatchTolls] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});