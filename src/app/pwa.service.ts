import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private deferredPrompt: InstallPromptEvent | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private readonly onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    this.deferredPrompt = event as InstallPromptEvent;
    this.canInstall.set(true);
  };
  private readonly onAppInstalled = () => {
    this.deferredPrompt = null;
    this.canInstall.set(false);
    this.isInstalled.set(true);
  };
  private readonly onConnectionChange = () => this.isOffline.set(!navigator.onLine);

  readonly canInstall = signal(false);
  readonly isInstalled = signal(false);
  readonly isOffline = signal(false);
  readonly updateAvailable = signal(false);

  constructor() {
    if (!this.browser) return;

    this.updateInstallState();
    this.isOffline.set(!navigator.onLine);
    window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
    window.addEventListener('appinstalled', this.onAppInstalled);
    window.addEventListener('online', this.onConnectionChange);
    window.addEventListener('offline', this.onConnectionChange);

    const register = () => this.registerServiceWorker();
    if (this.document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  async install() {
    if (!this.deferredPrompt) return;
    const prompt = this.deferredPrompt;
    this.deferredPrompt = null;
    this.canInstall.set(false);
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
  }

  applyUpdate() {
    const waiting = this.registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    } else {
      window.location.reload();
    }
  }

  private updateInstallState() {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    this.isInstalled.set(standalone);
  }

  private registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
      this.registration = registration;
      this.watchForUpdates(registration);
    }).catch(() => undefined);
  }

  private watchForUpdates(registration: ServiceWorkerRegistration) {
    if (registration.waiting && navigator.serviceWorker.controller) this.updateAvailable.set(true);
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) this.updateAvailable.set(true);
      });
    });
  }
}
