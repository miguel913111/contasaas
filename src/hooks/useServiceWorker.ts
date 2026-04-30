'use client';

import { useEffect, useState } from 'react';

interface SWState {
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  update: () => void;
}

export function useServiceWorker(): SWState {
  const [isInstalled, setIsInstalled] = useState(false);
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
        setIsInstalled(true);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingSW(newWorker);
            }
          });
        });
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  }, []);

  const update = () => {
    if (waitingSW) {
      waitingSW.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return {
    isInstalled,
    isUpdateAvailable: !!waitingSW,
    update,
  };
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}
