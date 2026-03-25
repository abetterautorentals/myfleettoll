import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];
const FLEETS = ['no_preference', 'concesionario', 'bar_auto_rentals'];
const SOURCES = ['direct', 'turo', 'upcar', 'rentcentric', 'signnow', 'imported'];

export default function CustomerForm({ customer, onClose, onSaved }) {
  const isEdit = !!customer;
  const [form, setForm] = useState({
    full_name: customer?.full_name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    license_number: customer?.license_number || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
    preferred_fleet: customer?.preferred_fleet || 'no_preference',
    preferred_vehicle_type: customer?.preferred_vehicle_type || '',
    loyalty_tier: customer?.loyalty_tier || 'bronze',
    marketing_opt_in: customer?.marketing_opt_in ?? true,
    source: customer?.source || 'direct',
    tags: customer?.tags?.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    if (isEdit) {
      await base44.entities.Customer.update(customer.id, data);
    } else {
      await base44.entities.Customer.create(data);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-background rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-background px-5 pt-5 pb-3 flex items-center justify-between border-b border-border z-10">
          <h2 className="text-lg font-black">{isEdit ? '✏️ Edit Customer' : '👤 New Customer'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-2xl">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <Field label="Full Name *">
            <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="John Doe" className="rounded-xl" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@email.com" type="email" className="rounded-xl" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000" className="rounded-xl" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Driver's License #">
              <Input value={form.license_number} onChange={e => set('license_number', e.target.value)} placeholder="DL12345" className="rounded-xl" />
            </Field>
            <Field label="Preferred Vehicle">
              <Input value={form.preferred_vehicle_type} onChange={e => set('preferred_vehicle_type', e.target.value)} placeholder="SUV, Sedan..." className="rounded-xl" />
            </Field>
          </div>

          <Field label="Address">
            <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, City" className="rounded-xl" />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Loyalty Tier">
              <select value={form.loyalty_tier} onChange={e => set('loyalty_tier', e.target.value)}
                className="w-full h-9 rounded-xl border-2 border-input bg-background px-3 text-sm font-semibold capitalize">
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Preferred Fleet">
              <select value={form.preferred_fleet} onChange={e => set('preferred_fleet', e.target.value)}
                className="w-full h-9 rounded-xl border-2 border-input bg-background px-2 text-xs font-semibold">
                {FLEETS.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Source">
              <select value={form.source} onChange={e => set('source', e.target.value)}
                className="w-full h-9 rounded-xl border-2 border-input bg-background px-2 text-xs font-semibold capitalize">
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Tags (comma-separated)">
            <Input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="vip, repeat, flagged" className="rounded-xl" />
          </Field>

          <Field label="Internal Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Any notes about this customer..."
              className="w-full min-h-[70px] rounded-xl border-2 border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </Field>

          {/* Marketing Opt-In */}
          <div className="flex items-center justify-between bg-green-50 border-2 border-green-200 rounded-2xl px-4 py-3">
            <div>
              <p className="font-bold text-sm text-green-800">📧 Marketing Opt-In</p>
              <p className="text-xs text-green-700">Send promos, car sale offers & loyalty discounts</p>
            </div>
            <button
              onClick={() => set('marketing_opt_in', !form.marketing_opt_in)}
              className={`w-12 h-6 rounded-full transition-all ${form.marketing_opt_in ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-all mx-0.5 ${form.marketing_opt_in ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !form.full_name}
            className="w-full h-12 rounded-2xl font-bold text-base gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Customer'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}