import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Users, DollarSign, TrendingUp, AlertTriangle, Eye, Gift, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { PLANS } from '@/lib/TenantContext';

const planColors = {
  starter: 'bg-blue-100 text-blue-700',
  professional: 'bg-purple-100 text-purple-700',
  business: 'bg-amber-100 text-amber-700',
  owner: 'bg-green-100 text-green-700',
  free: 'bg-gray-100 text-gray-600',
};

export default function AdminDashboard() {
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const queryClient = useQueryClient();

  const { data: tenants = [] } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date', 500),
  });

  const { data: errors = [] } = useQuery({
    queryKey: ['error-logs'],
    queryFn: () => base44.entities.ErrorLog.filter({ is_resolved: false }),
  });

  const updateTenantMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tenant.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }),
  });

  const filtered = tenants.filter(t =>
    t.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  const activeSubscriptions = tenants.filter(t => t.subscription_status === 'active' || t.subscription_status === 'trialing');
  const mrr = tenants.filter(t => t.subscription_status === 'active').reduce((s, t) => s + (PLANS[t.subscription_plan]?.price || 0) * (1 - (t.discount_percent || 0) / 100), 0);
  const totalTolls = tenants.reduce((s, t) => s + (t.total_tolls_processed || 0), 0);

  return (
    <div className="p-4 max-w-4xl mx-auto pb-20">
      <div className="pt-4 pb-3">
        <h1 className="text-2xl font-black flex items-center gap-2">🛡️ Owner Dashboard</h1>
        <p className="text-xs text-muted-foreground font-semibold">FleetToll Pro — Admin View</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-primary/10 border-2 border-primary/20 rounded-2xl p-4">
          <p className="text-2xl font-black text-primary">{activeSubscriptions.length}</p>
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 mt-0.5"><Users className="w-3 h-3" /> Active Customers</p>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
          <p className="text-2xl font-black text-green-700">${mrr.toFixed(0)}</p>
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 mt-0.5"><DollarSign className="w-3 h-3" /> MRR</p>
        </div>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
          <p className="text-2xl font-black text-blue-700">{totalTolls}</p>
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 mt-0.5"><TrendingUp className="w-3 h-3" /> Total Tolls</p>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <p className="text-2xl font-black text-red-700">{errors.length}</p>
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" /> Open Errors</p>
        </div>
      </div>

      {/* Projection */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 mb-5 text-xs">
        <p className="font-black text-amber-800 mb-1">💰 Revenue Projection</p>
        <p className="text-amber-700">At 50 Professional customers → <span className="font-black">${(50 * 49).toLocaleString()}/mo</span> revenue</p>
        <p className="text-amber-700">Costs: Base44 $40 + API ~${(totalTolls * 0.01).toFixed(0)} = ${(40 + totalTolls * 0.01).toFixed(0)}/mo</p>
        <p className="font-black text-amber-800 mt-1">Net margin: {mrr > 0 ? Math.round(((mrr - 40 - totalTolls * 0.01) / mrr) * 100) : 0}%</p>
      </div>

      {/* Customer List */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-2xl" />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-card border-2 border-border rounded-2xl p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-sm">{t.company_name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${planColors[t.subscription_plan] || 'bg-secondary text-muted-foreground'}`}>
                    {t.subscription_plan}
                  </span>
                  {t.subscription_status === 'past_due' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">PAST DUE</span>
                  )}
                  {t.free_access && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">FREE</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t.owner_email}</p>
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>📊 {t.total_tolls_processed || 0} tolls</span>
                  <span>📄 {t.pdfs_generated || 0} PDFs</span>
                  {t.last_login && <span>🕐 {format(new Date(t.last_login), 'MMM d')}</span>}
                  {t.discount_percent > 0 && <span className="text-green-600 font-bold">-{t.discount_percent}%</span>}
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <button onClick={() => setSelectedTenant(t)}
                  className="p-2 rounded-xl bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => updateTenantMutation.mutate({ id: t.id, data: { free_access: !t.free_access } })}
                  className={`p-2 rounded-xl transition-colors ${t.free_access ? 'bg-green-100 text-green-700' : 'bg-secondary hover:bg-green-100 hover:text-green-700'}`}>
                  <Gift className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Error Logs */}
      {errors.length > 0 && (
        <div className="mt-6">
          <h2 className="font-black text-base mb-2">🐛 Open Error Logs ({errors.length})</h2>
          <div className="space-y-2">
            {errors.slice(0, 10).map(e => (
              <div key={e.id} className="bg-red-50 border-2 border-red-200 rounded-2xl p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-red-700">{e.error_message?.slice(0, 100)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{e.page} • {e.user_email} • ×{e.occurrence_count}</p>
                  </div>
                  <button onClick={() => base44.entities.ErrorLog.update(e.id, { is_resolved: true }).then(() => queryClient.invalidateQueries({ queryKey: ['error-logs'] }))}
                    className="p-1 text-muted-foreground hover:text-green-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tenant Detail Modal */}
      {selectedTenant && (
        <TenantDetailModal tenant={selectedTenant} onClose={() => setSelectedTenant(null)}
          onUpdate={(data) => { updateTenantMutation.mutate({ id: selectedTenant.id, data }); setSelectedTenant(null); }} />
      )}
    </div>
  );
}

function TenantDetailModal({ tenant, onClose, onUpdate }) {
  const [notes, setNotes] = useState(tenant.notes || '');
  const [discount, setDiscount] = useState(tenant.discount_percent || 0);
  const [plan, setPlan] = useState(tenant.subscription_plan);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-card rounded-3xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg">{tenant.company_name}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground">{tenant.owner_email}</p>
        <div>
          <label className="text-xs font-bold mb-1 block">Plan Override</label>
          <select value={plan} onChange={e => setPlan(e.target.value)} className="w-full h-10 rounded-xl border border-border px-3 text-sm font-bold bg-background">
            {Object.keys(PLANS).map(p => <option key={p} value={p}>{PLANS[p].name} — ${PLANS[p].price}/mo</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold mb-1 block">Discount % (0–100)</label>
          <Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} min={0} max={100} className="h-10 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-bold mb-1 block">Internal Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background resize-none" />
        </div>
        <Button onClick={() => onUpdate({ notes, discount_percent: discount, subscription_plan: plan })}
          className="w-full h-11 rounded-2xl font-bold">
          Save Changes
        </Button>
      </motion.div>
    </div>
  );
}