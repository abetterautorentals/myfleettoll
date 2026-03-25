import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Trash2, AlertTriangle, Link2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, parseISO, differenceInDays } from 'date-fns';

function safeDate(str) {
  if (!str) return null;
  try { const d = parseISO(str); return isNaN(d.getTime()) ? null : d; } catch { return null; }
}

function safeFormat(str, fmt) {
  const d = safeDate(str);
  if (!d) return str || '?';
  try { return format(d, fmt); } catch { return str; }
}

function detectIssues(contracts) {
  const issues = [];
  for (let i = 0; i < contracts.length; i++) {
    const a = contracts[i];
    const endA = safeDate(a.end_date);
    for (let j = i + 1; j < contracts.length; j++) {
      const b = contracts[j];
      if (a.license_plate && b.license_plate && a.license_plate !== b.license_plate) continue;
      const startB = safeDate(b.start_date);
      if (!endA || !startB) continue;
      const gap = differenceInDays(startB, endA);
      if (gap > 1) {
        issues.push({ type: 'gap', between: [i, j], days: gap, date: safeFormat(a.end_date, 'MMM d') + ' – ' + safeFormat(b.start_date, 'MMM d') });
      } else if (gap < 0) {
        issues.push({ type: 'overlap', between: [i, j], days: Math.abs(gap) });
      }
    }
  }
  return issues;
}

function ContractCard({ contract, index, total, onChange, onDelete, isExtension }) {
  const [expanded, setExpanded] = useState(index === 0);
  const set = (k, v) => onChange({ ...contract, [k]: v });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-2xl border-2 overflow-hidden ${isExtension ? 'border-blue-600 bg-blue-950/30' : 'border-border bg-card'}`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          {isExtension && <Link2 className="w-4 h-4 text-blue-400 flex-shrink-0" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm">
                Contract {index + 1}{total > 1 ? ` of ${total}` : ''}
              </span>
              {isExtension && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold px-1.5 py-0.5 rounded-full">
                  EXTENSION
                </span>
              )}
              {contract.signature_status === 'signed' ? (
                <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/40 font-bold px-1.5 py-0.5 rounded-full">SIGNED</span>
              ) : (
                <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold px-1.5 py-0.5 rounded-full">UNSIGNED</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {contract.renter_name || 'Unknown renter'} • {contract.license_plate || '?'} •{' '}
              {safeFormat(contract.start_date, 'MMM d')} → {safeFormat(contract.end_date, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded edit form */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
              <FormRow label="Renter Name">
                <Input className="rounded-xl h-10 font-bold" value={contract.renter_name || ''} onChange={e => set('renter_name', e.target.value)} />
              </FormRow>
              <FormRow label="License Plate">
                <Input className="rounded-xl h-10 font-bold uppercase" value={contract.license_plate || ''} onChange={e => set('license_plate', e.target.value.toUpperCase())} />
              </FormRow>
              <div className="grid grid-cols-2 gap-2">
                <FormRow label="Start">
                  <Input type="datetime-local" className="rounded-xl h-10 text-xs" value={(contract.start_date || '').slice(0, 16)} onChange={e => set('start_date', e.target.value)} />
                </FormRow>
                <FormRow label="End">
                  <Input type="datetime-local" className="rounded-xl h-10 text-xs" value={(contract.end_date || '').slice(0, 16)} onChange={e => set('end_date', e.target.value)} />
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormRow label="Platform">
                  <Select value={contract.platform || 'signnow'} onValueChange={v => set('platform', v)}>
                    <SelectTrigger className="rounded-xl h-10 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="turo">🚗 Turo</SelectItem>
                      <SelectItem value="upcar">🚙 UpCar</SelectItem>
                      <SelectItem value="rentcentric">📋 RentCentric</SelectItem>
                      <SelectItem value="signnow">✍️ SignNow</SelectItem>
                      <SelectItem value="direct">🤝 Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </FormRow>
                <FormRow label="Signature">
                  <Select value={contract.signature_status || 'signed'} onValueChange={v => set('signature_status', v)}>
                    <SelectTrigger className="rounded-xl h-10 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="signed">✅ Signed</SelectItem>
                      <SelectItem value="pending">⏳ Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </FormRow>
              </div>
              <FormRow label="Reservation ID">
                <Input className="rounded-xl h-10 text-xs" value={contract.reservation_id || ''} onChange={e => set('reservation_id', e.target.value)} placeholder="Optional" />
              </FormRow>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FormRow({ label, children }) {
  return (
    <div>
      <Label className="text-[10px] font-bold text-muted-foreground mb-1 block uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

export default function MultiContractReview({ contracts, onChange, onSave, saving }) {
  const issues = detectIssues(contracts);

  const updateContract = (i, updated) => {
    const next = [...contracts];
    next[i] = updated;
    onChange(next);
  };

  const deleteContract = (i) => {
    onChange(contracts.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-3">
      {/* Summary header */}
      {(() => {
        const uniqueRenters = [...new Set(contracts.map(c => c.renter_name).filter(Boolean))];
        const uniquePlates = [...new Set(contracts.map(c => c.license_plate).filter(Boolean))];
        const isSameRenter = uniqueRenters.length === 1 && contracts.length > 1;
        return (
          <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="font-black text-sm">
                Found {contracts.length} contract{contracts.length !== 1 ? 's' : ''} in this PDF{isSameRenter ? ` — each with different dates` : ''}
              </p>
            </div>
            {isSameRenter && (
              <div className="space-y-1 pl-1">
                {contracts.map((c, i) => (
                  <p key={i} className="text-xs text-foreground font-semibold">
                    Contract {i + 1}: <span className="text-primary">{c.renter_name}</span>
                    {c.license_plate && <span className="text-muted-foreground"> · {c.license_plate}</span>}
                    {c.start_date && c.end_date && (
                      <span className="text-muted-foreground"> · {safeFormat(c.start_date, 'MMM d')} → {safeFormat(c.end_date, 'MMM d, yyyy')}</span>
                    )}
                  </p>
                ))}
              </div>
            )}
            {!isSameRenter && (
              <p className="text-xs text-muted-foreground pl-8">Review each one below — edit, delete, or save all at once.</p>
            )}
          </div>
        );
      })()}

      {/* Issues */}
      {issues.map((issue, i) => (
        <div key={i} className="bg-orange-950/40 border-2 border-orange-600 rounded-2xl px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs font-bold text-orange-300">
            {issue.type === 'gap'
              ? `⚠️ Gap detected: ${issue.days} day${issue.days > 1 ? 's' : ''} with no contract (${issue.date}). Any tolls in this window will be unmatched.`
              : `⚠️ Overlap detected: Contract ${issue.between[0] + 1} and ${issue.between[1] + 1} share ${issue.days} overlapping day${issue.days > 1 ? 's' : ''}. Check which takes priority.`}
          </p>
        </div>
      ))}

      {/* Date chain visualization — show when same renter with multiple periods */}
      {contracts.length > 1 && [...new Set(contracts.map(c => c.renter_name).filter(Boolean))].length === 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 px-1">
          {contracts.map((c, i) => (
            <React.Fragment key={i}>
              <div className="flex-shrink-0 bg-secondary rounded-xl px-2 py-1 text-center">
                <p className="text-[9px] font-bold text-muted-foreground">#{i + 1}</p>
                <p className="text-[10px] font-black">{safeFormat(c.start_date, 'MMM d')}</p>
                <p className="text-[10px] text-muted-foreground">{safeFormat(c.end_date, 'MMM d')}</p>
              </div>
              {i < contracts.length - 1 && (
                <div className="flex-shrink-0 text-muted-foreground text-xs font-bold">→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Contract cards */}
      <div className="space-y-2">
        {contracts.map((c, i) => (
          <ContractCard
            key={i}
            contract={c}
            index={i}
            total={contracts.length}
            onChange={updated => updateContract(i, updated)}
            onDelete={() => deleteContract(i)}
            isExtension={c.is_extension && i > 0}
          />
        ))}
      </div>

      {/* Save all */}
      <Button
        onClick={onSave}
        disabled={saving || contracts.length === 0}
        className="w-full h-14 rounded-2xl font-bold text-lg gap-2 bg-green-500 text-white shadow-lg hover:bg-green-600"
      >
        {saving
          ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving {contracts.length} contracts...</>
          : <><CheckCircle className="w-5 h-5" /> Save All {contracts.length} Contract{contracts.length !== 1 ? 's' : ''}</>
        }
      </Button>
    </div>
  );
}
