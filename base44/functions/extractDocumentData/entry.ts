import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  let base44, user, file_url, document_type;
  
  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    file_url = body.file_url;
    document_type = body.document_type;
    if (!file_url) return Response.json({ error: 'Missing file_url' }, { status: 400 });

    // Use Claude Sonnet 4.6 for best extraction quality
    const result = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      file_urls: [file_url],
      add_context_from_internet: false,
      prompt: document_type === 'toll' 
        ? generateTollPrompt()
        : generateContractPrompt(),
      response_json_schema: document_type === 'toll'
        ? getTollSchema()
        : getContractSchema(),
    });

    return Response.json({
      success: true,
      data: result,
      confidence: calculateConfidence(result, document_type),
      document_type
    });
  } catch (error) {
    // Log the failure
    if (base44 && user?.id) {
      try {
        await base44.asServiceRole.functions.invoke('logAdminFailure', {
          tenant_id: user.id,
          log_type: 'extraction_failure',
          severity: 'high',
          title: 'Document Extraction Failed',
          message: error.message,
          file_url: file_url || null,
          error_stack: error.stack,
        });
      } catch (logErr) {
        console.error('Failed to log extraction error:', logErr.message);
      }
    }

    console.error('Extraction error:', error.message);
    return Response.json({
      error: error.message,
      success: false,
      data: null
    }, { status: 500 });
  }
});

function generateTollPrompt() {
  return `You are a document extraction expert. Extract ALL toll transaction data from this document.

For EACH toll found, extract:
- license_plate: The exact vehicle license plate (uppercase, e.g., "ABC 1234")
- renter_name: Name of the person who rented the vehicle (if available)
- reservation_number: Rental platform confirmation/reservation number
- rental_platform: Platform used (turo, upcar, rentcentric, signnow, direct, docusign, or unknown)
- occurrence_date: Date vehicle passed toll in YYYY-MM-DD format (THIS IS CRITICAL - use toll/transaction date, NEVER notice date)
- occurrence_time: Time in HH:MM 24-hour format (if available)
- notice_date: Date the notice was sent in YYYY-MM-DD format
- amount: Toll charge amount as a number (e.g., 5.50)
- agency: Toll agency name (FasTrak, Bay Area Toll, Golden Gate Bridge, etc.)
- location: Toll location/plaza/corridor

CRITICAL RULES:
1. occurrence_date is when the toll was incurred, NOT when the notice was sent
2. Extract EVERY toll from multi-page documents - process page by page
3. Return empty tolls array if NO tolls found
4. Include ALL available fields, even partial information
5. Be exact with dates and amounts - these are critical for matching

Return as JSON with "tolls" array containing all extracted tolls.`;
}

function generateContractPrompt() {
  return `Extract rental contract information from this document.

Extract:
- renter_name: Full name of the renter
- renter_email: Email address
- renter_phone: Phone number
- license_plate: Vehicle license plate
- start_date: Rental start date (ISO 8601 format)
- end_date: Rental end date (ISO 8601 format)
- platform: Rental platform (turo, upcar, rentcentric, signnow, direct, docusign)
- reservation_id: Confirmation/reservation number
- vehicle_make: Vehicle make/brand
- vehicle_model: Vehicle model
- vehicle_year: Year
- vehicle_color: Color

Return as JSON object with extracted fields.`;
}

function getTollSchema() {
  return {
    type: 'object',
    properties: {
      tolls: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            license_plate: { type: 'string' },
            renter_name: { type: 'string' },
            reservation_number: { type: 'string' },
            rental_platform: { type: 'string' },
            occurrence_date: { type: 'string' },
            occurrence_time: { type: 'string' },
            notice_date: { type: 'string' },
            amount: { type: 'number' },
            agency: { type: 'string' },
            location: { type: 'string' },
          },
          required: ['license_plate', 'occurrence_date', 'amount']
        }
      }
    }
  };
}

function getContractSchema() {
  return {
    type: 'object',
    properties: {
      renter_name: { type: 'string' },
      renter_email: { type: 'string' },
      renter_phone: { type: 'string' },
      license_plate: { type: 'string' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      platform: { type: 'string' },
      reservation_id: { type: 'string' },
      vehicle_make: { type: 'string' },
      vehicle_model: { type: 'string' },
      vehicle_year: { type: 'string' },
      vehicle_color: { type: 'string' },
    },
    required: ['renter_name', 'license_plate', 'start_date', 'end_date']
  };
}

function calculateConfidence(data, documentType) {
  if (documentType === 'toll') {
    if (!data?.tolls || data.tolls.length === 0) return 0;
    const toll = data.tolls[0];
    let confidence = 50; // base
    if (toll.license_plate) confidence += 15;
    if (toll.occurrence_date) confidence += 15;
    if (toll.amount) confidence += 10;
    if (toll.agency) confidence += 5;
    if (toll.location) confidence += 5;
    return Math.min(confidence, 100);
  }
  
  if (documentType === 'contract') {
    let confidence = 50;
    if (data?.renter_name) confidence += 15;
    if (data?.license_plate) confidence += 15;
    if (data?.start_date) confidence += 10;
    if (data?.end_date) confidence += 10;
    return Math.min(confidence, 100);
  }
  
  return 50;
}