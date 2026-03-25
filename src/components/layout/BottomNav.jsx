import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Receipt, FileText, Bell, BarChart2, Settings, Target } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';

const baseTabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/tolls', icon: Receipt, label: 'Tolls' },
  { path: '/contracts', icon: FileText, label: 'Contracts' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics' },
  { path: '/match-queue', icon: Target, label: 'Match' },
];

export default function BottomNav({ alertCount = 0 }) {
  const location = useLocation();
  const { isOwner } = useTenant() || {};

  const tabs = isOwner
    ? [...baseTabs, { path: '/admin', icon: Settings, label: 'Admin' }]
    : [...baseTabs, { path: '/settings', icon: Settings, label: 'Settings' }];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t-2 border-border shadow-lg pb-safe">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? 'text-primary scale-110'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[9px] font-bold">{label}</span>
              {label === 'Alerts' && alertCount > 0 && (
                <span className="absolute -top-0.5 right-0 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}