import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, doc_type, license_plate: rawPlate } = await req.json();
    if (!file_url) return Response.json({ error: 'Missing file_url' }, { status: 400 });

    // Normalize plate: remove spaces, uppercase
    const license_plate = rawPlate ? rawPlate.replace(/\s+/g, '').toUpperCase() : null;
    const effectiveDocType = doc_type || 'toll';
    console.log(`[scannerOCR] Processing ${effectiveDocType} for plate=${license_plate}, url=${file_url.substring(0, 80)}`);

    // Use Claude vision to extract data
    let response;
    try {
      response = await base44.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        file_urls: [file_url],
        prompt: getPromptForDocType(effectiveDocType, license_plate),
        response_json_schema: getSchemaForDocType(effectiveDocType),
      });
      console.log('[scannerOCR] LLM extraction complete, keys:', Object.keys(response || {}));
    } catch (llmErr) {
      console.error('[scannerOCR] LLM call failed:', llmErr.message);
      return Response.json({ error: 'OCR failed: ' + llmErr.message, ocr_failed: true }, { status: 500 });
    }

    console.log('[scannerOCR] Extraction complete');

    // If it's a toll, try to auto-create TollNotice record
    if (effectiveDocType === 'toll' && response.tolls && Array.isArray(response.tolls)) {
      const tenant = await base44.asServiceRole.entities.Tenant.filter({
        owner_user_id: user.id,
      });
      const tenantId = tenant[0]?.id || user.id;

      for (const toll of response.tolls) {
        try {
          await base44.asServiceRole.entities.TollNotice.create({
            tenant_id: tenantId,
            license_plate: license_plate || toll.license_plate,
            occurrence_date: toll.occurrence_date,
            occurrence_time: toll.occurrence_time || null,
            notice_date: toll.notice_date || new Date().toISOString().split('T')[0],
            amount: parseFloat(toll.amount) || 0,
            agency: toll.agency || 'Unknown',
            location: toll.location || 'Unknown',
            transaction_id: toll.transaction_id || `SCAN-${Date.now()}`,
            fleet: toll.fleet || null,
            notice_image_urls: [file_url],
            match_status: 'unmatched',
            is_violation: false,
          });
          console.log(`[scannerOCR] Created TollNotice: ${toll.transaction_id}`);
        } catch (err) {
          console.error('[scannerOCR] Failed to create toll record:', err.message);
        }
      }
    }

    // Normalize any extracted plate from OCR — add CA prefix if missing
    const normPlate = (p) => {
      if (!p) return null;
      const clean = p.replace(/\s+/g, '').toUpperCase();
      return clean.startsWith('CA') ? clean : `CA${clean}`;
    };
    let extractedPlate = null;
    let plateConfidence = 0;
    if (effectiveDocType === 'toll') {
      if (response.license_plate) {
        extractedPlate = normPlate(response.license_plate);
        plateConfidence = response.plate_confidence || 80;
      } else if (response.tolls?.[0]?.license_plate) {
        extractedPlate = normPlate(response.tolls[0].license_plate);
        plateConfidence = 70;
      }
    } else if (effectiveDocType === 'contract' && response.license_plate) {
      extractedPlate = normPlate(response.license_plate);
      plateConfidence = 90;
    } else if (response.license_plate) {
      extractedPlate = normPlate(response.license_plate);
      plateConfidence = response.plate_confidence || 70;
    }

    // Also extract quick transaction summary for display
    const transactions = response.tolls?.map(t => ({
      date: t.occurrence_date,
      time: t.occurrence_time,
      amount: t.amount,
      location: t.location,
      transaction_id: t.transaction_id,
    })) || [];

    return Response.json({
      success: true,
      doc_type: effectiveDocType,
      license_plate: license_plate || extractedPlate,
      extracted_plate: extractedPlate,
      plate_confidence: plateConfidence,
      transactions,
      toll_count: response.tolls?.length || 0,
      summary: response.summary || `Extracted ${response.tolls?.length || 1} item(s)`,
      data: response,
    });

  } catch (error) {
    console.error('[scannerOCR] Error:', error);
    return Response.json({
      error: error.message || 'OCR processing failed',
    }, { status: 500 });
  }
});

function getPromptForDocType(docType, licensePlate) {
  if (docType === 'toll') {
    return `This is a FasTrak toll notice, toll evasion notice, or parking violation. Extract ALL fields carefully.

**FIRST: Look for this document type:**
- FasTrak NOTICE OF TOLL EVASION: Look for "Violation Number", "Notice of Toll Evasion", "Toll Amount", "Penalty Amount", "Total Amount Due"
- FasTrak toll/violation: Look for "Transaction ID", "Toll Amount", "Express Lane"
- Parking violation: Look for "Violation Number", "Violation Date", "Fine Due"

**STEP 1 - FIND LICENSE PLATE:**
Search for plate near: "Vehicle", "License Plate", "Plate Number", "License #", or in a bordered section.
California plates: Usually 7 chars like "9ABC123" or "ABC9123" or can be written as "CA 9ABC123".
Always return plate WITHOUT spaces, uppercase.
${licensePlate ? `The known plate is: ${licensePlate}` : 'Search carefully for the plate on this document.'}

**STEP 2 - EXTRACT VIOLATION/TRANSACTION DETAILS:**
- violation_number OR transaction_id: The primary identifier (most important)
- occurrence_date: YYYY-MM-DD (when the toll was incurred or violation occurred — NOT the notice date)
- occurrence_time: HH:MM format or null
- toll_amount: The base toll charge
- penalty_amount: Any penalties/fees (for evasion notices)
- total_amount_due: Sum of all amounts owed
- location: Where the toll plaza is or where violation occurred
- agency: FasTrak, MTC, parking authority, etc.
- notice_date: YYYY-MM-DD when this notice was issued
- due_date: YYYY-MM-DD payment due date if shown

**STEP 3 - RETURN JSON:**
{
  "license_plate": "9ABC123 or null",
  "plate_confidence": 90,
  "tolls": [{
    "transaction_id": "T682660762384 or violation number",
    "occurrence_date": "YYYY-MM-DD",
    "occurrence_time": "HH:MM or null",
    "amount": 4.30,
    "penalty_amount": 10.00,
    "total_amount_due": 14.30,
    "location": "I-680 or full location",
    "agency": "FasTrak",
    "notice_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD or null",
    "is_violation": true
  }],
  "summary": "FasTrak evasion notice: CA9ABC123, $14.30 total due by 04/09/26"
}`;
  } else if (docType === 'violation') {
    return `Extract parking violation and traffic violation data from this document.

Look for:
- Violation date and time
- Location where violation occurred
- Violation code/type
- Amount/fine due
- Agency issuing violation
- Vehicle plate (or use provided: ${licensePlate})

Return:
{
  "violations": [array of violations],
  "summary": "brief summary"
}`;
  } else if (docType === 'contract') {
    return `Extract rental contract information from this document.

Extract:
- Renter name
- Email and phone
- Start date and end date of rental
- Vehicle make, model, year, color, plate
- Rental platform (Turo, Upcar, etc.)
- Reservation ID / Contract ID
- Signature status (signed/pending)

Return:
{
  "renter_name": "...",
  "renter_email": "...",
  "renter_phone": "...",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "vehicle_make": "...",
  "vehicle_model": "...",
  "vehicle_year": "...",
  "vehicle_color": "...",
  "license_plate": "${licensePlate}",
  "platform": "...",
  "reservation_id": "...",
  "signature_status": "...",
  "summary": "brief summary"
}`;
  } else {
    return `Extract all readable text and structured information from this document. Return as JSON with a "summary" field.`;
  }
}

function getSchemaForDocType(docType) {
  if (docType === 'toll') {
    return {
      type: 'object',
      properties: {
        license_plate: { type: 'string' },
        plate_confidence: { type: 'number' },
        summary: { type: 'string' },
        tolls: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              transaction_id: { type: 'string' },
              occurrence_date: { type: 'string' },
              occurrence_time: { type: 'string' },
              amount: { type: 'number' },
              penalty_amount: { type: 'number' },
              total_amount_due: { type: 'number' },
              location: { type: 'string' },
              agency: { type: 'string' },
              notice_date: { type: 'string' },
              due_date: { type: 'string' },
              license_plate: { type: 'string' },
              is_violation: { type: 'boolean' },
            },
          },
        },
      },
    };
  } else if (docType === 'violation') {
    return {
      type: 'object',
      properties: {
        violations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              time: { type: 'string' },
              location: { type: 'string' },
              code: { type: 'string' },
              amount: { type: 'number' },
              agency: { type: 'string' },
            },
          },
        },
        summary: { type: 'string' },
      },
    };
  } else if (docType === 'contract') {
    return {
      type: 'object',
      properties: {
        renter_name: { type: 'string' },
        renter_email: { type: 'string' },
        renter_phone: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        vehicle_make: { type: 'string' },
        vehicle_model: { type: 'string' },
        vehicle_year: { type: 'string' },
        vehicle_color: { type: 'string' },
        license_plate: { type: 'string' },
        platform: { type: 'string' },
        reservation_id: { type: 'string' },
        signature_status: { type: 'string' },
        summary: { type: 'string' },
      },
    };
  } else {
    return {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        extracted_text: { type: 'string' },
      },
    };
  }
}