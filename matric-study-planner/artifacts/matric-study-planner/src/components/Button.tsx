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
  const baseClasses = 'inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-2xl h-11 px-6 min-h-[44px]';
  const widthClasses = fullWidth ? 'w-full' : '';

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
    ghost: 'bg-transparent hover:bg-accent hover:text-accent-foreground',
  };

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`${baseClasses} ${widthClasses} ${variants[variant]} disabled:opacity-50 disabled:pointer-events-none ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}
