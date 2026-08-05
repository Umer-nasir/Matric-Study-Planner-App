import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { daysUntilDateOnly } from '@/lib/dateOnly';

export function ModeBanner() {
  const { currentMode, profile } = useAppContext();

  if (currentMode !== 'focus' || !profile) return null;

  const daysLeft = daysUntilDateOnly(profile.examDate);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="bg-red-600 text-white px-5 py-3 flex items-center gap-3"
      data-testid="banner-focus-mode"
    >
      <AlertTriangle className="w-5 h-5 shrink-0 text-red-200" />
      <p className="text-sm font-semibold leading-snug">
        Focus Mode Active —{' '}
        <span className="font-black">{Math.max(0, daysLeft)} day{daysLeft !== 1 ? 's' : ''}</span>{' '}
        left. Stay on track.
      </p>
    </motion.div>
  );
}
