import React from 'react';
import { motion } from 'framer-motion';
import { FileText, AlertTriangle, ScrollText, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const options = [
  {
    id: 'toll',
    label: 'Toll Notice',
    icon: FileText,
    desc: 'FasTrak, Bay Area Tolls, etc.',
    color: 'from-blue-600 to-blue-700',
  },
  {
    id: 'violation',
    label: 'Violation / Parking',
    icon: AlertTriangle,
    desc: 'Parking tickets, violations',
    color: 'from-red-600 to-red-700',
  },
  {
    id: 'contract',
    label: 'Rental Contract',
    icon: ScrollText,
    desc: 'Turo, Upcar, SignNow, etc.',
    color: 'from-purple-600 to-purple-700',
  },
  {
    id: 'other',
    label: 'Other Document',
    icon: HelpCircle,
    desc: 'Invoice, receipt, etc.',
    color: 'from-gray-600 to-gray-700',
  },
];

export default function DocumentClassification({ onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black mb-2">What is this document?</h2>
        <p className="text-sm text-muted-foreground">Select the type to help organize and process it correctly</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {options.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(opt.id)}
              className={`p-4 rounded-xl border-2 border-border hover:border-primary transition-all group bg-gradient-to-r ${opt.color} hover:shadow-lg`}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-6 h-6 text-white mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-bold text-white text-sm">{opt.label}</div>
                  <div className="text-xs text-white/80 mt-0.5">{opt.desc}</div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}