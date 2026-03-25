import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Loader2, CheckCircle, Circle, Download, Send, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

function CheckRow({ done, label, detail, warning }) {
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-border last:border-0 ${warning ? 'opacity-80' : ''}`}>
      <div className="mt-0.5 flex-shrink-0">
        {done === 'loading' ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : done ? (
          <CheckCircle className={`w-4 h-4 ${warning ? 'text-orange-400' : 'text-green-400'}`} />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${done && !warning ? 'text-foreground' : done && warning ? 'text-orange-300' : 'text-muted-foreground'}`}>{label}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

export default function DisputePackageBuilder({ plate, renterName, onClose }) {
  const [step, setStep] = useState('idle'); // idle | building | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleBuild = async () => {
    setStep('building');
    setError(null);
    const res = await base44.functions.invoke('buildDisputePackage', {
      license_plate: plate,
      renter_name: renterName,
    });
    if (res.data?.success) {
      setResult(res.data);
      setStep('done');
    } else {
      setError(res.data?.error || 'Unknown error');
      setStep('error');
    }
  };

  const handleDownload = () => {
    if (result?.pdf_url) {
      window.open(result.pdf_url, '_blank');
    } else if (result?.pdf_data_url) {
      window.open(result.pdf_data_url, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          className="bg-background rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <div>
                <p className="font-black text-base">Build Dispute Package</p>
                <p className="text-xs text-muted-foreground font-mono">{plate}{renterName ? ` · ${renterName}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Idle state */}
            {step === 'idle' && (
              <div className="space-y-4">
                <div className="bg-primary/10 border border-primary/30 rounded-2xl p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-bold text-foreground text-sm">What this does:</p>
                  <p>• Finds ALL matched tolls for plate <span className="font-bold font-mono">{plate}</span></p>
                  <p>• Finds ALL rental contracts covering those toll dates</p>
                  <p>• Builds one combined PDF (cover letter + tolls + all contracts)</p>
                  <p>• Creates a Gmail draft addressed to FasTrak ready to send</p>
                </div>
                <Button onClick={handleBuild} className="w-full h-12 rounded-2xl font-bold gap-2 bg-primary">
                  <Package className="w-4 h-4" /> Build Package Now
                </Button>
              </div>
            )}

            {/* Building */}
            {step === 'building' && (
              <div className="space-y-1 py-2">
                <CheckRow done="loading" label="Fetching all matched tolls..." />
                <CheckRow done={false} label="Finding rental contracts" />
                <CheckRow done={false} label="Building PDF package" />
                <CheckRow done={false} label="Creating Gmail draft" />
                <p className="text-xs text-center text-muted-foreground pt-2">This may take 10–20 seconds...</p>
              </div>
            )}

            {/* Done */}
            {step === 'done' && result && (
              <div className="space-y-4">
                {/* Checklist */}
                <div className="bg-secondary rounded-2xl px-3 divide-y divide-border">
                  <CheckRow
                    done={true}
                    label={`${result.toll_count} tolls found — $${result.total_amount?.toFixed(2)}`}
                    detail={`All matched tolls for ${plate}`}
                  />
                  <CheckRow
                    done={true}
                    label={`${result.contract_count} contract${result.contract_count !== 1 ? 's' : ''} attached`}
                    detail={result.contracts_summary?.map(c => {
                      const s = c.start ? new Date(c.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';
                      const e = c.end ? new Date(c.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '?';
                      return `${s}–${e} (${c.tolls_covered} tolls)`;
                    }).join(' • ')}
                  />
                  <CheckRow
                    done={result.uncovered_count === 0}
                    warning={result.uncovered_count > 0}
                    label={result.uncovered_count === 0
                      ? 'All toll dates covered by contracts ✓'
                      : `⚠️ ${result.uncovered_count} toll${result.uncovered_count > 1 ? 's' : ''} have no contract coverage`}
                    detail={result.uncovered_count > 0 ? 'These tolls may not be disputeable — review before sending' : null}
                  />
                  <CheckRow
                    done={true}
                    label={`PDF package built — ${result.size_mb}MB`}
                    detail={result.filename}
                  />
                  <CheckRow
                    done={result.draft_created}
                    warning={!result.draft_created}
                    label={result.draft_created ? 'Gmail draft created — ready to send' : 'Gmail draft failed — download PDF manually'}
                    detail={result.draft_created
                      ? `To: CustomerService@BayAreaFasTrak.org`
                      : 'Open Gmail and attach the downloaded PDF'}
                  />
                </div>

                {/* Uncovered warning */}
                {result.uncovered_count > 0 && (
                  <div className="bg-orange-950/40 border border-orange-600 rounded-xl px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-300">
                      {result.uncovered_count} toll{result.uncovered_count > 1 ? 's' : ''} had no matching contract. Review your contracts to ensure full date coverage before sending.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleDownload}
                    className="w-full h-12 rounded-2xl font-bold gap-2 bg-primary"
                  >
                    <Download className="w-4 h-4" /> Download PDF Package
                  </Button>
                  {result.draft_created && (
                    <Button
                      onClick={() => window.open('https://mail.google.com/mail/u/0/#drafts', '_blank')}
                      variant="outline"
                      className="w-full h-11 rounded-xl font-bold gap-2"
                    >
                      <Send className="w-4 h-4" /> Open Gmail Drafts to Send
                    </Button>
                  )}
                  <Button variant="ghost" onClick={onClose} className="w-full h-10 rounded-xl text-sm">
                    Close
                  </Button>
                </div>
              </div>
            )}

            {/* Error */}
            {step === 'error' && (
              <div className="space-y-3">
                <div className="bg-red-950/40 border border-red-600 rounded-xl p-3">
                  <p className="text-sm font-bold text-red-300 mb-1">Package build failed</p>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
                <Button onClick={handleBuild} className="w-full h-11 rounded-xl font-bold gap-2">
                  <Package className="w-4 h-4" /> Retry
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}