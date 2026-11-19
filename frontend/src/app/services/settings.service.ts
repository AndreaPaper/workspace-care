import { Injectable, computed, signal } from '@angular/core';
import type { BackupInfo, DesktopSettings } from '../models/settings';

const STALE_DAYS = 7;

/** Desktop preferences and backups, through the Electron bridge. Nothing is available outside the desktop app. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  /** False in a plain browser (ng serve): the Impostazioni page then only explains that. */
  readonly available = !!window.workspaceCare?.getSettings;
  readonly settings = signal<DesktopSettings | null>(null);
  readonly backups = signal<BackupInfo[]>([]);
  /** "Salvato" label, visible for a moment after every automatic save. */
  readonly saved = signal(false);
  readonly backupBusy = signal(false);

  private pending: Partial<DesktopSettings> = {};
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private savedTimer: ReturnType<typeof setTimeout> | undefined;
  private loaded = false;

  /** Whole days since the last backup found in the backup folder; null when there is none. */
  readonly daysSinceBackup = computed(() => {
    const last = this.backups()[0];
    return last ? Math.floor((Date.now() - last.when) / 86_400_000) : null;
  });

  /** The Backup section needs attention: no backup yet, or the last one is a week old. */
  readonly backupStale = computed(() => {
    if (!this.available || !this.settings()) return false;
    const days = this.daysSinceBackup();
    return days === null || days >= STALE_DAYS;
  });

  /** Loads the preferences and the backup list once (the sidebar dot and the greeting need them). */
  async init(): Promise<void> {
    if (!this.available || this.loaded) return;
    this.loaded = true;
    await Promise.all([this.loadSettings(), this.refreshBackups()]);
  }

  async loadSettings(): Promise<void> {
    try {
      this.settings.set((await window.workspaceCare?.getSettings?.()) ?? null);
    } catch {
      this.settings.set(null);
    }
  }

  async refreshBackups(): Promise<void> {
    try {
      this.backups.set((await window.workspaceCare?.listBackups?.()) ?? []);
    } catch {
      this.backups.set([]);
    }
  }

  /** Applies the change on screen at once and saves it a moment later (one save for a burst of changes). */
  update(patch: Partial<DesktopSettings>): void {
    const current = this.settings();
    if (!current) return;
    this.settings.set({ ...current, ...patch });
    this.pending = { ...this.pending, ...patch };
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 400);
  }

  private async flush(): Promise<void> {
    const patch = this.pending;
    this.pending = {};
    try {
      const saved = await window.workspaceCare?.setSettings?.(patch);
      if (saved) this.settings.set(saved);
      this.saved.set(true);
      clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => this.saved.set(false), 2000);
    } catch {
      await this.loadSettings();
    }
  }

  async chooseBackupFolder(): Promise<void> {
    const next = await window.workspaceCare?.chooseBackupFolder?.();
    if (next) this.settings.set(next);
    await this.refreshBackups();
  }

  /** The window reloads when the backup is done (the server is restarted), so this page starts again from the URL. */
  async backupNow(): Promise<void> {
    if (this.backupBusy()) return;
    this.backupBusy.set(true);
    try {
      await window.workspaceCare?.exportBackup?.();
    } finally {
      this.backupBusy.set(false);
      await this.refreshBackups();
    }
  }

  openFolder(which: 'data' | 'backup'): void {
    void window.workspaceCare?.openFolder?.(which);
  }
}
