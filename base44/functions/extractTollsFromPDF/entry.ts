import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();
  if (!file_url) return Response.json({ error: 'Missing file_url' }, { status: 400 });

  try {
    // Download file and convert to base64
    const fileResp = await fetch(file_url);
    const fileBuffer = await fileResp.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    // Call Claude API directly with base64 document
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: 'Extract every individual toll transaction from this FasTrak notice PDF. Return ONLY a JSON array where each item has: plate, occurrence_date (YYYY-MM-DD), occurrence_time (HH:MM), notification_date (YYYY-MM-DD), amount (number), agency, location, transaction_id. If there are multiple transactions, return all of them as separate items in the array.',
              },
            ],
          },
        ],
      }),
    });

    const claudeData = await claudeResp.json();

    if (!claudeResp.ok) {
      console.error('Claude API error:', claudeData);
      return Response.json({ error: claudeData.error?.message || 'Claude API error', tolls: [] }, { status: 500 });
    }

    // Extract JSON from response
    const responseText = claudeData.content[0]?.text || '[]';
    
    // Parse JSON array
    let tolls = [];
    try {
      const parsed = JSON.parse(responseText);
      tolls = Array.isArray(parsed) ? parsed : [];
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      tolls = [];
    }

    // Normalize field names (Claude returns 'plate' but we use 'license_plate', etc.)
    const normalized = tolls.map(t => ({
      license_plate: t.plate || '',
      occurrence_date: t.occurrence_date || '',
      occurrence_time: t.occurrence_time || '',
      notice_date: t.notification_date || '',
      amount: typeof t.amount === 'number' ? t.amount : 0,
      agency: t.agency || '',
      location: t.location || '',
      transaction_id: t.transaction_id || '',
    }));

    return Response.json({ tolls: normalized });

  } catch (err) {
    console.error('Extraction error:', err.message);
    return Response.json({ error: err.message, tolls: [] }, { status: 500 });
  }
});