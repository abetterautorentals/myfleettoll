import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Mail, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PDFPreviewModal({ open, pdfData, filename, pdfUrl, onClose, onDownload }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          
          {/* Modal */}
           <motion.div
             initial={{ opacity: 0, scale: 0.95, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.95, y: 20 }}
             className="fixed inset-4 md:inset-10 bg-card border-2 border-border rounded-3xl z-50 flex flex-col overflow-hidden shadow-2xl"
           >
             {/* Header */}
             <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/50">
               <div className="flex items-center gap-2">
                 <FileText className="w-5 h-5 text-primary" />
                 <div>
                   <h3 className="font-black text-sm">{filename}</h3>
                   <p className="text-xs text-muted-foreground">PDF Ready for Review</p>
                 </div>
               </div>
               <button
                 onClick={onClose}
                 className="p-2 hover:bg-accent rounded-lg transition-colors flex-shrink-0"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>

             {/* PDF Viewer - Fixed height with scroll */}
             <div className="overflow-y-auto bg-background" style={{ height: 'max(300px, 60vh)' }}>
               {pdfData && (
                 <iframe
                   src={pdfData}
                   className="w-full h-full"
                   style={{ border: 'none', minHeight: '300px' }}
                   title="PDF Preview"
                 />
               )}
             </div>

             {/* Actions - Always visible below */}
             <div className="flex flex-col gap-2 p-4 border-t border-border bg-secondary/50 flex-shrink-0">
               <Button
                 onClick={() => {
                   if (pdfUrl) {
                     window.open(pdfUrl, '_blank');
                   } else if (pdfData) {
                     const link = document.createElement('a');
                     link.href = pdfData;
                     link.download = filename || 'document.pdf';
                     document.body.appendChild(link);
                     link.click();
                     document.body.removeChild(link);
                   }
                 }}
                 className="w-full gap-2 rounded-xl h-12 font-bold md:h-10"
               >
                 <Download className="w-4 h-4" />
                 Download PDF
               </Button>
               <Button
                 onClick={onClose}
                 variant="outline"
                 className="w-full rounded-xl h-12 font-bold md:h-10"
               >
                 <X className="w-4 h-4" />
                 Close
               </Button>
             </div>
           </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}