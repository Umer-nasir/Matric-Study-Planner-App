import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, BookOpen, MessageCircle, User, PencilLine } from 'lucide-react';
import { motion } from 'framer-motion';

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { name: 'Dashboard', icon: Home, path: '/dashboard', id: 'tab-dashboard' },
    { name: 'Syllabus', icon: BookOpen, path: '/syllabus', id: 'tab-syllabus' },
    { name: 'AI Tutor', icon: MessageCircle, path: '/ai-tutor', id: 'tab-ai-tutor' },
    { name: 'Practice', icon: PencilLine, path: '/practice', id: 'tab-practice' },
    { name: 'Profile', icon: User, path: '/profile', id: 'tab-profile' },
  ];

  return (
    <div className="bottom-nav-wrap fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[560px] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="bottom-nav-surface glass-surface flex h-[70px] items-center justify-around rounded-[1.65rem] px-1.5 shadow-[0_18px_45px_rgba(38,32,78,0.18)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location === tab.path;

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="relative flex min-h-[58px] min-w-0 flex-1 flex-col items-center justify-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={tab.id}
              aria-label={tab.name}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Animated pill background */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-1 top-1 h-[50px] rounded-2xl border border-primary/10 bg-[linear-gradient(180deg,rgba(116,96,255,0.14),rgba(116,96,255,0.07))]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              <div className="relative flex flex-col items-center justify-center space-y-1">
                {/* Icon with spring scale on activation */}
                <motion.div
                  animate={isActive ? { scale: 1.15 } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`transition-colors duration-200 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                </motion.div>
                <span
                  className={`bottom-nav-label text-[9px] font-bold tracking-[-0.01em] transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground/90'
                  }`}
                >
                  {tab.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
