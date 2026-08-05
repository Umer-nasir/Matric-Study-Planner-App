import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  className?: string;
}

export function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 8,
  color = '#4F46E5',
  bgColor = 'rgba(255,255,255,0.2)',
  className = '',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const targetOffset = circumference - (safePercentage / 100) * circumference;

  // Animate from full offset (0%) to the target on mount
  const [currentOffset, setCurrentOffset] = useState(circumference);
  const [displayPct, setDisplayPct] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Small delay so the ring is visible before animating
    const timeout = setTimeout(() => {
      const duration = 900; // ms
      const startTime = performance.now();
      const startOffset = circumference;
      const endOffset = targetOffset;
      const startPct = 0;
      const endPct = safePercentage;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        setCurrentOffset(startOffset + (endOffset - startOffset) * ease);
        setDisplayPct(Math.round(startPct + (endPct - startPct) * ease));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, 200);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [safePercentage, circumference, targetOffset]);

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={currentOffset}
          strokeLinecap="round"
        />
      </svg>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="absolute flex items-center justify-center font-bold text-sm"
        style={{ color }}
      >
        {displayPct}%
      </motion.div>
    </div>
  );
}
