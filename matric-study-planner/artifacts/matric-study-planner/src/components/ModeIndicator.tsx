import React from 'react';
import { motion } from 'framer-motion';
import { PartyPopper, Target, Zap, type LucideIcon } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import type { StudyMode } from '@/context/AppContext';

const MODE_CONFIG: Record<StudyMode, { label: string; icon: LucideIcon; className: string }> = {
  fun: {
    label: 'Fun Mode',
    icon: PartyPopper,
    className: 'border-violet-200/80 bg-violet-100/80 text-violet-700',
  },
  balanced: {
    label: 'Balanced',
    icon: Zap,
    className: 'border-amber-200/80 bg-amber-100/80 text-amber-700',
  },
  focus: {
    label: 'Focus Mode',
    icon: Target,
    className: 'border-red-200/80 bg-red-100/80 text-red-700',
  },
};

export function ModeIndicator() {
  const { currentMode } = useAppContext();
  const cfg = MODE_CONFIG[currentMode];
  const Icon = cfg.icon;

  return (
    <motion.div
      key={currentMode}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold backdrop-blur-sm ${cfg.className}`}
      data-testid="badge-mode"
    >
      <Icon size={12} strokeWidth={2.7} />
      <span>{cfg.label}</span>
    </motion.div>
  );
}
