import React from 'react';
import { motion } from 'framer-motion';

export default function StatBubble({ icon: Icon, label, value, color, onClick }) {
  const colorMap = {
    green: 'bg-green-950/40 text-green-300 border-green-600',
    red: 'bg-red-950/40 text-red-300 border-red-600',
    orange: 'bg-orange-950/40 text-orange-300 border-orange-600',
    blue: 'bg-blue-950/40 text-blue-300 border-blue-600',
    purple: 'bg-purple-950/40 text-purple-300 border-purple-600',
  };

  const iconColorMap = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex flex-col items-center p-4 rounded-2xl border-2 ${colorMap[color]} transition-all w-full`}
    >
      <div className={`w-10 h-10 rounded-full ${iconColorMap[color]} flex items-center justify-center mb-2`}>
        <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs font-bold opacity-80 text-center">{label}</span>
    </motion.button>
  );
}