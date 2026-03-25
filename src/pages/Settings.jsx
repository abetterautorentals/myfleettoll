import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/TenantContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTimezone } from '@/lib/TimezoneContext';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, Trash2, Save, Download, AlertTriangle,
  LogOut, Sun, Moon, Monitor, Mail, Key,
  Zap, ChevronRight, Check, Globe,
  CreditCard, FileText, Lock, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import AutoPilotStatus from '@/components/shared/AutoPilotStatus';
import { formatDateInTimezone } from '@/lib/formatDate';

const PLATFORMS = ['turo', 'upcar', 'rentcentric', 'signnow', 'direct', 'docusign'];
const FLEET_COLORS = ['#4A9EFF', '#F97316', '#22C55E', '#A855F7', '#F43F5E', '#06B6D4'];
const OWNER_FLEET_NAMES = ['Dealer Fleet', 'Bar Auto Rentals LLC'];

const TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong',
  'Asia/Singapore', 'Australia/Sydney', 'UTC'
];

export default function Settings() {
  const { tenant, fleets, loadFleets, refreshTenant, user, plan } = useTenant();
  const { theme, setTheme, accentId, setAccent, accentColors } = useTheme();
  const { timezone, updateTimezone, loading: timezoneLoading } = useTimezone();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.role === 'admin';

  const [saving, setSaving] = useState(false);
  const [deletingFleet, setDeletingFleet] = useState(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [localFleets, setLocalFleets] = useState(fleets);
  const [companyName, setCompanyName] = useState(tenant?.company_name || '');
  const [notifPrefs, setNotifPrefs] = useState({ tripEnding: true, tollMatched: true, weeklySummary: true });

  useEffect(() => { setLocalFleets(fleets); }, [fleets]);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase();

  const saveCompany = async () => {
    setSaving(true);
    await base44.entities.Tenant.update(tenant.id, { company_name: companyName });
    await refreshTenant();
    toast({ title: 'Saved!' });
    setSaving(false);
  };

  const canAddMore = isOwner || plan?.maxFleets === null || localFleets.filter(f => !f._deleted).length < (plan?.maxFleets || 1);

  const addFleet = () => {
    if (!canAddMore) { toast({ title: 'Upgrade to add more fleets', variant: 'destructive' }); return; }
    setLocalFleets([...localFleets, { name: '', platforms: [], tenant_id: tenant.id, is_active: true, color: FLEET_COLORS[localFleets.length % FLEET_COLORS.length], _new: true }]);
  };

  const saveFleet = async (f) => {
    if (f._new) {
      const alias = f.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
      await base44.entities.Fleet.create({ ...f, email_alias: `${alias}@fleettollpro.com`, _new: undefined });
    } else {
      await base44.entities.Fleet.update(f.id, { name: f.name, platforms: f.platforms, color: f.color });
    }
    await loadFleets(tenant.id);
    toast({ title: 'Fleet saved!' });
  };

  const deleteFleet = async () => {
    await base44.entities.Fleet.delete(deletingFleet);
    setDeletingFleet(null);
    await loadFleets(tenant.id);
  };

  const handleExportData = async () => {
    const contracts = await base44.entities.RentalContract.list('-created_date', 1000);
    const csv = [
      ['Renter', 'Email', 'Phone', 'License Plate', 'Start', 'End', 'Platform', 'Status'].join(','),
      ...contracts.map(c => [c.renter_name, c.renter_email, c.renter_phone, c.license_plate, c.start_date, c.end_date, c.platform, c.status].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'renter_data.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    await base44.entities.Tenant.update(tenant.id, { is_suspended: true, notes: 'DELETION_REQUESTED:' + new Date().toISOString() });
    toast({ title: 'Deletion requested', description: 'Your data will be deleted within 30 days.' });
    setShowDeleteAccount(false);
  };

  const themeOptions = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'auto', label: 'Auto', icon: Monitor },
  ];

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <div className="pt-2 pb-5">
        <h1 className="text-2xl font-black">⚙️ Settings</h1>
        <p className="text-sm text-muted-foreground">Account, appearance & integrations</p>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <div className="flex items-center gap-4 p-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 border-4 border-primary/30 flex items-center justify-center text-2xl font-black text-primary flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-lg truncate">{user?.full_name || 'User'}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {plan?.name || 'Starter'} Plan
            </span>
          </div>
        </div>
        {tenant?.id !== 'owner' && (
          <>
            <Divider />
            <div className="p-3 flex gap-2">
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)}
                className="h-9 rounded-xl font-bold flex-1" placeholder="Company name" />
              <Button onClick={saveCompany} disabled={saving} size="sm" className="h-9 rounded-xl px-3">
                <Save className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </Section>

      {/* Timezone */}
      <Section title="Timezone">
        <div className="p-3 space-y-3">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Your Timezone</p>
            <p className="text-sm text-foreground mb-2">Current: <span className="font-bold">{timezone}</span></p>
            <select
              value={timezone}
              onChange={(e) => updateTimezone(e.target.value)}
              disabled={timezoneLoading}
              className="w-full px-3 py-2 rounded-xl bg-secondary text-foreground border border-border text-sm font-bold disabled:opacity-50"
            >
              <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                🔄 Auto-detect ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </option>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-2">
              All dates, times, and reports will display in your local timezone. Right now it is approximately <span className="font-bold">{formatDateInTimezone(new Date(), timezone, 'time')}</span>.
            </p>
          </div>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <div className="p-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTheme(id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  theme === id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'
                }`}>
                <Icon className="w-5 h-5" />
                <span className="text-xs font-bold">{label}</span>
                {theme === id && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>
        {accentColors && (
          <>
            <Divider />
            <div className="p-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Accent Color</p>
              <div className="flex gap-3 flex-wrap">
                {accentColors.map(c => (
                  <button key={c.id} onClick={() => setAccent(c.id)}
                    className={`w-9 h-9 rounded-full border-4 transition-all ${accentId === c.id ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                    style={{ backgroundColor: c.hex }} title={c.label}>
                    {accentId === c.id && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        {[
          { key: 'tripEnding', label: 'Trip ending soon', desc: 'Alert when rental ends within 2 hours' },
          { key: 'tollMatched', label: 'Toll matched', desc: 'When a toll is linked to a contract' },
          { key: 'weeklySummary', label: 'Weekly summary', desc: 'Every Monday morning digest' },
        ].map(({ key, label, desc }, i, arr) => (
          <div key={key}>
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-bold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                onClick={() => setNotifPrefs(p => ({ ...p, [key]: !p[key] }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${notifPrefs[key] ? 'bg-primary' : 'bg-secondary border border-border'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${notifPrefs[key] ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
            {i < arr.length - 1 && <Divider />}
          </div>
        ))}
      </Section>

      {/* Connected Accounts */}
      <Section title="Connected Accounts">
        <GmailRow />
        <Divider />
        <SignNowRow />
        <Divider />
        <ConnectedRow icon={Zap} label="FasTrak" description="Dispute submission" connected={false} />
      </Section>

      {/* My Fleets */}
      <Section title={`My Fleets (${localFleets.length}/${plan?.maxFleets ?? '∞'})`} action={
        <button onClick={addFleet} className="text-xs font-bold text-primary flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Fleet
        </button>
      }>
        <div className="divide-y divide-border">
          {localFleets.map((f, i) => {
            const isPermanent = isOwner && OWNER_FLEET_NAMES.includes(f.name);
            return (
              <motion.div key={f.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input type="color" value={f.color || '#4A9EFF'}
                      onChange={e => setLocalFleets(localFleets.map((x, xi) => xi === i ? { ...x, color: e.target.value } : x))}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                    <div className="w-7 h-7 rounded-full border-2 border-border flex-shrink-0"
                      style={{ backgroundColor: f.color || '#4A9EFF' }} />
                  </div>
                  <Input value={f.name}
                    onChange={e => setLocalFleets(localFleets.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))}
                    placeholder="Fleet name" className="h-8 rounded-lg font-bold flex-1 text-sm" />
                  {isPermanent ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 whitespace-nowrap">PERMANENT</span>
                  ) : !f._new ? (
                    <button onClick={() => setDeletingFleet(f.id)} className="p-1.5 text-red-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.map(p => (
                    <button key={p} onClick={() => setLocalFleets(localFleets.map((x, xi) => xi === i ? {
                      ...x, platforms: x.platforms?.includes(p) ? x.platforms.filter(pp => pp !== p) : [...(x.platforms || []), p]
                    } : x))}
                      style={f.platforms?.includes(p) ? { backgroundColor: f.color || '#4A9EFF', borderColor: f.color || '#4A9EFF' } : {}}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                        f.platforms?.includes(p) ? 'text-white' : 'border-border bg-secondary text-muted-foreground'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
                {f.email_alias && <p className="text-[10px] text-muted-foreground font-mono">📧 {f.email_alias}</p>}
                <Button size="sm" onClick={() => saveFleet(f)} className="w-full h-7 rounded-lg text-xs font-bold">Save Fleet</Button>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* 24/7 AutoPilot */}
      <Section title="24/7 AutoPilot">
        <div className="p-3">
          <AutoPilotStatus fleets={localFleets.filter(f => f.id)} />
        </div>
      </Section>

      {/* Admin Section (Owner Only) */}
      {isOwner && (
        <Section title="👑 Owner Dashboard">
          <Link to="/admin-log" className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-bold">Admin Log</p>
              <p className="text-xs text-muted-foreground">View upload, OCR, and sync failures</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </Section>
      )}

      {/* Subscription */}
      <Section title="Subscription">
        <Link to="/subscription" className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-bold">Current Plan: {plan?.name}</p>
            <p className="text-xs text-muted-foreground">{plan?.price === 0 ? 'Free' : `$${plan?.price}/month`}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      </Section>

      {/* Legal */}
      <Section title="Legal">
        <a href="#" className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold flex-1">Terms of Service</span>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </a>
        <Divider />
        <a href="#" className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold flex-1">Privacy Policy</span>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </a>
        <Divider />
        <div className="flex items-center justify-between p-3">
          <div>
            <p className="text-sm font-bold flex items-center gap-2"><Download className="w-4 h-4" /> Export My Data</p>
            <p className="text-xs text-muted-foreground">Download all data as CSV (GDPR)</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExportData} className="rounded-xl h-8 text-xs">Export</Button>
        </div>
        <Divider />
        <div className="p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Delete Account</p>
            <p className="text-xs text-muted-foreground">Permanently deleted within 30 days</p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => setShowDeleteAccount(true)} className="rounded-xl h-8 text-xs">Request</Button>
        </div>
      </Section>

      {/* LOG OUT */}
      <button
        onClick={() => setShowLogoutConfirm(true)}
        className="w-full flex items-center justify-center gap-3 p-4 bg-red-500/10 border-2 border-red-500/20 rounded-2xl text-red-500 font-black text-base hover:bg-red-500/20 transition-colors mt-2 mb-6"
      >
        <LogOut className="w-5 h-5" />
        Log Out
      </button>

      <ConfirmDialog open={showLogoutConfirm} title="Log Out?"
        message="You will be signed out and returned to the login screen."
        onConfirm={() => base44.auth.logout()}
        onCancel={() => setShowLogoutConfirm(false)}
        confirmLabel="Log Out" confirmClass="bg-red-500 hover:bg-red-600 text-white" />
      <ConfirmDialog open={!!deletingFleet} title="Delete Fleet?"
        message="Existing contracts and tolls won't be deleted, but will lose fleet association."
        onConfirm={deleteFleet} onCancel={() => setDeletingFleet(null)} />
      <ConfirmDialog open={showDeleteAccount} title="Request Account Deletion?"
        message="Your data will be permanently deleted within 30 days. This cannot be undone."
        onConfirm={handleDeleteAccount} onCancel={() => setShowDeleteAccount(false)}
        confirmLabel="Yes, Delete My Data" confirmClass="bg-destructive hover:bg-destructive/90 text-white" />
    </div>
  );
}

function GmailRow() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => base44.functions.invoke('gmailStatus', {}).then(r => r.data),
    staleTime: 60000,
  });

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${status?.connected ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <Mail className={`w-4 h-4 ${status?.connected ? 'text-green-500' : isLoading ? 'text-muted-foreground' : 'text-red-500'}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Gmail</p>
          {isLoading
            ? <p className="text-xs text-muted-foreground">Checking connection...</p>
            : status?.connected
            ? <p className="text-xs text-muted-foreground">{status.email}</p>
            : <p className="text-xs text-red-500 font-semibold">{status?.error || 'Not connected'}</p>
          }
          {status?.lastSync && (
            <p className="text-[10px] text-muted-foreground">Last sync: {formatDateInTimezone(status.lastSync, timezone, 'datetime-short')}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
            isLoading ? 'bg-secondary text-muted-foreground border-border'
            : status?.connected ? 'bg-green-500/10 text-green-500 border-green-500/20'
            : 'bg-red-500/10 text-red-500 border-red-500/20'
          }`}>
            {isLoading ? '...' : status?.connected ? '✅ Connected' : '❌ Error'}
          </span>
          <Link to="/gmail-log" className="text-[10px] font-bold text-primary underline">View Logs →</Link>
        </div>
      </div>
      {status?.lastSyncStats && (
        <div className="bg-secondary rounded-xl px-3 py-1.5 text-[10px] text-muted-foreground font-mono">
          Last: {status.lastSyncStats.scanned} scanned · {status.lastSyncStats.imported} imported
          {status.lastSyncStats.errors > 0 && <span className="text-red-500"> · {status.lastSyncStats.errors} errors</span>}
        </div>
      )}
    </div>
  );
}

function SignNowRow() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const testConnection = async () => {
    setTesting(true);
    setResult(null);
    const res = await base44.functions.invoke('signnowTest', {});
    setResult(res.data);
    setTesting(false);
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${result?.success ? 'bg-green-500/10' : 'bg-secondary'}`}>
          <Key className={`w-4 h-4 ${result?.success ? 'text-green-500' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">SignNow</p>
          <p className="text-xs text-muted-foreground">Digital signature sync</p>
        </div>
        <button onClick={testConnection} disabled={testing}
          className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
          {testing ? '...' : 'Test'}
        </button>
      </div>
      {result && (
        <div className={`text-xs font-bold px-3 py-2 rounded-xl border ${
          result.success ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'
        }`}>
          {result.success ? `✅ ${result.message} (${result.email})` : `❌ ${result.error}`}
        </div>
      )}
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{title}</p>
        {action}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border mx-3" />;
}

function ConnectedRow({ icon: Icon, label, description, connected }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${connected ? 'bg-green-500/10' : 'bg-secondary'}`}>
        <Icon className={`w-4 h-4 ${connected ? 'text-green-500' : 'text-muted-foreground'}`} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
        connected ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-secondary text-muted-foreground border-border'
      }`}>
        {connected ? 'Connected' : 'Not set up'}
      </span>
    </div>
  );
}