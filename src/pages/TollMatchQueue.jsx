import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import MatchBadge from '@/components/shared/MatchBadge';
import { Loader2, GripVertical, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function TollMatchQueue() {
  const { tenant, isOwner } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [pendingMatch, setPendingMatch] = useState(null); // { toll, contract }
  const [generatingPDF, setGeneratingPDF] = useState(null);

  const { data: tolls = [], isLoading: loadingTolls } = useQuery({
    queryKey: ['unmatched-tolls', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.TollNotice.filter({ match_status: 'unmatched' }, '-occurrence_date', 100)
      : base44.entities.TollNotice.filter({ tenant_id: tenant?.id, match_status: 'unmatched' }, '-occurrence_date', 100),
    enabled: !!tenant,
    initialData: [],
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts-active', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.RentalContract.list('-start_date', 100)
      : base44.entities.RentalContract.filter({ tenant_id: tenant?.id }, '-start_date', 100),
    enabled: !!tenant,
    initialData: [],
  });

  const matchMutation = useMutation({
    mutationFn: async ({ toll, contract }) => {
      await base44.entities.TollNotice.update(toll.id, {
        match_status: 'matched',
        matched_contract_id: contract.id,
        matched_renter_name: contract.renter_name,
        matched_platform: contract.platform,
      });
    },
    onSuccess: async (_, { toll, contract }) => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-tolls'] });
      queryClient.invalidateQueries({ queryKey: ['tolls'] });
      toast({ title: '✅ Match saved!', description: `${toll.license_plate} linked to ${contract.renter_name}` });
      // Auto-generate dispute PDF
      setGeneratingPDF(toll.id);
      try {
        await base44.functions.invoke('generateDisputePDF', { toll_id: toll.id, type: 'dispute' });
        toast({ title: '📄 Dispute PDF sent to your inbox!' });
      } catch (e) {
        // non-blocking
      }
      setGeneratingPDF(null);
    },
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const tollId = result.draggableId;
    const contractId = result.destination.droppableId.replace('contract-', '');
    if (!contractId || contractId === 'unmatched') return;
    const toll = tolls.find(t => t.id === tollId);
    const contract = contracts.find(c => c.id === contractId);
    if (toll && contract) {
      setPendingMatch({ toll, contract });
    }
  };

  const confirmMatch = () => {
    matchMutation.mutate(pendingMatch);
    setPendingMatch(null);
  };

  return (
    <div className="h-screen flex flex-col">
      <PageHeader emoji="🎯" title="Manual Match Queue" subtitle={`${tolls.length} unmatched tolls`} />

      <div className="flex-1 overflow-hidden px-4 pb-4">
        <p className="text-xs text-muted-foreground mb-3 font-semibold">
          Drag a toll card onto a contract to manually link them
        </p>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 h-full">
            {/* LEFT: Unmatched Tolls */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-black uppercase tracking-wide text-red-500">Unmatched Tolls</span>
                <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full font-bold">{tolls.length}</span>
              </div>
              <Droppable droppableId="unmatched">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}
                    className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
                    {loadingTolls && <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
                    {tolls.map((toll, i) => (
                      <Draggable key={toll.id} draggableId={toll.id} index={i}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-red-50 border-2 border-red-200 rounded-2xl p-3 cursor-grab active:cursor-grabbing transition-shadow ${
                              snapshot.isDragging ? 'shadow-2xl ring-2 ring-red-400 rotate-1 scale-105' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="w-4 h-4 text-red-300 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-sm">{toll.license_plate}</p>
                                <p className="text-[10px] text-muted-foreground">{toll.occurrence_date}{toll.occurrence_time ? ` ${toll.occurrence_time}` : ''}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{toll.location || 'Unknown location'}</p>
                                <p className="font-bold text-red-600 text-sm mt-1">${(toll.amount || 0).toFixed(2)}</p>
                                {generatingPDF === toll.id && (
                                  <p className="text-[10px] text-blue-500 flex items-center gap-1 mt-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Generating PDF...
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {!loadingTolls && tolls.length === 0 && (
                      <div className="text-center py-10 text-muted-foreground">
                        <span className="text-3xl">🎉</span>
                        <p className="text-sm font-bold mt-2">All tolls matched!</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Divider */}
            <div className="w-px bg-border self-stretch" />

            {/* RIGHT: Contracts */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-black uppercase tracking-wide text-green-500">Contracts</span>
                <span className="text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-full font-bold">{contracts.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loadingContracts && <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
                {contracts.map((contract) => (
                  <Droppable key={contract.id} droppableId={`contract-${contract.id}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`bg-card border-2 rounded-2xl p-3 transition-all ${
                          snapshot.isDraggingOver
                            ? 'border-green-400 bg-green-50 scale-[1.02] shadow-lg ring-2 ring-green-300'
                            : 'border-border'
                        }`}
                      >
                        <p className="font-black text-sm">{contract.renter_name}</p>
                        <p className="text-[10px] text-muted-foreground">{contract.license_plate} • {contract.platform}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {contract.start_date ? format(new Date(contract.start_date), 'MMM d') : '?'} → {contract.end_date ? format(new Date(contract.end_date), 'MMM d') : '?'}
                        </p>
                        {snapshot.isDraggingOver && (
                          <p className="text-xs font-bold text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Drop to match!
                          </p>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ))}
                {!loadingContracts && contracts.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm font-bold">No contracts found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DragDropContext>
      </div>

      <ConfirmDialog
        open={!!pendingMatch}
        title="Confirm Manual Match?"
        message={pendingMatch ? `Link toll "${pendingMatch.toll.license_plate} ($${(pendingMatch.toll.amount || 0).toFixed(2)})" to contract for "${pendingMatch.contract.renter_name}"? A dispute PDF will be auto-generated.` : ''}
        confirmLabel="Match & Generate PDF"
        confirmClass="bg-green-500 hover:bg-green-600 text-white"
        onConfirm={confirmMatch}
        onCancel={() => setPendingMatch(null)}
      />
    </div>
  );
}