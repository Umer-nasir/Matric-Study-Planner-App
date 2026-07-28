import React from 'react';
import { motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import type { StudyMode } from '@/context/AppContext';

const MODE_CONFIG: Record<StudyMode, { label: string; emoji: string; className: string }> = {
  fun: {
    label: 'Fun Mode',
    emoji: '🎉',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  balanced: {
    label: 'Balanced',
    emoji: '⚡',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  focus: {
    label: 'Focus Mode',
    emoji: '🎯',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
};

export function ModeIndicator() {
  const { currentMode } = useAppContext();
  const cfg = MODE_CONFIG[currentMode];

  return (
    <motion.div
      key={currentMode}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.className}`}
      data-testid="badge-mode"
    >
      <span>{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </motion.div>
  );
}
