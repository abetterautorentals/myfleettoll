import React from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';
import FleetSelector from '@/components/shared/FleetSelector';

export default function TopBar() {
  const { user, activeFleet, setActiveFleet, fleets } = useTenant() || {};
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase();

  return (
    <div className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border/50">
      <div className="max-w-lg mx-auto px-4 py-2">
        <div className="flex items-center justify-between h-10 mb-1.5">
          {/* Avatar → Settings */}
          <Link to="/settings" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-xs font-black text-primary group-hover:bg-primary/30 transition-colors">
              {initials}
            </div>
            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors hidden sm:block">
              {user?.full_name?.split(' ')[0] || 'Account'}
            </span>
          </Link>

          {/* App name */}
          <span className="text-xs font-black text-muted-foreground tracking-widest uppercase">FleetToll Pro</span>

          {/* Gear → Settings */}
          <Link to="/settings" className="p-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Settings className="w-5 h-5" />
          </Link>
        </div>

        {/* Fleet selector — always visible */}
        {fleets && fleets.length > 0 && (
          <div className="py-1">
            <FleetSelector selected={activeFleet} onSelect={setActiveFleet} useGlobal={true} />
          </div>
        )}
      </div>
    </div>
  );
}