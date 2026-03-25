import React from 'react';
import { useTenant } from '@/lib/TenantContext';

// Default colors by fleet index when no color is set on the fleet record
const FALLBACK_COLORS = ['#4A9EFF', '#F97316', '#22C55E', '#A855F7', '#F43F5E', '#06B6D4'];

export default function FleetSelector({ selected, onSelect, useGlobal = false }) {
  const { fleets, activeFleet, setActiveFleet } = useTenant() || { fleets: [] };

  // If useGlobal=true, read/write from TenantContext global state
  const value = useGlobal ? activeFleet : selected;
  const onChange = useGlobal ? setActiveFleet : onSelect;

  const options = [
    { id: 'all', label: 'All', color: null },
    ...fleets.map((f, i) => ({
      id: f.id,
      label: f.name,
      color: f.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    })),
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((f) => {
        const isActive = value === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${
              isActive
                ? 'shadow-md scale-105 text-white'
                : 'dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80 light:bg-gray-200 light:text-gray-800 light:hover:bg-gray-300 border-transparent'
            }`}
            style={isActive && f.color
              ? { backgroundColor: f.color, borderColor: f.color }
              : isActive
              ? {}
              : { borderColor: 'transparent' }
            }
          >
            {f.id !== 'all' && (
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : (f.color || '#888') }}
              />
            )}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}