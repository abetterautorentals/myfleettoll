import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { ArrowLeft, Loader2, CheckCircle, Upload, Sparkles, Plus, AlertTriangle, XCircle, RefreshCw, ChevronDown, ChevronUp, Copy, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import PageHeader from '@/components/shared/PageHeader';
import MultiContractReview from '@/components/contracts/MultiContractReview';

// Compress/resize image files before upload
async function compressFile(file) {
  if (file.type === 'application/pdf') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1600;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.75);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

async function uploadFile(file) {
  const isPDF = file.type === 'application/pdf';
  const isLarge = file.size > 9 * 1024 * 1024;
  if (isPDF && isLarge) {
    // Use private upload (no 10MB limit) to get a URL, then compress
    const privateUpload = await base44.integrations.Core.UploadPrivateFile({ file });
    const signedRes = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: privateUpload.file_uri, expires_in: 600 });
    const compressed = await base44.functions.invoke('compressPDF', { file_url: signedRes.signed_url });
    return compressed.data?.compressed_url || compressed.data?.file_url || signedRes.signed_url;
  }
  const fileToUpload = await compressFile(file);
  const uploaded = await base44.integrations.Core.UploadFile({ file: fileToUpload });
  return uploaded.file_url;
}

const emptyContract = (fleetName) => ({
  renter_name: '', renter_email: '', renter_phone: '',
  license_plate: '', start_date: '', end_date: '',
  platform: 'turo', reservation_id: '', fleet: fleetName,
  signature_status: 'signed', status: 'active',
  vehicle_make: '', vehicle_model: '', vehicle_year: '', vehicle_color: '',
  insurance_company: '', insurance_policy: '', insurance_phone: '',
  is_extension: false,
});

export default function ContractAdd() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant, activeFleet, fleets } = useTenant();

  const getFleetName = () => {
    if (activeFleet === 'all') return 'APEX';
    return fleets?.find(f => f.id === activeFleet)?.name || 'APEX';
  };

  // Check for extension prefill from Contracts page
  const urlParams = new URLSearchParams(window.location.search);
  const isExtensionMode = urlParams.get('mode') === 'extension';

  // Modes: 'upload' | 'multi_review' | 'single_form'
  const [mode, setMode] = useState(() => {
    if (isExtensionMode) {
      try {
        const prefill = JSON.parse(sessionStorage.getItem('extension_prefill') || '{}');
        if (prefill.renter_name) return 'single_form';
      } catch (_) {}
    }
    return 'upload';
  });
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState('');
  const [extractError, setExtractError] = useState(null);
  const [extractionQuality, setExtractionQuality] = useState(null); // 'full' | 'partial' | 'failed'
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [allExtracted, setAllExtracted] = useState([]); // tracks full set from PDF for pending-import prompt
  const [pdfUrl, setPdfUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedRenter, setSavedRenter] = useState(null); // remember last renter for "add another"
  const [showAddAnother, setShowAddAnother] = useState(false);
  const [matchProgress, setMatchProgress] = useState('');
  const [matchResults, setMatchResults] = useState(null);

  // Single-form state (manual entry / single contract fallback)
  const [form, setForm] = useState(() => {
    if (isExtensionMode) {
      try {
        const prefill = JSON.parse(sessionStorage.getItem('extension_prefill') || '{}');
        sessionStorage.removeItem('extension_prefill');
        if (prefill.renter_name) return { ...emptyContract('APEX'), ...prefill, status: 'active', signature_status: 'signed' };
      } catch (_) {}
    }
    return emptyContract('APEX');
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Assess how well a contract was extracted
  const assessExtractionQuality = (c) => {
    const required = [c.renter_name, c.license_plate, c.start_date, c.end_date];
    const filled = required.filter(Boolean).length;
    if (filled === 4) return 'full';
    if (filled >= 1) return 'partial';
    return 'failed';
  };

  const runExtraction = async (url) => {
    setExtractProgress('Splitting PDF into pages...');
    let res;
    try {
      res = await base44.functions.invoke('extractMultipleContracts', { file_url: url });
    } catch (err) {
      console.error('[runExtraction] function error:', err);
      setDebugInfo({ error: err?.response?.data?.debug?.error || err.message, method: 'failed', pageCount: null, fileSizeMB: null });
      setExtractionQuality('failed');
      setForm(emptyContract(getFleetName()));
      setMode('single_form');
      setExtracting(false);
      return;
    }

    const resDebug = res.data?.debug;
    const pageCount = resDebug?.pageCount || '?';
    const foundCount = res.data?.contracts?.length || 0;
    setExtractProgress(`Done! Found ${foundCount} contract(s) across ${pageCount} page(s)`);
    const found = res.data?.contracts || [];
    const extractDebug = res.data?.debug || null;
    setDebugInfo(extractDebug);

    if (found.length === 0) {
      setExtractionQuality('failed');
      setForm(emptyContract(getFleetName()));
      setMode('single_form');
      setExtracting(false);
      return;
    }

    const fleetName = getFleetName();
    const enriched = found.map(c => ({
      ...emptyContract(fleetName),
      ...c,
      fleet: fleetName,
      license_plate: c.license_plate ? c.license_plate.replace(/\s+/g, '').toUpperCase() : '',
      start_date: c.start_date ? c.start_date.slice(0, 16) : '',
      end_date: c.end_date ? c.end_date.slice(0, 16) : '',
      status: 'active',
    }));

    setAllExtracted(enriched);
    if (enriched.length === 1) {
      setExtractionQuality(assessExtractionQuality(enriched[0]));
      setForm(enriched[0]);
      setMode('single_form');
    } else {
      setExtractionQuality('full');
      setContracts(enriched);
      setMode('multi_review');
    }
    setExtracting(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setExtracting(true);
    setExtractError(null);
    setExtractionQuality(null);
    setDebugInfo(null);
    setShowAddAnother(false);
    setExtractProgress('Uploading file...');
    const url = await uploadFile(file);
    setExtractProgress('Converting PDF pages to images...');
    setPdfUrl(url);
    await runExtraction(url);
  };

  const handleRetryExtraction = async () => {
    if (!pdfUrl) return;
    setExtracting(true);
    setExtractError(null);
    setExtractionQuality(null);
    setDebugInfo(null);
    await runExtraction(pdfUrl);
  };

  // "Add another contract" for same renter — pre-fills renter info, clears dates
  const handleAddAnother = () => {
    const renter = savedRenter || form;
    setForm({
      ...emptyContract(getFleetName()),
      renter_name: renter.renter_name,
      renter_email: renter.renter_email,
      renter_phone: renter.renter_phone,
      license_plate: renter.license_plate,
      platform: renter.platform,
      vehicle_make: renter.vehicle_make,
      vehicle_model: renter.vehicle_model,
      vehicle_year: renter.vehicle_year,
      vehicle_color: renter.vehicle_color,
      insurance_company: renter.insurance_company,
      insurance_policy: renter.insurance_policy,
      insurance_phone: renter.insurance_phone,
      fleet: renter.fleet || getFleetName(),
    });
    setExtractionQuality(null);
    setShowAddAnother(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save helper: save one contract + auto-match tolls + upsert customer
  const saveOneContract = async (contractData) => {
    const fleetName = contractData.fleet || getFleetName();
    const created = await base44.entities.RentalContract.create({
      ...contractData,
      fleet: fleetName,
      contract_pdf_url: pdfUrl || '',
      tenant_id: tenant?.id || 'owner',
    });

    // Upsert customer
    if (contractData.renter_name) {
      const existing = await base44.entities.Customer.filter({ full_name: contractData.renter_name });
      const customerData = {
        full_name: contractData.renter_name,
        email: contractData.renter_email || undefined,
        phone: contractData.renter_phone || undefined,
        preferred_fleet: fleetName,
        source: contractData.platform || 'direct',
        last_rental_date: contractData.start_date ? contractData.start_date.slice(0, 10) : undefined,
      };
      if (existing?.length > 0) {
        await base44.entities.Customer.update(existing[0].id, customerData);
      } else {
        await base44.entities.Customer.create(customerData);
      }
    }

    // Auto-match tolls
    if (contractData.license_plate) {
      const unmatchedTolls = await base44.entities.TollNotice.filter({
        license_plate: contractData.license_plate.toUpperCase().replace(/\s+/g, ''),
        match_status: 'unmatched',
      });
      let matchCount = 0;
      for (const toll of unmatchedTolls) {
        const tollDate = new Date(toll.occurrence_date);
        const startDate = new Date(contractData.start_date);
        const endDate = new Date(contractData.end_date);
        if (tollDate >= startDate && tollDate <= endDate) {
          await base44.entities.TollNotice.update(toll.id, {
            match_status: 'matched',
            matched_contract_id: created.id,
            matched_renter_name: contractData.renter_name,
            matched_platform: contractData.platform,
          });
          matchCount++;
        }
      }
      if (matchCount > 0) {
        await base44.entities.Alert.create({
          type: 'toll_matched',
          title: `Auto-matched ${matchCount} toll(s)`,
          message: `Found ${matchCount} matching toll(s) for plate ${contractData.license_plate} and renter ${contractData.renter_name}`,
          fleet: fleetName,
          severity: 'success',
          license_plate: contractData.license_plate,
          renter_name: contractData.renter_name,
        });
      }
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setMatchProgress('');
    setMatchResults(null);
    const toSave = mode === 'multi_review' ? contracts : [form];
    for (const c of toSave) {
      await saveOneContract(c);
    }
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['tolls'] });
    queryClient.invalidateQueries({ queryKey: ['alerts-unread'] });
    
    // Run auto-match on all tolls
    setMatchProgress('Auto-matching tolls to contracts...');
    try {
      await base44.functions.invoke('autoMatchTolls', {});
    } catch (err) {
      console.error('Auto-match failed:', err);
    }
    setMatchProgress('');
    setMatchResults('Auto-matching complete!');
    queryClient.invalidateQueries({ queryKey: ['tolls'] });
    setTimeout(() => setMatchResults(null), 2000);
    
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    setSaving(false);
    if (mode === 'single_form') {
      // If there were more contracts in the original PDF, store them as pending
      const remaining = allExtracted.filter(c =>
        !(c.renter_name === form.renter_name && c.start_date?.slice(0, 10) === form.start_date?.slice(0, 10))
      );
      if (remaining.length > 0) {
        sessionStorage.setItem('pending_contracts', JSON.stringify({
          total: allExtracted.length,
          contracts: remaining,
        }));
      }
      setSavedRenter(form);
      setShowAddAnother(true);
    } else {
      setTimeout(() => navigate('/contracts'), 800);
    }
  };

  return (
    <div>
      <PageHeader
        emoji="📝"
        title="Add Contract"
        action={
          <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        }
      />

      <div className="px-4 space-y-3 pb-8">
        {/* UPLOAD ZONE */}
        {mode === 'upload' && (
          <div className="border-2 border-dashed border-primary/30 rounded-2xl p-6 text-center bg-primary/5">
            <input type="file" id="contract-file" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
            {extracting ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="font-bold text-sm text-primary">{extractProgress || 'Reading PDF...'}</p>
                <p className="text-xs text-muted-foreground">Converting pages to images for best accuracy</p>
              </div>
            ) : (
              <label htmlFor="contract-file" className="cursor-pointer block">
                <Upload className="w-10 h-10 mx-auto text-primary/50 mb-2" />
                <p className="font-black text-base">Upload Contract PDF</p>
                <p className="text-xs text-muted-foreground mt-1">AI detects all contracts inside — even 50+ in one PDF</p>
              </label>
            )}
            {extractError && (
              <p className="text-xs text-red-400 mt-2 font-bold">{extractError}</p>
            )}
          </div>
        )}

        {/* After upload: show option to add manually or re-upload */}
        {(mode === 'single_form' || mode === 'multi_review') && !extracting && (
          <div className="flex items-center gap-2">
            <label htmlFor="contract-file-reupload" className="cursor-pointer flex-1">
              <div className="border border-dashed border-border rounded-xl p-2 text-center text-xs text-muted-foreground hover:border-primary/50 transition-colors">
                <Upload className="w-3 h-3 inline mr-1" /> Upload a different PDF
              </div>
              <input type="file" id="contract-file-reupload" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* MULTI CONTRACT REVIEW */}
        {mode === 'multi_review' && !extracting && (
          <MultiContractReview
            contracts={contracts}
            onChange={setContracts}
            onSave={handleSaveAll}
            saving={saving}
          />
        )}

        {/* SINGLE CONTRACT FORM */}
        {mode === 'single_form' && !extracting && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Extension mode banner */}
            {isExtensionMode && extractionQuality === null && (
              <div className="bg-blue-950/40 border-2 border-blue-600 rounded-2xl p-3 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-blue-300">Adding extension for {form.renter_name}</p>
                  <p className="text-xs text-muted-foreground">Renter info pre-filled — just set the new dates</p>
                </div>
              </div>
            )}

            {/* Honest extraction status banner */}
            {extractionQuality === 'full' && (
              <div className="bg-green-950/40 border-2 border-green-600 rounded-2xl p-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-400" />
                <p className="text-xs font-bold text-green-300">Contract extracted — verify the fields below</p>
              </div>
            )}
            {extractionQuality === 'partial' && (
              <div className="bg-orange-950/40 border-2 border-orange-500 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <p className="text-xs font-bold text-orange-300">Partial extraction — please fill in the missing fields</p>
                </div>
                {pdfUrl && (
                  <button onClick={handleRetryExtraction} className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 font-bold">
                    <RefreshCw className="w-3 h-3" /> Try extracting again
                  </button>
                )}
              </div>
            )}
            {extractionQuality === 'failed' && (
              <div className="bg-red-950/40 border-2 border-red-600 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs font-bold text-red-300">Could not read this PDF — fill in manually</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {pdfUrl && (
                      <button onClick={handleRetryExtraction} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-bold">
                        <RefreshCw className="w-3 h-3" /> Retry
                      </button>
                    )}
                    {debugInfo && (
                      <button onClick={() => setShowDebug(v => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Debug
                      </button>
                    )}
                  </div>
                </div>
                {showDebug && debugInfo && (
                  <div className="bg-black/40 rounded-xl p-2 text-[10px] font-mono text-muted-foreground space-y-0.5 mt-1">
                    <p>Method: <span className="text-foreground">{debugInfo.method ?? '—'}</span></p>
                    <p>File size: <span className="text-foreground">{debugInfo.fileSizeMB != null ? `${debugInfo.fileSizeMB} MB` : '—'}</span></p>
                    <p>Pages: <span className="text-foreground">{debugInfo.pageCount != null ? debugInfo.pageCount : '—'}</span></p>
                    {debugInfo.error && <p className="text-red-400 break-all">Error: {debugInfo.error}</p>}
                  </div>
                )}
              </div>
            )}
            {extractionQuality === null && (
              <div className="bg-secondary border border-border rounded-2xl p-2 flex items-center gap-2">
                <Plus className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-bold text-muted-foreground">Manual entry — fill in the fields below</p>
              </div>
            )}

            <FormField label="Renter Full Name">
              <Input className="rounded-xl h-12 font-bold" value={form.renter_name} onChange={e => set('renter_name', e.target.value)} placeholder="Enter renter full name" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email">
                <Input type="email" className="rounded-xl h-12" value={form.renter_email} onChange={e => set('renter_email', e.target.value)} placeholder="renter@email.com" />
              </FormField>
              <FormField label="Phone">
                <Input type="tel" className="rounded-xl h-12" value={form.renter_phone} onChange={e => set('renter_phone', e.target.value)} placeholder="555-123-4567" />
              </FormField>
            </div>
            <FormField label="License Plate">
              <Input className="rounded-xl h-12 font-bold text-lg uppercase" value={form.license_plate} onChange={e => set('license_plate', e.target.value.toUpperCase())} placeholder="e.g. CA9KWZ508" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Start Date & Time">
                <Input type="datetime-local" className="rounded-xl h-12" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </FormField>
              <FormField label="End Date & Time">
                <Input type="datetime-local" className="rounded-xl h-12" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Platform">
                <Select value={form.platform} onValueChange={v => set('platform', v)}>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turo">🚗 Turo</SelectItem>
                    <SelectItem value="upcar">🚙 UpCar</SelectItem>
                    <SelectItem value="rentcentric">📋 RentCentric</SelectItem>
                    <SelectItem value="signnow">✍️ SignNow</SelectItem>
                    <SelectItem value="direct">🤝 Direct</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Reservation ID">
                <Input className="rounded-xl h-12" value={form.reservation_id} onChange={e => set('reservation_id', e.target.value)} placeholder="Optional" />
              </FormField>
            </div>
            <div className="flex gap-4">
              <FormField label="Signature">
                <Select value={form.signature_status} onValueChange={v => set('signature_status', v)}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signed">✅ Signed</SelectItem>
                    <SelectItem value="pending">⏳ Pending</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Trip Status">
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">🔵 Upcoming</SelectItem>
                    <SelectItem value="active">🟢 Active</SelectItem>
                    <SelectItem value="completed">🟣 Completed</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="pt-2">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wide mb-2">Vehicle Info</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Make"><Input className="rounded-xl h-12" value={form.vehicle_make} onChange={e => set('vehicle_make', e.target.value)} placeholder="e.g. Toyota" /></FormField>
                <FormField label="Model"><Input className="rounded-xl h-12" value={form.vehicle_model} onChange={e => set('vehicle_model', e.target.value)} placeholder="e.g. Camry" /></FormField>
                <FormField label="Year"><Input className="rounded-xl h-12" value={form.vehicle_year} onChange={e => set('vehicle_year', e.target.value)} placeholder="e.g. 2022" /></FormField>
                <FormField label="Color"><Input className="rounded-xl h-12" value={form.vehicle_color} onChange={e => set('vehicle_color', e.target.value)} placeholder="e.g. Silver" /></FormField>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wide mb-2">Insurance</p>
              <div className="space-y-3">
                <FormField label="Insurance Company"><Input className="rounded-xl h-12" value={form.insurance_company} onChange={e => set('insurance_company', e.target.value)} placeholder="e.g. State Farm" /></FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Policy Number"><Input className="rounded-xl h-12" value={form.insurance_policy} onChange={e => set('insurance_policy', e.target.value)} placeholder="Policy number" /></FormField>
                  <FormField label="Insurance Phone"><Input type="tel" className="rounded-xl h-12" value={form.insurance_phone} onChange={e => set('insurance_phone', e.target.value)} placeholder="1-800-555-0000" /></FormField>
                </div>
              </div>
            </div>

            {/* Show debug info for partial/full extractions too */}
            {debugInfo && extractionQuality !== 'failed' && (
              <div className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowDebug(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <span>🔍 Extraction debug info</span>
                  {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showDebug && (
                  <div className="bg-black/40 px-3 pb-2 text-[10px] font-mono text-muted-foreground space-y-0.5">
                    <p>Method: <span className="text-foreground">{debugInfo.method ?? '—'}</span></p>
                    <p>File size: <span className="text-foreground">{debugInfo.fileSizeMB != null ? `${debugInfo.fileSizeMB} MB` : '—'}</span></p>
                    <p>Pages: <span className="text-foreground">{debugInfo.pageCount != null ? debugInfo.pageCount : '—'}</span></p>
                    {debugInfo.error && <p className="text-orange-400 break-all">Note: {debugInfo.error}</p>}
                  </div>
                )}
              </div>
            )}

            {matchProgress && (
              <div className="bg-blue-950/40 border-2 border-blue-600 rounded-2xl p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <p className="text-sm font-bold text-blue-300">{matchProgress}</p>
              </div>
            )}
            
            {matchResults && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-green-950/40 border-2 border-green-600 rounded-2xl p-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-sm font-bold text-green-300">✅ {matchResults}</p>
              </motion.div>
            )}

            {showAddAnother ? (
              <div className="bg-green-950/40 border-2 border-green-600 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <p className="font-bold text-green-300">Contract saved!</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Does <span className="font-bold text-foreground">{savedRenter?.renter_name}</span> have more rental periods?
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleAddAnother} className="flex-1 h-10 rounded-xl gap-2 bg-primary font-bold text-sm">
                    <Copy className="w-3.5 h-3.5" /> Add Another Period
                  </Button>
                  <Button onClick={() => navigate('/contracts')} variant="outline" className="flex-1 h-10 rounded-xl font-bold text-sm">
                    Go to Contracts
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={handleSaveAll} disabled={saving}
                className="w-full h-14 rounded-2xl font-bold text-lg gap-2 bg-green-500 text-white shadow-lg hover:bg-green-600 mt-2">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Save Contract
              </Button>
            )}
          </motion.div>
        )}

        {/* Manual entry option when on upload screen */}
        {mode === 'upload' && !extracting && (
          <button
            onClick={() => { setForm(emptyContract(getFleetName())); setMode('single_form'); }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
          >
            <Plus className="w-3 h-3 inline mr-1" /> Enter manually instead
          </button>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <Label className="text-xs font-bold text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}