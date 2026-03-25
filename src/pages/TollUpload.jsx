import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, Upload, FileText, ArrowLeft, Loader2, CheckCircle, Sparkles, Plus, X, FolderOpen, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import PageHeader from '@/components/shared/PageHeader';
import ExtractionDebugger from '@/components/tolls/ExtractionDebugger';
import TollReviewStep from '@/components/tolls/TollReviewStep';
import DuplicateWarning from '@/components/tolls/DuplicateWarning';
import { useTenant } from '@/lib/TenantContext';
import { format } from 'date-fns';

// ── STEP 1: Capture/Upload photos ─────────────────────────────────────────────
function PhotoCaptureStep({ onFilesReady }) {
  const [photos, setPhotos] = useState([]);
  const [sizeWarning, setSizeWarning] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const filesInputRef = useRef(null);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit (will auto-compress large PDFs)
  const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB warning for large files

  const addPhotos = (files) => {
    setSizeWarning(null);
    const newPhotos = [];
    let hasLargeFile = false;

    Array.from(files).forEach(f => {
      if (f.size > MAX_FILE_SIZE) {
        setSizeWarning(`❌ ${f.name} is ${(f.size / 1024 / 1024).toFixed(1)}MB — max 100MB allowed. Files larger than 10MB will auto-compress.`);
        return;
      }
      if (f.size > WARN_FILE_SIZE) {
        hasLargeFile = true;
      }
      newPhotos.push({
        file: f,
        preview: f.type === 'application/pdf'
          ? null
          : URL.createObjectURL(f),
        name: f.name,
        size: f.size,
      });
    });

    if (hasLargeFile && !sizeWarning) {
      setSizeWarning(`⚠️ Large file detected — extraction may take up to 60 seconds`);
    }

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Camera input — opens camera directly */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={e => addPhotos(e.target.files)}
        className="hidden"
      />
      {/* Gallery input — opens photo library + files, NO camera */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        onChange={e => addPhotos(e.target.files)}
        className="hidden"
      />
      {/* Files/Documents input — PDF + all files, triggers iOS Files app picker */}
      <input
        ref={filesInputRef}
        type="file"
        accept=".pdf,application/pdf,image/*,.heic,.heif"
        multiple
        onChange={e => addPhotos(e.target.files)}
        className="hidden"
      />

      {sizeWarning && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 mb-4">
          <p className="font-bold text-red-700 text-sm">{sizeWarning}</p>
        </motion.div>
      )}

      {photos.length === 0 ? (
        <div className="border-4 border-dashed border-primary/30 rounded-3xl p-8 text-center bg-primary/5">
          <FileText className="w-16 h-16 mx-auto text-primary/50 mb-3" />
          <h3 className="font-black text-lg mb-1">Add Toll Notices</h3>
          <p className="text-xs text-muted-foreground mb-5">Take a photo, choose from gallery, or import a PDF from Files</p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button onClick={() => cameraInputRef.current?.click()}
              className="rounded-2xl h-13 px-6 font-bold gap-2 bg-primary text-primary-foreground w-full">
              <Camera className="w-5 h-5" /> Camera
            </Button>
            <Button onClick={() => galleryInputRef.current?.click()} variant="outline"
              className="rounded-2xl h-13 px-6 font-bold gap-2 w-full">
              <Image className="w-5 h-5" /> Gallery / Photos
            </Button>
            <Button onClick={() => filesInputRef.current?.click()} variant="outline"
              className="rounded-2xl h-13 px-6 font-bold gap-2 w-full">
              <FolderOpen className="w-5 h-5" /> Import from Files
              <span className="text-[10px] ml-1 opacity-60">(iCloud, Drive, PDF)</span>
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {sizeWarning && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-3 mb-4">
              <p className="font-bold text-yellow-700 text-sm">{sizeWarning}</p>
            </motion.div>
          )}
          {/* Photo grid preview */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {photos.map((p, i) => (
              <div key={i} className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-secondary">
                {p.preview ? (
                  <img src={p.preview} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-secondary">
                    <FileText className="w-8 h-8 text-primary/60" />
                    <span className="text-[9px] font-bold text-muted-foreground/90 px-1 text-center truncate w-full px-2">{p.name}</span>
                    <span className="text-[8px] text-muted-foreground/70 font-mono">{(p.size / 1024 / 1024).toFixed(1)}MB</span>
                  </div>
                )}
                <button onClick={() => removePhoto(i)}
                  className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1 text-white">
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-1.5 left-1.5 bg-black/60 rounded-full px-1.5 py-0.5 text-white text-[10px] font-bold">
                  {i + 1}
                </div>
              </div>
            ))}
            <button onClick={() => galleryInputRef.current?.click()}
              className="aspect-[3/4] rounded-2xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center text-primary/60 bg-primary/5 hover:bg-primary/10 transition-colors">
              <Plus className="w-7 h-7 mb-1" />
              <span className="text-[10px] font-bold">Add More</span>
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-blue-700 mb-4">
            📄 {photos.length} page{photos.length > 1 ? 's' : ''} ready — AI will extract all tolls from each page
          </div>

          <Button onClick={() => onFilesReady(photos.map(p => p.file))}
            className="w-full h-14 rounded-2xl font-bold text-lg gap-2 bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="w-5 h-5" /> Extract Tolls with AI →
          </Button>
        </div>
      )}

      <div className="mt-5 text-center">
        <button onClick={() => onFilesReady([])} className="text-sm text-primary font-bold underline">
          Enter toll manually instead →
        </button>
      </div>
    </motion.div>
  );
}



// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function TollUpload() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant, fleets, loading } = useTenant();
  
  // Guard: ensure tenant is loaded before rendering
  if (loading || !tenant || !fleets) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold text-muted-foreground/90 text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  const [step, setStep] = useState('capture'); // capture | extracting | review | done
  const [tollForms, setTollForms] = useState([]);
  const [uploadedFileUrls, setUploadedFileUrls] = useState([]);
  const [savedCount, setSavedCount] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [extractProgress, setExtractProgress] = useState({ stage: 'uploading', current: 0, total: 1, message: '', error: null });
  const [debugData, setDebugData] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { duplicate, pendingToll, pendingCallback }

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.RentalContract.list('-created_date', 500),
    initialData: [],
  });

  const defaultToll = () => ({
    license_plate: '',
    occurrence_date: '',
    occurrence_time: '',
    notice_date: '',
    amount: '',
    agency: '',
    location: '',
    transaction_id: '',
    fleet: fleets[0]?.id || '',
    is_violation: false,
    is_non_fastrak: false,
    _extraction_confidence: 100,
  });

  const emptyToll = () => ({
    license_plate: '',
    occurrence_date: '',
    occurrence_time: '',
    notice_date: '',
    amount: '',
    agency: '',
    location: '',
    transaction_id: '',
    fleet: fleets[0]?.id || '',
    is_violation: false,
    is_non_fastrak: false,
    _extraction_confidence: 0,
  });

  // No compression needed in frontend - backend handles it
  const compressFileIfNeeded = async (file) => {
    return file;
  };

  const handleFilesReady = async (files) => {
    if (files.length === 0) {
      setTollForms([emptyToll()]);
      setStep('review');
      return;
    }

    setStep('extracting');
    setExtractProgress({ stage: 'uploading', current: 0, total: files.length, message: `Processing ${files.length} file(s)...`, error: null });

    // Upload all files
    const urls = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setExtractProgress(p => ({ ...p, current: i + 1, message: `Uploading ${files[i].name} (${i + 1}/${files.length})...` }));
        const uploaded = await base44.integrations.Core.UploadFile({ file: files[i] });
        urls.push(uploaded.file_url);
      }
      setUploadedFileUrls(urls);
    } catch (err) {
      setExtractProgress(p => ({ ...p, error: `Upload failed: ${err.message}` }));
      return;
    }

    // Process each file with robust error handling
    const allTolls = [];
    const errors = [];

    for (let i = 0; i < urls.length; i++) {
      const fileLabel = files[i].name || `File ${i + 1}`;
      const fileSizeMB = (files[i].size / 1024 / 1024).toFixed(1);
      const isPDF = files[i].type === 'application/pdf';

      try {
        // If PDF > 10MB, split by pages and process each page as image
        if (isPDF && files[i].size > 10 * 1024 * 1024) {
          setExtractProgress(p => ({
            ...p,
            stage: 'extracting',
            message: `Splitting ${fileLabel} (${fileSizeMB}MB) into pages... (120 second timeout)`,
          }));

          const splitRes = await base44.functions.invoke('extractPDFPages', { 
            file_url: urls[i]
          });

          if (!splitRes.data.success) {
            throw new Error(`Failed to split PDF: ${splitRes.data.error}`);
          }

          const pages = splitRes.data.pages;
          console.log(`📄 Split into ${pages.length} pages`);

          // Process each page
          for (const page of pages) {
            setExtractProgress(p => ({
              ...p,
              message: `Processing page ${page.page_num} of ${page.total_pages} (${page.size_kb}KB)... (120s timeout)`,
            }));

            const pageRes = await base44.functions.invoke('extractTollsFromImage', {
              image_data_url: page.data_url,
              page_num: page.page_num,
              total_pages: page.total_pages,
            });

            if (pageRes.data.success && pageRes.data.tolls?.length > 0) {
              allTolls.push(...pageRes.data.tolls.map(t => ({ 
                ...t, 
                _extraction_confidence: 85 
              })));
              console.log(`✓ Page ${page.page_num}: ${pageRes.data.tolls.length} toll(s) found`);
            }
          }

          setExtractProgress(p => ({
            ...p,
            message: `✓ All ${pages.length} pages processed! Found ${allTolls.length} total toll(s).`,
          }));
        } else {
          // For non-PDF or small PDFs, use old single-shot extraction
          setExtractProgress(p => ({
            ...p,
            stage: 'extracting',
            message: `Extracting tolls from ${fileLabel}... (120s timeout)`,
          }));

          const res = await base44.functions.invoke('extractDocumentData', { 
            file_url: urls[i],
            document_type: 'toll'
          });

          if (!res.data.success) {
            errors.push(`${fileLabel}: ${res.data.error}`);
            continue;
          }

          const fileTolls = res.data.data?.response?.tolls || [];
          const confidence = fileTolls.length > 0 
            ? Math.round(fileTolls.reduce((sum, t) => {
                let completeness = 0;
                if (t.license_plate && t.license_plate !== '<UNKNOWN>') completeness += 20;
                if (t.occurrence_date && t.occurrence_date !== '<UNKNOWN>') completeness += 20;
                if (t.amount && t.amount !== '<UNKNOWN>') completeness += 20;
                if (t.agency && t.agency !== '<UNKNOWN>') completeness += 20;
                if (t.location && t.location !== '<UNKNOWN>') completeness += 20;
                return sum + completeness;
              }, 0) / fileTolls.length)
            : 0;

          if (fileTolls.length > 0 && !debugData) {
            setDebugData({
              fileLabel,
              rawResult: res.data,
              mappedTolls: fileTolls
            });
          }

          allTolls.push(...fileTolls.map(t => ({ ...t, _extraction_confidence: confidence })));
        }
      } catch (err) {
        const isTimeout = err.message?.includes('timeout') || err.message?.includes('504') || err.message?.includes('429');
        const errorMsg = isTimeout 
          ? `${fileLabel} (${fileSizeMB}MB) timed out — try splitting into smaller PDFs`
          : `${fileLabel}: ${err.message}`;

        errors.push(errorMsg);

        await base44.functions.invoke('logAdminFailure', {
          tenant_id: tenant?.id,
          log_type: 'extraction_failure',
          severity: isTimeout ? 'medium' : 'high',
          title: `Failed to extract tolls from ${fileLabel}`,
          message: errorMsg,
          file_url: urls[i],
          file_name: fileLabel,
          error_stack: err.stack,
        }).catch(() => null);

        console.error(`Extraction error for ${fileLabel}:`, err.message);
      }
    }

    if (errors.length > 0) {
      setExtractProgress(p => ({
        ...p,
        stage: 'done',
        message: `✅ Extracted ${allTolls.length} tolls. ${errors.length} file(s) had issues — you can enter those manually.`,
        error: errors.join('\n')
      }));
    } else {
      setExtractProgress(p => ({ ...p, stage: 'done', message: `✅ Extracted ${allTolls.length} toll transaction(s) total!` }));
    }
    await new Promise(r => setTimeout(r, 800));

    if (allTolls.length > 0) {
      setTollForms(allTolls.map(t => ({
        license_plate: (t.license_plate || '').replace(/\s+/g, '').toUpperCase(),
        occurrence_date: t.occurrence_date || '',
        occurrence_time: t.occurrence_time || '',
        notice_date: t.notice_date || '',
        amount: t.amount ? String(t.amount) : '',
        agency: t.agency || '',
        location: t.location || '',
        transaction_id: t.transaction_id || '',
        is_violation: t.is_violation || false,
        is_non_fastrak: t.agency ? !t.agency.toLowerCase().includes('fastrak') : false,
        fleet: fleets[0]?.id || '',
        _extraction_confidence: t._extraction_confidence || 80,
      })));
    } else {
      setTollForms([emptyToll()]);
    }
    setStep('review');
  };

  const handleTollChange = (index, updatedToll) => {
    setTollForms(prev => {
      const next = [...prev];
      if (index >= next.length) {
        next.push(updatedToll);
      } else {
        next[index] = updatedToll;
      }
      return next;
    });
  };

  const findMatch = (toll) => {
    if (!toll.license_plate || !toll.occurrence_date) return null;
    const tollDate = new Date(toll.occurrence_date);
    return contracts.find(c => {
      if (c.license_plate?.toUpperCase() !== toll.license_plate?.toUpperCase()) return false;
      return tollDate >= new Date(c.start_date) && tollDate <= new Date(c.end_date);
    });
  };

  // Check for duplicates: Transaction ID first, then fallback to plate+date+time+location+amount
  const checkDuplicate = async (toll) => {
    if (!toll.license_plate || !toll.occurrence_date) return null;
    
    // If we have a transaction ID, that's the primary duplicate check
    if (toll.transaction_id) {
      const existing = await base44.entities.TollNotice.filter({
        transaction_id: toll.transaction_id,
      });
      return existing.length > 0 ? existing[0] : null;
    }
    
    // Fallback: check plate + date + time + location + amount combo
    const existing = await base44.entities.TollNotice.filter({
      license_plate: toll.license_plate.toUpperCase(),
      occurrence_date: toll.occurrence_date,
    });
    const amount = parseFloat(toll.amount) || 0;
    const time = (toll.occurrence_time || '').trim();
    const location = (toll.location || '').trim();
    return existing.find(e => {
      const amountMatch = Math.abs((e.amount || 0) - amount) < 0.01;
      const timeMatch = !time || !e.occurrence_time || time === (e.occurrence_time || '').trim();
      const locMatch = !location || !e.location || location === (e.location || '').trim();
      return amountMatch && timeMatch && locMatch;
    }) || null;
  };

 const saveSingleToll = async (toll) => {
    const match = findMatch(toll);
    const isMatched = match && match.signature_status !== 'pending';
    const tollRecord = {
      ...toll,
      amount: parseFloat(toll.amount) || 0,
      notice_image_urls: uploadedFileUrls,
      match_status: match ? (match.signature_status === 'pending' ? 'pending_signature' : 'matched') : 'unmatched',
      lifecycle_status: isMatched ? 'matched' : 'unmatched',
      matched_contract_id: match ? String(match.id) : undefined,
      matched_renter_name: match ? match.renter_name : undefined,
      matched_platform: match ? match.platform : undefined,
    };
    await base44.entities.TollNotice.create(tollRecord);
    return { isDuplicate: false, matched: !!match };
};
    if (!match) {
      await base44.entities.Alert.create({
        type: 'toll_unmatched',
        title: 'Unmatched Toll',
        message: `Toll for ${toll.license_plate} on ${toll.occurrence_date} ($${toll.amount}) has no matching contract`,
        fleet: toll.fleet,
        severity: 'critical',
        license_plate: toll.license_plate,
      });
    }
    return { isDuplicate: false, matched: !!match };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let matched = 0;
      let saved = 0;
      const skipped = [];
      for (const toll of tollForms) {
        if (toll._skip) continue;
        const result = await saveSingleToll(toll, toll._forceAdd);
        if (result.isDuplicate) {
          // Track skipped duplicate
          skipped.push({
            plate: toll.license_plate,
            date: toll.occurrence_date,
            time: toll.occurrence_time,
            amount: toll.amount,
          });
          continue;
        }
        if (result.matched) matched++;
        saved++;
      }
      return { saved, matched, hasDuplicate: false, skipped };
    },
    onSuccess: async (result) => {
      setSavedCount(result.saved);
      setMatchedCount(result.matched);
      
      // Show duplicate rejection message if any were skipped
      if (result.skipped?.length > 0) {
        const msg = result.skipped.length === 1
          ? `This toll already exists — skipped.\n${result.skipped[0].plate} · ${result.skipped[0].date}`
          : `${result.skipped.length} duplicate toll(s) already existed — skipped.`;
        alert(`⚠️ ${msg}`);
      }
      
      // Run auto-match on all saved tolls
      if (result.saved > 0) {
        try {
          await base44.functions.invoke('autoMatchTolls', {});
        } catch (err) {
          console.error('Auto-match failed:', err);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['tolls'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-unread'] });
      setStep('done');
      if (result.matched > 0) confetti({ particleCount: 80 * result.matched, spread: 70, origin: { y: 0.6 } });
    },
    onError: (err) => {
      // Log save failure
      base44.functions.invoke('logAdminFailure', {
        tenant_id: tenant?.id,
        log_type: 'match_failure',
        severity: 'high',
        title: 'Failed to save tolls',
        message: err.message,
        error_stack: err.stack,
      }).catch(() => {});
    },
  });

  return (
    <div>
      <PageHeader
        emoji="📸"
        title="Upload Toll Notice"
        action={
          <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        }
      />

      <div className="px-4">
        <AnimatePresence mode="wait">
          {step === 'capture' && (
            <PhotoCaptureStep onFilesReady={handleFilesReady} />
          )}

          {step === 'extracting' && (
            <motion.div key="extracting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="py-10 px-2">
              {extractProgress.error ? (
                <div className="space-y-4">
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                    <p className="font-black text-red-700 mb-1">❌ Extraction Failed</p>
                    <p className="text-sm text-red-600">{extractProgress.error}</p>
                  </div>
                  <Button onClick={() => { setTollForms([defaultToll()]); setStep('review'); }}
                    className="w-full h-12 rounded-2xl font-bold gap-2 bg-primary text-primary-foreground">
                    ✏️ Enter Toll Manually Instead
                  </Button>
                  <Button onClick={() => setStep('capture')} variant="outline"
                    className="w-full h-12 rounded-2xl font-bold">
                    ← Try Again
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="relative mx-auto w-20 h-20 mb-4">
                      <Loader2 className="w-20 h-20 text-primary/20 absolute inset-0" />
                      <Loader2 className="w-20 h-20 text-primary animate-spin absolute inset-0" style={{ strokeDasharray: '60 100' }} />
                      <span className="absolute inset-0 flex items-center justify-center text-2xl">
                        {extractProgress.stage === 'uploading' ? '📤' : extractProgress.stage === 'done' ? '✅' : '🤖'}
                      </span>
                    </div>
                    <h3 className="font-black text-lg text-primary">
                      {extractProgress.stage === 'uploading' ? 'Uploading...' :
                       extractProgress.stage === 'done' ? 'Done!' : 'AI Extracting Tolls...'}
                    </h3>
                  </div>

                  {/* Progress bar */}
                  {extractProgress.total > 1 && (
                    <div>
                      <div className="flex justify-between text-xs font-bold text-muted-foreground/90 mb-1">
                        <span>File {extractProgress.current} of {extractProgress.total}</span>
                        <span>{Math.round((extractProgress.current / extractProgress.total) * 100)}%</span>
                      </div>
                      <div className="h-3 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          animate={{ width: `${Math.round((extractProgress.current / extractProgress.total) * 100)}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Live status log */}
                  <div className="bg-secondary rounded-2xl p-4 space-y-2 min-h-[80px]">
                    <AnimatePresence mode="popLayout">
                      <motion.p
                        key={extractProgress.message}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-bold text-foreground"
                      >
                        {extractProgress.message}
                      </motion.p>
                    </AnimatePresence>
                    <p className="text-xs text-muted-foreground/90">Large PDFs may take up to 60 seconds — please wait...</p>
                  </div>

                  <Button onClick={() => { setTollForms([defaultToll()]); setStep('review'); }}
                    variant="outline" className="w-full h-10 rounded-2xl font-bold text-sm border-dashed">
                    Skip AI — Enter Manually
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {step === 'review' && (
           <>
             {debugData && (
               <ExtractionDebugger
                 extractedData={debugData.rawResult}
                 fileLabel={debugData.fileLabel}
               />
             )}
             <TollReviewStep
               tolls={tollForms}
               onTollChange={handleTollChange}
               onSaveAll={() => saveMutation.mutate()}
               contracts={contracts}
               fleets={fleets}
               isSaving={saveMutation.isPending}
             />
           </>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: 2, duration: 0.3 }}>
                <span className="text-7xl">{matchedCount > 0 ? '🎉' : '📝'}</span>
              </motion.div>
              <h2 className="text-2xl font-black mt-4">{savedCount} Toll{savedCount !== 1 ? 's' : ''} Saved!</h2>
              <div className="flex gap-3 justify-center mt-3">
                <div className="bg-green-100 text-green-700 rounded-2xl px-4 py-2 text-sm font-bold">
                  ✅ {matchedCount} matched
                </div>
                <div className="bg-red-100 text-red-700 rounded-2xl px-4 py-2 text-sm font-bold">
                  ❌ {savedCount - matchedCount} unmatched
                </div>
              </div>
              <div className="flex gap-2 justify-center mt-6">
                <Button onClick={() => {
                  setStep('capture');
                  setTollForms([]);
                  setUploadedFileUrls([]);
                }} className="rounded-2xl h-12 px-6 font-bold gap-2 bg-primary text-primary-foreground">
                  <Camera className="w-4 h-4" /> Upload More
                </Button>
                <Button onClick={() => navigate('/tolls')} variant="outline" className="rounded-2xl h-12 px-6 font-bold">
                  View Tolls
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Duplicate Warning Modal */}
      <AnimatePresence>
        {duplicateWarning && (
          <DuplicateWarning
            duplicate={duplicateWarning.duplicate}
            onViewOriginal={() => { setDuplicateWarning(null); navigate('/tolls'); }}
            onAddAnyway={() => {
              // Mark this toll as force-add and retry
              setTollForms(prev => prev.map(t =>
                t.occurrence_date === duplicateWarning.toll.occurrence_date &&
                t.license_plate === duplicateWarning.toll.license_plate
                  ? { ...t, _forceAdd: true }
                  : t
              ));
              setDuplicateWarning(null);
              saveMutation.mutate();
            }}
            onCancel={() => setDuplicateWarning(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
