import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Camera, FileText, Loader2, Send, Trash2, Package, CheckSquare, Square, CheckCheck, RefreshCw, Archive, Download } from 'lucide-react';
import DisputePackageBuilder from '@/components/tolls/DisputePackageBuilder';
import { useTenant } from '@/lib/TenantContext';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import TollSubmissionTracker from '@/components/tolls/TollSubmissionTracker';
import GmailSyncButton from '@/components/shared/GmailSyncButton';
import PDFPreviewModal from '@/components/tolls/PDFPreviewModal';
import MobileEmailMenu from '@/components/tolls/MobileEmailMenu';
import TollLifecycleBadge from '@/components/tolls/TollLifecycleBadge';
import BulkActionBar from '@/components/tolls/BulkActionBar';
import ResendWorkflow from '@/components/tolls/ResendWorkflow';
import { motion, AnimatePresence } from 'framer-motion';

const ACTIVE_STATUSES = ['unmatched', 'matched', 'package_ready', 'sent', 'resent'];
const ARCHIVED_STATUSES = ['resolved', 'archived'];

const TAB_FILTERS = [
  { id: 'active', label: '⚡ Active' },
  { id: 'unmatched', label: '🔴 Unmatched' },
  { id: 'matched', label: '🟡 Matched' },
  { id: 'sent', label: '🔵 Sent' },
  { id: 'archive', label: '⚫ Archive' },
];

export default function Tolls() {
  const urlParams = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(urlParams.get('filter') || 'active');
  const [deletingId, setDeletingId] = useState(null);
  const [packageBuilderPlate, setPackageBuilderPlate] = useState(null);
  const [packageBuilderRenter, setPackageBuilderRenter] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(null); // { type, ids }
  const [dupMode, setDupMode] = useState(false); // show duplicate review/delete UI
  const [dupLoading, setDupLoading] = useState(false);
  const queryClient = useQueryClient();
  const { tenant, isOwner, fleets, activeFleet: fleet } = useTenant();

  const { data: tolls = [], isLoading } = useQuery({
    queryKey: ['tolls', tenant?.id],
    queryFn: () => isOwner
      ? base44.entities.TollNotice.list('-occurrence_date', 300)
      : base44.entities.TollNotice.filter({ tenant_id: tenant?.id }, '-occurrence_date', 300),
    enabled: !!tenant,
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TollNotice.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tolls'] }); setDeletingId(null); },
  });

  const selectedFleet = fleets.find(f => f.id === fleet);

  // Fleet filter
  const fleetFiltered = tolls.filter(t =>
    fleet === 'all' || t.fleet === fleet || (selectedFleet && t.fleet === selectedFleet.name)
  );

  // Tab filter — map old match_status to lifecycle_status for backwards compat
  const getEffectiveStatus = (t) => {
    if (t.lifecycle_status) return t.lifecycle_status;
    // fallback from old match_status
    if (t.match_status === 'matched') return 'matched';
    return 'unmatched';
  };

  const filtered = useMemo(() => fleetFiltered.filter(t => {
    const status = getEffectiveStatus(t);
    if (tab === 'active') return ACTIVE_STATUSES.includes(status);
    if (tab === 'archive') return ARCHIVED_STATUSES.includes(status);
    if (tab === 'unmatched') return status === 'unmatched';
    if (tab === 'matched') return status === 'matched' || status === 'package_ready';
    if (tab === 'sent') return status === 'sent' || status === 'resent';
    return true;
  }), [fleetFiltered, tab]);

  const totalAmount = filtered.reduce((s, t) => s + (t.amount || 0), 0);

  // Duplicate detection: use Transaction ID first (most reliable), then fallback to plate+date+time+location+amount
  const duplicateIds = useMemo(() => {
    const seen = new Map();
    const dupes = new Set();
    for (const t of fleetFiltered) {
      // Primary: Transaction ID (FasTrak Transaction ID or Violation Number)
      let key;
      if (t.transaction_id) {
        key = `txn:${t.transaction_id}`;
      } else {
        // Fallback: combine plate + date + time + location + amount
        key = `${t.license_plate}|${t.occurrence_date}|${(t.occurrence_time || '')}|${(t.location || '')}|${(t.amount || 0).toFixed(2)}`;
      }
      if (seen.has(key)) {
        dupes.add(t.id);
        dupes.add(seen.get(key));
      } else {
        seen.set(key, t.id);
      }
    }
    return dupes;
  }, [fleetFiltered]);

  const matchedPlates = [...new Set(
    fleetFiltered.filter(t => getEffectiveStatus(t) === 'matched').map(t => t.license_plate)
  )];

  // Bulk actions
  const toggleSelect = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const selectAll = () => setSelected(new Set(filtered.map(t => t.id)));
  const clearSelect = () => { setSelected(new Set()); setSelectMode(false); };

  const handleBulkDelete = () => setBulkConfirm({ type: 'delete', ids: [...selected] });
  const handleBulkMarkPaid = () => setBulkConfirm({ type: 'paid', ids: [...selected] });
  const handleBulkMarkSent = () => setBulkConfirm({ type: 'sent', ids: [...selected] });
  
  const handleRemoveDuplicates = async () => {
    setDupLoading(true);
    const toDelete = [];
    const seen = new Map();
    for (const t of fleetFiltered) {
      const key = `${t.license_plate}|${t.occurrence_date}|${(t.amount || 0).toFixed(2)}`;
      if (seen.has(key)) {
        // Keep first, delete second
        toDelete.push(t.id);
      } else {
        seen.set(key, t.id);
      }
    }
    for (const id of toDelete) {
      await base44.entities.TollNotice.delete(id);
    }
    queryClient.invalidateQueries({ queryKey: ['tolls'] });
    setDupLoading(false);
    setDupMode(false);
  };

  const executeBulk = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    const { type, ids } = bulkConfirm;
    for (const id of ids) {
      try {
        if (type === 'delete') {
          await base44.entities.TollNotice.delete(id);
        } else if (type === 'paid') {
          await base44.entities.TollNotice.update(id, { lifecycle_status: 'resolved', resolved_date: new Date().toISOString().split('T')[0] });
        } else if (type === 'sent') {
          await base44.entities.TollNotice.update(id, { lifecycle_status: 'sent', sent_date: new Date().toISOString().split('T')[0] });
        }
      } catch (e) { console.error('Bulk action failed for', id, e); }
    }
    queryClient.invalidateQueries({ queryKey: ['tolls'] });
    setBulkLoading(false);
    setBulkConfirm(null);
    clearSelect();
  };

  const bulkConfirmText = {
    delete: `Delete ${bulkConfirm?.ids.length} toll(s)? This cannot be undone.`,
    paid: `Mark ${bulkConfirm?.ids.length} toll(s) as Resolved/Paid?`,
    sent: `Mark ${bulkConfirm?.ids.length} toll(s) as Sent?`,
  };

  // Archive counts for tab badges
  const archiveCount = fleetFiltered.filter(t => ARCHIVED_STATUSES.includes(getEffectiveStatus(t))).length;
  const activeCount = fleetFiltered.filter(t => ACTIVE_STATUSES.includes(getEffectiveStatus(t))).length;

  return (
    <div>
      <PageHeader
        emoji="🧾"
        title="Tolls"
        subtitle={`${filtered.length} tolls • $${totalAmount.toFixed(2)}`}
        action={
          <div className="flex gap-2">
            {duplicateIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDupMode(!dupMode)}
                className={`rounded-xl h-9 text-xs font-bold gap-1 ${dupMode ? 'border-orange-500 text-orange-500' : ''}`}
              >
                🗑️ {duplicateIds.size} Duplicates
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
              className={`rounded-xl h-9 text-xs font-bold ${selectMode ? 'border-primary text-primary' : ''}`}
            >
              {selectMode ? <CheckCheck className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
              {selectMode ? 'Done' : 'Select'}
            </Button>
            <Link to="/tolls/upload">
              <Button className="rounded-2xl bg-primary text-primary-foreground font-bold gap-1.5 h-10 shadow-md">
                <Camera className="w-4 h-4" /> Upload
              </Button>
            </Link>
          </div>
        }
      />

      <div className="px-4 space-y-3">
        {dupMode && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-orange-950/40 border-2 border-orange-500 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-orange-300">⚠️ Found {duplicateIds.size} duplicate toll(s)</p>
            <p className="text-xs text-muted-foreground">Will keep the first occurrence of each duplicate and delete the rest.</p>
            <div className="flex gap-2">
              <Button onClick={handleRemoveDuplicates} disabled={dupLoading}
                className="flex-1 h-10 rounded-xl font-bold text-sm gap-2 bg-orange-600 hover:bg-orange-700 text-white">
                {dupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {dupLoading ? 'Removing...' : `Remove ${duplicateIds.size} Duplicate(s)`}
              </Button>
              <Button variant="outline" onClick={() => setDupMode(false)}
                className="h-10 rounded-xl font-bold text-sm px-4">
                Cancel
              </Button>
            </div>
          </motion.div>
        )}

        <GmailSyncButton invalidateKeys={['tolls']} />

        {/* Dispute package quick-build */}
        {matchedPlates.length > 0 && tab !== 'archive' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {matchedPlates.map(plate => {
              const renter = fleetFiltered.find(t => t.license_plate === plate && t.matched_renter_name)?.matched_renter_name;
              const count = fleetFiltered.filter(t => t.license_plate === plate && getEffectiveStatus(t) === 'matched').length;
              return (
                <button key={plate}
                  onClick={() => { setPackageBuilderPlate(plate); setPackageBuilderRenter(renter || null); }}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary font-mono">{plate}</span>
                  <span className="text-[10px] text-muted-foreground">({count})</span>
                </button>
              );
            })}
            <span className="flex-shrink-0 self-center text-[10px] text-muted-foreground ml-1">Tap to build dispute →</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TAB_FILTERS.map(f => (
            <button key={f.id} onClick={() => setTab(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                tab === f.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary text-secondary-foreground'
              }`}>
              {f.label}
              {f.id === 'archive' && archiveCount > 0 && (
                <span className="text-[9px] bg-white/20 px-1 rounded-full">{archiveCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Select All row */}
        {selectMode && filtered.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <button onClick={selectAll} className="text-xs font-bold text-primary flex items-center gap-1.5">
              <CheckCheck className="w-4 h-4" /> Select All ({filtered.length})
            </button>
            {selected.size > 0 && (
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            )}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 && !isLoading ? (
            tab === 'archive' ? (
              <EmptyState emoji="📦" title="No archived tolls" subtitle="Resolved tolls will appear here" />
            ) : (
              <EmptyState emoji="🎉" title="No active tolls!" subtitle="Upload a toll notice to get started" />
            )
          ) : (
            <div className="space-y-2 pb-24">
              {filtered.map((toll, i) => (
                <TollCard
                  key={toll.id}
                  toll={toll}
                  index={i}
                  onDelete={() => setDeletingId(toll.id)}
                  selectMode={selectMode}
                  selected={selected.has(toll.id)}
                  onToggleSelect={() => toggleSelect(toll.id)}
                  getEffectiveStatus={getEffectiveStatus}
                  isDuplicate={duplicateIds.has(toll.id)}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        <ConfirmDialog
          open={!!deletingId}
          title="Delete Toll?"
          message="Are you sure? This cannot be undone."
          onConfirm={() => deleteMutation.mutate(deletingId)}
          onCancel={() => setDeletingId(null)}
        />

        <ConfirmDialog
          open={!!bulkConfirm}
          title="Confirm Bulk Action"
          message={bulkConfirm ? bulkConfirmText[bulkConfirm.type] : ''}
          confirmLabel="Confirm"
          confirmClass={bulkConfirm?.type === 'delete' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'}
          onConfirm={executeBulk}
          onCancel={() => setBulkConfirm(null)}
        />
      </div>

      {packageBuilderPlate && (
        <DisputePackageBuilder
          plate={packageBuilderPlate}
          renterName={packageBuilderRenter}
          onClose={() => { setPackageBuilderPlate(null); setPackageBuilderRenter(null); }}
        />
      )}

      <AnimatePresence>
        {selectMode && (
          <BulkActionBar
            selectedCount={selected.size}
            onDelete={handleBulkDelete}
            onMarkPaid={handleBulkMarkPaid}
            onMarkSent={handleBulkMarkSent}
            onCancel={clearSelect}
            loading={bulkLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TollCard({ toll, index, onDelete, selectMode, selected, onToggleSelect, getEffectiveStatus, isDuplicate }) {
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [gmailLoading, setGmailLoading] = useState(false);
  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState(null);
  const [letterText, setLetterText] = useState(null);
  const [resendOpen, setResendOpen] = useState(false);
  const queryClient = useQueryClient();

  const status = getEffectiveStatus(toll);

  // Card style per status — clean white/light base with colored left border
  const cardStyle = {
    unmatched:     'border-l-4 border-l-red-500    border border-gray-200  bg-white      text-gray-900',
    matched:       'border-l-4 border-l-yellow-500 border border-gray-200  bg-white      text-gray-900',
    package_ready: 'border-l-4 border-l-orange-500 border border-gray-200  bg-white      text-gray-900',
    sent:          'border-l-4 border-l-blue-500   border border-gray-200  bg-white      text-gray-900',
    resent:        'border-l-4 border-l-blue-400   border border-gray-200  bg-white      text-gray-900',
    resolved:      'border-l-4 border-l-green-500  border border-gray-200  bg-white      text-gray-900',
    archived:      'border-l-4 border-l-gray-400   border border-gray-200  bg-gray-50    text-gray-600',
  };

  const handleGeneratePDF = async (type) => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateDisputePDF', { toll_id: toll.id, type });
      if (res.data?.pdf_data_url || res.data?.pdf_url) {
        setPdfData(res.data.pdf_data_url);
        setPdfUrl(res.data.pdf_url || null);
        setPdfFilename(res.data.filename);
        setPreviewOpen(true);
        if (status === 'matched') {
          await base44.entities.TollNotice.update(toll.id, { lifecycle_status: 'package_ready', pdf_url: res.data.pdf_url });
          queryClient.invalidateQueries({ queryKey: ['tolls'] });
        }
      }
    } catch (err) { console.error('PDF error:', err); }
    finally { setGenerating(false); }
  };

  const handleOpenEmailMenu = async () => {
    setGmailLoading(true);
    try {
      const res = await base44.functions.invoke('generateDisputePDF', { toll_id: toll.id, type: toll.is_violation ? 'violation' : 'dispute' });
      if (res.data?.email_draft) {
        setEmailDraft(res.data.email_draft);
        setLetterText(res.data.email_draft?.body);
        setPdfUrl(res.data.pdf_url || null);
        setEmailMenuOpen(true);
      }
    } catch (err) { console.error('Email error:', err); }
    finally { setGmailLoading(false); }
  };

  const handleMarkResolved = async () => {
    await base44.entities.TollNotice.update(toll.id, {
      lifecycle_status: 'resolved',
      resolved_date: new Date().toISOString().split('T')[0],
    });
    queryClient.invalidateQueries({ queryKey: ['tolls'] });
  };

  const handleArchive = async () => {
    await base44.entities.TollNotice.update(toll.id, { lifecycle_status: 'archived' });
    queryClient.invalidateQueries({ queryKey: ['tolls'] });
  };

  const getNextAction = () => {
    if (status === 'unmatched') return null;
    if (status === 'matched') return (
      <Button size="sm" onClick={handleOpenEmailMenu} disabled={gmailLoading}
        className="w-full h-9 rounded-xl text-xs font-bold gap-2 bg-purple-600 text-white hover:bg-purple-700">
        {gmailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        {gmailLoading ? 'Preparing...' : '📨 Send to FasTrak / Renter'}
      </Button>
    );
    if (status === 'package_ready') return (
      <Button size="sm" onClick={handleOpenEmailMenu} disabled={gmailLoading}
        className="w-full h-9 rounded-xl text-xs font-bold gap-2 bg-blue-600 text-white hover:bg-blue-700">
        {gmailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        {gmailLoading ? 'Preparing...' : '📨 Send Package'}
      </Button>
    );
    if (status === 'sent' || status === 'resent') return (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setResendOpen(true)}
          className="flex-1 h-9 rounded-xl text-xs font-bold gap-1.5 bg-orange-600 text-white hover:bg-orange-700">
          <RefreshCw className="w-3.5 h-3.5" /> Resend
        </Button>
        <Button size="sm" onClick={handleMarkResolved}
          className="flex-1 h-9 rounded-xl text-xs font-bold gap-1.5 bg-green-600 text-white hover:bg-green-700">
          ✅ Resolved
        </Button>
      </div>
    );
    if (status === 'resolved') return (
      <Button size="sm" onClick={handleArchive} variant="outline"
        className="w-full h-9 rounded-xl text-xs font-bold gap-1.5">
        <Archive className="w-3.5 h-3.5" /> Archive
      </Button>
    );
    return null;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className={`rounded-2xl overflow-hidden shadow-sm transition-all ${cardStyle[status] || 'border border-gray-200 bg-white text-gray-900'} ${selected ? 'ring-2 ring-primary' : ''}`}
        onClick={selectMode ? onToggleSelect : undefined}
      >
        {/* Duplicate warning banner */}
        {isDuplicate && (
          <div className="bg-yellow-400 text-yellow-900 text-[11px] font-bold px-3 py-1 flex items-center gap-1.5">
            ⚠️ Possible Duplicate — same plate, date &amp; amount found in another toll
          </div>
        )}

        <div className="p-3">
          {/* Row 1: checkbox + plate + status pill + amount + delete */}
          <div className="flex items-center gap-2">
            {/* Checkbox — 24x24 min, easy thumb tap */}
            {selectMode && (
              <button
                onClick={e => { e.stopPropagation(); onToggleSelect(); }}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
              >
                {selected
                  ? <CheckSquare className="w-6 h-6 text-primary" />
                  : <Square className="w-6 h-6 text-gray-400" />}
              </button>
            )}

            <span className="font-black text-base font-mono text-gray-900">{toll.license_plate}</span>

            <TollLifecycleBadge status={status} />
            {toll.is_violation && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">VIOLATION</span>}
            {toll.is_non_fastrak && <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">NON-FasTrak</span>}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-lg font-black text-gray-900">${(toll.amount || 0).toFixed(2)}</span>
              {!selectMode && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(); }}
                  className="p-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: date/time */}
          <p className="text-xs text-gray-500 mt-1.5">
            📅 <span className="font-semibold text-gray-800">{toll.occurrence_date}</span>
            {toll.occurrence_time && <span className="text-gray-500"> at {toll.occurrence_time}</span>}
          </p>

          {/* Row 3: location */}
          <p className="text-xs text-gray-500 mt-0.5">
            📍 {toll.location || 'Unknown location'} {toll.agency ? `· ${toll.agency}` : ''}
          </p>

          {/* Matched renter */}
          {toll.matched_renter_name && (
            <p className="text-xs font-bold text-green-600 mt-1">👤 {toll.matched_renter_name}</p>
          )}

          {/* Send history */}
          {toll.sent_date && (
            <p className="text-[10px] text-blue-500 mt-0.5">
              📤 Sent {toll.sent_date}
              {toll.resent_date && ` → Resent ${toll.resent_date}`}
              {toll.resolved_date && ` → ✅ Resolved ${toll.resolved_date}`}
            </p>
          )}



          {/* Submission tracker */}
          {(status === 'matched' || status === 'package_ready') && !selectMode && (
            <TollSubmissionTracker toll={toll} />
          )}

          {/* Next action CTA */}
          {!selectMode && (
            <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
              {getNextAction()}
              {['matched', 'package_ready', 'sent', 'resent'].includes(status) && (
                <Button size="sm" onClick={() => handleGeneratePDF(toll.is_violation ? 'violation' : 'dispute')} disabled={generating}
                  className="w-full h-8 rounded-lg text-[11px] font-semibold gap-1 bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                  {generating ? 'Building PDF...' : 'Download PDF'}
                </Button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <PDFPreviewModal open={previewOpen} pdfData={pdfData} pdfUrl={pdfUrl} filename={pdfFilename}
        onClose={() => setPreviewOpen(false)} />

      <MobileEmailMenu isOpen={emailMenuOpen} onClose={() => setEmailMenuOpen(false)}
        emailDraft={emailDraft} letterText={letterText} pdfFilename={pdfFilename} loading={gmailLoading} />

      <AnimatePresence>
        {resendOpen && <ResendWorkflow toll={toll} onClose={() => setResendOpen(false)} />}
      </AnimatePresence>
    </>
  );
}