import { Component, DestroyRef, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Area, Drawer, DrawerType, DrawerUnit } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { DrawersService, DrawerUnitsService } from '../../services/drawers.service';

const NO_AREA = 'Senza area';

/** Drawer units drawn as furniture: one box per area, each unit a stack of single drawers coloured by type. */
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-drawers',
  imports: [FormsModule, RouterLink],
  template: `
    <section aria-label="Cassettiere" class="wrap">
      <div class="bar">
        <div class="legend">
          <span><i class="sw personal"></i>Personale · {{ count().personale }}</span>
          <span><i class="sw shared"></i>Condiviso · {{ count().condiviso }}</span>
          <span><i class="sw stuff"></i>Con roba · {{ count().conRoba }}</span>
          <span><i class="sw free"></i>Libero · {{ count().libero }}</span>
          @if (!areaId()) { <a routerLink="/regole">Regola sulle cassettiere</a> }
        </div>
        <button type="button" class="btn btn-primary small" (click)="newUnit()">+ Cassettiera</button>
      </div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

      <div class="cols" [class.with-panel]="!!sel()">
        <div class="areas">
          @for (g of groups(); track g.name) {
            <div class="area-box">
              @if (!areaId()) { <strong>{{ g.name }}</strong> }
              <div class="grid">
                @for (u of g.units; track u.unit.id) {
                  <div class="unit">
                    <button type="button" class="label" [class.sel]="sel() === 'u:' + u.unit.id" (click)="selectUnit(u.unit)">Cassettiera {{ u.unit.numero }}</button>
                    <div class="furniture">
                      @for (d of u.drawers; track d.id; let first = $first) {
                        <button type="button" [class]="'drawer ' + kind(d)" [class.sel]="sel() === 'd:' + d.id" (click)="selectDrawer(d)"
                                [attr.aria-label]="'Cassettiera ' + u.unit.numero + ', cassetto ' + d.numero + ': ' + label(d)">
                          <span class="t">{{ label(d) }}</span>
                          @if (first && u.whole) { <small>tutta</small> }
                        </button>
                      } @empty {
                        <span class="nodrawers">Nessun cassetto</span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <p class="empty">{{ areaId() ? "Nessuna cassettiera in quest'area. Aggiungine una con «+ Cassettiera»." : "Nessuna cassettiera. Aggiungine una con «+ Cassettiera» oppure creale tutte insieme qui sotto." }}</p>
          }
        </div>

        @if (sel()) {
          <aside class="panel" aria-label="Dettaglio">
            @if (selectedDrawer(); as d) {
              <h3>Cassettiera {{ unitNumber(d.cassettiera) }} · Cassetto {{ d.numero }}</h3>
              <form (ngSubmit)="saveDrawer()">
                <div class="seg" role="group" aria-label="Tipo">
                  @for (t of types; track t.value) {
                    <button type="button" [attr.aria-pressed]="dd.tipo === t.value" (click)="dd.tipo = t.value">{{ t.label }}</button>
                  }
                </div>
                @if (dd.tipo === 'personale') {
                  <label>A chi<input name="chi" list="people-list" autocomplete="off" [(ngModel)]="dd.assegnato_a" placeholder="Nome della persona" /></label>
                  <label class="check"><input type="checkbox" name="tutta" [(ngModel)]="dd.tutta" /> Assegna tutta la cassettiera a questa persona</label>
                }
                @if (dd.tipo === 'condiviso') {
                  <label>Contenuto<input name="cont" [(ngModel)]="dd.contenuto" placeholder="Es. moduli e buste" /></label>
                }
                @if (dd.tipo === 'con_roba') {
                  <p class="hint">Dentro c'è roba che non è di nessuno: il cassetto non è libero, ma non è assegnato.</p>
                  <label>Cosa c'è (facoltativo)<input name="cosa" [(ngModel)]="dd.contenuto" placeholder="Es. cavi vecchi, scatole" /></label>
                  <label class="check"><input type="checkbox" name="tutta" [(ngModel)]="dd.tutta" /> Segna con roba anche gli altri cassetti liberi di questa cassettiera</label>
                }
                <div class="actions">
                  <button type="button" class="danger" (click)="removeDrawer(d)">Elimina cassetto</button>
                  <span class="grow"></span>
                  <button type="submit" class="btn btn-primary small" [disabled]="saving()">Salva</button>
                </div>
              </form>
            }

            @if (sel().startsWith('u:')) {
              <h3>{{ sel() === 'u:new' ? 'Nuova cassettiera' : 'Cassettiera ' + ud.numero }}</h3>
              <form (ngSubmit)="saveUnit()">
                <label>Numero<input type="number" min="1" name="numero" [(ngModel)]="ud.numero" required /></label>
                <label>Area
                  <select name="area" [(ngModel)]="ud.area">
                    <option value="">(nessuna)</option>
                    @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
                  </select>
                </label>
                @if (sel() === 'u:new') {
                  <label>Numero di cassetti<input type="number" min="1" max="12" name="n" [(ngModel)]="ud.cassetti" /></label>
                }
                <div class="actions">
                  @if (sel() !== 'u:new') {
                    <button type="button" class="danger" (click)="removeUnit()">Elimina</button>
                    <button type="button" class="outline" (click)="addDrawer()" [disabled]="saving()">+ Cassetto</button>
                  }
                  <span class="grow"></span>
                  <button type="submit" class="btn btn-primary small" [disabled]="!ud.numero || saving()">{{ sel() === 'u:new' ? 'Crea' : 'Salva' }}</button>
                </div>
              </form>
            }
            <button type="button" class="link" (click)="close()">Chiudi</button>
          </aside>
        }
      </div>

      @if (areaId() && (freeSummary() || stuffSummary())) {
        <p class="freeline">
          @if (freeSummary()) { <span>Liberi: {{ freeSummary() }}</span> }
          @if (stuffSummary()) { <span>Con roba: {{ stuffSummary() }}</span> }
          <a routerLink="/ufficio" [queryParams]="{ tab: 'cassettiere' }">Tutte le cassettiere</a>
        </p>
      }

      @if (!areaId()) {
      <details class="bulk-box">
        <summary>Crea più cassettiere insieme</summary>
        <form class="bulk" (ngSubmit)="createUpTo()">
          <label>
            <span>Crea le cassettiere da 1 a…</span>
            <input type="number" min="1" max="200" name="upto" [(ngModel)]="upTo" />
          </label>
          <label>
            <span>Cassetti per cassettiera</span>
            <input type="number" min="1" max="12" name="perunit" [(ngModel)]="perUnit" />
          </label>
          <button type="submit" class="btn btn-outline small" [disabled]="!upTo || bulkRunning()">Crea quelle mancanti</button>
        </form>
      </details>
      }
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
    .sw.stuff { background: #fbebc8; border: 1px solid #e8c77a; }
    .sw.free { background: #fff; border: 1px dashed #a8a291; }
    .btn.small { height: 40px; font-size: 13px; padding: 0 16px; }
    .error { margin: 0; color: #b42318; }
    .freeline { margin: 0; font-size: 13px; color: #45473f; }
    .freeline a { color: #245a41; font-weight: 600; }
    .cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
    .cols.with-panel { grid-template-columns: minmax(0, 1fr) 320px; }
    .areas { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .area-box { padding: 18px; border-radius: 24px; background: #fff; display: flex; flex-direction: column; gap: 12px; }
    .area-box > strong { font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
    .unit { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .label { align-self: flex-start; border: 0; background: transparent; padding: 2px 0; font: 700 13px Inter, system-ui, sans-serif; color: #22241f; cursor: pointer; }
    .label:hover, .label.sel { text-decoration: underline; }
    .furniture { background: #ddd7cb; border-radius: 12px; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
    .drawer { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 40px; padding: 6px 10px; border-radius: 8px; border: 1px solid; text-align: left; cursor: pointer; font: 600 13px Inter, system-ui, sans-serif; min-width: 0; }
    .drawer .t { overflow-wrap: anywhere; }
    .drawer small { font-size: 11px; font-weight: 700; opacity: .75; white-space: nowrap; }
    .drawer.personal { border-color: #a9c6e8; background: #e6f1fc; color: #0f3b6e; }
    .drawer.shared { border-color: #a9cdb8; background: #edf5f0; color: #173d2b; }
    .drawer.stuff { border-color: #e8c77a; background: #fbebc8; color: #5c3f00; }
    .freeline { display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .drawer.free { border: 1px dashed #a8a291; background: #fff; color: #45473f; font-weight: 500; }
    .drawer.sel { border: 2px solid #2f6fb5; }
    .drawer:focus-visible, .label:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .nodrawers { font-size: 12px; color: #55584f; padding: 6px; }
    .empty { margin: 0; color: #55584f; }
    .panel { position: sticky; top: 16px; padding: 18px; border-radius: 24px; background: #fff; display: flex; flex-direction: column; gap: 12px; font-family: Inter, system-ui, sans-serif; }
    .panel h3 { margin: 0; font: 800 16px 'Plus Jakarta Sans', Inter, sans-serif; }
    .panel form { display: flex; flex-direction: column; gap: 12px; }
    .panel label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #45473f; }
    .panel label.check { flex-direction: row; align-items: center; gap: 8px; font-weight: 500; font-size: 13px; }
    .panel input:not([type='checkbox']), .panel select { height: 40px; padding: 0 10px; border: 1px solid #cfc9bb; border-radius: 10px; font: 14px Inter, system-ui, sans-serif; background: #fff; }
    .panel input[type='checkbox'] { width: 18px; height: 18px; accent-color: #2e6a4f; }
    .panel input:focus-visible, .panel select:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .seg { display: flex; gap: 6px; flex-wrap: wrap; }
    .seg button { height: 36px; padding: 0 12px; border: 1px solid #cfc9bb; border-radius: 999px; background: #fff; font: 600 13px Inter, system-ui, sans-serif; cursor: pointer; }
    .seg button[aria-pressed='true'] { background: #2e6a4f; border-color: #2e6a4f; color: #fff; }
    .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .grow { flex: 1; }
    .danger { border: 0; background: transparent; color: #b42318; font: 600 13px Inter, system-ui, sans-serif; padding: 8px 4px; cursor: pointer; }
    .outline { height: 40px; padding: 0 14px; border: 1.5px solid #2e6a4f; border-radius: 999px; background: #fff; color: #173d2b; font: 700 13px Inter, system-ui, sans-serif; cursor: pointer; }
    .link { align-self: flex-start; border: 0; background: transparent; color: #0f3b6e; font-weight: 700; text-decoration: underline; padding: 4px; cursor: pointer; }
    .bulk-box { font-size: 13px; color: #45473f; }
    .bulk-box summary { cursor: pointer; font-weight: 600; }
    .bulk { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding-top: 10px; }
    .bulk label { display: flex; flex-direction: column; gap: 4px; }
    .bulk input { height: 40px; width: 120px; padding: 0 12px; border: 1px solid #c9c3b6; border-radius: 12px; font: 14px Inter, system-ui, sans-serif; }
    @media (max-width: 900px) { .cols.with-panel { grid-template-columns: minmax(0, 1fr); } .panel { position: static; } }
  `,
})
export class Drawers implements OnInit {
  private readonly confirmService = inject(ConfirmService);
  private readonly unitsService = inject(DrawerUnitsService);
  private readonly drawersService = inject(DrawersService);
  private readonly areasService = inject(AreasService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** When set, only the units of this area are shown (the area page); creation and bulk tools adapt. */
  readonly areaId = input('');

  /** Emitted after any change, so that the tab counters of the Ufficio page can refresh. */
  readonly changed = output<void>();

  readonly types: { value: DrawerType; label: string }[] = [
    { value: 'personale', label: 'Personale' },
    { value: 'condiviso', label: 'Condiviso' },
    { value: 'con_roba', label: 'Con roba' },
    { value: 'libero', label: 'Libero' },
  ];
  readonly units = signal<DrawerUnit[]>([]);
  readonly drawers = signal<Drawer[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly bulkRunning = signal(false);
  /** 'd:<id>' drawer, 'u:<id>' unit, 'u:new' new unit, '' nothing selected. */
  readonly sel = signal('');
  upTo: number | null = null;
  perUnit = 3;
  dd = { tipo: 'libero' as DrawerType, assegnato_a: '', contenuto: '', tutta: false };
  ud = { numero: 1, area: '', cassetti: 3 };

  private readonly shownUnits = computed(() => this.units().filter((u) => !this.areaId() || u.area === this.areaId()));

  readonly count = computed(() => {
    const ids = new Set(this.shownUnits().map((u) => u.id));
    const list = this.drawers().filter((d) => ids.has(d.cassettiera));
    return {
      personale: list.filter((d) => d.tipo === 'personale').length,
      condiviso: list.filter((d) => d.tipo === 'condiviso').length,
      conRoba: list.filter((d) => d.tipo === 'con_roba').length,
      libero: list.filter((d) => d.tipo === 'libero').length,
    };
  });

  /** One box per area, units by number; units without an area go last. */
  readonly groups = computed(() => {
    const by = new Map<string, { unit: DrawerUnit; drawers: Drawer[]; whole: boolean }[]>();
    for (const unit of this.shownUnits()) {
      const drawers = this.drawers().filter((d) => d.cassettiera === unit.id).sort((a, b) => a.numero - b.numero);
      const name = unit.expand?.area?.nome ?? NO_AREA;
      const first = drawers[0];
      const whole = drawers.length > 1 && first.tipo === 'personale' && !!first.assegnato_a && drawers.every((d) => d.tipo === 'personale' && d.assegnato_a === first.assegnato_a);
      by.set(name, [...(by.get(name) ?? []), { unit, drawers, whole }]);
    }
    return [...by.entries()]
      .sort(([a], [b]) => (a === NO_AREA ? 1 : b === NO_AREA ? -1 : a.localeCompare(b)))
      .map(([name, units]) => ({ name, units: units.sort((x, y) => x.unit.numero - y.unit.numero) }));
  });

  /** "cassettiera 3 (cassetti 2 e 3), cassettiera 5 (tutta)" for the units with free drawers. */
  readonly freeSummary = computed(() => this.summaryOf('libero'));
  /** The same for the drawers that hold stuff of nobody. */
  readonly stuffSummary = computed(() => this.summaryOf('con_roba'));

  private summaryOf(tipo: DrawerType): string {
    const parts: string[] = [];
    for (const g of this.groups()) {
      for (const u of g.units) {
        const free = u.drawers.filter((d) => d.tipo === tipo).map((d) => d.numero);
        if (!free.length) continue;
        const list = free.length === u.drawers.length ? 'tutta' : (free.length === 1 ? 'cassetto ' : 'cassetti ') + (free.length > 1 ? free.slice(0, -1).join(', ') + ' e ' + free[free.length - 1] : free[0]);
        parts.push(`cassettiera ${u.unit.numero} (${list})`);
      }
    }
    return parts.join(', ');
  }

  readonly selectedDrawer = computed(() => {
    const s = this.sel();
    return s.startsWith('d:') ? (this.drawers().find((d) => d.id === s.slice(2)) ?? null) : null;
  });

  async ngOnInit(): Promise<void> {
    await this.reload(false);
    // From the global search: ?cassetto=<id> opens that drawer (also when this tab is already open), then the parameter is dropped.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      if (p.has('nuova') && !this.areaId()) {
        this.newUnit(p.get('area') ?? '');
        void this.router.navigate([], { queryParams: { nuova: null, area: null }, queryParamsHandling: 'merge', replaceUrl: true });
        return;
      }
      const id = p.get('cassetto');
      if (!id) return;
      const d = this.drawers().find((x) => x.id === id);
      if (d) this.selectDrawer(d);
      void this.router.navigate([], { queryParams: { cassetto: null }, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  private async reload(notify = true): Promise<void> {
    try {
      const [units, drawers, areas] = await Promise.all([this.unitsService.list(), this.drawersService.list(), this.areasService.list()]);
      this.units.set(units);
      this.drawers.set(drawers);
      this.areas.set(areas);
      if (notify) this.changed.emit();
    } catch {
      this.error.set('Impossibile caricare le cassettiere.');
    }
  }

  kind(d: Drawer): string {
    return d.tipo === 'libero' ? 'free' : d.tipo === 'condiviso' ? 'shared' : d.tipo === 'con_roba' ? 'stuff' : 'personal';
  }

  label(d: Drawer): string {
    if (d.tipo === 'personale') return d.assegnato_a || 'Personale';
    if (d.tipo === 'condiviso') return d.contenuto || 'Condiviso';
    if (d.tipo === 'con_roba') return d.contenuto ? `Con roba: ${d.contenuto}` : 'Con roba';
    return 'Libero';
  }

  unitNumber(unitId: string): number | string {
    return this.units().find((u) => u.id === unitId)?.numero ?? '';
  }

  close(): void {
    this.sel.set('');
  }

  selectDrawer(d: Drawer): void {
    this.error.set('');
    this.dd = { tipo: d.tipo, assegnato_a: d.assegnato_a, contenuto: d.contenuto, tutta: false };
    this.sel.set('d:' + d.id);
  }

  selectUnit(u: DrawerUnit): void {
    this.error.set('');
    this.ud = { numero: u.numero, area: u.area, cassetti: 3 };
    this.sel.set('u:' + u.id);
  }

  newUnit(area = ''): void {
    this.error.set('');
    this.ud = { numero: Math.max(0, ...this.units().map((u) => u.numero)) + 1, area: area || this.areaId(), cassetti: 3 };
    this.sel.set('u:new');
  }

  async saveDrawer(): Promise<void> {
    const d = this.selectedDrawer();
    if (!d || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const person = this.dd.assegnato_a.trim();
    const own = {
      tipo: this.dd.tipo,
      assegnato_a: this.dd.tipo === 'personale' ? person : '',
      contenuto: this.dd.tipo === 'condiviso' || this.dd.tipo === 'con_roba' ? this.dd.contenuto.trim() : '',
    };
    try {
      await this.drawersService.update(d.id, own);
      if (this.dd.tutta && this.dd.tipo === 'personale' && person) {
        const others = this.drawers().filter((x) => x.cassettiera === d.cassettiera && x.id !== d.id);
        await Promise.all(others.map((x) => this.drawersService.update(x.id, { tipo: 'personale', assegnato_a: person, contenuto: '' })));
      } else if (this.dd.tutta && this.dd.tipo === 'con_roba') {
        // Only the free drawers: the ones that belong to someone are left alone.
        const free = this.drawers().filter((x) => x.cassettiera === d.cassettiera && x.id !== d.id && x.tipo === 'libero');
        await Promise.all(free.map((x) => this.drawersService.update(x.id, { tipo: 'con_roba', assegnato_a: '', contenuto: own.contenuto })));
      }
      await this.reload();
      this.dd.tutta = false;
    } catch {
      this.error.set('Impossibile salvare il cassetto.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeDrawer(d: Drawer): Promise<void> {
    const who = d.tipo === 'personale' ? `Assegnato a ${d.assegnato_a || 'una persona'}` : d.tipo === 'condiviso' ? `Contenuto: ${d.contenuto || 'materiale condiviso'}` : d.tipo === 'con_roba' ? `Con roba${d.contenuto ? ': ' + d.contenuto : ''}` : undefined;
    if (!(await this.confirmService.ask({ title: `Eliminare il cassetto ${d.numero}?`, text: who, confirmLabel: 'Elimina cassetto' }))) return;
    try {
      await this.drawersService.remove(d.id);
      this.sel.set('');
      await this.reload();
    } catch {
      this.error.set('Impossibile eliminare il cassetto.');
    }
  }

  async saveUnit(): Promise<void> {
    if (this.saving() || !this.ud.numero) return;
    this.saving.set(true);
    this.error.set('');
    const payload = { numero: Number(this.ud.numero), area: this.ud.area };
    try {
      if (this.sel() === 'u:new') {
        const unit = await this.unitsService.create(payload);
        await this.drawersService.createFree(unit.id, 1, Math.min(Math.max(Number(this.ud.cassetti) || 1, 1), 12));
        this.sel.set('');
      } else {
        await this.unitsService.update(this.sel().slice(2), payload);
      }
      await this.reload();
    } catch {
      this.error.set('Impossibile salvare: il numero potrebbe essere già usato.');
    } finally {
      this.saving.set(false);
    }
  }

  async addDrawer(): Promise<void> {
    const id = this.sel().slice(2);
    if (!id || this.saving()) return;
    this.saving.set(true);
    try {
      const next = Math.max(0, ...this.drawers().filter((d) => d.cassettiera === id).map((d) => d.numero)) + 1;
      await this.drawersService.createFree(id, next, 1);
      await this.reload();
    } catch {
      this.error.set('Impossibile aggiungere il cassetto.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeUnit(): Promise<void> {
    const id = this.sel().slice(2);
    const n = this.drawers().filter((d) => d.cassettiera === id).length;
    if (!id) return;
    const assigned = this.drawers().filter((d) => d.cassettiera === id && d.tipo !== 'libero').length;
    const list = n ? [`${n} ${n === 1 ? 'cassetto' : 'cassetti'}${assigned ? `, di cui ${assigned} ${assigned === 1 ? 'assegnato' : 'assegnati'}` : ''}`] : undefined;
    if (!(await this.confirmService.ask({ title: 'Eliminare la cassettiera?', list, confirmLabel: 'Elimina cassettiera' }))) return;
    try {
      await this.unitsService.remove(id);
      this.sel.set('');
      await this.reload();
    } catch {
      this.error.set('Impossibile eliminare la cassettiera.');
    }
  }

  async createUpTo(): Promise<void> {
    if (this.bulkRunning() || !this.upTo) return;
    this.bulkRunning.set(true);
    try {
      const perUnit = Math.min(Math.max(Number(this.perUnit) || 1, 1), 12);
      await this.unitsService.createUpTo(Math.min(Number(this.upTo), 200), perUnit, this.units(), this.drawersService);
      await this.reload();
    } catch {
      this.error.set('Impossibile creare le cassettiere.');
    } finally {
      this.bulkRunning.set(false);
    }
  }
}
