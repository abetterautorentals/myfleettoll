import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

export default function SmartMatchPanel({ toll }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const queryClient = useQueryClient();

  const fetchSuggestions = async () => {
    if (suggestions) { setOpen(!open); return; }
    setLoading(true);
    setOpen(true);
    const res = await base44.functions.invoke('smartMatch', { toll_id: toll.id });
    setSuggestions(res.data.suggestions || []);
    setLoading(false);
  };

  const confirmMatch = async (contractId) => {
    setConfirming(contractId);
    await base44.functions.invoke('smartMatch', { toll_id: toll.id, confirm: true, contract_id: contractId });
    queryClient.invalidateQueries({ queryKey: ['tolls'] });
    setConfirming(null);
  };

  return (
    <div className="mt-2">
      <Button
        size="sm"
        onClick={fetchSuggestions}
        disabled={loading}
        className="w-full h-8 rounded-xl text-[11px] font-bold gap-1.5 bg-violet-500 text-white hover:bg-violet-600"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {loading ? 'Searching...' : '🧠 Smart Match'}
        {!loading && (open ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />)}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {loading && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Scanning contracts ±7 days...
                </div>
              )}

              {!loading && suggestions?.length === 0 && (
                <div className="text-center py-3 bg-secondary rounded-xl text-xs text-muted-foreground">
                  😕 No contract candidates found for {toll.license_plate} around {toll.occurrence_date}
                </div>
              )}

              {!loading && suggestions?.map((s) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border-2 p-2.5 ${
                    s.is_best_match
                      ? 'border-green-300 bg-green-50'
                      : s.is_extended
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs">{s.renter_name}</span>
                        {s.is_best_match && (
                          <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" /> Best Match
                          </span>
                        )}
                        {s.is_extended && (
                          <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Extended?
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        🚗 {s.license_plate} • {s.platform}
                        {s.reservation_id && ` • #${s.reservation_id}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        📅 {s.start_date ? format(new Date(s.start_date), 'MMM d') : '?'} → {s.end_date ? format(new Date(s.end_date), 'MMM d, yyyy') : '?'}
                      </p>
                      {s.flags?.map((flag, i) => (
                        <p key={i} className="text-[10px] font-semibold text-orange-700 mt-0.5">{flag}</p>
                      ))}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground">Score: {s.score}</span>
                      <Button
                        size="sm"
                        disabled={confirming === s.id}
                        onClick={() => confirmMatch(s.id)}
                        className="h-7 px-2 text-[10px] font-bold rounded-lg bg-primary text-primary-foreground"
                      >
                        {confirming === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Match'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}