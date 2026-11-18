import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { PocketBaseService } from '../../core/pocketbase.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <form class="box" (ngSubmit)="submit()">
      <h1>Workspace Care</h1>
      @if (setupMode()) {
        <p class="muted">Primo avvio: scegli email e password (almeno 8 caratteri) per accedere all'app.</p>
      }
      <mat-form-field>
        <mat-label>Email</mat-label>
        <input matInput type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Password</mat-label>
        <input matInput type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" />
      </mat-form-field>
      @if (error()) { <small class="error">{{ error() }}</small> }
      <button mat-flat-button type="submit" [disabled]="loading()">{{ setupMode() ? 'Crea account' : 'Accedi' }}</button>
    </form>
  `,
  styles: `
    :host { display: grid; place-items: center; min-height: 100vh; padding: 1rem; }
    .box { display: flex; flex-direction: column; gap: .5rem; width: 100%; max-width: 340px; }
    h1 { text-align: center; }
    .error { color: var(--mat-sys-error); }
  `,
})
export class Login implements OnInit {
  private readonly pb = inject(PocketBaseService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly setupMode = signal(false);
  readonly error = signal('');
  readonly loading = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      this.setupMode.set(await this.pb.isSetupNeeded());
    } catch {
      this.error.set('Server non raggiungibile.');
    }
  }

  async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.setupMode()) await this.pb.setup(this.email, this.password);
      else await this.pb.login(this.email, this.password);
      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.error.set(this.setupMode() ? "Impossibile creare l'account (password di almeno 8 caratteri)." : 'Email o password non corretti.');
    } finally {
      this.loading.set(false);
    }
  }
}
