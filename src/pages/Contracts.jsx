import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Trash2, CalendarPlus, CheckCircle, Loader2 } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';

import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import GmailSyncButton from '@/components/shared/GmailSyncButton';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const statusFilters = [
  { id: 'all', label: 'All' },
  { id: 'active', label: '🟢 Active' },
  { id: 'upcoming', label: '🔵 Upcoming' },
  { id: 'completed', label: '🟣 Completed' },
  { id: 'extended', label: '🟡 Extended' },
];

const platformEmoji = {
  turo: '🚗',
  upcar: '🚙',
  rentcentric: '📋',
  signnow: '✍️',
  direct: '🤝',
  docusign: '📄',
};

const platformLabel = {
  turo: 'Turo',
  upcar: 'UpCar',
  rentcentric: 'RentCentric',
  signnow: 'SignNow',
  direct: 'Direct',
  docusign: 'DocuSign',
};

// A "hash-like" reservation ID should never be shown to users
function isHashId(str) {
  if (!str) return false;
  return /^[a-f0-9]{32,}$/i.test(str.trim());
}

import { useNavigate } from 'react-router-dom';

export default function Contracts() {
  const { activeFleet: fleet } = useTenant();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sigFilter, setSigFilter] = useState(urlParams.get('filter') === 'pending_signature' ? 'pending' : 'all');
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState(null);
  const { tenant, isOwner, fleets } = useTenant();
  const [pendingContracts, setPendingContracts] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('pending_contracts') || 'null'); } catch { return null; }
  });
  const [savingPending, setSavingPending] = useState(false);
  const [savedPending, setSavedPending] = useState(false);

  useEffect(() => {
    if (pendingContracts) {
      sessionStorage.removeItem('pending_contracts');
    }
  }, []);

  const handleAddExtension = (contract) => {
    // Store the source contract in sessionStorage and navigate to ContractAdd
    const nextDay = contract.end_date ? new Date(new Date(contract.end_date).getTime() + 60 * 1000).toISOString().slice(0, 16) : '';
    const extensionData = {
      renter_name: contract.renter_name,
      renter_email: contract.renter_email,
      renter_phone: contract.renter_phone,
      license_plate: contract.license_plate,
      platform: contract.platform,
      fleet: contract.fleet,
      vehicle_make: contract.vehicle_make,
      vehicle_model: contract.vehicle_model,
      vehicle_year: contract.vehicle_year,
      vehicle_color: contract.vehicle_color,
      insurance_company: contract.insurance_company,
      insurance_policy: contract.insurance_policy,
      insurance_phone: contract.insurance_phone,
      start_date: nextDay,
      end_date: '',
      is_extension: true,
    };
    sessionStorage.setItem('extension_prefill', JSON.stringify(extensionData));
    navigate('/contracts/add?mode=extension');
  };

  const handleSavePending = async () => {
    if (!pendingContracts?.contracts?.length) return;
    setSavingPending(true);
    for (const c of pendingContracts.contracts) {
      await base44.entities.RentalContract.create({
        ...c,
        tenant_id: tenant?.id || 'owner',
      });
    }
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    setSavingPending(false);
    setSavedPending(true);
    setPendingContracts(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RentalContract.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setDeletingId(null);
    },
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.RentalContract.list('-start_date', 200)
      : base44.entities.RentalContract.filter({ tenant_id: tenant?.id }, '-start_date', 200),
    enabled: !!tenant,
    initialData: [],
  });

  const selectedFleet = fleets.find(f => f.id === fleet);
  const filtered = contracts
    .filter(c => fleet === 'all' || c.fleet === fleet || (selectedFleet && c.fleet === selectedFleet.name))
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .filter(c => sigFilter === 'all' || c.signature_status === sigFilter);

  return (
    <div>
      <PageHeader
        emoji="📝"
        title="Contracts"
        subtitle={`${filtered.length} contracts`}
        action={
          <Link to="/contracts/add">
            <Button className="rounded-2xl bg-primary text-primary-foreground font-bold gap-1.5 h-10 shadow-md hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </Link>
        }
      />

      <div className="px-4 space-y-3">
        <GmailSyncButton invalidateKeys={['contracts']} />

        {/* Pending contracts from multi-PDF import */}
        <AnimatePresence>
          {pendingContracts && !savedPending && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-blue-950/40 border-2 border-blue-500 rounded-2xl p-4 space-y-3"
            >
              <p className="font-black text-sm text-blue-200">
                📄 This PDF contained {pendingContracts.total} contracts — do you want to import the remaining {pendingContracts.contracts.length}?
              </p>
              <div className="space-y-1.5">
                {pendingContracts.contracts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-blue-100 bg-blue-950/40 rounded-xl px-3 py-1.5">
                    <span className="font-bold">{c.renter_name || 'Unknown'}</span>
                    <span className="text-blue-300">·</span>
                    <span>{c.license_plate}</span>
                    <span className="text-blue-300">·</span>
                    <span>{safeFormat(c.start_date, 'MMM d')} → {safeFormat(c.end_date, 'MMM d, yyyy')}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSavePending} disabled={savingPending}
                  className="flex-1 h-10 rounded-xl font-bold text-sm gap-2 bg-blue-500 hover:bg-blue-600 text-white">
                  {savingPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    : <><CheckCircle className="w-4 h-4" /> Save All {pendingContracts.contracts.length} Remaining</>
                  }
                </Button>
                <Button variant="outline" onClick={() => setPendingContracts(null)}
                  className="h-10 rounded-xl font-bold text-sm px-4">
                  Skip
                </Button>
              </div>
            </motion.div>
          )}
          {savedPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-green-950/40 border-2 border-green-600 rounded-2xl p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <p className="text-sm font-bold text-green-300">All contracts imported successfully!</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {statusFilters.map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === f.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {sigFilter === 'pending' && (
          <div className="bg-orange-950/40 border-2 border-orange-600 rounded-2xl px-3 py-2 text-xs font-bold text-orange-300">
            ✍️ Showing pending signatures only
            <button onClick={() => setSigFilter('all')} className="ml-2 underline">Clear</button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 && !isLoading ? (
            <EmptyState emoji="📋" title="No contracts yet" subtitle="Add your first rental contract" />
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map((contract, i) => (
                <ContractCard key={contract.id} contract={contract} index={i} onDelete={() => setDeletingId(contract.id)} onAddExtension={() => handleAddExtension(contract)} />
              ))}
            </div>
          )}
        </AnimatePresence>

        <ConfirmDialog
          open={!!deletingId}
          title="Delete Contract?"
          message="Are you sure? This cannot be undone."
          onConfirm={() => deleteMutation.mutate(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      </div>
    </div>
  );
}

function safeFormat(dateStr, fmt) {
  if (!dateStr) return '?';
  try {
    const d = new Date(dateStr);
    if (!dateStr || isNaN(d.getTime())) return String(dateStr);
    return format(d, fmt);
  } catch {
    return String(dateStr);
  }
}

function ContractCard({ contract, index, onDelete, onAddExtension }) {
  const borderColor = {
    active:    'border-l-4 border-l-green-500  border border-gray-200 bg-white',
    upcoming:  'border-l-4 border-l-blue-500   border border-gray-200 bg-white',
    completed: 'border-l-4 border-l-purple-500 border border-gray-200 bg-white',
    extended:  'border-l-4 border-l-orange-500 border border-gray-200 bg-white',
    cancelled: 'border-l-4 border-l-red-500    border border-gray-200 bg-white',
  };

  const showReservationId = contract.reservation_id && !isHashId(contract.reservation_id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`rounded-2xl overflow-hidden shadow-sm ${borderColor[contract.status] || 'border border-gray-200 bg-white'}`}
    >
      <div className="p-3 flex justify-between items-start gap-2">
        {/* Left: content */}
        <div className="flex-1 min-w-0">
          {/* Renter name */}
          <p className="font-black text-sm text-gray-900 truncate">
            {contract.renter_name || 'Unknown'}
          </p>

          {/* Plate + Platform */}
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-semibold text-gray-800">{contract.license_plate}</span>
            {contract.platform && (
              <span className="ml-1">
                · {platformEmoji[contract.platform] || '📋'} {platformLabel[contract.platform] || contract.platform}
              </span>
            )}
          </p>

          {/* Dates */}
          <p className="text-xs text-gray-500 mt-0.5">
            📅 <span className="font-semibold text-gray-800">{safeFormat(contract.start_date, 'MMM d')}</span>
            {' → '}
            <span className="font-semibold text-gray-800">{safeFormat(contract.end_date, 'MMM d, yyyy')}</span>
          </p>

          {/* Reservation ID — only if not a hash */}
          {showReservationId && (
            <p className="text-[10px] text-gray-400 mt-0.5">🔖 {contract.reservation_id}</p>
          )}

          {/* Toll count if any */}
          {(contract.total_tolls || 0) > 0 && (
            <p className="text-[10px] font-bold text-red-500 mt-1">
              ⚠️ {contract.total_tolls} toll{contract.total_tolls > 1 ? 's' : ''} · ${(contract.total_toll_amount || 0).toFixed(2)}
            </p>
          )}

          {/* Status pills */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <StatusBadge status={contract.status} />
            <StatusBadge status={contract.signature_status} />
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button
            onClick={onAddExtension}
            className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 transition-colors"
            title="Add extension"
          >
            <CalendarPlus className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}