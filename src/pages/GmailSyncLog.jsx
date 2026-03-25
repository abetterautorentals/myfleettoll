import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ChevronDown, ChevronUp, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';

const actionColors = {
  imported_contract: 'text-green-600 bg-green-50 border-green-200',
  imported_toll: 'text-blue-600 bg-blue-50 border-blue-200',
  duplicate: 'text-muted-foreground bg-secondary border-border',
  skipped: 'text-muted-foreground bg-secondary border-border',
  error: 'text-red-600 bg-red-50 border-red-200',
};

const sourceColors = {
  turo: 'bg-blue-100 text-blue-700',
  upcar: 'bg-purple-100 text-purple-700',
  signnow: 'bg-orange-100 text-orange-700',
  fastrak: 'bg-red-100 text-red-700',
  unknown: 'bg-secondary text-muted-foreground',
};

export default function GmailSyncLog() {
  const [syncing, setSyncing] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['gmail-logs'],
    queryFn: () => base44.entities.EmailImportLog.list('-sync_time', 20),
    initialData: [],
  });

  const { data: gmailStatus } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => base44.functions.invoke('gmailStatus', {}).then(r => r.data),
    staleTime: 60000,
  });

  const handleSync = async () => {
    setSyncing(true);
    await base44.functions.invoke('gmailSync', {});
    setSyncing(false);
    queryClient.invalidateQueries({ queryKey: ['gmail-logs'] });
    queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
  };

  return (
    <div className="pb-24">
      <PageHeader emoji="📧" title="Gmail Sync Log" subtitle="Auto-import history & debug" action={
        <Button onClick={handleSync} disabled={syncing} className="rounded-2xl h-10 gap-2 font-bold">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync Now
        </Button>
      } />

      <div className="px-4 space-y-4">
        {/* Connection Status */}
        <div className={`rounded-2xl border-2 p-4 ${gmailStatus?.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            {gmailStatus?.connected
              ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
            <div>
              <p className={`font-black text-sm ${gmailStatus?.connected ? 'text-green-700' : 'text-red-700'}`}>
                {gmailStatus?.connected ? '✅ Gmail Connected' : '❌ Gmail Disconnected'}
              </p>
              {gmailStatus?.email && <p className="text-xs text-muted-foreground">{gmailStatus.email}</p>}
              {gmailStatus?.error && <p className="text-xs text-red-600">{gmailStatus.error}</p>}
              {gmailStatus?.lastSync && (
                <p className="text-xs text-muted-foreground">
                  Last sync: {format(new Date(gmailStatus.lastSync), 'MMM d, h:mm a')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sync Logs */}
        <div className="space-y-2">
          {isLoading && <div className="text-center py-8 text-muted-foreground text-sm">Loading logs...</div>}
          {logs.length === 0 && !isLoading && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-3xl mb-2">📭</p>
              <p className="font-bold">No sync logs yet</p>
              <p className="text-xs mt-1">Click "Sync Now" to run the first sync</p>
            </div>
          )}
          <AnimatePresence>
            {logs.map((log, i) => (
              <motion.div key={log.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Log Header */}
                <div className="p-3 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      log.status === 'success' ? 'bg-green-500' : log.status === 'partial' ? 'bg-orange-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-xs font-black">{format(new Date(log.sync_time), 'MMM d, h:mm a')}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {log.emails_scanned} scanned · {(log.contracts_imported || 0) + (log.tolls_imported || 0)} imported · {log.skipped || 0} skipped
                        {log.errors?.length > 0 && ` · ${log.errors.length} errors`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Source badges */}
                    <div className="flex gap-1">
                      {log.turo_found > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Turo:{log.turo_found}</span>}
                      {log.upcar_found > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">UpCar:{log.upcar_found}</span>}
                      {log.fastrak_found > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">FasTrak:{log.fastrak_found}</span>}
                      {log.signnow_found > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">SN:{log.signnow_found}</span>}
                    </div>
                    {expandedLog === log.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded Debug Panel */}
                <AnimatePresence>
                  {expandedLog === log.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden border-t border-border">
                      <div className="p-3 space-y-2">
                        {/* Errors */}
                        {log.errors?.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-2">
                            <p className="text-[10px] font-black text-red-700 mb-1">ERRORS</p>
                            {log.errors.map((e, i) => <p key={i} className="text-[10px] text-red-600">{e}</p>)}
                          </div>
                        )}

                        {/* Raw Items */}
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Raw Emails</p>
                        {(log.raw_items || []).length === 0 && (
                          <p className="text-xs text-muted-foreground">No emails processed</p>
                        )}
                        <div className="space-y-1.5 max-h-80 overflow-y-auto">
                          {(log.raw_items || []).map((item, i) => (
                            <div key={i} className={`rounded-xl border p-2 text-[10px] ${actionColors[item.action] || 'bg-secondary border-border text-muted-foreground'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold truncate">{item.subject || '(no subject)'}</p>
                                  <p className="text-[9px] opacity-70 truncate">{item.from}</p>
                                  {item.extracted && item.extracted !== '{}' && (
                                    <p className="mt-0.5 opacity-80 break-all">{item.extracted}</p>
                                  )}
                                  {item.skip_reason && <p className="mt-0.5 italic opacity-70">⚠️ {item.skip_reason}</p>}
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  {item.source && item.source !== 'unknown' && (
                                    <span className={`px-1.5 py-0.5 rounded-full font-bold text-[9px] ${sourceColors[item.source]}`}>{item.source}</span>
                                  )}
                                  <span className="font-black capitalize">{item.action?.replace(/_/g, ' ')}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}