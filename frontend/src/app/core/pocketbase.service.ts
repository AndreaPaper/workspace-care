import { Injectable, isDevMode, signal } from '@angular/core';
import PocketBase, { RecordModel } from 'pocketbase';
import type { BackupInfo, DesktopSettings } from '../models/settings';

declare global {
  interface Window {
    /** Provided by desktop/preload.js when running inside Electron. */
    workspaceCare?: {
      getCredentials(): Promise<{ email: string; password: string }>;
      /** Opens a save dialog and writes the current page as a PDF. Resolves to the saved path, or null if cancelled. */
      exportPdf?(suggestedName: string): Promise<string | null>;
      /** In-app updates (see services/update.service.ts). */
      getUpdateState?(): Promise<{ status: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error'; version: string; percent: number; message: string; notes?: string[]; lastCheck?: number }>;
      /** Messages from the main process (backup result), see services/toast.service.ts. */
      takeToasts?(): Promise<{ kind: 'success' | 'error'; title: string; text?: string; path?: string; folder?: string }[]>;
      onToastReady?(callback: () => void): () => void;
      showInFolder?(target: string): Promise<void>;
      exportBackup?(folder?: string, choose?: boolean): Promise<void>;
      /** Desktop preferences (Impostazioni page). */
      getSettings?(): Promise<DesktopSettings>;
      setSettings?(patch: Partial<DesktopSettings>): Promise<DesktopSettings>;
      listBackups?(): Promise<BackupInfo[]>;
      chooseBackupFolder?(): Promise<DesktopSettings>;
      openFolder?(which: 'data' | 'backup'): Promise<void>;
      checkForUpdates?(): Promise<void>;
      downloadUpdate?(): Promise<void>;
      installUpdate?(): Promise<void>;
      onUpdateState?(callback: (state: { status: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error'; version: string; percent: number; message: string; notes?: string[] }) => void): () => void;
    };
  }
}

// In production the Angular build is served by PocketBase itself (same origin).
const PB_URL = isDevMode() ? 'http://127.0.0.1:8090' : window.location.origin;

@Injectable({ providedIn: 'root' })
export class PocketBaseService {
  readonly client = new PocketBase(PB_URL);
  readonly isLoggedIn = signal(this.client.authStore.isValid);

  constructor() {
    this.client.autoCancellation(false);
    this.client.authStore.onChange(() => this.isLoggedIn.set(this.client.authStore.isValid));
  }

  async login(email: string, password: string): Promise<void> {
    await this.client.collection('users').authWithPassword(email, password);
  }

  /**
   * Inside the desktop app the internal account is signed in silently, so there is no login screen.
   * Returns false when not running in Electron (e.g. ng serve in a browser): the login page is the fallback.
   */
  async autoLogin(): Promise<boolean> {
    if (this.client.authStore.isValid) return true;
    const bridge = window.workspaceCare;
    if (!bridge) return false;
    try {
      const { email, password } = await bridge.getCredentials();
      await this.login(email, password);
      return true;
    } catch {
      return false;
    }
  }

  async isSetupNeeded(): Promise<boolean> {
    const res = await this.client.send<{ needed: boolean }>('/api/setup', { method: 'GET' });
    return res.needed;
  }

  async setup(email: string, password: string): Promise<void> {
    await this.client.send('/api/setup', { method: 'POST', body: { email, password } });
    await this.login(email, password);
  }

  logout(): void {
    this.client.authStore.clear();
  }

  fileUrl(record: RecordModel, filename: string, thumb?: string): string {
    return filename ? this.client.files.getURL(record, filename, thumb ? { thumb } : {}) : '';
  }
}
