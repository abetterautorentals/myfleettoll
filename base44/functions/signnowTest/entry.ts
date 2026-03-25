import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SIGNNOW_BASE = 'https://api.signnow.com';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = Deno.env.get('SIGNNOW_API_KEY');
  if (!apiKey) {
    return Response.json({ success: false, error: 'SIGNNOW_API_KEY is not set in environment secrets.' });
  }

  try {
    const res = await fetch(`${SIGNNOW_BASE}/user`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const body = await res.text();
      return Response.json({ success: false, error: `API returned ${res.status}: ${body}` });
    }

    const data = await res.json();
    return Response.json({
      success: true,
      email: data.email,
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      message: 'Connected successfully ✅'
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message });
  }
});