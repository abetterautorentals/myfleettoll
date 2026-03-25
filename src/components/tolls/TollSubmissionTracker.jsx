import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle, Circle, DollarSign, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FasTrakDisputeTracker from './FasTrakDisputeTracker';

/**
 * Platform-specific submission tracker for each toll.
 * Shows the correct workflow based on the matched platform.
 */
export default function TollSubmissionTracker({ toll }) {
  const queryClient = useQueryClient();
  const [showDateInput, setShowDateInput] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidAmount, setPaidAmount] = useState(String(toll.amount || ''));

  const platform = toll.matched_platform || 'direct';
  const isMatched = !!toll.matched_contract_id; // matched to a rental contract
  const isUnmatched = !toll.matched_contract_id; // truly unmatched = we owe FasTrak
  const isNonFasTrak = toll.is_non_fastrak || false; // Parking tickets, city violations, etc.
  const isFastrakHighway = !isNonFasTrak && !isUnmatched; // matched FasTrak toll (dispute workflow)

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.TollNotice.update(toll.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tolls'] }),
  });

  // ── Matched FasTrak highway toll — use dispute workflow ──
  if (isFastrakHighway) {
    return <FasTrakDisputeTracker toll={toll} />;
  }

  // ── Unmatched FasTrak toll — we owe FasTrak directly ──
  if (isUnmatched || toll.fastrack_paid !== undefined) {
    if (toll.fastrack_paid) {
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-700 bg-green-50 rounded-xl px-2.5 py-1.5 border border-green-200">
          <CheckCircle className="w-3.5 h-3.5" />
          Paid FasTrak {toll.fastrack_paid_date} — ${toll.fastrack_paid_amount || toll.amount}
        </div>
      );
    }
    return (
      <div className="mt-2 pt-2 border-t border-red-200">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 mb-2">
          <Circle className="w-3.5 h-3.5" />
          ⚠️ FasTrak owed by us — not paid (no renter contract)
        </div>
        {showDateInput ? (
          <div className="flex gap-2 items-center">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs rounded-xl flex-1" />
            <Input type="number" step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="Amount" className="h-8 text-xs rounded-xl w-24" />
            <Button size="sm" className="h-8 rounded-xl text-xs bg-green-500 text-white hover:bg-green-600 px-3"
              onClick={() => updateMutation.mutate({ fastrack_paid: true, fastrack_paid_date: date, fastrack_paid_amount: parseFloat(paidAmount) || toll.amount, submission_status: 'paid' })}>
              ✓ Confirm
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowDateInput(true)}
            className="h-8 rounded-xl text-[11px] bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 font-bold gap-1.5">
            <DollarSign className="w-3 h-3" /> Mark Paid to FasTrak
          </Button>
        )}
      </div>
    );
  }

  // ── Turo ──
  if (platform === 'turo') {
    if (toll.turo_collected) {
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-700 bg-green-50 rounded-xl px-2.5 py-1.5 border border-green-200">
          <CheckCircle className="w-3.5 h-3.5" />
          Turo collected {toll.turo_collected_date}
        </div>
      );
    }
    if (toll.submission_status === 'submitted') {
      return (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-current border-opacity-20">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-700">
            <Calendar className="w-3.5 h-3.5" />
            Submitted {toll.submission_date} — awaiting Turo collection
          </div>
          <Button size="sm" onClick={() => updateMutation.mutate({ turo_collected: true, turo_collected_date: new Date().toISOString().split('T')[0], submission_status: 'collected' })}
            className="h-7 rounded-xl text-[10px] bg-green-500 text-white hover:bg-green-600 px-2.5">
            ✓ Collected
          </Button>
        </div>
      );
    }
    return (
      <div className="mt-2 pt-2 border-t border-current border-opacity-20">
        {showDateInput ? (
          <div className="flex gap-2 items-center">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs rounded-xl flex-1" />
            <Button size="sm" className="h-8 rounded-xl text-xs bg-blue-500 text-white hover:bg-blue-600 px-3"
              onClick={() => { updateMutation.mutate({ submission_status: 'submitted', submission_date: date }); setShowDateInput(false); }}>
              ✓ Save
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowDateInput(true)}
            className="h-8 rounded-xl text-[11px] bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300 font-bold gap-1.5">
            <CheckCircle className="w-3 h-3" /> Mark Submitted in Turo App
          </Button>
        )}
      </div>
    );
  }

  // ── UpCar ──
  if (platform === 'upcar') {
    if (toll.submission_status === 'submitted' || toll.submission_status === 'collected') {
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-700 bg-green-50 rounded-xl px-2.5 py-1.5 border border-green-200">
          <CheckCircle className="w-3.5 h-3.5" />
          Submitted in UpCar {toll.submission_date}
        </div>
      );
    }
    return (
      <div className="mt-2 pt-2 border-t border-current border-opacity-20">
        {showDateInput ? (
          <div className="flex gap-2 items-center">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs rounded-xl flex-1" />
            <Button size="sm" className="h-8 rounded-xl text-xs bg-blue-500 text-white hover:bg-blue-600 px-3"
              onClick={() => { updateMutation.mutate({ submission_status: 'submitted', submission_date: date }); setShowDateInput(false); }}>
              ✓ Save
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowDateInput(true)}
            className="h-8 rounded-xl text-[11px] bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-300 font-bold gap-1.5">
            <CheckCircle className="w-3 h-3" /> Mark Submitted in UpCar
          </Button>
        )}
      </div>
    );
  }

  // ── Non-FasTrak (Parking Violations, City Tolls) ──
  if (isNonFasTrak) {
    if (toll.submission_status === 'paid') {
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-700 bg-green-50 rounded-xl px-2.5 py-1.5 border border-green-200">
          <CheckCircle className="w-3.5 h-3.5" />
          Paid {toll.submission_date} — ${toll.recovered_amount || toll.amount}
        </div>
      );
    }
    return (
      <div className="mt-2 pt-2 border-t border-current border-opacity-20 space-y-2">
        {showDateInput ? (
          <div className="flex gap-2 items-center">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs rounded-xl flex-1" />
            <Input type="number" step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="Amount" className="h-8 text-xs rounded-xl w-24" />
            <Button size="sm" className="h-8 rounded-xl text-xs bg-green-500 text-white hover:bg-green-600 px-3"
              onClick={() => { updateMutation.mutate({ submission_status: 'paid', submission_date: date, recovered_amount: parseFloat(paidAmount) || toll.amount }); setShowDateInput(false); }}>
              ✓ Mark Paid
            </Button>
          </div>
        ) : (
          <>
            <Button size="sm" onClick={() => setShowDateInput(true)}
              className="w-full h-8 rounded-xl text-[11px] bg-green-500 text-white hover:bg-green-600 font-bold gap-1.5">
              <CheckCircle className="w-3 h-3" /> Mark as Paid
            </Button>
            <Button size="sm" className="w-full h-8 rounded-xl text-[11px] bg-orange-500 text-white hover:bg-orange-600 font-bold gap-1.5">
              📧 Send Invoice to Renter
            </Button>
          </>
        )}
      </div>
    );
  }

  // ── SignNow / Direct — send invoice ──
  if (toll.submission_status === 'collected') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-700 bg-green-50 rounded-xl px-2.5 py-1.5 border border-green-200">
        <CheckCircle className="w-3.5 h-3.5" />
        Invoice collected {toll.submission_date}
      </div>
    );
  }
  if (toll.submission_status === 'submitted') {
    return (
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-current border-opacity-20">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-700">
          <Calendar className="w-3.5 h-3.5" />
          Invoice sent {toll.submission_date} — waiting payment
        </div>
        <Button size="sm" onClick={() => updateMutation.mutate({ submission_status: 'collected' })}
          className="h-7 rounded-xl text-[10px] bg-green-500 text-white hover:bg-green-600 px-2.5">
          ✓ Collected
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-2 pt-2 border-t border-current border-opacity-20">
      {showDateInput ? (
        <div className="flex gap-2 items-center">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs rounded-xl flex-1" />
          <Button size="sm" className="h-8 rounded-xl text-xs bg-orange-500 text-white hover:bg-orange-600 px-3"
            onClick={() => { updateMutation.mutate({ submission_status: 'submitted', submission_date: date }); setShowDateInput(false); }}>
            ✓ Save
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => setShowDateInput(true)}
          className="h-8 rounded-xl text-[11px] bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-300 font-bold gap-1.5">
          <CheckCircle className="w-3 h-3" /> Mark Invoice Sent to Renter
        </Button>
      )}
    </div>
  );
}