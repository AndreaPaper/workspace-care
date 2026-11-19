import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { watchPageParams } from '../../core/page-params';
import { Area, Container, InventoryItem } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { ContainersService } from '../../services/containers.service';
import { InventoryService } from '../../services/inventory.service';

const NO_AREA = 'Senza area';

/** The inventory as containers: one box per container (cabinet, box…) inside each area, edited in place. */
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-inventory',
  imports: [FormsModule, MatIconModule, NgTemplateOutlet],
  template: `
    <section class="panel">
      <div class="head">
        <p class="summary">
          <strong>{{ items().length }} {{ items().length === 1 ? 'oggetto' : 'oggetti' }}</strong>
          in {{ containers().length }} {{ containers().length === 1 ? 'contenitore' : 'contenitori' }}
          @if (looseCount()) { · {{ looseCount() }} {{ looseCount() === 1 ? 'oggetto' : 'oggetti' }} senza contenitore }
        </p>
        <div class="buttons">
          <button type="button" class="outline" (click)="newBox()">+ Contenitore</button>
          <button type="button" class="primary" (click)="newItem()">+ Oggetto</button>
        </div>
      </div>

      @if (search()) {
        <p class="filter">Filtro: «{{ search() }}» <button type="button" class="link" (click)="search.set('')">Togli il filtro</button></p>
      }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

      @if (editing() === 'i:new') { <ng-container *ngTemplateOutlet="itemForm" /> }
      @if (editing() === 'c:new') { <ng-container *ngTemplateOutlet="boxForm" /> }

      @for (g of groups(); track g.title) {
        <h2>{{ g.title }}</h2>
        <div class="grid">
          @for (b of g.boxes; track b.container.id) {
            <article class="box">
              @if (editing() === 'c:' + b.container.id) {
                <ng-container *ngTemplateOutlet="boxForm" />
              } @else {
                <header>
                  <mat-icon aria-hidden="true">inventory_2</mat-icon>
                  <button type="button" class="name" (click)="editBox(b.container)" [attr.aria-label]="'Modifica il contenitore ' + b.container.nome">{{ b.container.nome }}</button>
                  <span class="count">{{ b.items.length }} {{ b.items.length === 1 ? 'oggetto' : 'oggetti' }}</span>
                </header>
                @if (b.container.descrizione) { <p class="desc">{{ b.container.descrizione }}</p> }
              }
              <ul>
                @for (i of b.items; track i.id) {
                  <li>
                    @if (editing() === 'i:' + i.id) {
                      <ng-container *ngTemplateOutlet="itemForm" />
                    } @else {
                      <button type="button" class="row" (click)="editItem(i)" [attr.aria-label]="'Modifica l\\'oggetto ' + i.nome">
                        <span class="n">{{ i.nome }}</span><span class="where">{{ i.posizione }}</span>
                      </button>
                    }
                  </li>
                } @empty {
                  <li class="empty">Vuoto</li>
                }
              </ul>
            </article>
          }

          @if (g.loose.length) {
            <article class="box loose">
              <header><span class="n">Senza contenitore</span><span class="count">{{ g.loose.length }}</span></header>
              <ul>
                @for (i of g.loose; track i.id) {
                  <li>
                    @if (editing() === 'i:' + i.id) {
                      <ng-container *ngTemplateOutlet="itemForm" />
                    } @else {
                      <div class="row-wrap">
                        <button type="button" class="row" (click)="editItem(i)" [attr.aria-label]="'Modifica l\\'oggetto ' + i.nome">
                          <span class="n">{{ i.nome }}</span><span class="where">{{ i.posizione }}</span>
                        </button>
                        @if (g.areaBoxes.length) {
                          <select class="put" aria-label="Metti in un contenitore" (change)="putIn(i, $any($event.target).value); $any($event.target).value = ''">
                            <option value="">Metti in…</option>
                            @for (c of g.areaBoxes; track c.id) { <option [value]="c.id">{{ c.nome }}</option> }
                          </select>
                        }
                      </div>
                    }
                  </li>
                }
              </ul>
            </article>
          }
        </div>
      } @empty {
        <p class="muted">{{ search() ? 'Nessun risultato.' : 'Nessun oggetto in inventario: aggiungi un contenitore o un oggetto.' }}</p>
      }
    </section>

    <ng-template #itemForm>
      <form class="edit" (ngSubmit)="saveItem()">
        <input name="nome" [(ngModel)]="itemDraft.nome" placeholder="Nome dell'oggetto" aria-label="Nome dell'oggetto" required />
        <div class="two">
          <label>Contenitore
            <select name="contenitore" [(ngModel)]="itemDraft.contenitore">
              <option value="">(nessuno)</option>
              @for (c of containers(); track c.id) { <option [value]="c.id">{{ areaName(c.area) }} · {{ c.nome }}</option> }
            </select>
          </label>
          @if (!itemDraft.contenitore) {
            <label>Area
              <select name="area" [(ngModel)]="itemDraft.area">
                <option value="">(nessuna)</option>
                @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
              </select>
            </label>
          }
        </div>
        <input name="posizione" [(ngModel)]="itemDraft.posizione" placeholder="Punto preciso (ripiano 2, cassetto…)" aria-label="Punto preciso" />
        <textarea name="note" rows="2" [(ngModel)]="itemDraft.note" placeholder="Note" aria-label="Note"></textarea>
        <div class="actions">
          @if (editing() !== 'i:new') { <button type="button" class="danger" (click)="removeItem()">Elimina</button> }
          <span class="grow"></span>
          <button type="button" class="outline" (click)="cancel()">Annulla</button>
          <button type="submit" class="primary" [disabled]="!itemDraft.nome.trim() || saving()">Salva</button>
        </div>
      </form>
    </ng-template>

    <ng-template #boxForm>
      <form class="edit" (ngSubmit)="saveBox()">
        <input name="bnome" [(ngModel)]="boxDraft.nome" placeholder="Nome del contenitore (es. Armadio grigio)" aria-label="Nome del contenitore" required />
        <label>Area
          <select name="barea" [(ngModel)]="boxDraft.area">
            <option value="">(nessuna)</option>
            @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
          </select>
        </label>
        <input name="bdesc" [(ngModel)]="boxDraft.descrizione" placeholder="Descrizione breve (es. sullo scaffale)" aria-label="Descrizione" />
        <div class="actions">
          @if (editing() !== 'c:new') { <button type="button" class="danger" (click)="removeBox()">Elimina</button> }
          <span class="grow"></span>
          <button type="button" class="outline" (click)="cancel()">Annulla</button>
          <button type="submit" class="primary" [disabled]="!boxDraft.nome.trim() || saving()">Salva</button>
        </div>
      </form>
    </ng-template>
  `,
  styles: `
    .panel { display: flex; flex-direction: column; gap: 14px; font-family: Inter, system-ui, sans-serif; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .summary { margin: 0; font-size: 14px; color: #45473f; }
    .buttons { display: flex; gap: 8px; }
    button, select { font: inherit; }
    button { cursor: pointer; }
    button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .primary { height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: #2e6a4f; color: #fff; font-weight: 700; }
    .primary:disabled { opacity: .5; cursor: default; }
    .outline { height: 44px; padding: 0 18px; border: 1.5px solid #2e6a4f; border-radius: 999px; background: #fff; color: #173d2b; font-weight: 700; }
    .danger { border: 0; background: transparent; color: #b42318; font-weight: 600; padding: 8px; }
    .link { border: 0; background: transparent; color: #0f3b6e; font-weight: 700; text-decoration: underline; padding: 4px; }
    .filter { margin: 0; font-size: 14px; }
    .error { margin: 0; color: #b42318; }
    .muted { color: #5a5c53; }
    h2 { margin: 8px 0 -4px; font: 800 20px 'Plus Jakarta Sans', Inter, sans-serif; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; align-items: start; }
    .box { background: #fff; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 8px; border: 1px solid #ece7db; }
    .box.loose { background: transparent; border: 1.5px dashed #b9b3a3; }
    .box header { display: flex; align-items: center; gap: 8px; }
    .box header mat-icon { color: #2e6a4f; flex: none; }
    .name { flex: 1; border: 0; background: transparent; padding: 0; text-align: left; font: 800 16px 'Plus Jakarta Sans', Inter, sans-serif; color: #22241f; }
    .name:hover { text-decoration: underline dotted; }
    .loose header .n { flex: 1; font: 800 16px 'Plus Jakarta Sans', Inter, sans-serif; color: #45473f; }
    .count { font-size: 12px; color: #5a5c53; white-space: nowrap; }
    .desc { margin: -4px 0 0; font-size: 13px; color: #5a5c53; }
    ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
    li { border-top: 1px solid #f0ece2; }
    .empty { color: #8a8c82; font-size: 13px; padding: 8px 0; }
    .row { width: 100%; display: flex; justify-content: space-between; gap: 12px; align-items: baseline; border: 0; background: transparent; padding: 9px 0; text-align: left; color: #22241f; font-size: 14px; min-height: 40px; }
    .row:hover .n { text-decoration: underline dotted; }
    .where { color: #5a5c53; font-size: 13px; text-align: right; }
    .row-wrap { display: flex; align-items: center; gap: 8px; }
    .row-wrap .row { flex: 1; min-width: 0; }
    .put { height: 34px; border: 1px solid #cfc9bb; border-radius: 999px; padding: 0 10px; background: #fff; font-size: 13px; max-width: 130px; }
    .edit { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; border: 1.5px solid #2f6fb5; background: #f5f9fe; margin: 4px 0; }
    .edit input, .edit textarea, .edit select { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cfc9bb; border-radius: 10px; font: 14px Inter, system-ui, sans-serif; background: #fff; }
    .edit label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #45473f; flex: 1; }
    .two { display: flex; gap: 8px; flex-wrap: wrap; }
    .actions { display: flex; align-items: center; gap: 8px; }
    .grow { flex: 1; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class Inventory implements OnInit {
  private readonly confirmService = inject(ConfirmService);
  /** Emitted after any change, so that the tab counters of the Ufficio page can refresh. */
  readonly changed = output<void>();
  private readonly service = inject(InventoryService);
  private readonly containersService = inject(ContainersService);
  private readonly areasService = inject(AreasService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<InventoryItem[]>([]);
  readonly containers = signal<Container[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly search = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  /** 'i:<id>' / 'c:<id>' for the item / container being edited, 'i:new' / 'c:new' for a new one, '' for none. */
  readonly editing = signal('');
  itemDraft = { nome: '', area: '', contenitore: '', posizione: '', note: '' };
  boxDraft = { nome: '', area: '', descrizione: '' };

  readonly looseCount = computed(() => this.items().filter((i) => !i.contenitore).length);

  readonly groups = computed(() => {
    const q = this.search().trim().toLowerCase();
    const areaOf = new Map(this.areas().map((a) => [a.id, a.nome]));
    const nameOf = (id: string) => areaOf.get(id) ?? NO_AREA;
    const matches = (i: InventoryItem) => !q || (i.nome + ' ' + i.posizione + ' ' + i.note).toLowerCase().includes(q);
    const byArea = new Map<string, { boxes: { container: Container; items: InventoryItem[] }[]; loose: InventoryItem[]; areaBoxes: Container[] }>();
    const slot = (title: string) => {
      if (!byArea.has(title)) byArea.set(title, { boxes: [], loose: [], areaBoxes: [] });
      return byArea.get(title)!;
    };
    for (const c of this.containers()) {
      const inside = this.items().filter((i) => i.contenitore === c.id && matches(i));
      const nameMatches = !!q && c.nome.toLowerCase().includes(q);
      const s = slot(nameOf(c.area));
      s.areaBoxes.push(c);
      if (!q || inside.length || nameMatches || this.editing() === 'c:' + c.id) s.boxes.push({ container: c, items: nameMatches && !inside.length ? this.items().filter((i) => i.contenitore === c.id) : inside });
    }
    for (const i of this.items()) {
      if (!i.contenitore && matches(i)) slot(nameOf(i.area)).loose.push(i);
    }
    return [...byArea.entries()]
      .filter(([, g]) => g.boxes.length || g.loose.length)
      .sort(([a], [b]) => (a === NO_AREA ? 1 : b === NO_AREA ? -1 : a.localeCompare(b)))
      .map(([title, g]) => ({ title, ...g }));
  });

  async ngOnInit(): Promise<void> {
    await this.reload(false);
    watchPageParams(this.route, this.router, this.destroyRef, { onSearch: (q) => this.search.set(q), onNew: (area) => this.newItem(area) });
  }

  private async reload(notify = true): Promise<void> {
    try {
      const [items, containers, areas] = await Promise.all([this.service.list(), this.containersService.list(), this.areasService.list()]);
      this.items.set(items);
      this.containers.set(containers);
      this.areas.set(areas);
      if (notify) this.changed.emit();
    } catch {
      this.error.set("Impossibile caricare l'inventario.");
    }
  }

  areaName(id: string): string {
    return this.areas().find((a) => a.id === id)?.nome ?? NO_AREA;
  }

  newItem(area = ''): void {
    this.error.set('');
    this.itemDraft = { nome: '', area, contenitore: '', posizione: '', note: '' };
    this.editing.set('i:new');
  }

  editItem(i: InventoryItem): void {
    this.error.set('');
    this.itemDraft = { nome: i.nome, area: i.area, contenitore: i.contenitore, posizione: i.posizione, note: i.note };
    this.editing.set('i:' + i.id);
  }

  newBox(): void {
    this.error.set('');
    this.boxDraft = { nome: '', area: '', descrizione: '' };
    this.editing.set('c:new');
  }

  editBox(c: Container): void {
    this.error.set('');
    this.boxDraft = { nome: c.nome, area: c.area, descrizione: c.descrizione };
    this.editing.set('c:' + c.id);
  }

  cancel(): void {
    this.editing.set('');
  }

  async saveItem(): Promise<void> {
    if (this.saving() || !this.itemDraft.nome.trim()) return;
    this.saving.set(true);
    this.error.set('');
    const d = this.itemDraft;
    // An item inside a container always lives in that container's area.
    const area = d.contenitore ? (this.containers().find((c) => c.id === d.contenitore)?.area ?? '') : d.area;
    const payload = { nome: d.nome.trim(), area, contenitore: d.contenitore, posizione: d.posizione.trim(), note: d.note };
    try {
      const id = this.editing().slice(2);
      if (id === 'new') await this.service.create(payload);
      else await this.service.update(id, payload);
      this.editing.set('');
      await this.reload();
    } catch {
      this.error.set("Impossibile salvare l'oggetto.");
    } finally {
      this.saving.set(false);
    }
  }

  async removeItem(): Promise<void> {
    const id = this.editing().slice(2);
    if (!id || id === 'new') return;
    if (!(await this.confirmService.ask({ title: 'Eliminare questo oggetto?', text: "L'oggetto non sarà più in inventario.", confirmLabel: 'Elimina oggetto' }))) return;
    try {
      await this.service.remove(id);
      this.editing.set('');
      await this.reload();
    } catch {
      this.error.set("Impossibile eliminare l'oggetto.");
    }
  }

  async saveBox(): Promise<void> {
    if (this.saving() || !this.boxDraft.nome.trim()) return;
    this.saving.set(true);
    this.error.set('');
    const d = this.boxDraft;
    const id = this.editing().slice(2);
    try {
      const payload = { nome: d.nome.trim(), area: d.area, descrizione: d.descrizione.trim() };
      if (id === 'new') await this.containersService.create(payload);
      else {
        await this.containersService.update(id, payload);
        // Items follow their container when it changes area.
        const moved = this.items().filter((i) => i.contenitore === id && i.area !== d.area);
        await Promise.all(moved.map((i) => this.service.update(i.id, { area: d.area })));
      }
      this.editing.set('');
      await this.reload();
    } catch {
      this.error.set('Impossibile salvare il contenitore.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeBox(): Promise<void> {
    const id = this.editing().slice(2);
    if (!id || id === 'new') return;
    const n = this.items().filter((i) => i.contenitore === id).length;
    const extra = n
      ? n === 1
        ? " L'oggetto al suo interno resta in inventario, senza contenitore."
        : ` I ${n} oggetti al suo interno restano in inventario, senza contenitore.`
      : '';
    if (!(await this.confirmService.ask({ title: 'Eliminare il contenitore?', text: extra.trim() || undefined, confirmLabel: 'Elimina contenitore' }))) return;
    try {
      await this.containersService.remove(id);
      this.editing.set('');
      await this.reload();
    } catch {
      this.error.set('Impossibile eliminare il contenitore.');
    }
  }

  /** "Metti in…": moves a loose item into one of the area's containers. */
  async putIn(item: InventoryItem, containerId: string): Promise<void> {
    if (!containerId) return;
    this.error.set('');
    try {
      await this.service.update(item.id, { contenitore: containerId });
      await this.reload();
    } catch {
      this.error.set("Impossibile spostare l'oggetto.");
    }
  }
}
