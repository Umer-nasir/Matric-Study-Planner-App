import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MascotProps {
  onTrack: boolean;
  veryBehind?: boolean;
}

export function Mascot({ onTrack, veryBehind = false }: MascotProps) {
  const face = veryBehind ? '😰' : onTrack ? '😊' : '📚';
  const message = veryBehind
    ? 'Catch up time — you can do this!'
    : onTrack
    ? 'Looking good! Keep it up.'
    : 'Steady progress wins the race.';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={face}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-2xl px-4 py-3"
        data-testid="mascot"
      >
        <motion.span
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ delay: 0.5, duration: 0.6, ease: 'easeInOut' }}
          className="text-3xl"
          role="img"
          aria-label="mascot"
        >
          {face}
        </motion.span>
        <p className="text-sm font-medium text-foreground leading-snug">{message}</p>
      </motion.div>
    </AnimatePresence>
  );
}
