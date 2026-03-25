import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Get the connected account profile
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!profileRes.ok) {
      const err = await profileRes.text();
      return Response.json({ connected: false, error: `Gmail API error: ${err}` });
    }

    const profile = await profileRes.json();

    // Get last sync log
    const logs = await base44.asServiceRole.entities.EmailImportLog.list('-sync_time', 1);
    const lastLog = logs[0] || null;

    return Response.json({
      connected: true,
      email: profile.emailAddress,
      messagesTotal: profile.messagesTotal,
      lastSync: lastLog?.sync_time || null,
      lastSyncStats: lastLog ? {
        scanned: lastLog.emails_scanned,
        imported: (lastLog.contracts_imported || 0) + (lastLog.tolls_imported || 0),
        errors: lastLog.errors?.length || 0,
        status: lastLog.status
      } : null
    });
  } catch (e) {
    return Response.json({ connected: false, error: e.message });
  }
});