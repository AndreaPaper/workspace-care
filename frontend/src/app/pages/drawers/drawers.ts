import { Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
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
          <mat-label>Assegnata a (o contenuto, se condivisa)</mat-label>
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
  imports: [FormsModule, RouterLink],
  template: `
    <section aria-label="Cassettiere" class="wrap">
      <div class="bar">
        <div class="legend">
          <span><i class="sw personal"></i>Personale · {{ count().personale }}</span>
          <span><i class="sw shared"></i>Condivisa · {{ count().condivisa }}</span>
          <span><i class="sw free"></i>Libera · {{ count().free }}</span>
          <a routerLink="/regole">Regola sulle cassettiere</a>
        </div>
        <button type="button" class="btn btn-primary small" (click)="open()">+ Cassettiera</button>
      </div>

      @for (g of groups(); track g.name) {
        <div class="area-box">
          <strong>{{ g.name }}</strong>
          <div class="grid">
            @for (d of g.items; track d.id) {
              <button type="button" [class]="'block ' + kind(d)" (click)="open(d)" [attr.aria-label]="'Cassettiera ' + d.numero + ': ' + label(d)">
                <span class="n">N. {{ d.numero }}</span>
                <strong>{{ label(d) }}</strong>
              </button>
            }
          </div>
        </div>
      } @empty {
        <p class="empty">Nessuna cassettiera. Aggiungine una con «+ Cassettiera» oppure creale tutte insieme qui sotto.</p>
      }

      <details class="bulk-box">
        <summary>Crea più cassettiere insieme</summary>
        <form class="bulk" (ngSubmit)="createUpTo()">
          <label>
            <span>Crea le cassettiere da 1 a…</span>
            <input type="number" min="1" max="200" name="upto" [(ngModel)]="upTo" />
          </label>
          <button type="submit" class="btn btn-outline small" [disabled]="!upTo || bulkRunning()">Crea quelle mancanti</button>
        </form>
      </details>
    </section>
  `,
  styles: `
    .wrap { display: flex; flex-direction: column; gap: 16px; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; font-size: 13px; color: #45473f; }
    .legend span { display: flex; align-items: center; gap: 6px; }
    .legend a { color: #245a41; font-weight: 600; text-decoration: none; }
    .sw { width: 14px; height: 14px; border-radius: 4px; display: inline-block; box-sizing: border-box; }
    .sw.personal { background: #e6f1fc; border: 1px solid #a9c6e8; }
    .sw.shared { background: #edf5f0; border: 1px solid #a9cdb8; }
    .sw.free { background: #fff; border: 1px dashed #a8a291; }
    .btn.small { height: 40px; font-size: 13px; padding: 0 16px; }
    .area-box { padding: 18px; border-radius: 24px; background: #fff; display: flex; flex-direction: column; gap: 12px; }
    .area-box > strong { font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
    .block { padding: 12px; border-radius: 14px; border: 1px solid; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; font: 14px Inter, system-ui, sans-serif; min-width: 0; }
    .block .n { font-size: 12px; font-weight: 700; }
    .block strong { font-weight: 600; overflow-wrap: anywhere; }
    .block.personal { border-color: #a9c6e8; background: #e6f1fc; color: #0f3b6e; }
    .block.shared { border-color: #a9cdb8; background: #edf5f0; color: #173d2b; }
    .block.free { border: 1px dashed #a8a291; background: #fff; color: #45473f; }
    .block:hover { filter: brightness(.97); }
    .block:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .empty { margin: 0; color: #55584f; }
    .bulk-box { font-size: 13px; color: #45473f; }
    .bulk-box summary { cursor: pointer; font-weight: 600; }
    .bulk { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding-top: 10px; }
    .bulk label { display: flex; flex-direction: column; gap: 4px; }
    .bulk input { height: 40px; width: 120px; padding: 0 12px; border: 1px solid #c9c3b6; border-radius: 12px; font: 14px Inter, system-ui, sans-serif; }
  `,
})
export class Drawers implements OnInit {
  private readonly service = inject(DrawersService);
  private readonly areasService = inject(AreasService);
  private readonly dialog = inject(MatDialog);

  /** Emitted after any change, so that the tab counters of the Ufficio page can refresh. */
  readonly changed = output<void>();

  readonly drawers = signal<Drawer[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly bulkRunning = signal(false);
  upTo: number | null = null;

  /** A drawer without an assignee is free, whatever its type. */
  readonly count = computed(() => {
    const list = this.drawers();
    return {
      personale: list.filter((d) => d.assegnata_a && d.tipo === 'personale').length,
      condivisa: list.filter((d) => d.assegnata_a && d.tipo === 'condivisa').length,
      free: list.filter((d) => !d.assegnata_a).length,
    };
  });

  /** One box per area, drawers by number; drawers without an area go last. */
  readonly groups = computed(() => {
    const by = new Map<string, Drawer[]>();
    for (const d of this.drawers()) {
      const name = d.expand?.area?.nome ?? 'Senza area';
      by.set(name, [...(by.get(name) ?? []), d]);
    }
    return [...by.entries()]
      .sort(([a], [b]) => (a === 'Senza area' ? 1 : b === 'Senza area' ? -1 : a.localeCompare(b)))
      .map(([name, items]) => ({ name, items: items.sort((x, y) => x.numero - y.numero) }));
  });

  async ngOnInit(): Promise<void> {
    const [drawers, areas] = await Promise.all([this.service.list(), this.areasService.list()]);
    this.drawers.set(drawers);
    this.areas.set(areas);
  }

  kind(d: Drawer): string {
    return !d.assegnata_a ? 'free' : d.tipo === 'condivisa' ? 'shared' : 'personal';
  }

  label(d: Drawer): string {
    return d.assegnata_a || 'Libera';
  }

  open(drawer?: Drawer): void {
    const nextNumber = Math.max(0, ...this.drawers().map((d) => d.numero)) + 1;
    this.dialog
      .open(DrawerDialog, { data: { drawer, areas: this.areas(), nextNumber }, width: '28rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(async (res?: Drawer | 'deleted') => {
        if (!res) return;
        this.drawers.set(await this.service.list());
        this.changed.emit();
      });
  }

  async createUpTo(): Promise<void> {
    if (this.bulkRunning()) return;
    if (!this.upTo) return;
    this.bulkRunning.set(true);
    try {
      await this.service.createUpTo(Math.min(Number(this.upTo), 200), this.drawers());
      this.drawers.set(await this.service.list());
      this.changed.emit();
    } finally {
      this.bulkRunning.set(false);
    }
  }
}
