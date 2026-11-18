import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { PocketBaseService } from '../../core/pocketbase.service';
import { Area, IDEA_CATEGORIES, IDEA_PRIORITIES, IDEA_STATUSES, Idea, IdeaLink } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { IdeaLinksService } from '../../services/idea-links.service';
import { IdeasService } from '../../services/ideas.service';

@Component({
  selector: 'app-idea-detail',
  imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    @if (idea(); as i) {
      <a routerLink="/idee" class="back"><mat-icon>arrow_back</mat-icon> Idee</a>
      <div class="head">
        <input class="title" [(ngModel)]="i.titolo" (blur)="save({ titolo: i.titolo })" aria-label="Titolo" />
        <button mat-flat-button [disabled]="i.stato === 'fatta'" (click)="save({ stato: 'fatta' })"><mat-icon>check</mat-icon> Segna come fatta</button>
        <button mat-stroked-button disabled title="Disponibile nella fase 3"><mat-icon>shopping_cart</mat-icon> Converti in acquisto</button>
        <button mat-icon-button (click)="remove()" aria-label="Elimina idea"><mat-icon>delete</mat-icon></button>
      </div>

      <div class="fields">
        <mat-form-field>
          <mat-label>Area</mat-label>
          <mat-select [(ngModel)]="i.area" (selectionChange)="save({ area: i.area })">
            <mat-option value="">(nessuna)</mat-option>
            @for (a of areas(); track a.id) { <mat-option [value]="a.id">{{ a.nome }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Categoria</mat-label>
          <mat-select [(ngModel)]="i.categoria" (selectionChange)="save({ categoria: i.categoria })">
            <mat-option value="">(nessuna)</mat-option>
            @for (c of categories; track c.value) { <mat-option [value]="c.value">{{ c.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Stato</mat-label>
          <mat-select [(ngModel)]="i.stato" (selectionChange)="save({ stato: i.stato })">
            @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Priorità</mat-label>
          <mat-select [(ngModel)]="i.priorita" (selectionChange)="save({ priorita: i.priorita })">
            <mat-option value="">(nessuna)</mat-option>
            @for (p of priorities; track p.value) { <mat-option [value]="p.value">{{ p.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Costo min (€)</mat-label>
          <input matInput type="number" min="0" [(ngModel)]="i.costo_min" (blur)="save({ costo_min: i.costo_min || 0 })" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Costo max (€)</mat-label>
          <input matInput type="number" min="0" [(ngModel)]="i.costo_max" (blur)="save({ costo_max: i.costo_max || 0 })" />
        </mat-form-field>
      </div>

      <mat-form-field class="full">
        <mat-label>Descrizione</mat-label>
        <textarea matInput rows="3" [(ngModel)]="i.descrizione" (blur)="save({ descrizione: i.descrizione })"></textarea>
      </mat-form-field>
      <mat-form-field class="full">
        <mat-label>Note</mat-label>
        <textarea matInput rows="3" [(ngModel)]="i.note" (blur)="save({ note: i.note })"></textarea>
      </mat-form-field>

      <h3>Link</h3>
      <form class="add" (ngSubmit)="addLink()">
        <mat-form-field class="grow">
          <mat-label>Incolla un link (https://…)</mat-label>
          <input matInput name="url" [(ngModel)]="newUrl" />
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="!newUrl.trim() || addingLink()"><mat-icon>add</mat-icon> Aggiungi</button>
      </form>
      <div class="links">
        @for (l of links(); track l.id) {
          <div class="link">
            @if (l.immagine) {
              <img [src]="imageUrl(l)" [alt]="l.titolo" />
            } @else {
              <div class="noimg">Nessuna immagine</div>
            }
            <div class="info">
              <a [href]="l.url" target="_blank" rel="noopener"><strong>{{ l.titolo || l.url }}</strong></a>
              <small class="muted">{{ l.sito }}</small>
              @if (l.prezzo) { <span>{{ l.prezzo }}</span> }
              <span class="chip" [class.ok]="l.stato_anteprima === 'ok'" [class.bad]="l.stato_anteprima === 'fallita'" [class.warn]="l.stato_anteprima === 'parziale'">
                anteprima: {{ l.stato_anteprima || 'in attesa' }}
              </span>
              @if (l.stato_anteprima !== 'ok') {
                <div class="fallback">
                  <input placeholder="URL immagine" [(ngModel)]="imageUrls[l.id]" />
                  <button mat-icon-button (click)="setImageUrl(l)" aria-label="Usa questo URL"><mat-icon>check</mat-icon></button>
                  <label class="upload"><mat-icon>upload</mat-icon> Screenshot
                    <input type="file" accept="image/*" hidden (change)="uploadImage(l, $event)" />
                  </label>
                </div>
              }
              <button mat-button (click)="removeLink(l)"><mat-icon>delete</mat-icon> Rimuovi</button>
            </div>
          </div>
        } @empty {
          <p class="muted">Nessun link. Aggiungine uno per vedere l'anteprima.</p>
        }
      </div>

      <h3>Foto</h3>
      <div class="photos">
        @for (f of i.foto; track f) {
          <div class="photo">
            <img [src]="photoUrl(i, f)" alt="" />
            <button mat-mini-fab (click)="removePhoto(f)" aria-label="Rimuovi foto"><mat-icon>close</mat-icon></button>
          </div>
        }
        <label class="upload"><mat-icon>upload</mat-icon> Aggiungi foto
          <input type="file" accept="image/*" multiple hidden (change)="addPhotos($event)" />
        </label>
      </div>
    } @else {
      <p>Caricamento…</p>
    }
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: .25rem; color: var(--mat-sys-on-surface-variant); text-decoration: none; }
    .head { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin: .75rem 0 1rem; }
    .title { flex: 1; min-width: 200px; font: inherit; font-size: 1.4rem; font-weight: 600; padding: .4rem .6rem; border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; background: transparent; color: inherit; }
    .fields { display: flex; flex-wrap: wrap; gap: .75rem; margin-bottom: .75rem; }
    .full { width: 100%; }
    .add { display: flex; gap: .5rem; align-items: center; }
    .grow { flex: 1; }
    .links { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .link { border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; overflow: hidden; background: var(--mat-sys-surface-container-lowest); }
    .link img, .noimg { width: 100%; height: 180px; object-fit: cover; display: grid; place-items: center; background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface-variant); }
    .info { padding: .75rem; display: flex; flex-direction: column; gap: .4rem; align-items: flex-start; }
    .fallback { display: flex; gap: .25rem; flex-wrap: wrap; align-items: center; }
    .fallback input { padding: .4rem; font: inherit; }
    .upload { cursor: pointer; color: var(--mat-sys-primary); display: inline-flex; gap: .3rem; align-items: center; }
    .photos { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }
    .photo { position: relative; }
    .photo img { height: 120px; border-radius: 8px; }
    .photo button { position: absolute; top: 4px; right: 4px; transform: scale(.7); }
  `,
})
export class IdeaDetail implements OnInit {
  private readonly ideas = inject(IdeasService);
  private readonly linksService = inject(IdeaLinksService);
  private readonly areasService = inject(AreasService);
  private readonly pb = inject(PocketBaseService);
  private readonly router = inject(Router);

  readonly id = input.required<string>(); // bound from the route param (withComponentInputBinding)
  readonly idea = signal<Idea | null>(null);
  readonly links = signal<IdeaLink[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly addingLink = signal(false);

  readonly categories = IDEA_CATEGORIES;
  readonly statuses = IDEA_STATUSES;
  readonly priorities = IDEA_PRIORITIES;
  newUrl = '';
  imageUrls: Record<string, string> = {};

  async ngOnInit(): Promise<void> {
    const [idea, links, areas] = await Promise.all([
      this.ideas.get(this.id()),
      this.linksService.listByIdea(this.id()),
      this.areasService.list(),
    ]);
    this.idea.set(idea);
    this.links.set(links);
    this.areas.set(areas);
  }

  async save(data: Partial<Idea>): Promise<void> {
    const current = this.idea();
    if (!current) return;
    const updated = await this.ideas.update(current.id, data);
    Object.assign(current, { stato: updated.stato, expand: updated.expand });
    this.idea.set({ ...current });
  }

  async remove(): Promise<void> {
    if (!confirm('Eliminare questa idea e i suoi link?')) return;
    await this.ideas.remove(this.id());
    await this.router.navigateByUrl('/idee');
  }

  imageUrl(l: IdeaLink): string {
    return this.linksService.imageUrl(l);
  }

  photoUrl(idea: Idea, file: string): string {
    return this.pb.fileUrl(idea, file, '300x200');
  }

  async addLink(): Promise<void> {
    this.addingLink.set(true);
    try {
      const link = await this.linksService.create(this.id(), this.newUrl.trim());
      // The hook fills the preview during create, so the returned record is already complete.
      this.links.update((l) => [...l, link]);
      this.newUrl = '';
    } catch {
      alert('Link non valido o non salvato.');
    } finally {
      this.addingLink.set(false);
    }
  }

  async removeLink(l: IdeaLink): Promise<void> {
    await this.linksService.remove(l.id);
    this.links.update((list) => list.filter((x) => x.id !== l.id));
  }

  async setImageUrl(l: IdeaLink): Promise<void> {
    const url = (this.imageUrls[l.id] ?? '').trim();
    if (!url) return;
    // The server downloads the image when immagine_url changes.
    const updated = await this.linksService.update(l.id, { immagine_url: url });
    this.links.update((list) => list.map((x) => (x.id === l.id ? updated : x)));
  }

  async uploadImage(l: IdeaLink, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('immagine', file);
    form.append('stato_anteprima', 'parziale');
    const updated = await this.linksService.update(l.id, form);
    this.links.update((list) => list.map((x) => (x.id === l.id ? updated : x)));
  }

  async addPhotos(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if (!files?.length) return;
    const form = new FormData();
    for (const f of Array.from(files)) form.append('foto+', f);
    const updated = await this.ideas.update(this.id(), form);
    this.idea.update((i) => (i ? { ...i, foto: updated.foto } : i));
  }

  async removePhoto(file: string): Promise<void> {
    const updated = await this.ideas.update(this.id(), { 'foto-': file } as unknown as Partial<Idea>);
    this.idea.update((i) => (i ? { ...i, foto: updated.foto } : i));
  }
}
