import { Injectable, signal } from '@angular/core';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error';
  title: string;
  text?: string;
  actions: ToastAction[];
}

/**
 * Outcome messages at the bottom of the page (design M2). A success disappears after 6 seconds; an error stays
 * until it is dismissed or one of its buttons is used. Messages from the desktop main process (the backup result)
 * arrive here too.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  constructor() {
    const bridge = window.workspaceCare;
    if (!bridge?.takeToasts) return;
    const take = () => void bridge.takeToasts?.().then((list) => list.forEach((t) => this.fromDesktop(t)));
    take();
    bridge.onToastReady?.(take);
  }

  success(title: string, options: { text?: string; actions?: ToastAction[] } = {}): void {
    this.push({ kind: 'success', title, text: options.text, actions: options.actions ?? [] });
  }

  error(title: string, options: { text?: string; actions?: ToastAction[] } = {}): void {
    this.push({ kind: 'error', title, text: options.text, actions: options.actions ?? [] });
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(toast: Omit<Toast, 'id'>): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { ...toast, id }]);
    if (toast.kind === 'success') setTimeout(() => this.dismiss(id), 6000);
  }

  private fromDesktop(t: { kind: 'success' | 'error'; title: string; text?: string; path?: string; folder?: string }): void {
    const bridge = window.workspaceCare;
    if (t.kind === 'success') {
      const path = t.path;
      this.success(t.title, {
        text: t.text,
        actions: path ? [{ label: 'Apri cartella', run: () => void bridge?.showInFolder?.(path) }] : [],
      });
    } else {
      const folder = t.folder;
      this.error(t.title, {
        text: t.text,
        actions: [
          { label: 'Altra cartella', run: () => void bridge?.exportBackup?.() },
          ...(folder ? [{ label: 'Riprova', run: () => void bridge?.exportBackup?.(folder) }] : []),
        ],
      });
    }
  }
}
