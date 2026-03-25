import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, CheckCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BulkActionBar({ selectedCount, onDelete, onMarkPaid, onMarkSent, onCancel, loading }) {
  if (selectedCount === 0) return null;
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-20 left-0 right-0 z-40 px-4"
    >
      <div className="bg-card border-2 border-primary rounded-2xl p-3 shadow-2xl">
        <p className="text-xs font-black text-center text-muted-foreground mb-2">
          {selectedCount} toll{selectedCount !== 1 ? 's' : ''} selected
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={onDelete}
            disabled={loading}
            size="sm"
            className="h-10 rounded-xl gap-1.5 font-bold bg-red-600 hover:bg-red-700 text-white text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
          <Button
            onClick={onMarkPaid}
            disabled={loading}
            size="sm"
            className="h-10 rounded-xl gap-1.5 font-bold bg-green-600 hover:bg-green-700 text-white text-xs"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
          </Button>
          <Button
            onClick={onMarkSent}
            disabled={loading}
            size="sm"
            className="h-10 rounded-xl gap-1.5 font-bold bg-blue-600 hover:bg-blue-700 text-white text-xs"
          >
            <Send className="w-3.5 h-3.5" /> Mark Sent
          </Button>
        </div>
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-8 text-xs text-muted-foreground"
        >
          <X className="w-3 h-3 mr-1" /> Cancel Selection
        </Button>
      </div>
    </motion.div>
  );
}