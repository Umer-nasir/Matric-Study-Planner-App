import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlarmClock, BookOpen, Smile } from 'lucide-react';

interface MascotProps {
  onTrack: boolean;
  veryBehind?: boolean;
}

export function Mascot({ onTrack, veryBehind = false }: MascotProps) {
  const state = veryBehind ? 'behind' : onTrack ? 'on-track' : 'steady';
  const Icon = veryBehind ? AlarmClock : onTrack ? Smile : BookOpen;
  const message = veryBehind
    ? 'Catch-up time — you can do this!'
    : onTrack
    ? 'Looking good! Keep it up.'
    : 'Steady progress wins the race.';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        className="flex items-center gap-3 rounded-[1.35rem] border border-primary/10 bg-primary/[0.055] px-4 py-3"
        data-testid="mascot"
      >
        <motion.span
          animate={{ rotate: [0, -6, 6, 0] }}
          transition={{ delay: 0.5, duration: 0.6, ease: 'easeInOut' }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm"
          aria-label="Study coach"
        >
          <Icon size={22} strokeWidth={2.4} />
        </motion.span>
        <p className="text-sm font-semibold leading-snug text-foreground">{message}</p>
      </motion.div>
    </AnimatePresence>
  );
}
