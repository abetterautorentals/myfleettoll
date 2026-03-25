import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import PageHeader from '@/components/shared/PageHeader';

import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { TrendingUp, DollarSign, Car, Award, AlertTriangle } from 'lucide-react';

export default function FleetAnalytics() {
  const { tenant, isOwner, activeFleet: fleet } = useTenant();

  const { data: tolls = [] } = useQuery({
    queryKey: ['tolls-analytics', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.TollNotice.list('-occurrence_date', 500)
      : base44.entities.TollNotice.filter({ tenant_id: tenant?.id }, '-occurrence_date', 500),
    enabled: !!tenant,
    initialData: [],
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-analytics', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.RentalContract.list('-start_date', 500)
      : base44.entities.RentalContract.filter({ tenant_id: tenant?.id }, '-start_date', 500),
    enabled: !!tenant,
    initialData: [],
  });

  const filtered = fleet === 'all' ? tolls : tolls.filter(t => t.fleet === fleet);

  // Per-vehicle stats
  const vehicleStats = useMemo(() => {
    const map = {};
    for (const t of filtered) {
      if (!t.license_plate) continue;
      if (!map[t.license_plate]) map[t.license_plate] = { plate: t.license_plate, total: 0, count: 0, recovered: 0, disputes: 0 };
      map[t.license_plate].total += t.amount || 0;
      map[t.license_plate].count += 1;
      if (t.dispute_status === 'recovered') {
        map[t.license_plate].recovered += t.recovered_amount || 0;
        map[t.license_plate].disputes += 1;
      }
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const top5 = vehicleStats.slice(0, 5);

  // Monthly data (last 6 months)
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      const label = format(d, 'MMM');
      const monthTolls = filtered.filter(t => t.occurrence_date?.startsWith(key));
      const revenue = monthTolls.filter(t => t.dispute_status === 'recovered').reduce((s, t) => s + (t.recovered_amount || 0), 0);
      const amount = monthTolls.reduce((s, t) => s + (t.amount || 0), 0);
      months.push({ label, revenue, amount, count: monthTolls.length });
    }
    return months;
  }, [filtered]);

  // Summary stats
  const totalAmount = filtered.reduce((s, t) => s + (t.amount || 0), 0);
  const totalRecovered = filtered.filter(t => t.dispute_status === 'recovered').reduce((s, t) => s + (t.recovered_amount || 0), 0);
  const recoveryRate = totalAmount > 0 ? Math.round((totalRecovered / totalAmount) * 100) : 0;
  const disputeSuccess = filtered.filter(t => t.dispute_status === 'recovered').length;
  const disputeTotal = filtered.filter(t => ['pdf_generated','sent_to_agency','sent_to_renter','recovered','lost'].includes(t.dispute_status)).length;
  const disputeRate = disputeTotal > 0 ? Math.round((disputeSuccess / disputeTotal) * 100) : 0;
  const estimatedAnnualSavings = totalRecovered * (12 / 6); // annualized from 6 months

  // Best/Worst months
  const sortedMonths = [...monthlyData].sort((a, b) => b.revenue - a.revenue);
  const bestMonth = sortedMonths[0];
  const worstMonth = sortedMonths[sortedMonths.length - 1];

  return (
    <div>
      <PageHeader emoji="📊" title="Fleet Analytics" subtitle="Revenue, disputes & vehicle performance" />
      <div className="px-4 pb-24 space-y-5">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <KPICard icon={DollarSign} label="Total Toll Exposure" value={`$${totalAmount.toFixed(0)}`} color="red" />
          <KPICard icon={TrendingUp} label="Total Recovered" value={`$${totalRecovered.toFixed(0)}`} color="green" />
          <KPICard icon={Award} label="Dispute Win Rate" value={`${disputeRate}%`} color="blue" />
          <KPICard icon={Car} label="Vehicles Tracked" value={vehicleStats.length} color="purple" />
        </div>

        {/* Monthly Revenue Chart */}
        <Card title="📈 Monthly: Toll Exposure vs Recovered">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => `$${v.toFixed(2)}`} contentStyle={{ background: '#1a1f35', border: '1px solid #2a304a', borderRadius: 12 }} />
              <Legend />
              <Line type="monotone" dataKey="amount" stroke="#ef4444" name="Exposure" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" name="Recovered" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Top 5 Vehicles Bar Chart */}
        <Card title="🚗 Top 5 Vehicles by Toll Amount">
          {top5.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={top5} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="plate" tick={{ fontSize: 11, fill: '#888' }} width={70} />
                <Tooltip formatter={v => `$${v.toFixed(2)}`} contentStyle={{ background: '#1a1f35', border: '1px solid #2a304a', borderRadius: 12 }} />
                <Bar dataKey="total" fill="#4A9EFF" name="Total Tolls" radius={[0, 4, 4, 0]} />
                <Bar dataKey="recovered" fill="#22c55e" name="Recovered" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Best/Worst Months */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/10 border-2 border-green-500/20 rounded-2xl p-3">
            <p className="text-xs font-bold text-green-500 mb-1">🏆 Best Month</p>
            <p className="font-black text-lg">{bestMonth?.label || '—'}</p>
            <p className="text-xs text-muted-foreground">${(bestMonth?.revenue || 0).toFixed(0)} recovered</p>
          </div>
          <div className="bg-red-500/10 border-2 border-red-500/20 rounded-2xl p-3">
            <p className="text-xs font-bold text-red-500 mb-1">📉 Worst Month</p>
            <p className="font-black text-lg">{worstMonth?.label || '—'}</p>
            <p className="text-xs text-muted-foreground">${(worstMonth?.revenue || 0).toFixed(0)} recovered</p>
          </div>
        </div>

        {/* Estimated Annual Savings */}
        <div className="bg-primary/10 border-2 border-primary/20 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">💡 Estimated Annual Savings</p>
          <p className="text-4xl font-black text-primary">${estimatedAnnualSavings.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Based on last 6 months of recovery data</p>
        </div>

        {/* Vehicle Table */}
        <Card title="🚙 All Vehicles Performance">
          <div className="space-y-2">
            {vehicleStats.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No toll data yet</p>}
            {vehicleStats.map((v, i) => (
              <motion.div key={v.plate} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between bg-secondary rounded-xl px-3 py-2">
                <div>
                  <p className="font-black text-sm">{v.plate}</p>
                  <p className="text-[10px] text-muted-foreground">{v.count} tolls</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-red-500">${v.total.toFixed(2)}</p>
                  <p className="text-[10px] text-green-500">${v.recovered.toFixed(2)} back</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, color }) {
  // Icon is passed as prop
  const colors = {
    red: 'bg-red-500/10 border-red-500/20 text-red-500',
    green: 'bg-green-500/10 border-green-500/20 text-green-500',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-500',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 p-3 ${colors[color]}`}>
      <Icon className="w-5 h-5 mb-1" />
      <p className="text-xl font-black">{value}</p>
      <p className="text-[11px] font-bold opacity-70">{label}</p>
    </motion.div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="font-black text-sm mb-3">{title}</p>
      {children}
    </div>
  );
}