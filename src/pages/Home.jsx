import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Receipt, FileText, AlertTriangle, TrendingUp, Car, Plus, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/lib/TenantContext';
import StatBubble from '@/components/shared/StatBubble';
import VehicleCard from '@/components/vehicles/VehicleCard';
import FleetSelector from '@/components/shared/FleetSelector';
import MatchBadge from '@/components/shared/MatchBadge';
import StatusBadge from '@/components/shared/StatusBadge';
import SmartMatchPanel from '@/components/tolls/SmartMatchPanel';
import { format, isToday, isBefore } from 'date-fns';

export default function Home() {
  const navigate = useNavigate();
  const { tenant, isOwner, activeFleet: fleet, setActiveFleet: setFleet } = useTenant();

  const { data: tolls = [] } = useQuery({
    queryKey: ['tolls', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.TollNotice.list('-created_date', 100)
      : base44.entities.TollNotice.filter({ tenant_id: tenant?.id }, '-created_date', 100),
    enabled: !!tenant,
    initialData: [],
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.RentalContract.list('-created_date', 100)
      : base44.entities.RentalContract.filter({ tenant_id: tenant?.id }, '-created_date', 100),
    enabled: !!tenant,
    initialData: [],
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: () => base44.entities.Alert.filter({ is_read: false }),
    initialData: [],
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    initialData: [],
  });

  const filtered = {
    tolls: fleet === 'all' ? tolls : tolls.filter(t => t.fleet === fleet),
    contracts: fleet === 'all' ? contracts : contracts.filter(c => c.fleet === fleet),
  };

  const unmatchedCount = filtered.tolls.filter(t => t.match_status === 'unmatched').length;
  const pendingSigs = filtered.contracts.filter(c => c.signature_status === 'pending').length;
  const tripsEndingToday = filtered.contracts.filter(c => {
    if (!c.end_date) return false;
    return isToday(new Date(c.end_date));
  });
  const overdueTrips = filtered.contracts.filter(c => {
    if (!c.end_date || c.status === 'completed') return false;
    return isBefore(new Date(c.end_date), new Date()) && c.status === 'active';
  });

  const totalTollAmount = filtered.tolls.reduce((s, t) => s + (t.amount || 0), 0);
  const recoveredAmount = filtered.tolls.filter(t => t.dispute_status === 'recovered').reduce((s, t) => s + (t.recovered_amount || 0), 0);
  const recoveryRate = totalTollAmount > 0 ? Math.round((recoveredAmount / totalTollAmount) * 100) : 0;

  const trialDaysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / 86400000))
    : null;

  return (
    <div className="px-4">
      {/* Subscription banners */}
      {!isOwner && tenant?.subscription_status === 'trialing' && trialDaysLeft !== null && (
        <div className="mt-3 bg-blue-950/40 border-2 border-blue-600 rounded-2xl px-3 py-2 text-xs font-bold text-blue-300 flex items-center justify-between">
          <span>🎯 Trial: {trialDaysLeft} days left</span>
          <Link to="/subscription" className="underline">Upgrade now</Link>
        </div>
      )}
      {!isOwner && tenant?.subscription_status === 'past_due' && (
        <div className="mt-3 bg-red-950/40 border-2 border-red-600 rounded-2xl px-3 py-2 text-xs font-bold text-red-300 flex items-center justify-between animate-pulse">
          <span>⚠️ Payment failed — update billing</span>
          <Link to="/subscription" className="underline">Fix now</Link>
        </div>
      )}

      {/* Header */}
      <div className="pt-6 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">⚡ {isOwner ? 'FleetToll Pro' : (tenant?.company_name || 'FleetToll Pro')}</h1>
          <p className="text-xs text-muted-foreground/90 font-semibold">Toll Management Dashboard</p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <StatBubble icon={Receipt} label="Unmatched Tolls" value={unmatchedCount} color={unmatchedCount > 0 ? 'red' : 'green'} onClick={() => navigate('/unmatched-queue')} />
        <StatBubble icon={FileText} label="Pending Signatures" value={pendingSigs} color={pendingSigs > 0 ? 'orange' : 'green'} onClick={() => navigate('/contracts?filter=pending_signature')} />
        <StatBubble icon={TrendingUp} label="Recovery Rate" value={`${recoveryRate}%`} color={recoveryRate >= 70 ? 'green' : recoveryRate >= 40 ? 'orange' : 'red'} onClick={() => navigate('/reports')} />
        <StatBubble icon={AlertTriangle} label="Alerts" value={alerts.length} color={alerts.length > 0 ? 'orange' : 'blue'} onClick={() => navigate('/alerts')} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 mt-5">
        <Link to="/scanner" className="flex-1">
          <Button className="w-full h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 text-white font-bold text-sm gap-1 shadow-lg hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transition-all">
            <Camera className="w-4 h-4" />
            <span className="text-xs">Scan</span>
          </Button>
        </Link>
        <Link to="/tolls/upload" className="flex-1">
          <Button className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-sm gap-1 shadow-lg hover:bg-primary/90">
            <Camera className="w-4 h-4" />
            <span className="text-xs">Upload</span>
          </Button>
        </Link>
        <Link to="/contracts/add" className="flex-1">
          <Button className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-sm gap-1 shadow-lg hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            <span className="text-xs">Contract</span>
          </Button>
        </Link>
      </div>

      {/* Trips Ending Today */}
      {tripsEndingToday.length > 0 && (
        <Section title="⏰ Trips Ending Today" count={tripsEndingToday.length}>
          {tripsEndingToday.map(c => (
            <TripCard key={c.id} contract={c} />
          ))}
        </Section>
      )}

      {/* Overdue Trips */}
      {overdueTrips.length > 0 && (
        <Section title="🚨 Overdue Trips" count={overdueTrips.length}>
          {overdueTrips.map(c => (
            <TripCard key={c.id} contract={c} overdue />
          ))}
        </Section>
      )}

      {/* Recent Unmatched Tolls */}
      <Section title="🔴 Recent Unmatched Tolls" count={unmatchedCount}>
        {filtered.tolls.filter(t => t.match_status === 'unmatched').slice(0, 5).map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="dark:bg-red-950/40 dark:border-red-600 light:bg-red-50 light:border-red-300 border-2 rounded-2xl p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-foreground">{t.license_plate}</p>
                <p className="text-xs text-muted-foreground/90">{t.occurrence_date} • {t.agency || 'Unknown Agency'}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-red-300">${(t.amount || 0).toFixed(2)}</p>
                <MatchBadge status="unmatched" />
              </div>
            </div>
            <SmartMatchPanel toll={t} />
          </motion.div>
        ))}
        {unmatchedCount === 0 && (
          <div className="text-center py-6 text-muted-foreground/90">
            <span className="text-3xl">🎉</span>
            <p className="font-bold mt-1 text-sm">All tolls matched!</p>
          </div>
        )}
      </Section>

      {/* Fleet Overview */}
      <Section title="🚙 Fleet Overview">
        <div className="grid grid-cols-2 gap-3">
          {vehicles.filter(v => fleet === 'all' || v.fleet === fleet).slice(0, 6).map((v, i) => (
            <VehicleCard key={v.id} vehicle={v} index={i} />
          ))}
          <Link to="/vehicles/add" className="bg-secondary rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground min-h-[160px] hover:bg-secondary/80 transition-colors">
            <Plus className="w-7 h-7 mb-1" />
            <span className="text-xs font-bold">Add Vehicle</span>
          </Link>
        </div>
      </Section>

      <div className="h-4" />
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-black">{title}</h2>
        {count !== undefined && <span className="text-xs font-bold bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{count}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function TripCard({ contract, overdue }) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      className={`rounded-2xl p-3 border-2 flex items-center justify-between ${overdue ? 'dark:bg-red-950/40 dark:border-red-600 light:bg-red-50 light:border-red-300' : 'dark:bg-orange-950/40 dark:border-orange-600 light:bg-amber-50 light:border-amber-300'}`}
    >
      <div>
        <p className="font-bold text-sm text-foreground">{contract.renter_name}</p>
        <p className="text-xs text-muted-foreground/90">
          {contract.license_plate} • {contract.platform}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold">
          {contract.end_date ? format(new Date(contract.end_date), 'h:mm a') : '—'}
        </p>
        <StatusBadge status={overdue ? 'overdue' : contract.status} />
      </div>
    </motion.div>
  );
}