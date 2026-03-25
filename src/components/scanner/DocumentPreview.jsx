import React from 'react';
import { motion } from 'framer-motion';

export default function DocumentPreview({ page }) {
  if (!page) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex items-center justify-center bg-black/50 rounded-xl overflow-hidden"
    >
      <img
        src={page.data}
        alt="Scanned page"
        className="max-w-full max-h-full object-contain"
      />
    </motion.div>
  );
}