import React from 'react';
import { motion } from 'framer-motion';

const EmptyState = React.forwardRef(({ emoji, title, subtitle, action }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <span className="text-6xl mb-4">{emoji}</span>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>
      {action}
    </motion.div>
  );
});

EmptyState.displayName = 'EmptyState';
export default EmptyState;