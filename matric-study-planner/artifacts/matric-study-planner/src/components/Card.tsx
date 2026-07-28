import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  noTap?: boolean;
}

export function Card({ children, className = '', noTap = false, ...props }: CardProps) {
  return (
    <motion.div
      whileTap={noTap ? {} : { y: -2, boxShadow: '0 8px 24px rgba(79, 70, 229, 0.12)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`bg-card rounded-2xl p-4 shadow-sm border border-card-border ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
