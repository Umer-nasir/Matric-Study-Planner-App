import React, { useEffect, useRef, useState } from 'react';

interface ProgressBarProps {
  /** 0–100 */
  percentage: number;
  className?: string;
  height?: string;
  /** Show the percentage label inside/above the bar */
  showLabel?: boolean;
}

function getBarColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-rose-500';
}

function getTrackColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-100';
  if (pct >= 40) return 'bg-amber-100';
  return 'bg-rose-100';
}

export function ProgressBar({
  percentage,
  className = '',
  height = 'h-2',
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const DURATION = 600; // ms

  useEffect(() => {
    fromRef.current = displayed;
    startRef.current = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(fromRef.current + (clamped - fromRef.current) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-end mb-1">
          <span className="text-xs font-semibold text-muted-foreground">
            {Math.round(clamped)}%
          </span>
        </div>
      )}
      <div className={`w-full ${height} rounded-full ${getTrackColor(clamped)} overflow-hidden`}>
        <div
          className={`${height} rounded-full transition-none ${getBarColor(clamped)}`}
          style={{ width: `${displayed}%` }}
        />
      </div>
    </div>
  );
}
