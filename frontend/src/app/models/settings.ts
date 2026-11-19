/** Preferences of the desktop app, kept by the Electron main process in settings.json. */
export interface DesktopSettings {
  openAtLogin: boolean;
  keepInTray: boolean;
  remindersEnabled: boolean;
  reminderHour: number;
  /** Folder where the backups are written (the default one when `backupFolderIsDefault`). */
  backupFolder: string;
  backupFolderIsDefault: boolean;
  autoUpdateCheck: boolean;
  remindDayBefore: boolean;
  staleRequestsEnabled: boolean;
  staleRequestsDays: number;
  autoBackup: boolean;
  /** 0 = Sunday ... 6 = Saturday. */
  autoBackupDay: number;
  autoBackupHour: number;
  autoBackupKeep: number;
  userName: string;
  version: string;
  dataDir: string;
  /** False when running from source: the start-with-Windows switch has no effect there. */
  canAutoStart: boolean;
}

export interface BackupInfo {
  name: string;
  path: string;
  kind: 'manual' | 'auto' | 'sicurezza';
  /** Last modification, ms since 1970. */
  when: number;
  /** Total size in bytes. */
  size: number;
}
