import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Check, Trash2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimezone } from '@/lib/TimezoneContext';
import { formatDateInTimezone } from '@/lib/formatDate';

const severityConfig = {
  critical: { bg: 'bg-red-950/40 border-red-600', icon: '🚨', text: 'text-red-300' },
  warning: { bg: 'bg-orange-950/40 border-orange-600', icon: '⚠️', text: 'text-orange-300' },
  info: { bg: 'bg-blue-950/40 border-blue-600', icon: 'ℹ️', text: 'text-blue-300' },
  success: { bg: 'bg-green-950/40 border-green-600', icon: '✅', text: 'text-green-300' },
};

const typeEmoji = {
  trip_ending: '⏰',
  trip_extended: '📅',
  toll_matched: '🎉',
  toll_unmatched: '🔴',
  pending_signature: '✍️',
  non_fastrak: '⚠️',
  violation: '🚨',
  no_return_photos: '📸',
  monthly_summary: '📊',
};

export default function Alerts() {
  const { timezone } = useTimezone();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list('-created_date', 100),
    initialData: [],
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Alert.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-unread'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Alert.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-unread'] });
    },
  });

  const markAllRead = async () => {
    const unread = alerts.filter(a => !a.is_read);
    for (const a of unread) {
      await base44.entities.Alert.update(a.id, { is_read: true });
    }
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['alerts-unread'] });
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div>
      <PageHeader emoji="🔔" title="Alerts" subtitle={`${unreadCount} unread`}
        action={unreadCount > 0 && (
          <Button onClick={markAllRead} variant="outline" className="rounded-xl text-xs font-bold gap-1">
            <Check className="w-3 h-3" /> Mark All Read
          </Button>
        )}
      />
      <div className="px-4">
        <AnimatePresence mode="popLayout">
          {alerts.length === 0 && !isLoading ? (
            <EmptyState emoji="🔔" title="All clear!" subtitle="No alerts right now — great job!" />
          ) : (
            <div className="space-y-2 pb-4">
              {alerts.map((alert, i) => {
                const config = severityConfig[alert.severity] || severityConfig.info;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-2xl border-2 p-3 ${config.bg} ${alert.is_read ? 'opacity-60' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span>{typeEmoji[alert.type] || config.icon}</span>
                          <span className={`font-bold text-sm ${config.text}`}>{alert.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                        {alert.license_plate && <p className="text-[10px] text-muted-foreground mt-0.5">🚗 {alert.license_plate}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {alert.created_date ? formatDateInTimezone(alert.created_date, timezone, 'datetime-short') : ''}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!alert.is_read && (
                          <Button size="icon" variant="ghost" onClick={() => markReadMutation.mutate(alert.id)}
                            className="h-8 w-8 rounded-xl">
                            <Check className="w-4 h-4 text-green-400" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(alert.id)}
                          className="h-8 w-8 rounded-xl">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}