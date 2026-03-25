import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

const config = {
  matched: { icon: CheckCircle, label: 'Matched', bg: 'dark:bg-green-950/40 light:bg-green-50', text: 'dark:text-green-300 light:text-green-700', border: 'dark:border-green-600 light:border-green-300' },
  unmatched: { icon: XCircle, label: 'No Match', bg: 'dark:bg-red-950/40 light:bg-red-50', text: 'dark:text-red-300 light:text-red-700', border: 'dark:border-red-600 light:border-red-300' },
  pending_signature: { icon: Clock, label: 'Pending Sig', bg: 'dark:bg-orange-950/40 light:bg-amber-50', text: 'dark:text-orange-300 light:text-amber-700', border: 'dark:border-orange-600 light:border-amber-300' },
  manual_review: { icon: AlertTriangle, label: 'Review', bg: 'dark:bg-orange-950/40 light:bg-amber-50', text: 'dark:text-orange-300 light:text-amber-700', border: 'dark:border-orange-600 light:border-amber-300' },
};

export default function MatchBadge({ status }) {
  const c = config[status] || config.unmatched;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text} border ${c.border}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}