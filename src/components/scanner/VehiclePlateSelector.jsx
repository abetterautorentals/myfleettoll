import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, Plus, Check, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const normalizePlate = (plate) => plate ? plate.replace(/\s+/g, '').toUpperCase() : '';

export default function VehiclePlateSelector({ vehicles, onSelect, disabled, suggestedPlate }) {
  const [customPlate, setCustomPlate] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [confirmedSuggestion, setConfirmedSuggestion] = useState(false);

  const normalizedSuggestion = normalizePlate(suggestedPlate);

  // If there's a suggestion and it hasn't been confirmed/rejected yet, show confirm UI
  if (normalizedSuggestion && !confirmedSuggestion && !showCustom) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="text-xl font-black mb-2">Plate detected from document</h2>
          <p className="text-sm text-muted-foreground">Our OCR found this plate number</p>
        </div>

        <div className="bg-primary/10 border-2 border-primary rounded-2xl p-6 text-center mb-6">
          <p className="text-3xl font-black font-mono tracking-widest text-primary">{normalizedSuggestion}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => {
              setConfirmedSuggestion(true);
              onSelect(normalizedSuggestion);
            }}
            disabled={disabled}
            className="w-full h-14 rounded-2xl text-base font-black gap-2 bg-green-600 hover:bg-green-700"
          >
            <Check className="w-5 h-5" /> Yes, that's correct
          </Button>
          <Button
            onClick={() => {
              setConfirmedSuggestion(true);
              setCustomPlate(normalizedSuggestion);
              setShowCustom(true);
            }}
            variant="outline"
            disabled={disabled}
            className="w-full h-12 rounded-xl gap-2 font-bold"
          >
            <Edit2 className="w-4 h-4" /> Edit plate
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black mb-2">Which vehicle plate?</h2>
        <p className="text-sm text-muted-foreground">Select the vehicle this document is for</p>
      </div>

      {/* REGISTERED PLATES */}
      <div className="grid grid-cols-1 gap-2 mb-4">
        {vehicles.length > 0 ? (
          vehicles.map((v, i) => (
            <motion.button
              key={v.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => !disabled && onSelect(normalizePlate(v.license_plate))}
              disabled={disabled}
              className="p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/10 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <Car className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-bold text-lg font-mono tracking-widest">{normalizePlate(v.license_plate)}</div>
                  <div className="text-xs text-muted-foreground">
                    {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </div>
                </div>
              </div>
            </motion.button>
          ))
        ) : (
          <div className="text-center p-4 text-sm text-muted-foreground">
            No vehicles registered yet
          </div>
        )}
      </div>

      {vehicles.length > 0 && (
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-background text-muted-foreground">or</span>
          </div>
        </div>
      )}

      {!showCustom ? (
        <Button onClick={() => setShowCustom(true)} variant="outline" className="w-full gap-2" disabled={disabled}>
          <Plus className="w-4 h-4" /> Enter Custom Plate
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          <input
            type="text"
            placeholder="e.g., CA9LXE850"
            value={customPlate}
            onChange={(e) => setCustomPlate(normalizePlate(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-input bg-transparent text-center font-mono tracking-widest text-lg"
            autoFocus
          />
          <p className="text-[10px] text-center text-muted-foreground">Spaces removed automatically · Always uppercase</p>
          <div className="flex gap-2">
            <Button onClick={() => { setShowCustom(false); setCustomPlate(''); }} variant="ghost" className="flex-1" disabled={disabled}>
              Cancel
            </Button>
            <Button
              onClick={() => customPlate && onSelect(customPlate)}
              disabled={!customPlate || disabled}
              className="flex-1"
            >
              Save & Continue
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}