import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

export default function PageThumbnails({ pages, currentIndex, onSelectPage, onDeletePage, onReorder, disabled }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <div className="border-t border-border bg-card p-3 max-h-24 overflow-x-auto">
      <Reorder.Group
        axis="x"
        values={pages}
        onReorder={onReorder}
        className="flex gap-2"
      >
        <AnimatePresence>
          {pages.map((page, idx) => (
            <Reorder.Item
              key={page.id}
              value={page}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing"
            >
              <motion.div
                layoutId={`thumb-${page.id}`}
                onClick={() => !disabled && onSelectPage(idx)}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`relative w-20 h-28 rounded-lg overflow-hidden border-2 transition-all ${
                  currentIndex === idx ? 'border-primary shadow-lg' : 'border-border hover:border-primary/50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <img
                  src={page.data}
                  alt={`Page ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                
                {/* PAGE NUMBER */}
                <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {idx + 1}
                </div>

                {/* DELETE BUTTON (on hover) */}
                {hoveredIndex === idx && !disabled && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(idx);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/70 hover:bg-red-600/70 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </motion.button>
                )}
              </motion.div>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  );
}