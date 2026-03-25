import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

export default function GmailSyncButton({ invalidateKeys = [] }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    const res = await base44.functions.invoke('gmailSync', {});
    setResult(res.data);
    setSyncing(false);
    for (const key of invalidateKeys) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const statusColor = result?.status === 'success' ? 'text-green-600 bg-green-50 border-green-200'
    : result?.status === 'partial' ? 'text-orange-600 bg-orange-50 border-orange-200'
    : result?.status === 'error' ? 'text-red-600 bg-red-50 border-red-200'
    : '';

  return (
    <div className="space-y-2">
      <Button onClick={handleSync} disabled={syncing} variant="outline"
        className="w-full h-10 rounded-2xl font-bold gap-2 border-2 border-primary/20 text-primary hover:bg-primary/5">
        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {syncing ? 'Syncing Gmail...' : '📧 Sync Gmail Now'}
      </Button>

      {result && (
        <div className={`rounded-2xl border-2 p-3 text-xs font-bold ${statusColor}`}>
          <div className="flex items-center justify-between">
            <span>
              {result.status === 'error' ? '❌' : result.status === 'partial' ? '⚠️' : '✅'}
              {' '}{result.emails_scanned} scanned · {(result.contracts_imported || 0) + (result.tolls_imported || 0)} imported
              {result.errors?.length > 0 && ` · ${result.errors.length} errors`}
            </span>
            <button onClick={() => setShowDebug(v => !v)} className="flex items-center gap-0.5 opacity-70">
              Debug {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showDebug && (
            <div className="mt-2 space-y-1 font-mono text-[10px]">
              <p>Turo: {result.turo_found} · UpCar: {result.upcar_found} · FasTrak: {result.fastrak_found} · SignNow: {result.signnow_found}</p>
              {result.errors?.map((e, i) => <p key={i} className="text-red-600">⚠ {e}</p>)}
              <div className="max-h-48 overflow-y-auto space-y-1 mt-1">
                {(result.rawItems || []).map((item, i) => (
                  <div key={i} className="bg-black/5 rounded-lg p-1.5">
                    <p className="font-bold truncate">{item.subject}</p>
                    <p className="opacity-70 truncate">{item.from}</p>
                    <p>→ <span className="font-black">{item.action}</span>{item.skip_reason ? ` (${item.skip_reason})` : ''}</p>
                    {item.extracted && item.extracted !== '{}' && <p className="opacity-60 break-all">{item.extracted}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}