import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { AlertTriangle, CheckCircle, Trash2, LinkIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import FleetSelector from '@/components/shared/FleetSelector';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

export default function UnmatchedTollQueue() {
  const { tenant, isOwner, activeFleet: fleet } = useTenant();
  const queryClient = useQueryClient();
  const [linking, setLinking] = useState(null); // toll_id being linked

  const { data: tolls = [] } = useQuery({
    queryKey: ['tolls-unmatched', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.TollNotice.filter({ match_status: 'unmatched' }, '-created_date', 200)
      : base44.entities.TollNotice.filter({ tenant_id: tenant?.id, match_status: 'unmatched' }, '-created_date', 200),
    enabled: !!tenant,
    initialData: [],
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.RentalContract.list('-start_date', 500),
    initialData: [],
  });

  const filtered = tolls.filter(t => fleet === 'all' || t.fleet === fleet);

  return (
    <div>
      <PageHeader
        emoji="🔴"
        title="Unmatched Toll Queue"
        subtitle={`${filtered.length} tolls awaiting manual linking`}
      />

      <div className="px-4 space-y-3">
        <FleetSelector useGlobal />

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <EmptyState emoji="✅" title="All caught up!" subtitle="No unmatched tolls — great job!" />
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map((toll, i) => (
                <TollQueueItem
                  key={toll.id}
                  toll={toll}
                  index={i}
                  contracts={contracts}
                  isLinking={linking === toll.id}
                  onLinkStart={() => setLinking(toll.id)}
                  onLinkComplete={() => {
                    setLinking(null);
                    queryClient.invalidateQueries({ queryKey: ['tolls-unmatched'] });
                  }}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TollQueueItem({ toll, index, contracts, isLinking, onLinkStart, onLinkComplete }) {
  const [selectedContractId, setSelectedContractId] = useState('');
  const queryClient = useQueryClient();

  // Find possible contracts (same license plate, overlapping dates, or manual search)
  const possibleContracts = contracts.filter(c => {
    if (!toll.license_plate) return false;
    const tollDate = new Date(toll.occurrence_date);
    return (
      c.license_plate?.toUpperCase() === toll.license_plate?.toUpperCase() &&
      tollDate >= new Date(c.start_date) &&
      tollDate <= new Date(c.end_date)
    );
  });

  const updateMutation = useMutation({
    mutationFn: (contractId) => {
      const contract = contracts.find(c => c.id === contractId);
      return base44.entities.TollNotice.update(toll.id, {
        match_status: contract.signature_status === 'pending' ? 'pending_signature' : 'matched',
        matched_contract_id: contractId,
        matched_renter_name: contract.renter_name,
        matched_platform: contract.platform,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tolls-unmatched'] });
      queryClient.invalidateQueries({ queryKey: ['tolls'] });
      onLinkComplete();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.TollNotice.delete(toll.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tolls-unmatched'] });
      onLinkComplete();
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-red-50 border-2 border-red-200 rounded-2xl p-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="font-black text-sm">{toll.license_plate || 'Unknown Plate'}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            📅 {toll.occurrence_date} {toll.occurrence_time ? `at ${toll.occurrence_time}` : ''} • ${toll.amount.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            📍 {toll.location || 'Unknown'} • {toll.agency || 'Unknown Agency'}
          </p>
          {toll.transaction_id && (
            <p className="text-[10px] text-muted-foreground">🔖 {toll.transaction_id}</p>
          )}
        </div>

        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="p-1.5 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors rounded-lg"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLinking ? (
        <div className="mt-3 pt-3 border-t border-red-200 space-y-2">
          <p className="text-xs font-bold text-red-700">🔗 Link to a contract:</p>

          {possibleContracts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] text-green-700 font-bold">Found {possibleContracts.length} matching contract(s):</p>
              {possibleContracts.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedContractId(c.id);
                    updateMutation.mutate(c.id);
                  }}
                  disabled={updateMutation.isPending}
                  className="w-full text-left p-2 rounded-lg bg-white border border-green-300 hover:bg-green-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-green-700">{c.renter_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.platform} • {format(new Date(c.start_date), 'MMM d')} → {format(new Date(c.end_date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-red-600 mb-2">No automatic matches. Search manually:</p>
              <Select value={selectedContractId} onValueChange={v => setSelectedContractId(v)}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue placeholder="Search contracts..." /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.renter_name} • {c.license_plate} • {format(new Date(c.start_date), 'MMM d')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedContractId && (
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate(selectedContractId)}
                  disabled={updateMutation.isPending}
                  className="w-full mt-2 h-7 rounded-lg text-xs bg-green-500 text-white hover:bg-green-600"
                >
                  {updateMutation.isPending ? '...' : '✓ Link'}
                </Button>
              )}
            </div>
          )}

          <button
            onClick={() => onLinkComplete()}
            className="w-full h-7 rounded-lg text-xs font-bold border border-red-300 text-red-700 hover:bg-red-100 transition-colors"
          >
            ✕ Cancel
          </button>
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-red-200 flex gap-2">
          <Button
            size="sm"
            onClick={onLinkStart}
            className="flex-1 h-8 rounded-lg text-[11px] font-bold gap-1 bg-blue-500 text-white hover:bg-blue-600"
          >
            <LinkIcon className="w-3 h-3" /> Link to Contract
          </Button>
        </div>
      )}
    </motion.div>
  );
}