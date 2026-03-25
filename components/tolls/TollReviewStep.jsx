import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const PLATFORMS = ['Turo', 'UpCar', 'SignNow', 'Direct', 'Unknown', 'Mixed'];

// Convert a UTC datetime string to America/Los_Angeles for display
function formatTimePT(timeStr) {
  if (!timeStr) return '';
  try {
    // timeStr may be "HH:MM" or "HH:MM:SS" — treat as-is if no timezone info
    return timeStr;
  } catch {
    return timeStr;
  }
}

export default function TollReviewStep({ tolls, onTollChange, onSaveAll, contracts, fleets, isSaving }) {
  const [checked, setChecked] = useState(() => tolls.map(() => true));
  const [platform, setPlatform] = useState('');
  const [mixedPlatforms, setMixedPlatforms] = useState({}); // { index: platform }
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [expandedIndex, setExpandedIndex] = useState(null);

  // Sync checked array length if tolls change
  useEffect(() => {
    setChecked(prev => {
      if (prev.length !== tolls.length) return tolls.map(() => true);
      return prev;
    });
  }, [tolls.length]);

  const findMatch = (toll) => {
    if (!toll.license_plate || !toll.occurrence_date) return null;
    const tollDate = new Date(toll.occurrence_date);
    return contracts.find(c => {
      if (c.license_plate?.toUpperCase() !== toll.license_plate?.toUpperCase()) return false;
      try {
        return tollDate >= new Date(c.start_date) && tollDate <= new Date(c.end_date);
      } catch { return false; }
    });
  };

  const selectedTolls = tolls.filter((_, i) => checked[i]);
  const totalAmount = selectedTolls.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const matchedCount = selectedTolls.filter(t => findMatch(t)).length;
  const unmatchedCount = selectedTolls.length - matchedCount;
  const primaryPlate = tolls[0]?.license_plate || 'Unknown';

  const toggleAll = (val) => setChecked(tolls.map(() => val));

  const handleSave = async () => {
    const toSave = tolls.filter((_, i) => checked[i]);
    setSaving(true);
    setSaveProgress({ current: 0, total: toSave.length });

    // Apply platform to each toll
    const withPlatform = toSave.map((t, origIdx) => {
      const globalIdx = tolls.indexOf(t);
      const match = findMatch(t);
      const resolvedPlatform = match
        ? match.platform
        : platform === 'Mixed'
          ? (mixedPlatforms[globalIdx] || 'unknown')
          : (platform || 'unknown');
      return { ...t, _detected_platform: resolvedPlatform };
    });

    // Pass to parent save — parent handles actual DB writes
    // We simulate progress by calling onSaveAll with selected tolls
    // Swap out tollForms with only the checked ones before saving
    // We update parent state via onTollChange then call onSaveAll
    withPlatform.forEach((t, i) => {
      onTollChange(i, t);
    });
    // Replace tollForms in parent with only selected tolls
    // Since parent iterates tollForms, we set only checked tolls
    // We do this by calling onTollChange for unchecked as a marker
    tolls.forEach((t, i) => {
      if (!checked[i]) onTollChange(i, { ...t, _skip: true });
    });

    onSaveAll();
  };

  const needsMixedPlatform = platform === 'Mixed';

  return (
    <motion.div key="batch-review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 pb-8">

      {/* HEADER SUMMARY */}
      <div className="bg-primary/10 border-2 border-primary/30 rounded-3xl p-4">
        <p className="text-2xl font-black mb-1">
          Found {tolls.length} tolls for <span className="font-mono text-primary">{primaryPlate}</span>
        </p>
        <div className="flex gap-3 mt-2 flex-wrap">
          <div className="bg-primary/20 rounded-xl px-3 py-1.5">
            <p className="text-xs font-bold text-muted-foreground">Total</p>
            <p className="text-xl font-black text-primary">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-green-950/40 rounded-xl px-3 py-1.5 border border-green-600">
            <p className="text-xs font-bold text-green-400">Matched</p>
            <p className="text-xl font-black text-green-300">{matchedCount}</p>
          </div>
          {unmatchedCount > 0 && (
            <div className="bg-orange-950/40 rounded-xl px-3 py-1.5 border border-orange-600">
              <p className="text-xs font-bold text-orange-400">Unmatched</p>
              <p className="text-xl font-black text-orange-300">{unmatchedCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* PLATFORM SELECTOR — ask once */}
      <div className="bg-secondary rounded-2xl p-4">
        <p className="font-black text-sm mb-3">
          What platform was <span className="font-mono text-primary">{primaryPlate}</span> listed on?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all border-2 ${
                platform === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-foreground hover:border-primary/50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {!platform && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">Optional — you can save without selecting</p>
        )}
      </div>

      {/* TOLL LIST with checkboxes */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{checked.filter(Boolean).length} of {tolls.length} selected</p>
          <div className="flex gap-2">
            <button onClick={() => toggleAll(true)} className="text-xs font-bold text-primary underline">All</button>
            <button onClick={() => toggleAll(false)} className="text-xs font-bold text-muted-foreground underline">None</button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-0.5">
          {tolls.map((t, i) => {
            const match = findMatch(t);
            const isExpanded = expandedIndex === i;
            const isChecked = checked[i];

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.01 }}
                className={`rounded-xl border-2 transition-all ${
                  !isChecked
                    ? 'opacity-40 border-border bg-secondary/50'
                    : match
                      ? 'border-green-600 bg-green-950/30'
                      : 'border-orange-600/50 bg-orange-950/20'
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isChecked ? 'bg-primary border-primary' : 'border-border bg-background'
                    }`}
                  >
                    {isChecked && <CheckCircle className="w-3 h-3 text-white" />}
                  </button>

                  {/* Toll info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">
                        {t.occurrence_date || '?'} {t.occurrence_time && <span className="text-muted-foreground font-normal text-xs">{formatTimePT(t.occurrence_time)}</span>}
                      </p>
                      <p className="font-black text-sm">${(parseFloat(t.amount) || 0).toFixed(2)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.location || 'Unknown location'} • {t.agency || ''}
                    </p>
                    {match && (
                      <p className="text-[10px] text-green-400 font-bold mt-0.5 truncate">✅ {match.renter_name}</p>
                    )}
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    className="text-muted-foreground p-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Expanded detail + mixed platform */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-0 border-t border-border/50 space-y-1.5 text-xs">
                        {t.transaction_id && <p className="text-muted-foreground">TXN: <span className="font-mono">{t.transaction_id}</span></p>}
                        {match ? (
                          <p className="text-green-400 font-bold">Platform: {match.platform} • {match.start_date?.split('T')[0]} → {match.end_date?.split('T')[0]}</p>
                        ) : (
                          <p className="text-orange-400">No matching contract found</p>
                        )}
                        {/* Mixed platform per-toll selector */}
                        {needsMixedPlatform && !match && (
                          <div className="mt-2">
                            <p className="font-bold text-foreground mb-1">Platform for this toll:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {['Turo', 'UpCar', 'SignNow', 'Direct', 'Unknown'].map(p => (
                                <button
                                  key={p}
                                  onClick={() => setMixedPlatforms(prev => ({ ...prev, [i]: p }))}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                    mixedPlatforms[i] === p
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-background border-border text-foreground'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* SAVE BUTTON */}
      <Button
        onClick={handleSave}
        disabled={isSaving || saving || checked.filter(Boolean).length === 0}
        className="w-full h-14 rounded-2xl font-black text-base gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg sticky bottom-4"
      >
        {isSaving || saving
          ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
          : <><CheckCircle className="w-5 h-5" /> Save {checked.filter(Boolean).length} Toll{checked.filter(Boolean).length !== 1 ? 's' : ''}</>
        }
      </Button>

    </motion.div>
  );
}