import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

const RESEND_REASONS = [
  { id: 'no_response_fastrak', label: 'No response from FasTrak' },
  { id: 'renter_no_pay', label: 'Renter did not pay' },
  { id: 'fastrak_rejected', label: 'FasTrak rejected — need more documents' },
  { id: 'other', label: 'Other' },
];

export default function ResendWorkflow({ toll, onClose }) {
  const [reason, setReason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  const handleResend = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      // Generate new PDF with resend context
      const res = await base44.functions.invoke('generateDisputePDF', {
        toll_id: toll.id,
        type: toll.is_violation ? 'violation' : 'dispute',
        resend_reason: reason,
        original_sent_date: toll.sent_date,
      });

      // Update toll record
      const today = new Date().toISOString().split('T')[0];
      const history = toll.send_history || [];
      history.push({ date: today, action: 'resent', reason });

      await base44.entities.TollNotice.update(toll.id, {
        lifecycle_status: 'resent',
        resent_date: today,
        resent_reason: reason,
        send_history: history,
        pdf_url: res.data?.pdf_url || toll.pdf_url,
      });

      queryClient.invalidateQueries({ queryKey: ['tolls'] });
      setDone(true);
    } catch (err) {
      console.error('[ResendWorkflow] error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="bg-background border-2 border-border rounded-3xl p-5 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-lg">Resend Package</h3>
            <p className="text-xs text-muted-foreground">{toll.license_plate} • ${toll.amount?.toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-black text-lg">Package Resent!</p>
            <p className="text-xs text-muted-foreground mt-1">Status updated to Resent</p>
            {toll.sent_date && (
              <div className="mt-4 bg-secondary rounded-2xl p-3 text-left text-xs space-y-1">
                <p className="text-muted-foreground">📅 First sent: <span className="font-bold text-foreground">{toll.sent_date}</span></p>
                <p className="text-muted-foreground">🔄 Resent: <span className="font-bold text-foreground">{new Date().toISOString().split('T')[0]}</span></p>
              </div>
            )}
            <Button onClick={onClose} className="mt-4 w-full h-10 rounded-xl font-bold">Done</Button>
          </div>
        ) : (
          <>
            {toll.sent_date && (
              <div className="bg-blue-950/40 border border-blue-600 rounded-xl p-3 mb-4 text-xs">
                <p className="text-blue-300 font-bold">📅 Originally sent: {toll.sent_date}</p>
              </div>
            )}

            <p className="text-sm font-bold mb-3">Why are you resending?</p>
            <div className="space-y-2 mb-5">
              {RESEND_REASONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm ${
                    reason === r.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <Button
              onClick={handleResend}
              disabled={!reason || loading}
              className="w-full h-12 rounded-xl font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loading ? 'Generating new package...' : 'Generate & Resend'}
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}