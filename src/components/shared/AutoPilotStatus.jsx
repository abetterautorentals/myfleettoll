import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Shows the 24/7 AutoPilot status — last gmail sync time,
 * and a per-fleet forwarding address.
 */
export default function AutoPilotStatus({ fleets = [] }) {
  const { data: syncState } = useQuery({
    queryKey: ['sync-state'],
    queryFn: () => base44.entities.SyncState.filter({ key: 'gmail_history_id' }),
    refetchInterval: 60000,
    initialData: [],
  });

  const lastSync = syncState?.[0]?.last_synced;

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="font-black text-sm">AutoPilot Active</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
          <Clock className="w-3.5 h-3.5" />
          {lastSync ? `Synced ${formatDistanceToNow(new Date(lastSync), { addSuffix: true })}` : 'Setting up...'}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        📧 Emails arriving at your fleet addresses are processed automatically 24/7 — tolls extracted, matched to contracts, ready to send.
      </p>

      {/* Fleet forwarding addresses */}
      <div className="space-y-2">
        {fleets.filter(f => f.email_alias).map(f => (
          <div key={f.id} className="bg-background/70 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div>
              <p className="font-bold text-xs">{f.name}</p>
              <p className="text-[11px] text-primary font-mono font-bold">{f.email_alias}</p>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(f.email_alias)}
              className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Copy
            </button>
          </div>
        ))}
      </div>

      {fleets.filter(f => f.email_alias).length === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs font-bold text-orange-700">
          ⚠️ No email aliases set up yet — go to Settings → Fleets to create one
        </div>
      )}

      <div className="border-t border-primary/10 pt-2">
        <p className="text-[11px] text-muted-foreground font-bold flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-primary" />
          Forward FasTrak, Turo, UpCar & SignNow emails to your fleet address — the app handles the rest.
        </p>
      </div>
    </div>
  );
}