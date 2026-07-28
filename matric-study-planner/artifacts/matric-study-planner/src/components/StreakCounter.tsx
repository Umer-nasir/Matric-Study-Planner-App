import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';

interface StreakCounterProps {
  compact?: boolean;
}

export function StreakCounter({ compact = false }: StreakCounterProps) {
  const { streak, lastStudiedDate, currentMode } = useAppContext();

  const today = new Date().toISOString().slice(0, 10);
  const studiedToday = lastStudiedDate === today;
  const isEvening = new Date().getHours() >= 18;
  const showReminder = !studiedToday && isEvening && streak > 0 && currentMode !== 'focus';

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" data-testid="streak-counter-compact">
        <Flame
          className={streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}
          size={16}
          strokeWidth={2.5}
        />
        <span className="text-sm font-bold text-foreground">{streak}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="bg-card rounded-2xl border border-card-border p-4 flex items-center gap-4"
      data-testid="streak-counter"
    >
      <motion.div
        animate={streak > 0 ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0"
      >
        <Flame
          className={streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}
          size={24}
          strokeWidth={2.5}
        />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <motion.span
            key={streak}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-black text-foreground"
          >
            {streak}
          </motion.span>
          <span className="text-sm font-medium text-muted-foreground">day streak</span>
        </div>
        {showReminder ? (
          <p className="text-xs text-orange-500 font-medium mt-0.5">
            Don't break your streak! Study something today.
          </p>
        ) : studiedToday ? (
          <p className="text-xs text-green-600 font-medium mt-0.5">Studied today — streak alive!</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            {streak === 0 ? 'Start your first streak today!' : 'Keep it going!'}
          </p>
        )}
      </div>
    </motion.div>
  );
}
