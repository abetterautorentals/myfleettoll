import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Eye, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DuplicateWarning({ duplicate, onViewOriginal, onAddAnyway, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-background border-2 border-orange-500 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-xl font-black text-orange-300">⚠️ Duplicate Detected</h3>
          <p className="text-sm text-muted-foreground">This toll looks like one you already processed:</p>
        </div>

        <div className="bg-secondary rounded-2xl p-4 mb-5 text-left space-y-1.5">
          <p className="font-black text-base font-mono">{duplicate.license_plate}</p>
          <p className="text-sm text-muted-foreground">📅 {duplicate.occurrence_date} • <span className="font-bold text-foreground">${(duplicate.amount || 0).toFixed(2)}</span></p>
          {duplicate.location && <p className="text-xs text-muted-foreground">📍 {duplicate.location}</p>}
          {duplicate.lifecycle_status && (
            <p className="text-xs font-bold text-orange-400 mt-2">
              Status: {duplicate.lifecycle_status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              {duplicate.sent_date && ` • Sent ${duplicate.sent_date}`}
            </p>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground mb-4">Are you sure you want to add it again?</p>

        <div className="flex flex-col gap-2">
          <Button onClick={onViewOriginal} variant="outline" className="w-full h-11 rounded-xl gap-2 font-bold">
            <Eye className="w-4 h-4" /> View Original
          </Button>
          <Button onClick={onAddAnyway} className="w-full h-11 rounded-xl gap-2 font-bold bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4" /> Add Anyway
          </Button>
          <Button onClick={onCancel} variant="ghost" className="w-full h-10 rounded-xl text-sm">
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}