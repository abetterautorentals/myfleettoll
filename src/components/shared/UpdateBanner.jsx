import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { X, Sparkles } from 'lucide-react';

export default function UpdateBanner() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    const check = async () => {
      const versions = await base44.entities.AppVersion.list('-created_date', 1);
      if (versions.length === 0) return;
      const latest = versions[0];
      const seen = localStorage.getItem('seen_version');
      if (seen !== latest.id) {
        setUpdate(latest);
      }
    };
    check().catch(() => {});
  }, []);

  const dismiss = () => {
    if (update) localStorage.setItem('seen_version', update.id);
    setUpdate(null);
  };

  return (
    <AnimatePresence>
      {update && (
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
          className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">✨ v{update.version} — {update.changelog}</span>
          <button onClick={dismiss}><X className="w-4 h-4" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}