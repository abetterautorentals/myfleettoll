import React, { useState } from 'react';
import { Mail, MessageCircle, Copy, Share2, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileEmailMenu({ 
  isOpen, 
  onClose, 
  emailDraft, 
  letterText, 
  pdfFilename, 
  onCopyText, 
  onShare,
  loading = false 
}) {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopyText = async () => {
    if (letterText) {
      await navigator.clipboard.writeText(letterText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
      onCopyText?.();
    }
  };

  const handleMailto = () => {
    if (!emailDraft) return;
    const { recipient, subject, body } = emailDraft;
    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    onClose?.();
  };

  const handleGmailApp = () => {
    if (!emailDraft) return;
    const { recipient, subject, body } = emailDraft;
    const gmailLink = `googlegmail://co?to=${recipient}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = gmailLink;
    onClose?.();
  };

  const handleShare = async () => {
    if (!navigator.share) {
      // Fallback: use mailto
      handleMailto();
      return;
    }
    try {
      const shareText = letterText || emailDraft?.body || '';
      await navigator.share({
        title: emailDraft?.subject || 'Invoice',
        text: shareText,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full bg-card rounded-3xl rounded-b-none p-4 space-y-2"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm">Send to Renter</h3>
            <button onClick={onClose} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {isMobile && (
            <>
              {/* Share Sheet (Most reliable on iPhone) */}
              <button
                onClick={handleShare}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                Share Sheet (Any App)
              </button>

              {/* Gmail App Direct */}
              <button
                onClick={handleGmailApp}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary text-secondary-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                Open Gmail App
              </button>

              {/* Native Mail App */}
              <button
                onClick={handleMailto}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary text-secondary-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4" />
                Open Mail App
              </button>
            </>
          )}

          {!isMobile && (
            /* Desktop: Use Gmail web */
            <button
              onClick={() => {
                const { recipient, subject, body } = emailDraft || {};
                const gmailURL = new URL('https://mail.google.com/mail/?ui=2&fs=1&tf=cm');
                gmailURL.searchParams.set('to', recipient);
                gmailURL.searchParams.set('su', subject);
                gmailURL.searchParams.set('body', body);
                window.open(gmailURL.toString(), '_blank', 'width=900,height=800');
                onClose?.();
              }}
              disabled={loading}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Open in Gmail
            </button>
          )}

          {/* Copy Email Text */}
          <button
            onClick={handleCopyText}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary text-secondary-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors"
          >
            <Copy className="w-4 h-4" />
            {copyFeedback ? '✓ Copied to Clipboard' : 'Copy Email Text'}
          </button>

          <div className="h-2" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}