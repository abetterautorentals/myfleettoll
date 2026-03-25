import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { image_data_url, page_num, total_pages } = await req.json();
    if (!image_data_url) return Response.json({ error: 'Missing image_data_url' }, { status: 400 });

    console.log(`[extractTollsFromImage] Processing page ${page_num}/${total_pages}`);

    // Call Claude with the image to extract tolls
    const response = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      file_urls: [image_data_url],
      prompt: `You are a toll document extraction expert. Extract ALL toll transactions from this document page.

CRITICAL INSTRUCTIONS:
- Extract EVERY toll transaction visible on this page
- For each toll, extract: transaction_id, occurrence_date (YYYY-MM-DD), occurrence_time (HH:MM), location, agency, amount, license_plate
- OCCURRENCE_DATE is when the car passed the toll, NOT when notice was sent
- Look for dates in format like "01/15/2025" and convert to "2025-01-15"
- Times should be 24-hour format like "14:30"
- If any field is not clearly visible, return "<UNKNOWN>" for that field
- Check for VIOLATION indicators (fines, traffic violations, etc.)
- If amount starts with $ or ends with amount-like text, extract just the number

Return ONLY a JSON object:
{
  "tolls": [
    {
      "license_plate": "ABC1234",
      "occurrence_date": "2025-01-15",
      "occurrence_time": "14:30",
      "location": "Bay Bridge",
      "agency": "FasTrak",
      "amount": 5.50,
      "transaction_id": "TXN123456",
      "is_violation": false
    }
  ],
  "summary": "Found X toll(s) on this page"
}`,
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
                location: { type: 'string' },
                agency: { type: 'string' },
                amount: { type: 'number' },
                transaction_id: { type: 'string' },
                is_violation: { type: 'boolean' },
              },
            },
          },
          summary: { type: 'string' },
        },
      },
    });

    console.log(`[extractTollsFromImage] Page ${page_num} extracted: ${response.tolls?.length || 0} tolls found`);

    return Response.json({
      success: true,
      page_num,
      total_pages,
      tolls: response.tolls || [],
      summary: response.summary,
    });

  } catch (error) {
    console.error('[extractTollsFromImage] Error:', error);
    return Response.json({
      error: error.message || 'Image extraction failed',
    }, { status: 500 });
  }
});