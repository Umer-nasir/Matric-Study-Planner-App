import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

const BOOT_WATCHDOG_RELOAD_DELAY_MS = 10000;
const BOOT_WATCHDOG_RECHECK_MS = 500;
const BOOT_WATCHDOG_KEY_PREFIX = 'matric_boot_watchdog_reloaded';

function createReloadKey(reason: string): string {
  return `${BOOT_WATCHDOG_KEY_PREFIX}:${reason}:${window.location.pathname}${window.location.search}`;
}

function reloadOnce(reason: string) {
  const key = createReloadKey(reason);
  if (sessionStorage.getItem(key) === 'true') return;
  sessionStorage.setItem(key, 'true');
  window.location.reload();
}

function isChunkLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /loading chunk|failed to fetch dynamically imported module|importing a module script failed|modulepreload/i.test(message);
}

function startBootWatchdog(root: HTMLElement) {
  const startedAt = Date.now();
  let stopped = false;
  let timeoutId: number | null = null;

  const loadingTextPatterns = [
    /preparing your study space/i,
    /loading/i,
    /reloading automatically/i,
  ];

  function hasHealthyContent(): boolean {
    const text = root.textContent?.trim() ?? '';
    if (text.length > 0 && !loadingTextPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    return Boolean(
      root.querySelector(
        'button:not([disabled]), a[href], input, textarea, select, [data-app-ready="true"]',
      ),
    );
  }

  function check() {
    if (stopped) return;

    if (hasHealthyContent()) {
      stopped = true;
      return;
    }

    if (Date.now() - startedAt >= BOOT_WATCHDOG_RELOAD_DELAY_MS) {
      reloadOnce('blank-or-loading');
      stopped = true;
      return;
    }

    timeoutId = window.setTimeout(check, BOOT_WATCHDOG_RECHECK_MS);
  }

  const observer = new MutationObserver(() => {
    if (!stopped && hasHealthyContent()) {
      stopped = true;
      observer.disconnect();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });
  timeoutId = window.setTimeout(check, BOOT_WATCHDOG_RECHECK_MS);
}

window.addEventListener('error', (event) => {
  if (isChunkLoadFailure(event.error) || isChunkLoadFailure(event.message)) {
    reloadOnce('chunk-error');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadFailure(event.reason)) {
    reloadOnce('chunk-rejection');
  }
});

const root = document.getElementById('root');

if (!root) {
  reloadOnce('missing-root');
} else {
  startBootWatchdog(root);
  createRoot(root).render(<App />);
}
