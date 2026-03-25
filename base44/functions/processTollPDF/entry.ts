import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'Missing file_url' }, { status: 400 });

    // Use Claude Sonnet 4.6 which is best for document analysis
    const result = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      file_urls: [file_url],
      prompt: `Extract ALL toll transactions from this PDF/image. 
For EACH individual toll found, extract:
- license_plate: exact license plate (e.g. "ABC 1234")
- occurrence_date: date vehicle passed toll in YYYY-MM-DD format (use the toll date, NOT the notice date)
- occurrence_time: time in HH:MM 24-hour format
- notice_date: date the notice was sent (YYYY-MM-DD)
- amount: toll amount as number (e.g. 5.50)
- agency: toll agency name (FasTrak, Bay Area Toll, etc)
- location: toll location/plaza name
- transaction_id: transaction or notice ID shown on document

CRITICAL: Process the entire PDF page by page. If it's a multi-page PDF, extract tolls from every page.
If the same toll appears multiple times, list it separately (duplicate detection will happen later).
Return as JSON with "tolls" array. If NO tolls found, return empty array.`,
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
                notice_date: { type: 'string' },
                amount: { type: 'number' },
                agency: { type: 'string' },
                location: { type: 'string' },
                transaction_id: { type: 'string' },
              },
              required: ['license_plate', 'occurrence_date', 'amount']
            }
          }
        }
      }
    });

    return Response.json({
      success: true,
      tolls: result?.tolls || [],
      message: `Extracted ${result?.tolls?.length || 0} toll(s)`
    });
  } catch (error) {
    // Log the failure for admin review
    try {
      await base44.asServiceRole.functions.invoke('logAdminFailure', {
        tenant_id: user?.id,
        log_type: 'ocr_failure',
        severity: 'high',
        title: 'PDF Extraction Failed',
        message: error.message,
        file_url: file_url || null,
        error_stack: error.stack,
      });
    } catch (logErr) {
      console.error('Failed to log extraction error:', logErr);
    }
    
    return Response.json({
      error: error.message,
      success: false,
      tolls: []
    }, { status: 500 });
  }
});