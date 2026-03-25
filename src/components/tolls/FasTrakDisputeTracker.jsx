import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * FasTrak highway toll dispute workflow for matched rental tolls.
 * Tracks: dispute package built → sent to FasTrak → receipt confirmed → resolved
 */
export default function FasTrakDisputeTracker({ toll }) {
  const queryClient = useQueryClient();
  const [showDateInput, setShowDateInput] = useState(false);
  const [sentDate, setSentDate] = useState(new Date().toISOString().split('T')[0]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.TollNotice.update(toll.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tolls'] }),
  });

  // Status mapping
  const isPackageReady = toll.lifecycle_status === 'package_ready';
  const isSent = toll.lifecycle_status === 'sent' || toll.lifecycle_status === 'resent';
  const isResolved = toll.lifecycle_status === 'resolved';

  const handleMarkSent = () => {
    updateMutation.mutate({
      lifecycle_status: 'sent',
      sent_date: sentDate,
    });
    setShowDateInput(false);
  };

  const handleMarkResolved = () => {
    updateMutation.mutate({
      lifecycle_status: 'resolved',
      resolved_date: new Date().toISOString().split('T')[0],
    });
  };

  // Show resolved state
  if (isResolved) {
    return (
      <div className="mt-2 pt-2 border-t border-green-200 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-green-700 bg-green-50 rounded-xl px-3 py-2 border border-green-200">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ✅ Resolved {toll.resolved_date}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-orange-200 space-y-2">
      {/* Status Checkboxes */}
      <div className="space-y-2">
        {/* 1. Package Built */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            isPackageReady || isSent || isResolved 
              ? 'bg-green-500 border-green-500' 
              : 'border-gray-300'
          }`}>
            {(isPackageReady || isSent || isResolved) && (
              <CheckCircle2 className="w-3 h-3 text-white" />
            )}
          </div>
          <span className="text-xs font-semibold text-gray-700">Dispute package built</span>
        </label>

        {/* 2. Sent to FasTrak */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              isSent || isResolved
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300'
            }`}>
              {(isSent || isResolved) && (
                <CheckCircle2 className="w-3 h-3 text-white" />
              )}
            </div>
            <span className="text-xs font-semibold text-gray-700">
              Sent to FasTrak
              {isSent && toll.sent_date && <span className="text-gray-500 font-normal ml-1">({toll.sent_date})</span>}
            </span>
          </label>

          {/* Date input for sent */}
          <AnimatePresence>
            {!isSent && !isResolved && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {showDateInput ? (
                  <div className="ml-6 flex gap-2 items-center">
                    <Input
                      type="date"
                      value={sentDate}
                      onChange={e => setSentDate(e.target.value)}
                      className="h-8 text-xs rounded-xl flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8 rounded-xl text-xs bg-green-500 text-white hover:bg-green-600 px-3"
                      onClick={handleMarkSent}
                      disabled={updateMutation.isPending}
                    >
                      ✓ Save
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDateInput(true)}
                    className="ml-6 text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1.5 py-1"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Set sent date
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. FasTrak Confirmed Receipt */}
        <label className="flex items-center gap-2.5 cursor-pointer opacity-50">
          <div className="flex-shrink-0 w-4 h-4 rounded border-2 border-gray-300">
          </div>
          <span className="text-xs font-semibold text-gray-600">FasTrak confirmed receipt (future)</span>
        </label>

        {/* 4. Resolved */}
        {isSent && !isResolved && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              size="sm"
              onClick={handleMarkResolved}
              className="w-full h-8 rounded-xl text-xs bg-green-500 text-white hover:bg-green-600 font-bold gap-1.5"
              disabled={updateMutation.isPending}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark as Resolved
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}