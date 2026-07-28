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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-w-[480px] mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location === tab.path;

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="flex-1 flex flex-col items-center justify-center min-h-[56px] min-w-0 focus:outline-none relative"
              data-testid={tab.id}
              aria-label={tab.name}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Animated pill background */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-1 top-1.5 h-10 bg-primary/8 rounded-2xl"
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
                    size={20}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`transition-colors duration-200 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                </motion.div>
                <span
                  className={`text-[9px] font-medium tracking-wide transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
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
