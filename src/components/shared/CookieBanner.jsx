import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('cookie_consent');
    if (!accepted) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 bg-card border-2 border-border rounded-2xl p-4 shadow-xl max-w-lg mx-auto"
        >
          <p className="text-xs text-muted-foreground mb-3">
            🍪 We use cookies to keep you logged in and improve your experience. We never sell your data.{' '}
            <a href="#" className="underline text-primary">Privacy Policy</a>
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={accept} className="flex-1 h-8 rounded-xl text-xs font-bold">Accept All</Button>
            <Button size="sm" variant="outline" onClick={() => { localStorage.setItem('cookie_consent', 'essential'); setShow(false); }} className="flex-1 h-8 rounded-xl text-xs font-bold">Essential Only</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}