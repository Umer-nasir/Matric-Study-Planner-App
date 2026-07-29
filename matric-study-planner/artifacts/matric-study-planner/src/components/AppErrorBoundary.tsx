import React from 'react';

type AppErrorBoundaryState = {
  error: Error | null;
  autoReloading: boolean;
};

const AUTO_RELOAD_KEY = 'matric_auto_reloaded_after_crash';
const AUTO_RELOAD_DELAY_MS = 900;

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, autoReloading: false };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, autoReloading: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed before rendering a screen.', error, info);

    if (sessionStorage.getItem(AUTO_RELOAD_KEY) === 'true') return;
    sessionStorage.setItem(AUTO_RELOAD_KEY, 'true');
    this.setState({ autoReloading: true });
    window.setTimeout(() => {
      window.location.reload();
    }, AUTO_RELOAD_DELAY_MS);
  }

  componentDidUpdate(_: React.PropsWithChildren, prevState: AppErrorBoundaryState) {
    if (prevState.error && !this.state.error) {
      sessionStorage.removeItem(AUTO_RELOAD_KEY);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background px-5 py-10 shadow-[0_0_40px_rgba(0,0,0,0.05)]">
        <div className="flex min-h-[80dvh] items-center justify-center">
          <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <h1 className="text-xl font-black text-amber-950">Something did not load correctly</h1>
            <p className="mt-2 text-sm leading-relaxed text-amber-900">
              {this.state.autoReloading
                ? 'Reloading automatically...'
                : 'Please refresh the page. If it happens again, continue as guest for the demo and sign in later.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="mt-4 min-h-[44px] w-full rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
