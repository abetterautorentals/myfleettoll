import React from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import BottomNav from './BottomNav';
import TopBar from './TopBar';
import CookieBanner from '@/components/shared/CookieBanner';
import UpdateBanner from '@/components/shared/UpdateBanner';

export default function AppLayout() {
  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: () => base44.entities.Alert.filter({ is_read: false }),
    initialData: [],
  });

  return (
    <div className="min-h-screen bg-background">
      <UpdateBanner />
      <TopBar />
      <main className="pb-20 max-w-lg mx-auto">
        <Outlet />
      </main>
      <BottomNav alertCount={alerts.length} />
      <CookieBanner />
    </div>
  );
}