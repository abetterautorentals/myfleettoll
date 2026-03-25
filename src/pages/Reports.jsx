import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import PageHeader from '@/components/shared/PageHeader';

import { motion } from 'framer-motion';
import { format, startOfMonth, subMonths, isAfter } from 'date-fns';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6'];

export default function Reports() {
  const { activeFleet: fleet } = useTenant();

  const { data: tolls = [] } = useQuery({
    queryKey: ['tolls'],
    queryFn: () => base44.entities.TollNotice.list('-occurrence_date', 500),
    initialData: [],
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    initialData: [],
  });

  const filtered = fleet === 'all' ? tolls : tolls.filter(t => t.fleet === fleet);

  const totalAmount = filtered.reduce((s, t) => s + (t.amount || 0), 0);
  const recoveredAmount = filtered.filter(t => t.dispute_status === 'recovered').reduce((s, t) => s + (t.recovered_amount || 0), 0);
  const lostAmount = filtered.filter(t => t.dispute_status === 'lost').reduce((s, t) => s + (t.amount || 0), 0);
  const pendingAmount = totalAmount - recoveredAmount - lostAmount;
  const recoveryRate = totalAmount > 0 ? Math.round((recoveredAmount / totalAmount) * 100) : 0;

  // Monthly trends (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const monthStart = startOfMonth(subMonths(new Date(), 5 - i));
    const monthEnd = startOfMonth(subMonths(new Date(), 4 - i));
    const monthTolls = filtered.filter(t => {
      if (!t.occurrence_date) return false;
      const d = new Date(t.occurrence_date);
      return isAfter(d, monthStart) && (!monthEnd || d < monthEnd || i === 5);
    });
    return {
      month: format(monthStart, 'MMM'),
      total: monthTolls.reduce((s, t) => s + (t.amount || 0), 0),
      recovered: monthTolls.filter(t => t.dispute_status === 'recovered').reduce((s, t) => s + (t.recovered_amount || 0), 0),
      count: monthTolls.length,
    };
  });

  // Fleet breakdown
  const fleetBreakdown = [
    { name: 'Concesionario', value: tolls.filter(t => t.fleet === 'concesionario').reduce((s, t) => s + (t.amount || 0), 0) },
    { name: 'Bar Auto', value: tolls.filter(t => t.fleet === 'bar_auto_rentals').reduce((s, t) => s + (t.amount || 0), 0) },
  ].filter(f => f.value > 0);

  // Match status breakdown
  const statusBreakdown = [
    { name: 'Matched', value: filtered.filter(t => t.match_status === 'matched').length },
    { name: 'Unmatched', value: filtered.filter(t => t.match_status === 'unmatched').length },
    { name: 'Pending Sig', value: filtered.filter(t => t.match_status === 'pending_signature').length },
    { name: 'Review', value: filtered.filter(t => t.match_status === 'manual_review').length },
  ].filter(s => s.value > 0);

  // Per vehicle
  const vehicleBreakdown = {};
  filtered.forEach(t => {
    if (!vehicleBreakdown[t.license_plate]) vehicleBreakdown[t.license_plate] = { count: 0, amount: 0 };
    vehicleBreakdown[t.license_plate].count++;
    vehicleBreakdown[t.license_plate].amount += t.amount || 0;
  });
  const topVehicles = Object.entries(vehicleBreakdown)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <div>
      <PageHeader emoji="📊" title="Reports" subtitle="Financial Dashboard" />
      <div className="px-4 space-y-4 pb-8">
        {/* Big Numbers */}
        <div className="grid grid-cols-2 gap-3">
          <BigStat label="Total Tolls" value={`$${totalAmount.toFixed(0)}`} emoji="🧾" bg="bg-blue-50 border-blue-200" />
          <BigStat label="Recovered" value={`$${recoveredAmount.toFixed(0)}`} emoji="💰" bg="bg-green-50 border-green-200" />
          <BigStat label="Lost" value={`$${lostAmount.toFixed(0)}`} emoji="❌" bg="bg-red-50 border-red-200" />
          <BigStat label="Recovery Rate" value={`${recoveryRate}%`} emoji={recoveryRate >= 70 ? '🏆' : '📈'} bg={recoveryRate >= 70 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} />
        </div>

        {/* Progress Bar */}
        <div className="bg-card rounded-2xl border-2 border-border p-4">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span>Recovery Progress</span>
            <span>{recoveryRate}%</span>
          </div>
          <div className="h-4 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${recoveryRate}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-green-500 rounded-full"
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>💰 ${recoveredAmount.toFixed(0)} recovered</span>
            <span>${pendingAmount.toFixed(0)} pending</span>
          </div>
        </div>

        {/* Monthly Trends */}
        <div className="bg-card rounded-2xl border-2 border-border p-4">
          <h3 className="font-bold text-sm mb-3">📈 Monthly Trends</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} name="Total" />
              <Bar dataKey="recovered" fill="#10b981" radius={[6, 6, 0, 0]} name="Recovered" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet & Status Pies */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border-2 border-border p-4">
            <h3 className="font-bold text-xs mb-2">🏢 By Fleet</h3>
            {fleetBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={fleetBreakdown} dataKey="value" cx="50%" cy="50%" outerRadius={45} label={({ name }) => name}>
                    {fleetBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No data</p>}
          </div>
          <div className="bg-card rounded-2xl border-2 border-border p-4">
            <h3 className="font-bold text-xs mb-2">🎯 Match Status</h3>
            {statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" cx="50%" cy="50%" outerRadius={45} label={({ name }) => name}>
                    {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No data</p>}
          </div>
        </div>

        {/* Top Vehicles */}
        <div className="bg-card rounded-2xl border-2 border-border p-4">
          <h3 className="font-bold text-sm mb-3">🚗 Top Vehicles by Toll Amount</h3>
          {topVehicles.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No data yet</p>}
          {topVehicles.map(([plate, data], i) => (
            <div key={plate} className="flex items-center justify-between py-2 border-b last:border-0 border-border">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-muted-foreground">{i + 1}</span>
                <div>
                  <p className="font-bold text-sm">{plate}</p>
                  <p className="text-[10px] text-muted-foreground">{data.count} tolls</p>
                </div>
              </div>
              <span className="font-black">${data.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, emoji, bg }) {
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className={`rounded-2xl border-2 p-4 text-center ${bg}`}>
      <span className="text-2xl">{emoji}</span>
      <p className="text-xl font-black mt-1">{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
    </motion.div>
  );
}