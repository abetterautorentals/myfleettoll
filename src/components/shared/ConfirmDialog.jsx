import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ConfirmDialog({ open, title = 'Are you sure?', message = 'This cannot be undone.', onConfirm, onCancel, confirmLabel = 'Delete', confirmClass = 'bg-red-500 hover:bg-red-600 text-white' }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onCancel()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-background rounded-3xl p-6 max-w-sm w-full shadow-2xl"
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-black">{title}</h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <div className="flex gap-3 mt-5">
            <Button variant="outline" onClick={onCancel} className="flex-1 rounded-2xl font-bold">Cancel</Button>
            <Button onClick={onConfirm} className={`flex-1 rounded-2xl font-bold ${confirmClass}`}>{confirmLabel}</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}