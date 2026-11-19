import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { MasterDetail } from '../../core/ui/master-detail';
import { BudgetService } from '../../services/budget.service';
import { ConfirmService } from '../../services/confirm.service';
import { PeopleService } from '../../services/people.service';
import { SettingsService } from '../../services/settings.service';
import { ToastService } from '../../services/toast.service';
import { UpdateService } from '../../services/update.service';

type Section = 'generale' | 'notifiche' | 'budget' | 'persone' | 'backup' | 'aggiornamenti' | 'informazioni';

const SECTIONS: { key: Section; label: string; icon: string; color: string }[] = [
  { key: 'generale', label: 'Generale', icon: 'tune', color: '#e3eee7' },
  { key: 'notifiche', label: 'Notifiche', icon: 'notifications', color: '#e6f1fc' },
  { key: 'budget', label: 'Budget', icon: 'savings', color: '#fff0d6' },
  { key: 'persone', label: 'Persone', icon: 'group', color: '#fde7ef' },
  { key: 'backup', label: 'Backup', icon: 'backup', color: '#fbebc8' },
  { key: 'aggiornamenti', label: 'Aggiornamenti', icon: 'system_update', color: '#efe6fa' },
  { key: 'informazioni', label: 'Informazioni', icon: 'info', color: '#efebe3' },
];

/** Settings of the desktop app, as a list of sections with the selected one on the right. Saved automatically. */
@Component({
  selector: 'app-settings',
  imports: [DatePipe, FormsModule, MasterDetail, MatIconModule],
  template: `
    <div class="head">
      <h1>Impostazioni</h1>
      <span class="saved" role="status" aria-live="polite">@if (cfg.saved()) { ✓ Salvato }</span>
    </div>

    @if (!cfg.available) {
      <p class="muted">Le impostazioni sono disponibili solo nell'app per Windows.</p>
    } @else if (cfg.settings(); as s) {
      <app-master-detail listLabel="Sezioni" detailLabel="Impostazioni">
        <div list>
          @for (x of sections; track x.key) {
            <button type="button" class="md-item" [class.sel]="section() === x.key" (click)="select(x.key)" [attr.aria-current]="section() === x.key ? 'page' : null">
              <span class="ico" [style.background]="x.color"><mat-icon aria-hidden="true">{{ x.icon }}</mat-icon></span>
              <span class="grow"><span class="t">{{ x.label }}</span><span class="s">{{ status(x.key) }}</span></span>
              @if (x.key === 'backup' && cfg.backupStale()) { <span class="attention" aria-label="Richiede attenzione"></span> }
            </button>
          }
        </div>

        <div detail>
          @switch (section()) {
            @case ('generale') {
              <h2>Generale</h2>
              <label class="field">
                <span class="lab">Il tuo nome</span>
                <input name="nome" [ngModel]="s.userName" (ngModelChange)="cfg.update({ userName: $event })" placeholder="Es. Andrea" maxlength="40" />
                <span class="hint">Compare nel saluto della pagina Oggi («Buongiorno Andrea»).</span>
              </label>
              <label class="row">
                <span class="txt"><strong>Avvia con Windows</strong><span class="hint">{{ s.canAutoStart ? "L'app parte da sola e resta nella tray." : "Funziona solo nell'app installata." }}</span></span>
                <input type="checkbox" role="switch" class="switch" [checked]="s.openAtLogin" [disabled]="!s.canAutoStart" (change)="cfg.update({ openAtLogin: on($event) })" />
              </label>
              <label class="row">
                <span class="txt"><strong>Chiudendo la finestra resta attiva</strong><span class="hint">Rimane nella tray (vicino all'orologio) e ti ricorda i controlli. Spenta, chiudere la finestra chiude l'app.</span></span>
                <input type="checkbox" role="switch" class="switch" [checked]="s.keepInTray" (change)="cfg.update({ keepInTray: on($event) })" />
              </label>
            }
            @case ('notifiche') {
              <h2>Notifiche</h2>
              <label class="row">
                <span class="txt"><strong>Ricordami i controlli da fare</strong><span class="hint">Una notifica di Windows quando ci sono controlli di oggi o in ritardo. All'avvio dell'app ne vedi comunque una.</span></span>
                <input type="checkbox" role="switch" class="switch" [checked]="s.remindersEnabled" (change)="cfg.update({ remindersEnabled: on($event) })" />
              </label>
              <label class="row" [class.off]="!s.remindersEnabled">
                <span class="txt"><strong>Anche il giorno prima</strong><span class="hint">La notifica dice anche quanti controlli scadono domani.</span></span>
                <input type="checkbox" role="switch" class="switch" [checked]="s.remindDayBefore" [disabled]="!s.remindersEnabled" (change)="cfg.update({ remindDayBefore: on($event) })" />
              </label>
              <label class="row" [class.off]="!s.remindersEnabled">
                <span class="txt"><strong>Richieste ferme</strong><span class="hint">La notifica avverte se ci sono richieste aperte senza novità da troppo tempo.</span></span>
                <input type="checkbox" role="switch" class="switch" [checked]="s.staleRequestsEnabled" [disabled]="!s.remindersEnabled" (change)="cfg.update({ staleRequestsEnabled: on($event) })" />
              </label>
              @if (s.staleRequestsEnabled && s.remindersEnabled) {
                <label class="field">
                  <span class="lab">Ferme da più di (giorni)</span>
                  <input type="number" min="1" max="60" name="giorni" [ngModel]="s.staleRequestsDays" (ngModelChange)="cfg.update({ staleRequestsDays: +$event || 7 })" />
                </label>
              }
              <label class="field" [class.off]="!s.remindersEnabled">
                <span class="lab">Dall'ora</span>
                <select name="ora" [disabled]="!s.remindersEnabled" [ngModel]="s.reminderHour" (ngModelChange)="cfg.update({ reminderHour: +$event })">
                  @for (h of hours; track h) { <option [ngValue]="h">{{ h < 10 ? '0' + h : h }}:00</option> }
                </select>
                <span class="hint">Il promemoria del giorno arriva una volta sola, da quest'ora in poi.</span>
              </label>
            }
            @case ('budget') {
              <h2>Budget</h2>
              <p class="hint">Un budget annuale per gli acquisti, facoltativo. Se lo imposti, le barre di Acquisti e di Oggi confrontano la spesa con questo importo; se lo lasci vuoto restano come oggi, con la somma delle stime.</p>
              <label class="field">
                <span class="lab">Budget annuale (€)</span>
                <input type="number" min="0" step="50" name="budget" [ngModel]="budgetAnnual" (ngModelChange)="budgetAnnual = $event; saveBudget()" placeholder="Nessun budget" />
              </label>
              <label class="field">
                <span class="lab">L'anno di budget inizia a</span>
                <select name="mese" [ngModel]="budgetMonth" (ngModelChange)="budgetMonth = +$event; saveBudget()">
                  @for (m of months; track m.value) { <option [ngValue]="m.value">{{ m.label }}</option> }
                </select>
                <span class="hint">Anno corrente: dal {{ yearStartLabel() }}. Il «speso» conta gli acquisti pagati da quel giorno.</span>
              </label>
            }
            @case ('persone') {
              <h2>Persone</h2>
              <p class="hint">I colleghi che vuoi ritrovare nei suggerimenti di «A chi» (cassetti) e «Richiedente» (richieste). Puoi sempre scrivere anche un altro nome: i nomi già inseriti restano.</p>
              <form class="addrow" (ngSubmit)="addPerson()">
                <input name="nuova" [(ngModel)]="newPerson" placeholder="Nome del collega" aria-label="Nome del collega" maxlength="60" />
                <button type="submit" class="btn btn-primary" [disabled]="!newPerson.trim()">Aggiungi</button>
              </form>
              @if (peopleError()) { <p class="err" role="alert">{{ peopleError() }}</p> }
              <ul class="people">
                @for (p of people.people(); track p.id) {
                  <li>
                    @if (renamingId() === p.id) {
                      <input name="rinomina" [(ngModel)]="renameTo" aria-label="Nuovo nome" (keyup.enter)="saveRename(p.id)" (keyup.escape)="renamingId.set('')" />
                      <button type="button" class="btn btn-primary" (click)="saveRename(p.id)">Salva</button>
                      <button type="button" class="btn btn-ghost" (click)="renamingId.set('')">Annulla</button>
                    } @else {
                      <span class="pname">{{ p.nome }}</span>
                      <button type="button" class="btn btn-ghost" (click)="startRename(p.id, p.nome)">Rinomina</button>
                      <button type="button" class="btn btn-ghost btn-danger-text" (click)="removePerson(p.id, p.nome)">Elimina</button>
                    }
                  </li>
                } @empty {
                  <li class="muted">Nessuna persona in elenco.</li>
                }
              </ul>
            }
            @case ('backup') {
              <h2>Backup</h2>
              @if (cfg.backupStale()) {
                <div class="warn" role="status">
                  <span>{{ cfg.daysSinceBackup() === null ? 'Non hai ancora fatto nessun backup.' : "L'ultimo backup è di " + cfg.daysSinceBackup() + ' giorni fa.' }}</span>
                  <button type="button" class="btn btn-primary" (click)="cfg.backupNow()" [disabled]="cfg.backupBusy()">Fai un backup ora</button>
                </div>
              }
              <div class="field">
                <span class="lab">Cartella dei backup</span>
                <span class="path">{{ s.backupFolder }}</span>
                <span class="btns">
                  <button type="button" class="btn btn-outline" (click)="cfg.chooseBackupFolder()">Cambia…</button>
                  <button type="button" class="btn btn-ghost" (click)="cfg.openFolder('backup')">Apri</button>
                </span>
              </div>
              @if (!cfg.backupStale()) {
                <div><button type="button" class="btn btn-primary" (click)="cfg.backupNow()" [disabled]="cfg.backupBusy()">Fai un backup ora</button></div>
              }
              <label class="row">
                <span class="txt"><strong>Backup automatico</strong><span class="hint">Una volta a settimana, nel giorno e all'ora scelti. Se il PC è spento a quell'ora, lo fa alla prossima accensione.</span></span>
                <input type="checkbox" role="switch" class="switch" [checked]="s.autoBackup" (change)="cfg.update({ autoBackup: on($event) })" />
              </label>
              @if (s.autoBackup) {
                <div class="trio">
                  <label class="field"><span class="lab">Giorno</span>
                    <select name="giorno" [ngModel]="s.autoBackupDay" (ngModelChange)="cfg.update({ autoBackupDay: +$event })">
                      @for (d of weekdays; track d.value) { <option [ngValue]="d.value">{{ d.label }}</option> }
                    </select>
                  </label>
                  <label class="field"><span class="lab">Ora</span>
                    <select name="oraback" [ngModel]="s.autoBackupHour" (ngModelChange)="cfg.update({ autoBackupHour: +$event })">
                      @for (h of hours; track h) { <option [ngValue]="h">{{ h < 10 ? '0' + h : h }}:00</option> }
                    </select>
                  </label>
                  <label class="field"><span class="lab">Quanti tenerne</span>
                    <input type="number" min="1" max="52" name="tenere" [ngModel]="s.autoBackupKeep" (ngModelChange)="cfg.update({ autoBackupKeep: +$event || 8 })" />
                  </label>
                </div>
                <p class="hint">Dei backup automatici tengo gli ultimi {{ s.autoBackupKeep }}: i più vecchi vengono cancellati. I backup manuali non si cancellano mai.</p>
              }
              <p class="hint">Durante il backup l'app si ferma per qualche secondo, poi riparte da sola. Ogni backup è una cartella con tutti i dati.</p>
              <h3>Backup fatti</h3>
              @if (cfg.backups().length) {
                <table>
                  <thead><tr><th>Data</th><th>Dimensione</th><th>Tipo</th><th></th></tr></thead>
                  <tbody>
                    @for (b of cfg.backups(); track b.path) {
                      <tr><td>{{ b.when | date: 'd MMM y, HH:mm' }}</td><td>{{ size(b.size) }}</td><td>{{ kindLabel(b.kind) }}</td><td class="act"><button type="button" class="btn btn-ghost" (click)="restore(b.path, b.when)" [attr.aria-label]="'Ripristina il backup del ' + (b.when | date: 'd MMM y, HH:mm')">Ripristina…</button></td></tr>
                    }
                  </tbody>
                </table>
              } @else {
                <p class="muted">Nessun backup in questa cartella.</p>
              }
              <div class="danger-zone">
                <h3>Ripristino</h3>
                <p class="hint">Sostituisce tutti i dati di adesso con quelli di un backup. Prima l'app fa una copia di sicurezza dei dati attuali.</p>
                <button type="button" class="btn btn-outline btn-danger-text" (click)="restoreFromFolder()">Ripristina da un'altra cartella…</button>
              </div>
            }
            @case ('aggiornamenti') {
              <h2>Aggiornamenti</h2>
              <div class="field">
                <span class="lab">Versione attuale</span>
                <span class="big">{{ s.version }} <span class="chip" [class.ok]="up.state().status === 'none'" [class.warn]="up.state().status === 'available' || up.state().status === 'ready'">{{ updateChip() }}</span></span>
                <span class="hint">{{ lastCheck() }}</span>
              </div>
              <div class="btns">
                <button type="button" class="btn btn-outline" (click)="up.check()" [disabled]="up.state().status === 'checking' || up.state().status === 'downloading'">Controlla ora</button>
                @if (up.state().status === 'available') { <button type="button" class="btn btn-primary" (click)="up.download()">Aggiorna alla {{ up.state().version }}</button> }
                @if (up.state().status === 'ready') { <button type="button" class="btn btn-primary" (click)="up.install()">Riavvia e installa</button> }
              </div>
              <label class="row">
                <span class="txt"><strong>Cerca da solo</strong><span class="hint">All'avvio e ogni 6 ore. Se è spento, controlli tu con «Controlla ora».</span></span>
                <input type="checkbox" role="switch" class="switch" [checked]="s.autoUpdateCheck" (change)="cfg.update({ autoUpdateCheck: on($event) })" />
              </label>
            }
            @case ('informazioni') {
              <h2>Informazioni</h2>
              <div class="field"><span class="lab">Versione</span><span class="big">Workspace Care {{ s.version }}</span></div>
              <div class="field">
                <span class="lab">Cartella dei dati</span>
                <span class="path">{{ s.dataDir }}</span>
                <span class="btns"><button type="button" class="btn btn-outline" (click)="cfg.openFolder('data')">Apri</button></span>
                <span class="hint">Qui stanno i tuoi dati. Per spostarli su un altro PC usa un backup.</span>
              </div>
            }
          }
        </div>
      </app-master-detail>
    } @else {
      <p class="muted">Caricamento…</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 18px; font-family: Inter, system-ui, sans-serif; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h1 { margin: 0; font: 800 30px 'Plus Jakarta Sans', Inter, sans-serif; }
    h2 { margin: 0; font: 800 22px 'Plus Jakarta Sans', Inter, sans-serif; }
    h3 { margin: 6px 0 0; font-size: 14px; }
    .saved { min-height: 22px; padding: 2px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; color: #245a41; }
    .saved:not(:empty) { background: #e3eee7; }
    .muted { margin: 0; color: #55584f; }
    .md-item .ico { width: 40px; height: 40px; flex: none; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: #22241f; }
    .attention { width: 10px; height: 10px; border-radius: 999px; background: #e8850c; flex: none; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field.off { opacity: .55; }
    .lab { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #45473f; }
    .hint { font-size: 13px; color: #55584f; line-height: 1.4; }
    input:not([type='checkbox']), select { height: 44px; max-width: 360px; padding: 0 12px; border: 1px solid #cfc9bb; border-radius: 12px; font: 15px Inter, system-ui, sans-serif; background: #fff; }
    input:focus-visible, select:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid #efebe3; cursor: pointer; }
    .txt { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .switch { appearance: none; flex: none; width: 48px; height: 28px; border-radius: 999px; background: #cfc9bb; position: relative; cursor: pointer; transition: background .15s; }
    .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 999px; background: #fff; transition: transform .15s; }
    .switch:checked { background: #2e6a4f; }
    .switch:checked::after { transform: translateX(20px); }
    .switch:disabled { opacity: .5; cursor: default; }
    .switch:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .warn { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 16px; background: #fdf5e4; border: 1px solid #ecd9a6; color: #5c3f00; font-size: 14px; font-weight: 600; }
    .path { padding: 10px 12px; border-radius: 12px; background: #f6f2ea; font: 13px ui-monospace, Consolas, monospace; overflow-wrap: anywhere; }
    .addrow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .err { margin: 0; color: #b42318; font-size: 14px; }
    .people { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .people li { display: flex; align-items: center; gap: 6px; padding: 8px 0; border-top: 1px solid #efebe3; flex-wrap: wrap; }
    .people .pname { flex: 1; min-width: 120px; font-size: 15px; }
    .danger-zone { margin-top: 12px; padding-top: 16px; border-top: 1px solid #efebe3; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .act { text-align: right; }
    .trio { display: flex; gap: 12px; flex-wrap: wrap; }
    .trio input, .trio select { width: 150px; }
    .btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .big { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #efebe3; }
    th { font-size: 12px; color: #45473f; }
    @media (max-width: 800px) { h1 { font-size: 26px; } }
  `,
})
export class Settings implements OnInit {
  readonly cfg = inject(SettingsService);
  readonly budget = inject(BudgetService);
  budgetAnnual: number | null = null;
  budgetMonth = 1;
  private budgetTimer: ReturnType<typeof setTimeout> | undefined;
  readonly months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'].map((label, i) => ({ value: i + 1, label }));
  readonly people = inject(PeopleService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  newPerson = '';
  readonly renamingId = signal('');
  renameTo = '';
  readonly peopleError = signal('');
  readonly up = inject(UpdateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly sections = SECTIONS;
  readonly weekdays = [
    { value: 1, label: 'Lunedì' }, { value: 2, label: 'Martedì' }, { value: 3, label: 'Mercoledì' }, { value: 4, label: 'Giovedì' },
    { value: 5, label: 'Venerdì' }, { value: 6, label: 'Sabato' }, { value: 0, label: 'Domenica' },
  ];
  readonly hours = Array.from({ length: 24 }, (_, h) => h);
  private readonly requested = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('sezione'))), {
    initialValue: this.route.snapshot.queryParamMap.get('sezione'),
  });
  readonly section = computed<Section>(() => (SECTIONS.some((s) => s.key === this.requested()) ? (this.requested() as Section) : 'generale'));

  ngOnInit(): void {
    void this.cfg.init();
    void this.cfg.loadSettings();
    void this.cfg.refreshBackups();
    void this.people.load();
    void this.budget.load().then(() => {
      this.budgetAnnual = this.budget.annual();
      this.budgetMonth = this.budget.startMonth();
    });
  }

  /** Saved a moment after the last change (the field is typed digit by digit). */
  saveBudget(): void {
    clearTimeout(this.budgetTimer);
    this.budgetTimer = setTimeout(async () => {
      const amount = this.budgetAnnual === null || this.budgetAnnual === ('' as unknown) ? null : Number(this.budgetAnnual);
      await this.budget.save(amount, this.budgetMonth);
      this.cfg.flashSaved();
    }, 600);
  }

  yearStartLabel(): string {
    const [y, m] = this.budget.yearStart().split('-');
    return `1 ${this.months[Number(m) - 1].label} ${y}`;
  }

  async addPerson(): Promise<void> {
    this.peopleError.set('');
    const name = this.newPerson.trim();
    if (!name) return;
    try {
      await this.people.create(name);
      this.newPerson = '';
    } catch {
      this.peopleError.set(`«${name}» è già nell'elenco.`);
    }
  }

  startRename(id: string, name: string): void {
    this.renamingId.set(id);
    this.renameTo = name;
    this.peopleError.set('');
  }

  async saveRename(id: string): Promise<void> {
    const name = this.renameTo.trim();
    if (!name) return;
    try {
      await this.people.rename(id, name);
      this.renamingId.set('');
    } catch {
      this.peopleError.set(`«${name}» è già nell'elenco.`);
    }
  }

  async removePerson(id: string, name: string): Promise<void> {
    const ok = await this.confirmService.ask({
      title: `Togliere «${name}» dall'elenco?`,
      text: 'I cassetti e le richieste che portano già questo nome non cambiano.',
      confirmLabel: 'Togli dall\'elenco',
    });
    if (ok) await this.people.remove(id);
  }

  select(key: Section): void {
    void this.router.navigate([], { queryParams: { sezione: key }, queryParamsHandling: 'merge' });
  }

  on(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  /** Asks for confirmation (red box in the panel), then replaces the data with the backup. */
  async restore(source: string, when: number): Promise<void> {
    const date = new Date(when).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const ok = await this.confirmService.ask({
      title: 'Ripristinare questo backup?',
      text: `Tutti i dati di adesso vengono sostituiti con quelli del backup del ${date}. Prima l'app ne fa una copia di sicurezza, ma le modifiche fatte dopo quel backup non ci saranno più.`,
      confirmLabel: 'Ripristina',
    });
    if (!ok) return;
    const res = await this.cfg.restore(source);
    if (res && !res.ok && res.message) this.toast.error('Ripristino non riuscito', { text: res.message });
  }

  async restoreFromFolder(): Promise<void> {
    const chosen = await window.workspaceCare?.chooseRestoreFolder?.();
    if (!chosen) return;
    if (chosen.error || !chosen.path) {
      this.toast.error('Backup non valido', { text: chosen.error });
      return;
    }
    await this.restore(chosen.path, Date.now());
  }

  kindLabel(kind: string): string {
    return kind === 'auto' ? 'Automatico' : kind === 'sicurezza' ? 'Di sicurezza' : 'Manuale';
  }

  size(bytes: number): string {
    return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  /** The second line of each item of the list. */
  status(key: Section): string {
    const s = this.cfg.settings();
    if (!s) return '';
    switch (key) {
      case 'generale':
        return `${s.openAtLogin ? 'Parte con Windows' : 'Non parte con Windows'} · ${s.keepInTray ? 'resta attiva' : 'si chiude'}`;
      case 'notifiche':
        return s.remindersEnabled ? `Controlli dalle ${String(s.reminderHour).padStart(2, '0')}:00` : 'Spente';
      case 'budget': {
        const a = this.budget.annual();
        return a ? `${a.toLocaleString('it-IT')} € all'anno` : 'Non impostato';
      }
      case 'persone': {
        const n = this.people.people().length;
        return n === 0 ? 'Nessuna persona' : n === 1 ? '1 persona' : `${n} persone`;
      }
      case 'backup': {
        const d = this.cfg.daysSinceBackup();
        return d === null ? 'Nessun backup' : d === 0 ? 'Ultimo: oggi' : d === 1 ? 'Ultimo: ieri' : `Ultimo: ${d} giorni fa`;
      }
      case 'aggiornamenti':
        return this.up.state().status === 'available' || this.up.state().status === 'ready' ? `Disponibile ${this.up.state().version}` : `Versione ${s.version}`;
      default:
        return `Versione ${s.version}`;
    }
  }

  updateChip(): string {
    switch (this.up.state().status) {
      case 'checking': return 'Controllo…';
      case 'available': return `Disponibile ${this.up.state().version}`;
      case 'downloading': return 'Scarico…';
      case 'ready': return 'Pronta da installare';
      case 'none': return 'È la più recente';
      default: return 'Non ancora controllato';
    }
  }

  lastCheck(): string {
    const t = this.up.state().lastCheck;
    if (!t) return 'Il controllo parte all\'avvio e ogni 6 ore.';
    return 'Ultimo controllo: ' + new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
