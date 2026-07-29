import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppContextProvider, useAppContext } from '@/context/AppContext';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import type { Transition, Variants } from 'framer-motion';
import { useEffect } from 'react';
import Onboarding from '@/pages/Onboarding';
import Portal from '@/pages/Portal';
import Dashboard from '@/pages/Dashboard';
import Syllabus from '@/pages/Syllabus';
import AiTutor from '@/pages/AiTutor';
import Practice from '@/pages/Practice';
import Profile from '@/pages/Profile';
import { BottomNav } from '@/components/BottomNav';
import { BadgeModal } from '@/components/BadgeModal';

const pageVariants: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const pageTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

function AnimatedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="w-full"
    >
      <Component />
    </motion.div>
  );
}

function OnboardingRoute() {
  return <AnimatedRoute component={Onboarding} />;
}

function PortalRoute() {
  return <AnimatedRoute component={Portal} />;
}

function DashboardRoute() {
  return <AnimatedRoute component={Dashboard} />;
}

function SyllabusRoute() {
  return <AnimatedRoute component={Syllabus} />;
}

function AiTutorRoute() {
  return <AnimatedRoute component={AiTutor} />;
}

function PracticeRoute() {
  return <AnimatedRoute component={Practice} />;
}

function ProfileRoute() {
  return <AnimatedRoute component={Profile} />;
}

function MainFallbackRoute() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/dashboard');
  }, [setLocation]);

  return (
    <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background shadow-[0_0_40px_rgba(0,0,0,0.05)] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}

function ProtectedRoutes() {
  const { profile } = useAppContext();
  const { currentUser, isGuest, loading } = useAuthContext();
  const [location, setLocation] = useLocation();
  const hasAuthEntry = Boolean(currentUser) || isGuest;
  const normalizedLocation =
    location.length > 1 && location.endsWith('/') ? location.replace(/\/+$/, '') : location;

  useEffect(() => {
    if (loading) return;

    if (normalizedLocation !== location) {
      setLocation(normalizedLocation);
      return;
    }

    if (!hasAuthEntry && location !== '/portal') {
      setLocation('/portal');
      return;
    }

    if (!hasAuthEntry) return;

    if (location === '/portal') {
      setLocation(profile?.onboardingComplete ? '/dashboard' : '/onboarding');
      return;
    }

    if (!profile?.onboardingComplete && location !== '/onboarding') {
      setLocation('/onboarding');
    }
    if (profile?.onboardingComplete && (location === '/' || location === '/onboarding')) {
      setLocation('/dashboard');
    }
  }, [hasAuthEntry, loading, profile, location, normalizedLocation, setLocation]);

  if (normalizedLocation === '/onboarding' && hasAuthEntry && !profile?.onboardingComplete) {
    return (
      <AnimatePresence mode="wait">
        <Switch key="onboarding-direct-switch">
          <Route path="/onboarding" component={OnboardingRoute} />
          <Route component={OnboardingRoute} />
        </Switch>
      </AnimatePresence>
    );
  }

  if (normalizedLocation === '/portal' && !hasAuthEntry) {
    return (
      <AnimatePresence mode="wait">
        <Switch key="portal-direct-switch">
          <Route path="/portal" component={PortalRoute} />
          <Route component={PortalRoute} />
        </Switch>
      </AnimatePresence>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background shadow-[0_0_40px_rgba(0,0,0,0.05)] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!hasAuthEntry) {
    return (
      <AnimatePresence mode="wait">
        <Switch key="portal-switch">
          <Route path="/portal" component={PortalRoute} />
          <Route component={PortalRoute} />
        </Switch>
      </AnimatePresence>
    );
  }

  if (!profile?.onboardingComplete) {
    return (
      <AnimatePresence mode="wait">
        <Switch key="onboarding-switch">
          <Route path="/onboarding" component={OnboardingRoute} />
          <Route component={OnboardingRoute} />
        </Switch>
      </AnimatePresence>
    );
  }

  if (location === '/portal') {
    return (
      <AnimatePresence mode="wait">
        <Switch key="portal-redirect-switch">
          <Route path="/portal" component={PortalRoute} />
          <Route component={PortalRoute} />
        </Switch>
      </AnimatePresence>
    );
  }

  if (location === '/onboarding') {
    return (
      <AnimatePresence mode="wait">
        <Switch key="onboarding-redirect-switch">
          <Route path="/onboarding" component={OnboardingRoute} />
          <Route component={OnboardingRoute} />
        </Switch>
      </AnimatePresence>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={location} style={{ width: '100%' }}>
          <Switch>
            <Route path="/dashboard" component={DashboardRoute} />
            <Route path="/syllabus" component={SyllabusRoute} />
            <Route path="/ai-tutor" component={AiTutorRoute} />
            <Route path="/practice" component={PracticeRoute} />
            <Route path="/profile" component={ProfileRoute} />
            <Route component={MainFallbackRoute} />
          </Switch>
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </>
  );
}

function AppContent() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ProtectedRoutes />
    </WouterRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContextProvider>
        <TooltipProvider>
          <AppContent />
          <BadgeModal />
          <Toaster />
        </TooltipProvider>
      </AppContextProvider>
    </AuthProvider>
  );
}

export default App;
