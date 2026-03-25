import React from 'react';

const LIFECYCLE = {
  unmatched:      { label: '🔴 Unmatched',      bg: 'bg-red-950/50 border-red-600 text-red-300' },
  matched:        { label: '🟡 Matched',         bg: 'bg-yellow-950/50 border-yellow-600 text-yellow-300' },
  package_ready:  { label: '🟠 Package Ready',   bg: 'bg-orange-950/50 border-orange-500 text-orange-300' },
  sent:           { label: '🔵 Sent',            bg: 'bg-blue-950/50 border-blue-500 text-blue-300' },
  resent:         { label: '🔵 Resent',          bg: 'bg-blue-950/50 border-blue-400 text-blue-200' },
  resolved:       { label: '🟢 Resolved',        bg: 'bg-green-950/50 border-green-500 text-green-300' },
  archived:       { label: '⚫ Archived',        bg: 'bg-secondary border-border text-muted-foreground' },
};

export default function TollLifecycleBadge({ status }) {
  const cfg = LIFECYCLE[status] || LIFECYCLE.unmatched;
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.bg} whitespace-nowrap`}>
      {cfg.label}
    </span>
  );
}

export { LIFECYCLE };