import { Injectable, isDevMode, signal } from '@angular/core';
import PocketBase, { RecordModel } from 'pocketbase';

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
