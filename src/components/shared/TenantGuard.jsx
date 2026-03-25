import React from 'react';
import { useTenant } from '@/lib/TenantContext';
import Onboarding from '@/pages/Onboarding';
import { Loader2 } from 'lucide-react';

export default function TenantGuard({ children }) {
  const context = useTenant();
  const tenant = context?.tenant;
  const loading = context?.loading;
  const refreshTenant = context?.refreshTenant;

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-1">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
          <p className="text-sm font-bold text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return <Onboarding onComplete={refreshTenant} />;
  }

  if (!tenant.onboarding_completed && tenant.id !== 'owner') {
    return <Onboarding onComplete={refreshTenant} />;
  }

  return <>{children}</>;
}