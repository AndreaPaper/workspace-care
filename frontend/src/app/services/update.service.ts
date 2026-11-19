import { Injectable, computed, signal } from '@angular/core';

export type UpdateStatus = 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateState {
  status: UpdateStatus;
  version: string;
  percent: number;
  message: string;
}

/** In-app updates, driven by the Electron main process (see desktop/main.js). Does nothing outside Electron. */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  readonly state = signal<UpdateState>({ status: 'idle', version: '', percent: 0, message: '' });
  /** "Più tardi": hides the banner for this version until the app is restarted. */
  private readonly dismissedVersion = signal('');

  readonly visible = computed(() => {
    const s = this.state();
    if (s.status === 'available') return s.version !== this.dismissedVersion();
    return s.status === 'downloading' || s.status === 'ready' || s.status === 'error';
  });

  constructor() {
    const bridge = window.workspaceCare;
    if (!bridge?.onUpdateState) return;
    void bridge.getUpdateState?.().then((s) => this.state.set(s));
    bridge.onUpdateState((s) => this.state.set(s));
  }

  download(): void {
    void window.workspaceCare?.downloadUpdate?.();
  }

  install(): void {
    void window.workspaceCare?.installUpdate?.();
  }

  later(): void {
    this.dismissedVersion.set(this.state().version);
  }

  retry(): void {
    void window.workspaceCare?.checkForUpdates?.();
  }
}
