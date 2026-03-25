import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, Mail, Car, Receipt, Star, Edit3, Tag, MapPin, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import CustomerForm from './CustomerForm';

const tierConfig = {
  bronze:   { color: 'text-orange-600 bg-orange-50',   icon: '🥉', label: 'Bronze' },
  silver:   { color: 'text-gray-600 bg-gray-100',      icon: '🥈', label: 'Silver' },
  gold:     { color: 'text-yellow-600 bg-yellow-50',   icon: '🥇', label: 'Gold' },
  platinum: { color: 'text-violet-600 bg-violet-50',   icon: '💎', label: 'Platinum' },
};

export default function CustomerProfile({ customer, contracts, tolls, onBack, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const queryClient = useQueryClient();

  const tier = tierConfig[customer.loyalty_tier] || tierConfig.bronze;

  // Tolls matched to this customer's contracts
  const customerTolls = tolls.filter(t =>
    contracts.some(c => c.id === t.matched_contract_id)
  );
  const totalTollAmount = customerTolls.reduce((s, t) => s + (t.amount || 0), 0);

  // Outstanding = tolls that are NOT resolved/archived
  const outstandingTolls = customerTolls.filter(t => {
    const ls = t.lifecycle_status || (t.match_status === 'matched' ? 'matched' : 'unmatched');
    return !['resolved', 'archived'].includes(ls);
  });
  const outstandingAmount = outstandingTolls.reduce((s, t) => s + (t.amount || 0), 0);
  const paidAmount = totalTollAmount - outstandingAmount;

  const handleSendPromo = async () => {
    if (!customer.email) return;
    setSending(true);
    await base44.integrations.Core.SendEmail({
      to: customer.email,
      subject: `🚗 Special offer just for you, ${customer.full_name?.split(' ')[0]}!`,
      body: `Hi ${customer.full_name},\n\nThank you for being a valued customer! As a ${tier.label} member, we have exclusive offers waiting for you.\n\nContact us to learn about our latest deals and loyalty discounts.\n\nBest,\nThe Fleet Team`,
    });
    setSent(true);
    setSending(false);
  };

  if (editing) {
    return (
      <CustomerForm
        customer={customer}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); onUpdated(); }}
      />
    );
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-2xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-black flex-1">Customer Profile</h1>
        <Button variant="outline" size="icon" onClick={() => setEditing(true)} className="rounded-2xl">
          <Edit3 className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-4 space-y-4">
        {/* Identity Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border-2 border-border rounded-3xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-black text-primary flex-shrink-0">
              {customer.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black">{customer.full_name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.color}`}>
                  {tier.icon} {tier.label} Member
                </span>
                {customer.marketing_opt_in && (
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">📧 Promo OK</span>
                )}
                {customer.source && (
                  <span className="text-[10px] font-bold bg-secondary text-muted-foreground px-2 py-0.5 rounded-full capitalize">{customer.source}</span>
                )}
              </div>
              {customer.tags?.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {customer.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" /> {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-4 space-y-2">
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Mail className="w-4 h-4 text-primary" /> {customer.email}
              </a>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Phone className="w-4 h-4 text-primary" /> {customer.phone}
              </a>
            )}
            {customer.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary" /> {customer.address}
              </div>
            )}
            {customer.license_number && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-lg">🪪</span> DL: <span className="font-semibold text-foreground">{customer.license_number}</span>
              </div>
            )}
          </div>

          {/* Preferences */}
          {(customer.preferred_fleet !== 'no_preference' || customer.preferred_vehicle_type) && (
            <div className="mt-3 pt-3 border-t border-border flex gap-3 flex-wrap">
              {customer.preferred_fleet !== 'no_preference' && (
                <span className="text-xs text-muted-foreground">
                  🏢 Prefers: <span className="font-bold text-foreground capitalize">{customer.preferred_fleet?.replace(/_/g, ' ')}</span>
                </span>
              )}
              {customer.preferred_vehicle_type && (
                <span className="text-xs text-muted-foreground">
                  🚗 Vehicle: <span className="font-bold text-foreground">{customer.preferred_vehicle_type}</span>
                </span>
              )}
            </div>
          )}

          {customer.notes && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground font-semibold">📝 Notes</p>
              <p className="text-sm mt-1">{customer.notes}</p>
            </div>
          )}
        </motion.div>

        {/* Insurance Info */}
         {(customer.insurance_company || customer.insurance_policy || customer.insurance_phone) && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
             className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
             <p className="text-xs font-black text-blue-700 mb-2">🛡️ Insurance</p>
             <div className="space-y-1">
               {customer.insurance_company && <p className="text-sm font-bold">{customer.insurance_company}</p>}
               {customer.insurance_policy && <p className="text-xs text-muted-foreground">Policy: <span className="font-semibold text-foreground">{customer.insurance_policy}</span></p>}
               {customer.insurance_phone && (
                 <a href={`tel:${customer.insurance_phone}`} className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline">
                   <Phone className="w-3 h-3" /> {customer.insurance_phone}
                 </a>
               )}
             </div>
           </motion.div>
         )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-950/30 border-2 border-blue-600 rounded-2xl p-3 text-center">
            <p className="text-xl font-black text-blue-300">{contracts.length}</p>
            <p className="text-[10px] font-bold text-blue-400">🚗 Rentals</p>
          </div>
          <div className="bg-secondary border-2 border-border rounded-2xl p-3 text-center">
            <p className="text-xl font-black">${totalTollAmount.toFixed(0)}</p>
            <p className="text-[10px] font-bold text-muted-foreground">🧾 Total Tolls</p>
          </div>
          <div className="bg-green-950/30 border-2 border-green-600 rounded-2xl p-3 text-center">
            <p className="text-xl font-black text-green-300">${paidAmount.toFixed(0)}</p>
            <p className="text-[10px] font-bold text-green-400">✅ Tolls Paid</p>
          </div>
          <div className={`border-2 rounded-2xl p-3 text-center ${outstandingAmount > 0 ? 'bg-red-950/40 border-red-500' : 'bg-secondary border-border'}`}>
            <p className={`text-xl font-black ${outstandingAmount > 0 ? 'text-red-300' : 'text-foreground'}`}>${outstandingAmount.toFixed(0)}</p>
            <p className={`text-[10px] font-bold ${outstandingAmount > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
              {outstandingAmount > 0 ? '🔴 Outstanding' : '✅ Clear'}
            </p>
          </div>
        </div>

        {/* Send Promo */}
        {customer.marketing_opt_in && customer.email && (
          <Button
            onClick={handleSendPromo}
            disabled={sending || sent}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold gap-2 shadow-md"
          >
            <Send className="w-4 h-4" />
            {sent ? '✅ Promo Sent!' : sending ? 'Sending...' : '📧 Send Promotion Email'}
          </Button>
        )}

        {/* Toll History */}
        {(() => {
          const customerTolls = tolls.filter(t =>
            contracts.some(c => c.id === t.matched_contract_id)
          );
          if (customerTolls.length === 0) return null;

          return (
            <div>
              <h3 className="font-black text-base mb-2">🧾 Toll History</h3>
              <div className="space-y-2">
                {customerTolls.map(t => (
                  <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{t.license_plate}</span>
                          <span className="text-[10px] bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">{t.agency || 'N/A'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          📅 {t.occurrence_date}{t.occurrence_time ? ` @ ${t.occurrence_time}` : ''} • {t.location || 'Unknown'}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Status: {t.dispute_status}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-orange-700">${(t.amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Rental History */}
        <div>
          <h3 className="font-black text-base mb-2">📋 Rental History</h3>
          {contracts.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground bg-secondary rounded-2xl">
              No rentals on record yet
            </div>
          ) : (
            <div className="space-y-2">
              {contracts.map(c => {
                const contractTolls = tolls.filter(t => t.matched_contract_id === c.id);
                const tollTotal = contractTolls.reduce((s, t) => s + (t.amount || 0), 0);
                return (
                  <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-card border-2 border-border rounded-2xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{c.license_plate}</span>
                          <StatusBadge status={c.status} />
                          <span className="text-[10px] text-muted-foreground capitalize bg-secondary px-1.5 py-0.5 rounded-full">{c.platform}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.start_date ? format(new Date(c.start_date), 'MMM d') : '?'} → {c.end_date ? format(new Date(c.end_date), 'MMM d, yyyy') : '?'}
                        </p>
                        <div className="flex gap-2 flex-wrap mt-0.5">
                          {c.fleet && <p className="text-[10px] text-muted-foreground capitalize">{c.fleet === 'bar_auto_rentals' ? '🚘 BAR' : '🏢 APEX'}</p>}
                          {(c.vehicle_make || c.vehicle_model) && <p className="text-[10px] text-muted-foreground">{[c.vehicle_year, c.vehicle_make, c.vehicle_model, c.vehicle_color].filter(Boolean).join(' ')}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        {tollTotal > 0 && <p className="text-xs font-bold text-orange-600">🧾 ${tollTotal.toFixed(2)}</p>}
                        {contractTolls.length > 0 && <p className="text-[10px] text-muted-foreground">{contractTolls.length} toll{contractTolls.length > 1 ? 's' : ''}</p>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}