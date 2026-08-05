import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppContext } from '@/context/AppContext';
import { getMilestoneById } from '@/data/milestones';

export function BadgeModal() {
  const { pendingBadges, dismissPendingBadge, currentMode } = useAppContext();
  const badgeId = pendingBadges[0] ?? null;
  const milestone = badgeId ? getMilestoneById(badgeId) : null;

  useEffect(() => {
    if (!milestone || currentMode === 'focus') return;

    // Fire confetti
    const end = Date.now() + 1400;
    const colors = ['#4F46E5', '#7C3AED', '#F59E0B', '#10B981', '#EC4899'];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    // Auto-dismiss after 4s
    const timer = setTimeout(dismissPendingBadge, 4000);
    return () => clearTimeout(timer);
  }, [milestone, currentMode, dismissPendingBadge]);

  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={dismissPendingBadge}
          data-testid="badge-modal"
        >
          <motion.div
            initial={{ scale: 0.7, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-3xl p-8 max-w-[320px] w-full text-center shadow-2xl border border-card-border relative"
          >
            <button
              onClick={dismissPendingBadge}
              className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-secondary hover:text-foreground"
              data-testid="button-dismiss-badge"
              aria-label="Close badge notification"
            >
              <X size={18} />
            </button>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 500, damping: 20 }}
              className="text-6xl mb-4"
              role="img"
              aria-label={milestone.title}
            >
              {milestone.icon}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                Badge Unlocked!
              </p>
              <h2 className="text-xl font-black text-foreground mb-2">{milestone.title}</h2>
              <p className="text-sm text-muted-foreground">{milestone.description}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-xs text-muted-foreground"
            >
              Tap anywhere to close
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
