import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { AlertTriangle, CheckCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const logTypeIcons = {
  upload_failure: '📤',
  ocr_failure: '🤖',
  extraction_failure: '📄',
  match_failure: '🔗',
  sync_failure: '📧',
};

const severityColors = {
  low: 'bg-blue-50 border-blue-200 text-blue-700',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  high: 'bg-orange-50 border-orange-200 text-orange-700',
  critical: 'bg-red-50 border-red-200 text-red-700',
};

export default function AdminLog() {
  const { isOwner } = useTenant();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [filterResolved, setFilterResolved] = useState(false);

  // Only owner can view admin logs
  if (!isOwner) {
    return (
      <div className="p-4">
        <PageHeader emoji="🔒" title="Admin Logs" subtitle="Owner only" />
        <EmptyState emoji="🚫" title="Not authorized" subtitle="Only the owner can access admin logs" />
      </div>
    );
  }

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => base44.entities.AdminLog.list('-created_date', 500),
    initialData: [],
  });

  const filtered = logs.filter(l => filterResolved ? l.is_resolved : !l.is_resolved);

  const resolveMutation = useMutation({
    mutationFn: (logId) => base44.entities.AdminLog.update(logId, { is_resolved: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-logs'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (logId) => base44.entities.AdminLog.delete(logId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-logs'] }),
  });

  return (
    <div>
      <PageHeader
        emoji="📋"
        title="Admin Log"
        subtitle="Upload, extraction, and sync failures"
      />

      <div className="px-4 space-y-3">
        {/* Filter buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterResolved(false)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              !filterResolved
                ? 'bg-red-500 text-white'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            🔴 Unresolved ({logs.filter(l => !l.is_resolved).length})
          </button>
          <button
            onClick={() => setFilterResolved(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              filterResolved
                ? 'bg-green-500 text-white'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            ✅ Resolved ({logs.filter(l => l.is_resolved).length})
          </button>
        </div>

        {/* Logs list */}
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <EmptyState
              emoji={filterResolved ? '✅' : '🎉'}
              title={filterResolved ? 'No resolved logs yet' : 'All clear!'}
              subtitle={filterResolved ? 'No failures have been marked resolved' : 'No unresolved failures'}
            />
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map((log, i) => (
                <LogItem
                  key={log.id}
                  log={log}
                  index={i}
                  isExpanded={expandedId === log.id}
                  onToggleExpand={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  onResolve={() => resolveMutation.mutate(log.id)}
                  onDelete={() => deleteMutation.mutate(log.id)}
                  isResolving={resolveMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LogItem({ log, index, isExpanded, onToggleExpand, onResolve, onDelete, isResolving, isDeleting }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`border-2 rounded-2xl p-3 ${severityColors[log.severity] || severityColors.medium}`}
    >
      <button
        onClick={onToggleExpand}
        className="w-full text-left flex items-start gap-2 hover:opacity-80 transition-opacity"
      >
        <span className="text-lg flex-shrink-0 mt-0.5">
          {logTypeIcons[log.log_type] || '📝'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <div>
              <p className="font-bold text-sm">{log.title}</p>
              <p className="text-xs text-current opacity-70 mt-0.5">
                {log.tenant_id} • {format(new Date(log.created_date), 'MMM d, h:mm a')}
              </p>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 pt-3 border-t border-current border-opacity-20 space-y-2"
        >
          {/* Message */}
          <div>
            <p className="text-[10px] font-bold opacity-70 uppercase">Message</p>
            <p className="text-xs font-mono bg-black/10 rounded-lg p-2 mt-1 whitespace-pre-wrap break-words">
              {log.message}
            </p>
          </div>

          {/* File details */}
          {log.file_name && (
            <div>
              <p className="text-[10px] font-bold opacity-70 uppercase">File</p>
              <p className="text-xs font-mono">{log.file_name}</p>
              {log.file_url && (
                <a
                  href={log.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 underline block mt-1"
                >
                  View file →
                </a>
              )}
            </div>
          )}

          {/* Extracted data preview */}
          {log.extracted_data && (
            <div>
              <p className="text-[10px] font-bold opacity-70 uppercase">Extracted Data</p>
              <pre className="text-[10px] font-mono bg-black/10 rounded-lg p-2 mt-1 overflow-x-auto max-h-32">
                {JSON.stringify(log.extracted_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Stack trace */}
          {log.error_stack && (
            <details>
              <summary className="text-[10px] font-bold opacity-70 uppercase cursor-pointer hover:opacity-100">
                Stack Trace
              </summary>
              <pre className="text-[10px] font-mono bg-black/10 rounded-lg p-2 mt-1 overflow-x-auto max-h-32">
                {log.error_stack}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {!log.is_resolved && (
              <Button
                size="sm"
                onClick={onResolve}
                disabled={isResolving}
                className="flex-1 h-7 rounded-lg text-xs bg-green-500 text-white hover:bg-green-600"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                {isResolving ? '...' : 'Resolved'}
              </Button>
            )}
            <Button
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              variant="outline"
              className="flex-1 h-7 rounded-lg text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {isDeleting ? '...' : 'Delete'}
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}