import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExtractionDebugger({ extractedData, fileLabel }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!extractedData) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 mb-4"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <p className="font-bold text-purple-900">🔍 Debug: {fileLabel}</p>
          <p className="text-xs text-purple-700">Extracted data structure</p>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-purple-200"
          >
            <div className="bg-white rounded-lg p-3 font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words text-purple-900">
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={copyToClipboard}
              className="mt-2 w-full rounded-xl text-xs gap-2"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy JSON'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}