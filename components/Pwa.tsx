'use client';

import { useEffect, useState } from 'react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'salawat-install-dismissed';

export function Pwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone || localStorage.getItem(DISMISS_KEY) === '1') return;

    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setIosHint(false);
    }

    window.addEventListener('beforeinstallprompt', onPrompt);

    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) setIosHint(true);
    setWide(window.matchMedia('(min-width: 720px)').matches);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setPrompt(null);
    setIosHint(false);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    dismiss();
  }

  if (!prompt && !iosHint) return null;

  return (
    <div className="install-banner" role="dialog" aria-label="Install Salawat Challenge">
      <p>
        {iosHint
          ? 'On iPhone or iPad, open Share and choose Add to Home Screen.'
          : wide
            ? 'Install Salawat Challenge on this computer or tablet.'
            : 'Install Salawat Challenge on this phone.'}
      </p>
      <div className="install-actions">
        {prompt ? (
          <button type="button" className="btn btn-gold" onClick={() => void install()}>
            Install
          </button>
        ) : null}
        <button type="button" className="btn btn-text" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
