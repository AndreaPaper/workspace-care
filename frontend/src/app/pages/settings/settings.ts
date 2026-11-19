import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { MasterDetail } from '../../core/ui/master-detail';
import { SettingsService } from '../../services/settings.service';
import { UpdateService } from '../../services/update.service';

type Section = 'generale' | 'notifiche' | 'backup' | 'aggiornamenti' | 'informazioni';

const SECTIONS: { key: Section; label: string; icon: string; color: string }[] = [
  { key: 'generale', label: 'Generale', icon: 'tune', color: '#e3eee7' },
  { key: 'notifiche', label: 'Notifiche', icon: 'notifications', color: '#e6f1fc' },
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
              <label class="field" [class.off]="!s.remindersEnabled">
                <span class="lab">Dall'ora</span>
                <select name="ora" [disabled]="!s.remindersEnabled" [ngModel]="s.reminderHour" (ngModelChange)="cfg.update({ reminderHour: +$event })">
                  @for (h of hours; track h) { <option [ngValue]="h">{{ h < 10 ? '0' + h : h }}:00</option> }
                </select>
                <span class="hint">Il promemoria del giorno arriva una volta sola, da quest'ora in poi.</span>
              </label>
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
              <p class="hint">Durante il backup l'app si ferma per qualche secondo, poi riparte da sola. Ogni backup è una cartella con tutti i dati.</p>
              <h3>Backup fatti</h3>
              @if (cfg.backups().length) {
                <table>
                  <thead><tr><th>Data</th><th>Dimensione</th><th>Tipo</th></tr></thead>
                  <tbody>
                    @for (b of cfg.backups(); track b.path) {
                      <tr><td>{{ b.when | date: 'd MMM y, HH:mm' }}</td><td>{{ size(b.size) }}</td><td>Manuale</td></tr>
                    }
                  </tbody>
                </table>
              } @else {
                <p class="muted">Nessun backup in questa cartella.</p>
              }
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
  readonly up = inject(UpdateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly sections = SECTIONS;
  readonly hours = Array.from({ length: 24 }, (_, h) => h);
  private readonly requested = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('sezione'))), {
    initialValue: this.route.snapshot.queryParamMap.get('sezione'),
  });
  readonly section = computed<Section>(() => (SECTIONS.some((s) => s.key === this.requested()) ? (this.requested() as Section) : 'generale'));

  ngOnInit(): void {
    void this.cfg.init();
    void this.cfg.loadSettings();
    void this.cfg.refreshBackups();
  }

  select(key: Section): void {
    void this.router.navigate([], { queryParams: { sezione: key }, queryParamsHandling: 'merge' });
  }

  on(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
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
