import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Area, DRAWER_TYPES, Drawer, DrawerType } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { DrawersService } from '../../services/drawers.service';

/** Create or edit a drawer unit. Closes with the saved drawer, or 'deleted'. */
@Component({
  selector: 'app-drawer-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.drawer ? 'Cassettiera ' + data.drawer.numero : 'Nuova cassettiera' }}</h2>
    <form (ngSubmit)="save()">
      <mat-dialog-content class="form">
        <mat-form-field>
          <mat-label>Numero</mat-label>
          <input matInput type="number" min="1" name="numero" [(ngModel)]="numero" required />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Tipo</mat-label>
          <mat-select name="tipo" [(ngModel)]="tipo">
            @for (t of types; track t.value) { <mat-option [value]="t.value">{{ t.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Assegnata a</mat-label>
          <input matInput name="assegnata_a" [(ngModel)]="assegnataA" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Area</mat-label>
          <mat-select name="area" [(ngModel)]="area">
            <mat-option value="">(nessuna)</mat-option>
            @for (a of data.areas; track a.id) { <mat-option [value]="a.id">{{ a.nome }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (error()) { <small class="error">{{ error() }}</small> }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.drawer) { <button mat-button type="button" class="danger" (click)="remove()">Elimina</button> }
        <span class="spacer"></span>
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!numero || saving()">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: .5rem; padding-top: .5rem !important; }
    mat-dialog-actions { display: flex; }
    .spacer { flex: 1; }
    .danger, .error { color: var(--mat-sys-error); }
  `,
})
export class DrawerDialog {
  private readonly service = inject(DrawersService);
  private readonly ref = inject<MatDialogRef<DrawerDialog, Drawer | 'deleted'>>(MatDialogRef);
  readonly data = inject<{ drawer?: Drawer; areas: Area[]; nextNumber: number }>(MAT_DIALOG_DATA);

  readonly types = DRAWER_TYPES;
  numero = this.data.drawer?.numero ?? this.data.nextNumber;
  tipo: DrawerType = this.data.drawer?.tipo ?? 'personale';
  assegnataA = this.data.drawer?.assegnata_a ?? '';
  area = this.data.drawer?.area ?? '';
  readonly saving = signal(false);
  readonly error = signal('');

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const payload = { numero: Number(this.numero), tipo: this.tipo, assegnata_a: this.assegnataA.trim(), area: this.area };
    try {
      const saved = this.data.drawer
        ? await this.service.update(this.data.drawer.id, payload)
        : await this.service.create(payload);
      this.ref.close(saved);
    } catch {
      this.error.set('Impossibile salvare: il numero potrebbe essere già usato.');
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    if (!this.data.drawer || !confirm('Eliminare questa cassettiera?')) return;
    await this.service.remove(this.data.drawer.id);
    this.ref.close('deleted');
  }
}

@Component({
  selector: 'app-drawers',
  imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="head">
      <h1>Cassettiere</h1>
      <button mat-flat-button (click)="open()"><mat-icon>add</mat-icon> Nuova cassettiera</button>
    </div>

    <div class="summary">
      <span class="chip">{{ count().personale }} personali</span>
      <span class="chip">{{ count().condivisa }} condivise</span>
      <span class="chip" [class.ok]="count().free === 0" [class.warn]="count().free > 0">{{ count().free }} senza assegnatario</span>
      <a routerLink="/regole">Regola sulle cassettiere</a>
    </div>

    <form class="bulk" (ngSubmit)="createUpTo()">
      <mat-form-field>
        <mat-label>Crea le cassettiere da 1 a…</mat-label>
        <input matInput type="number" min="1" max="200" name="upto" [(ngModel)]="upTo" />
      </mat-form-field>
      <button mat-stroked-button type="submit" [disabled]="!upTo || bulkRunning()">Crea quelle mancanti</button>
    </form>

    <div class="cards">
      @for (d of drawers(); track d.id) {
        <button class="card" (click)="open(d)">
          <span class="num">{{ d.numero }}</span>
          <span class="chip">{{ d.tipo }}</span>
          <strong>{{ d.assegnata_a || '— libera —' }}</strong>
          <small class="muted">{{ d.expand?.area?.nome }}</small>
        </button>
      } @empty {
        <p class="muted">Nessuna cassettiera. Creale una alla volta oppure indica quante sono qui sopra.</p>
      }
    </div>
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .head h1 { margin: 0; }
    .summary { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .bulk { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .75rem; }
    .card { font: inherit; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: .25rem; padding: .75rem; border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; background: var(--mat-sys-surface-container-lowest); color: inherit; }
    .card:hover { box-shadow: 0 2px 8px rgb(0 0 0 / .12); }
    .num { font-size: 1.6rem; font-weight: 700; }
  `,
})
export class Drawers implements OnInit {
  private readonly service = inject(DrawersService);
  private readonly areasService = inject(AreasService);
  private readonly dialog = inject(MatDialog);

  readonly drawers = signal<Drawer[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly bulkRunning = signal(false);
  upTo: number | null = null;

  readonly count = computed(() => {
    const list = this.drawers();
    return {
      personale: list.filter((d) => d.tipo === 'personale').length,
      condivisa: list.filter((d) => d.tipo === 'condivisa').length,
      free: list.filter((d) => !d.assegnata_a).length,
    };
  });

  async ngOnInit(): Promise<void> {
    const [drawers, areas] = await Promise.all([this.service.list(), this.areasService.list()]);
    this.drawers.set(drawers);
    this.areas.set(areas);
  }

  open(drawer?: Drawer): void {
    const nextNumber = Math.max(0, ...this.drawers().map((d) => d.numero)) + 1;
    this.dialog
      .open(DrawerDialog, { data: { drawer, areas: this.areas(), nextNumber }, width: '28rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(async (res?: Drawer | 'deleted') => {
        if (res) this.drawers.set(await this.service.list());
      });
  }

  async createUpTo(): Promise<void> {
    if (this.bulkRunning()) return;
    if (!this.upTo) return;
    this.bulkRunning.set(true);
    try {
      await this.service.createUpTo(Math.min(Number(this.upTo), 200), this.drawers());
      this.drawers.set(await this.service.list());
    } finally {
      this.bulkRunning.set(false);
    }
  }
}
