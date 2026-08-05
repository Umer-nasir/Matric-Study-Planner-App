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
      whileTap={noTap ? {} : { y: -2, boxShadow: '0 18px 38px rgba(58, 48, 116, 0.13)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`rounded-[1.4rem] border border-white/75 bg-card/90 p-4 shadow-[0_10px_32px_rgba(45,40,80,0.07),0_1px_2px_rgba(45,40,80,0.04)] backdrop-blur-sm ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
