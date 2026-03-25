import { supabase } from '../integrations/supabase/client';

function toBase64Safe(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(binary);
}

async function callClaude(messages, max_tokens = 2000) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens, messages }),
  });
  const d = await r.json();
  return d.content?.[0]?.text || '';
}

function makeEntity(table) {
  return {
    list: async (order = '-created_at', limit = 200) => {
      const col = order.startsWith('-') ? order.slice(1) : order;
      const asc = !order.startsWith('-');
      const { data } = await supabase.from(table).select('*').order(col, { ascending: asc }).limit(limit);
      return data || [];
    },
    filter: async (filters, order = '-created_at', limit = 200) => {
      const col = (order || 'created_at').replace(/^-/, '');
      const asc = !String(order).startsWith('-');
      let q = supabase.from(table).select('*');
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null) q = q.eq(k, v); });
      const { data } = await q.order(col, { ascending: asc }).limit(limit);
      return data || [];
    },
    get: async (id) => {
      const { data } = await supabase.from(table).select('*').eq('id', id).single();
      return data;
    },
    create: async (obj) => {
      const { data, error } = await supabase.from(table).insert(obj).select().single();
      if (error) throw error;
      return data;
    },
    update: async (id, updates) => {
      const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

const entities = {
  TollNotice: makeEntity('toll_notices'),
  RentalContract: makeEntity('rental_contracts'),
  Vehicle: makeEntity('vehicles'),
  Customer: makeEntity('customers'),
  Fleet: makeEntity('fleets'),
  Alert: makeEntity('alerts'),
  Tenant: makeEntity('tenants'),
  AdminLog: makeEntity('admin_logs'),
};

export const base44 = {
  entities,
  asServiceRole: { entities },
  auth: {
    me: async () => {
      return { id: 'owner', email: 'lizzethamaya211@gmail.com', full_name: 'Lizzeth Amaya', role: 'admin' };
    },
    logout: async () => {},
  },
  functions: {
    invoke: async (name, payload = {}) => {
      if (name === 'extractTollsFromPDF' || name === 'extractDocumentData') {
        const { file_url } = payload;
        const resp = await fetch(file_url);
        const buf = await resp.arrayBuffer();
        const b64 = toBase64Safe(buf);
        const txt = await callClaude([{role:'user',content:[
          {type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}},
          {type:'text',text:'Extract ALL toll transactions. Return ONLY JSON:\n{"success":true,"data":{"response":{"tolls":[{"license_plate":"UPPERCASE","occurrence_date":"YYYY-MM-DD","notice_date":"YYYY-MM-DD","occurrence_time":"HH:MM","amount":0,"agency":"string","location":"string","transaction_id":"string","is_violation":false}]}}}'}
        ]}], 4000);
        try { return { data: JSON.parse(txt.replace(/```json|```/g,'').trim()) }; }
        catch { return { data: { success: false, error: 'Parse error' } }; }
      }
      if (name === 'extractMultipleContracts' || name === 'extractPDFPages') {
        const { file_url } = payload;
        const resp = await fetch(file_url);
        const buf = await resp.arrayBuffer();
        const b64 = toBase64Safe(buf);
        const txt = await callClaude([{role:'user',content:[
          {type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}},
          {type:'text',text:'Extract rental contracts. Return ONLY JSON:\n{"contracts":[{"renter_name":"string","renter_email":"string","renter_phone":"string","license_plate":"UPPERCASE","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","platform":"turo","reservation_id":"string","signature_status":"signed"}]}'}
        ]}]);
        try { return { data: JSON.parse(txt.replace(/```json|```/g,'').trim()) }; }
        catch { return { data: { contracts: [] } }; }
      }
      if (name === 'autoMatchTolls' || name === 'logAdminFailure' || name === 'smartMatch' || name === 'generateDisputePDF' || name === 'buildDisputePackage') {
        return { data: { success: true } };
      }
      return { data: { success: false, error: 'Unknown function: ' + name } };
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const fileName = 'tolls/' + Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const { error } = await supabase.storage.from('toll-files').upload(fileName, file, { upsert: true });
        if (error) throw new Error(error.message);
        const { data: { publicUrl } } = supabase.storage.from('toll-files').getPublicUrl(fileName);
        return { file_url: publicUrl };
      }
    }
  },
  toBase64Safe,
  callClaude,
};

export default base44;
