import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  fullWidth?: boolean;
  size?: 'sm' | 'md';
}

export function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  size,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'relative isolate inline-flex min-h-[46px] items-center justify-center overflow-hidden rounded-2xl px-6 font-bold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
  const widthClasses = fullWidth ? 'w-full' : '';

  const variants = {
    primary: 'border border-white/10 bg-[linear-gradient(135deg,#7667ff_0%,#6048e8_100%)] text-primary-foreground shadow-[0_10px_24px_rgba(92,69,220,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_14px_30px_rgba(92,69,220,0.34),inset_0_1px_0_rgba(255,255,255,0.28)]',
    secondary: 'border border-white/70 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/75',
    outline: 'border border-border bg-card/70 text-foreground shadow-sm backdrop-blur-md hover:border-primary/25 hover:bg-accent hover:text-accent-foreground',
    ghost: 'bg-transparent hover:bg-accent hover:text-accent-foreground',
  };

  return (
    <motion.button
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.98, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`${baseClasses} ${widthClasses} ${variants[variant]} disabled:opacity-50 disabled:pointer-events-none ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}
