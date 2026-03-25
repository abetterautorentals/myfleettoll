import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Car, Receipt, ChevronRight, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import CustomerProfile from '@/components/customers/CustomerProfile';
import CustomerForm from '@/components/customers/CustomerForm';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const tierConfig = {
  bronze:   { color: 'text-orange-600 bg-orange-50 border-orange-200',   icon: '🥉' },
  silver:   { color: 'text-gray-600 bg-gray-100 border-gray-300',        icon: '🥈' },
  gold:     { color: 'text-yellow-600 bg-yellow-50 border-yellow-200',   icon: '🥇' },
  platinum: { color: 'text-violet-600 bg-violet-50 border-violet-200',   icon: '💎' },
};

const fleetBadge = {
  bar_auto_rentals: { label: 'BAR', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  concesionario:    { label: 'APEX', color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function Customers() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
    initialData: [],
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.RentalContract.list('-start_date', 500),
    initialData: [],
  });

  const { data: tolls = [] } = useQuery({
    queryKey: ['tolls'],
    queryFn: () => base44.entities.TollNotice.list('-occurrence_date', 500),
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeletingId(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => base44.functions.invoke('restoreCustomersFromContracts', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    // Also search in rental contracts for plate matching
    const matchingCustomerIds = new Set();
    customers.forEach(c => {
      const matchesName = c.full_name?.toLowerCase().includes(q);
      const matchesEmail = c.email?.toLowerCase().includes(q);
      const matchesPhone = c.phone?.includes(q);
      const matchesLicense = c.license_number?.toLowerCase().includes(q);
      if (matchesName || matchesEmail || matchesPhone || matchesLicense) {
        matchingCustomerIds.add(c.id);
      }
    });

    // Also match by license plate from contracts
    contracts.forEach(c => {
      if (c.license_plate?.toLowerCase().includes(q)) {
        const customer = customers.find(cust =>
          cust.full_name?.toLowerCase() === c.renter_name?.toLowerCase() ||
          cust.email === c.renter_email
        );
        if (customer) matchingCustomerIds.add(customer.id);
      }
    });

    return customers.filter(c => matchingCustomerIds.has(c.id));
  }, [customers, contracts, search]);

  const stats = useMemo(() => ({
    total: customers.length,
    gold: customers.filter(c => c.loyalty_tier === 'gold' || c.loyalty_tier === 'platinum').length,
    optedIn: customers.filter(c => c.marketing_opt_in).length,
  }), [customers]);

  if (selectedCustomer) {
    return (
      <CustomerProfile
        customer={selectedCustomer}
        contracts={contracts.filter(c =>
          c.renter_name?.toLowerCase() === selectedCustomer.full_name?.toLowerCase() ||
          c.renter_email === selectedCustomer.email
        )}
        tolls={tolls}
        onBack={() => setSelectedCustomer(null)}
        onUpdated={() => { refetch(); setSelectedCustomer(null); }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        emoji="👥"
        title="Customers"
        subtitle={`${stats.total} customers • ${stats.optedIn} opted in`}
        action={
          <div className="flex gap-2">
            {stats.total === 0 && (
              <Button 
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending}
                className="rounded-2xl bg-orange-600 text-white font-bold gap-1.5 h-10 shadow-md hover:bg-orange-700">
                {restoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Restore Customers
              </Button>
            )}
            <Button onClick={() => setShowForm(true)}
              className="rounded-2xl bg-primary text-primary-foreground font-bold gap-1.5 h-10 shadow-md">
              <UserPlus className="w-4 h-4" /> Add
            </Button>
          </div>
        }
      />

      <div className="px-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatChip emoji="👤" label="Total" value={stats.total} />
          <StatChip emoji="🥇" label="VIP" value={stats.gold} color="yellow" />
          <StatChip emoji="📧" label="Opted In" value={stats.optedIn} color="green" />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, or license..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-2xl border-2"
          />
        </div>

        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading customers...</div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-12 text-muted-foreground">
              <span className="text-5xl block mb-3">👥</span>
              <p className="font-bold">No customers yet</p>
              <p className="text-xs mt-1">Customers are auto-created when you add contracts</p>
            </motion.div>
          ) : (
            <div className="space-y-2 pb-6">
              {filtered.map((customer, i) => {
                const tier = tierConfig[customer.loyalty_tier] || tierConfig.bronze;
                const fleet = fleetBadge[customer.preferred_fleet];
                const customerContracts = contracts.filter(c =>
                  c.renter_name?.toLowerCase() === customer.full_name?.toLowerCase() ||
                  c.renter_email === customer.email
                );
                return (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="bg-card border-2 border-border rounded-2xl p-3.5 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-black text-primary flex-shrink-0">
                          {customer.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-sm">{customer.full_name}</p>
                            {fleet && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${fleet.color}`}>
                                {fleet.label}
                              </span>
                            )}
                            {customer.total_rentals >= 3 && (
                              <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200">⭐ VIP</span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${tier.color}`}>
                              {tier.icon} {customer.loyalty_tier}
                            </span>
                            {customer.marketing_opt_in && (
                              <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200">📧</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {customer.email && <span className="text-[10px] text-muted-foreground truncate">{customer.email}</span>}
                            {customer.phone && <span className="text-[10px] text-muted-foreground">{customer.phone}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[10px] font-semibold flex items-center gap-1 text-muted-foreground">
                              <Car className="w-3 h-3" /> {customerContracts.length} rentals
                            </span>
                            {(() => {
                              const custTolls = tolls.filter(t => customerContracts.some(c => c.id === t.matched_contract_id));
                              const outstanding = custTolls.filter(t => !['resolved','archived'].includes(t.lifecycle_status || 'unmatched'));
                              const owed = outstanding.reduce((s, t) => s + (t.amount || 0), 0);
                              if (owed > 0) return (
                                <span className="text-[10px] font-bold flex items-center gap-1 text-red-500">
                                  💰 ${owed.toFixed(2)} owed
                                </span>
                              );
                              if (custTolls.length > 0) return (
                                <span className="text-[10px] font-semibold flex items-center gap-1 text-green-600">
                                  ✅ Tolls clear
                                </span>
                              );
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(customer.id); }}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" onClick={() => setSelectedCustomer(customer)} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showForm && (
          <CustomerForm
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); refetch(); }}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deletingId}
        title="Delete Customer?"
        message="Are you sure? This cannot be undone."
        onConfirm={() => deleteMutation.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}

function StatChip({ emoji, label, value, color }) {
  const bg = color === 'yellow' ? 'bg-yellow-50 border-yellow-200' : color === 'green' ? 'bg-green-50 border-green-200' : 'bg-secondary border-border';
  return (
    <div className={`rounded-2xl border-2 p-2.5 text-center ${bg}`}>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] text-muted-foreground font-semibold">{emoji} {label}</p>
    </div>
  );
}