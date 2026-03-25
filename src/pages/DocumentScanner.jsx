import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Plus, Trash2, Check, Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CameraCapture from '@/components/scanner/CameraCapture';
import DocumentPreview from '@/components/scanner/DocumentPreview';
import PageThumbnails from '@/components/scanner/PageThumbnails';
import DocumentClassification from '@/components/scanner/DocumentClassification';
import VehiclePlateSelector from '@/components/scanner/VehiclePlateSelector';
import { useTenant } from '@/lib/TenantContext';
import { base44 } from '@/api/base44Client';

// Compression only: already enhanced by CameraCapture (grayscale + contrast 1.4)
// Just compress to max 1500px + 70% JPEG
async function compressImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX_W = 1500;
      const scale = img.width > MAX_W ? MAX_W / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.70);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function DocumentScanner() {
  const { tenant } = useTenant();
  // stages: capture | preview | classify | ocr_loading | plate_confirm | vehicle | processing | success
  const [stage, setStage] = useState('capture');
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [classification, setClassification] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [ocrResult, setOcrResult] = useState(null); // { plate, plateConfidence, transactions, toll_count, summary }
  const [ocrFailed, setOcrFailed] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  React.useEffect(() => {
    // Load vehicles from Vehicle entity, but also gather plates from tolls/contracts as fallback
    Promise.all([
      base44.entities.Vehicle.list('-updated_date', 100).catch(() => []),
      base44.entities.TollNotice.list('-updated_date', 200).catch(() => []),
      base44.entities.RentalContract.list('-updated_date', 200).catch(() => []),
    ]).then(([registered, tolls, contracts]) => {
      // Normalize all plates to uppercase, add CA prefix if missing
      const normalizePrefix = (p) => {
        if (!p) return null;
        const clean = p.replace(/\s+/g, '').toUpperCase();
        return clean.startsWith('CA') ? clean : `CA${clean}`;
      };

      if (registered.length > 0) {
        const normalized = registered.map(v => ({
          ...v,
          license_plate: normalizePrefix(v.license_plate),
        }));
        setVehicles(normalized);
        return;
      }
      // Synthesize vehicles from plates seen in tolls + contracts
      const plateMap = new Map();
      for (const t of tolls) {
        const normalized = normalizePrefix(t.license_plate);
        if (normalized && !plateMap.has(normalized)) {
          plateMap.set(normalized, { id: normalized, license_plate: normalized, make: '', model: '', year: '' });
        }
      }
      for (const c of contracts) {
        const normalized = normalizePrefix(c.license_plate);
        if (normalized && !plateMap.has(normalized)) {
          plateMap.set(normalized, {
            id: normalized,
            license_plate: normalized,
            make: c.vehicle_make || '',
            model: c.vehicle_model || '',
            year: c.vehicle_year || '',
          });
        }
      }
      setVehicles([...plateMap.values()]);
    });
  }, []);

  const handleCapturePage = async (imageData) => {
    // CameraCapture already enhanced (grayscale + contrast 1.4)
    // Just compress to 70% JPEG for storage
    const compressed = await compressImage(imageData);
    const newPages = [...pages, { id: Date.now(), data: compressed, timestamp: new Date() }];
    setPages(newPages);
    setCurrentPage(newPages.length - 1);
    setStage('preview');
  };

  const handleRetake = () => {
    const newPages = pages.filter((_, i) => i !== currentPage);
    setPages(newPages);
    if (currentPage >= newPages.length) setCurrentPage(Math.max(0, newPages.length - 1));
    setStage('capture');
  };

  const handleDeletePage = (index) => {
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
    if (currentPage >= newPages.length) setCurrentPage(Math.max(0, newPages.length - 1));
    if (newPages.length === 0) { setCurrentPage(null); setStage('capture'); }
  };

  const handleReorderPages = (newOrder) => setPages(newOrder);

  const handleClassified = async (type) => {
    setClassification(type);
    setOcrResult(null);
    setOcrFailed(false);

    if (type === 'toll' || type === 'contract' || type === 'violation') {
      setStage('ocr_loading');
      try {
        // Build PDF from all pages and upload for OCR
        const pdfRes = await base44.functions.invoke('scannerBuildPDF', {
          images: pages.map(p => p.data),
        });
        if (!pdfRes.data?.file_url) throw new Error('PDF generation failed');
        const fileUrl = pdfRes.data.file_url;
        
        const ocrRes = await base44.functions.invoke('scannerOCR', {
          file_url: fileUrl,
          doc_type: type,
          license_plate: null,
        });
        const data = ocrRes.data;
        if (data?.extracted_plate) {
          setOcrResult({
            plate: data.extracted_plate,
            plateConfidence: data.plate_confidence || 80,
            transactions: data.transactions || [],
            toll_count: data.toll_count || 0,
            summary: data.summary || '',
          });
          setStage('plate_confirm');
        } else {
          // OCR worked but no plate found — go to manual selector
          setStage('vehicle');
        }
      } catch (e) {
        console.error('[DocumentScanner] Pre-OCR failed:', e.message);
        setOcrFailed(true);
        setStage('vehicle'); // graceful fallback
      }
    } else {
      setStage('vehicle');
    }
  };

  const normalizePrefix = (p) => {
    const clean = p.replace(/\s+/g, '').toUpperCase();
    return clean.startsWith('CA') ? clean : `CA${clean}`;
  };

  const handlePlateConfirmed = (plate) => {
    const normalized = normalizePrefix(plate);
    handleProcess(normalized);
  };

  const handleVehicleSelected = (plate) => {
    const normalized = normalizePrefix(plate);
    handleProcess(normalized);
  };

  const handleProcess = async (plate) => {
    setProcessing(true);
    setProcessingProgress(10);
    setStage('processing');

    try {
      setProcessingProgress(25);
      const pdfRes = await base44.functions.invoke('scannerBuildPDF', {
        images: pages.map(p => p.data),
      });
      if (!pdfRes.data?.file_url) throw new Error('PDF generation failed');
      const fileUrl = pdfRes.data.file_url;
      setProcessingProgress(40);

      // Save PDF to toll entity FIRST (never lose the scan)
      let savedTollId = null;
      try {
        const tollRes = await base44.entities.TollNotice.create({
          license_plate: plate,
          occurrence_date: new Date().toISOString().split('T')[0],
          amount: 0, // placeholder
          notice_image_urls: [fileUrl],
          match_status: 'unmatched',
          lifecycle_status: 'unmatched',
        });
        savedTollId = tollRes.id;
        console.log('[DocumentScanner] Toll saved with ID:', savedTollId);
      } catch (saveErr) {
        console.error('[DocumentScanner] Failed to save toll:', saveErr.message);
        throw new Error(`Failed to save scan: ${saveErr.message}`);
      }
      setProcessingProgress(60);

      // Now attempt OCR extraction (non-critical)
      let extractedData = null;
      if (classification !== 'other') {
        try {
          const ocrRes = await base44.functions.invoke('scannerOCR', {
            file_url: fileUrl,
            doc_type: classification,
            license_plate: plate,
          });
          extractedData = ocrRes.data;
          setProcessingProgress(90);
          
          // If extraction succeeded, update the toll with extracted data
          if (extractedData && savedTollId) {
            try {
              const updatePayload = {};
              if (extractedData.transaction_id) updatePayload.transaction_id = extractedData.transaction_id;
              if (extractedData.occurrence_date) updatePayload.occurrence_date = extractedData.occurrence_date;
              if (extractedData.amount) updatePayload.amount = extractedData.amount;
              if (extractedData.location) updatePayload.location = extractedData.location;
              if (extractedData.agency) updatePayload.agency = extractedData.agency;
              if (Object.keys(updatePayload).length > 0) {
                await base44.entities.TollNotice.update(savedTollId, updatePayload);
                console.log('[DocumentScanner] Toll updated with extracted data');
              }
            } catch (updateErr) {
              console.error('[DocumentScanner] Failed to update toll with extracted data:', updateErr.message);
              // Not critical - scan is already saved
            }
          }
        } catch (ocrErr) {
          console.error('[DocumentScanner] OCR extraction failed (non-critical):', ocrErr.message);
          // Scan is already saved; this is just a bonus
        }
      }
      setProcessingProgress(100);

      setSuccessInfo({
        plate,
        pages: pages.length,
        tollCount: extractedData?.toll_count || 0,
        summary: extractedData ? (extractedData.summary || 'Scan processed successfully') : 'Scan saved but could not read data automatically',
        transactions: extractedData?.transactions || [],
        hadError: !extractedData,
      });
      setStage('success');
    } catch (err) {
      console.error('[DocumentScanner] Process error:', err);
      setSuccessInfo({
        plate,
        pages: pages.length,
        tollCount: 0,
        summary: `Error: ${err.message || 'Unknown error'}. Please try again.`,
        transactions: [],
        hadError: true,
      });
      setStage('success');
    } finally {
      setProcessing(false);
      setProcessingProgress(0);
    }
  };

  const handleReset = () => {
    setPages([]);
    setCurrentPage(null);
    setClassification(null);
    setOcrResult(null);
    setOcrFailed(false);
    setSuccessInfo(null);
    setStage('capture');
  };

  const estimatedSizeMB = ((pages.length * 150000) / 1024 / 1024).toFixed(1);
  const shouldWarn = pages.length * 150000 > 6 * 1024 * 1024;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* HEADER */}
      <div className="p-4 border-b border-border sticky top-0 z-20 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Camera className="w-6 h-6 text-primary" />
              Document Scanner
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {pages.length} page{pages.length !== 1 ? 's' : ''} scanned
              {pages.length > 0 && ` • ~${estimatedSizeMB}MB`}
              {shouldWarn && <span className="text-orange-400 font-bold ml-2">⚠️ Getting large</span>}
            </p>
          </div>
          {pages.length > 0 && !['processing', 'success'].includes(stage) && (
            <Button
              onClick={() => setStage('classify')}
              className="h-10 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-sm"
            >
              Create PDF ({pages.length})
            </Button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <AnimatePresence mode="wait">

          {/* CAPTURE */}
          {stage === 'capture' && (
            <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
              <CameraCapture onCapture={handleCapturePage} />
              {/* Cancel button if user has already scanned pages */}
              {pages.length > 0 && (
                <div className="p-4 border-t border-border bg-secondary/50">
                  <Button
                    onClick={() => setStage('preview')}
                    variant="outline"
                    className="w-full h-10 rounded-xl font-bold gap-2"
                  >
                    ← Back to scanned pages
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* PREVIEW — enhanced photo */}
          {stage === 'preview' && currentPage !== null && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden p-4">
              <div className="flex-1 overflow-hidden rounded-2xl bg-secondary mb-3">
                <DocumentPreview page={pages[currentPage]} />
              </div>
              <p className="text-xs text-center text-muted-foreground mb-3">✨ Auto-enhanced: grayscale + contrast boost applied</p>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleRetake} className="flex-1 h-12 rounded-xl gap-2 font-bold">
                    <X className="w-4 h-4" /> Retake
                  </Button>
                  <Button variant="outline" onClick={() => handleDeletePage(currentPage)} className="px-4 h-12 rounded-xl font-bold">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setStage('capture')} variant="outline" className="flex-1 h-12 rounded-xl gap-2 font-bold">
                    <Plus className="w-4 h-4" /> Add Page
                  </Button>
                  <Button onClick={() => setStage('classify')} className="flex-1 h-12 rounded-xl bg-primary gap-2 font-bold">
                    <Check className="w-4 h-4" /> Done
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* CLASSIFY */}
          {stage === 'classify' && (
            <motion.div key="classify" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex items-center justify-center p-4">
              <DocumentClassification onSelect={handleClassified} />
            </motion.div>
          )}

          {/* OCR LOADING */}
          {stage === 'ocr_loading' && (
            <motion.div key="ocr_loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex items-center justify-center p-4">
              <div className="text-center max-w-xs">
                <Loader2 className="w-14 h-14 text-primary animate-spin mx-auto mb-4" />
                <p className="font-black text-xl mb-2">Reading document...</p>
                <p className="text-sm text-muted-foreground">AI is extracting plate number and transactions</p>
              </div>
            </motion.div>
          )}

          {/* PLATE CONFIRM — OCR found a plate */}
          {stage === 'plate_confirm' && ocrResult && (
            <motion.div key="plate_confirm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
              <div className="w-full max-w-md">
                <div className="text-center mb-5">
                  <div className="text-4xl mb-2">🔍</div>
                  <h2 className="text-2xl font-black">Document scanned!</h2>
                  <p className="text-sm text-muted-foreground mt-1">AI extracted the following information</p>
                </div>

                {/* Plate */}
                {ocrResult.plateConfidence >= 80 ? (
                  <div className="bg-primary/10 border-2 border-primary rounded-2xl p-4 text-center mb-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">License Plate</p>
                    <p className="text-4xl font-black font-mono tracking-widest text-primary">{ocrResult.plate}</p>
                  </div>
                ) : (
                  <div className="bg-yellow-500/10 border-2 border-yellow-500 rounded-2xl p-4 text-center mb-4">
                    <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-1">⚠️ We think this is the plate — please verify</p>
                    <p className="text-4xl font-black font-mono tracking-widest text-yellow-400">{ocrResult.plate}</p>
                    <p className="text-xs text-muted-foreground mt-1">Confidence: {ocrResult.plateConfidence}% — tap Edit if incorrect</p>
                  </div>
                )}

                {/* Transactions summary */}
                {ocrResult.transactions.length > 0 && (
                  <div className="bg-secondary rounded-2xl p-4 mb-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Found {ocrResult.transactions.length} transaction{ocrResult.transactions.length !== 1 ? 's' : ''}
                    </p>
                    {ocrResult.transactions.slice(0, 3).map((t, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                        <span className="text-sm text-muted-foreground">
                          {t.date || 'Unknown date'}{t.location ? ` • ${t.location.substring(0, 20)}` : ''}
                        </span>
                        <span className="font-bold text-sm">${(t.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {ocrResult.transactions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">+{ocrResult.transactions.length - 3} more</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handlePlateConfirmed(ocrResult.plate)}
                    className="w-full h-14 rounded-2xl text-base font-black gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-5 h-5" /> Yes, that's correct — Save
                  </Button>
                  <Button
                    onClick={() => { setOcrResult(null); setStage('vehicle'); }}
                    variant="outline"
                    className="w-full h-12 rounded-xl gap-2 font-bold"
                  >
                    <Edit2 className="w-4 h-4" /> Edit plate or pick different
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* VEHICLE / MANUAL PLATE */}
          {stage === 'vehicle' && (
            <motion.div key="vehicle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
              {ocrFailed && (
                <div className="w-full max-w-md mb-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2 text-xs text-orange-400 font-semibold">
                  ⚠️ Auto-detection failed. Please enter the plate manually.
                </div>
              )}
              <VehiclePlateSelector
                vehicles={vehicles}
                onSelect={handleVehicleSelected}
                disabled={processing}
                suggestedPlate={null}
              />
            </motion.div>
          )}

          {/* PROCESSING */}
          {stage === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex items-center justify-center p-4">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                <p className="font-bold text-lg">Building PDF & running OCR...</p>
                <div className="mt-4 bg-secondary rounded-xl p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold">Processing {pages.length} page{pages.length !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-muted-foreground">{processingProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary-foreground/20 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${processingProgress}%` }}
                      className="bg-primary h-full"
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* SUCCESS */}
          {stage === 'success' && successInfo && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1 flex items-center justify-center p-4">
              <div className="w-full max-w-md text-center">
                <div className="text-6xl mb-4">{successInfo.hadError ? '⚠️' : '✅'}</div>
                <h2 className="text-2xl font-black mb-2">{successInfo.hadError ? 'Saved with issues' : 'Scan complete!'}</h2>

                <div className="bg-secondary rounded-2xl p-4 text-left mb-5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Plate</span>
                    <span className="font-black font-mono">{successInfo.plate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pages scanned</span>
                    <span className="font-bold">{successInfo.pages}</span>
                  </div>
                  {successInfo.tollCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tolls extracted</span>
                      <span className="font-bold text-green-400">{successInfo.tollCount}</span>
                    </div>
                  )}
                  {successInfo.transactions.slice(0, 3).map((t, i) => (
                    <div key={i} className="flex justify-between text-xs border-t border-border pt-2">
                      <span className="text-muted-foreground">
                        {t.date}{t.location ? ` • ${t.location.substring(0, 18)}` : ''}
                      </span>
                      <span className="font-bold">${(t.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {successInfo.hadError && (
                   <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4 text-xs text-orange-400">
                     <p className="font-bold mb-1">⚠️ Scan saved but OCR failed</p>
                     <p>The images were saved successfully to Tolls. Manual data entry may be needed.</p>
                   </div>
                 )}

                <div className="flex flex-col gap-2">
                  <Button onClick={handleReset} className="w-full h-12 rounded-xl font-bold gap-2">
                    <Camera className="w-4 h-4" /> Scan Another Document
                  </Button>
                  <Button variant="outline" onClick={() => window.location.href = '/tolls'} className="w-full h-12 rounded-xl font-bold">
                    View in Tolls →
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* THUMBNAILS */}
      {pages.length > 0 && !['processing', 'success'].includes(stage) && (
        <PageThumbnails
          pages={pages}
          currentIndex={currentPage}
          onSelectPage={setCurrentPage}
          onDeletePage={handleDeletePage}
          onReorder={handleReorderPages}
          disabled={['ocr_loading', 'processing'].includes(stage)}
        />
      )}
    </div>
  );
}