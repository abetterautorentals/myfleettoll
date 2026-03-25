import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenant_id, log_type, severity = 'medium', title, message, file_name, file_url, toll_id, contract_id, extracted_data, error_stack } = await req.json();

    if (!tenant_id || !log_type || !title || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Log to AdminLog entity
    await base44.asServiceRole.entities.AdminLog.create({
      tenant_id,
      log_type,
      severity,
      title,
      message,
      file_name: file_name || null,
      file_url: file_url || null,
      toll_id: toll_id || null,
      contract_id: contract_id || null,
      extracted_data: extracted_data || null,
      error_stack: error_stack || null,
      is_resolved: false,
    });

    // If critical, email the owner
    if (severity === 'critical' || severity === 'high') {
      const ownerEmail = Deno.env.get('OWNER_EMAIL');
      if (ownerEmail) {
        await base44.integrations.Core.SendEmail({
          to: ownerEmail,
          subject: `🚨 [${log_type}] ${title}`,
          body: `Tenant: ${tenant_id}\nSeverity: ${severity}\n\n${message}\n\n${file_name ? `File: ${file_name}` : ''}\n${error_stack ? `\nStack:\n${error_stack}` : ''}`,
        });
      }
    }

    return Response.json({ success: true, logged: true });
  } catch (error) {
    console.error('logAdminFailure error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});