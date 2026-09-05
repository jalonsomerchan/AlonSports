import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ActivityLabel, ApiService } from './app';

@Component({
  selector: 'app-labels',
  imports: [FormsModule, RouterLink, MatIconModule],
  template: `<section class="page labels-page"><div class="back-row"><a routerLink="/app/more"><mat-icon>arrow_back</mat-icon> Más</a><span class="api-badge">ETIQUETAS</span></div><div class="page-heading"><div><p class="eyebrow">ORGANIZA TUS SALIDAS</p><h1>Etiquetas</h1><p class="muted">Crea etiquetas con color e icono, asígnalas a tus actividades y encuéntralas de un vistazo.</p></div><button class="round-button" type="button" (click)="startNew()" aria-label="Crear etiqueta"><mat-icon>add</mat-icon></button></div>@if (error()) { <p class="api-error">{{ error() }}</p> }<article class="form-card label-editor"><div class="section-heading compact"><div><p class="eyebrow">{{ editingId === null ? 'NUEVA ETIQUETA' : 'EDITAR ETIQUETA' }}</p><h2>{{ editingId === null ? 'Crea una categoría propia' : 'Actualiza esta etiqueta' }}</h2></div>@if (editingId !== null) { <button class="text-button" type="button" (click)="startNew()">Cancelar</button> }</div><div class="two-fields"><label>Nombre<input [(ngModel)]="draft.name" maxlength="60" placeholder="Series, montaña, recuperación…" /></label><label>Color<input class="color-input" type="color" [(ngModel)]="draft.color" /></label></div><label>Icono Lucide<input [(ngModel)]="draft.icon" list="label-icon-options" maxlength="32" placeholder="timer, terrain, bolt…" /><datalist id="label-icon-options">@for (icon of iconOptions(); track icon) { <option [value]="icon"></option> }</datalist></label><p class="muted label-editor-hint">El icono debe pertenecer a la biblioteca disponible. Déjalo vacío si prefieres mostrar solo el color.</p><button class="primary-button full" type="button" (click)="save()" [disabled]="saving()">{{ saving() ? 'Guardando…' : editingId === null ? 'Crear etiqueta' : 'Guardar cambios' }} <mat-icon>{{ saving() ? 'sync' : 'save' }}</mat-icon></button>@if (message()) { <p class="success-message">{{ message() }}</p> }</article><div class="section-heading compact labels-heading"><div><p class="eyebrow">TU COLECCIÓN</p><h2>{{ labels().length }} etiquetas</h2></div><label class="label-search">Buscar icono<input [(ngModel)]="iconSearch" placeholder="timer" /></label></div><div class="labels-list">@for (label of labels(); track label.id) { <article class="label-card" [style.--label-color]="label.color || '#c9f45b'"><div class="label-card-preview"><span class="label-color-dot"><mat-icon>{{ label.icon || 'label' }}</mat-icon></span><div><h3>{{ label.name }}</h3><p>{{ label.activity_count ?? 0 }} {{ (label.activity_count ?? 0) === 1 ? 'actividad asignada' : 'actividades asignadas' }}</p></div></div><div class="label-card-actions"><button class="text-button" type="button" (click)="edit(label)"><mat-icon>edit</mat-icon> Editar</button><button class="text-button danger-text" type="button" (click)="remove(label)"><mat-icon>delete_outline</mat-icon> Borrar</button></div></article> } @empty { <div class="empty-state"><mat-icon>sell</mat-icon><p>Aún no tienes etiquetas. Crea la primera para organizar tus salidas.</p></div> }</div></section>`,
  styles: [`
    .labels-page{max-width:900px}.label-editor{margin-top:4px}.label-editor .section-heading{margin-top:0}.color-input{height:42px;padding:5px!important;cursor:pointer}.label-editor-hint{margin:10px 0 18px;font-size:11px}.labels-heading{align-items:center}.label-search{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:10px}.label-search input{width:150px;margin:0;border:1px solid var(--line);color:var(--ink);background:#11150f;border-radius:9px;padding:9px 10px;outline:0;font-size:11px}.labels-list{display:grid;gap:10px}.label-card{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px;background:var(--panel);border:1px solid var(--line);border-radius:14px}.label-card-preview{display:flex;align-items:center;gap:12px;min-width:0}.label-color-dot{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:#18200e;background:var(--label-color)}.label-color-dot mat-icon{font-size:18px}.label-card h3{font-size:14px}.label-card p{color:var(--muted);font-size:10px;margin-top:4px}.label-card-actions{display:flex;gap:10px}.label-card-actions .text-button{font-size:10px;color:var(--muted);padding:7px}.label-card-actions .text-button mat-icon{font-size:16px;width:16px;height:16px}.danger-text{color:#e77e6c!important}@media(max-width:620px){.labels-heading{display:block}.label-search{margin-top:12px}.label-search input{flex:1;width:auto}.label-card{align-items:flex-start;flex-direction:column}.label-card-actions{width:100%;justify-content:flex-end}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelsPage {
  private readonly api = inject(ApiService);
  readonly labels = signal<ActivityLabel[]>([]);
  readonly iconCatalog = signal<string[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  iconSearch = '';
  iconOptions() {
    const query = this.iconSearch.trim().toLowerCase();
    const matches = this.iconCatalog().filter(icon => !query || icon.toLowerCase().includes(query)).slice(0, 80);
    if (this.draft.icon && !matches.includes(this.draft.icon)) matches.unshift(this.draft.icon);
    return [...new Set(matches)];
  }
  editingId: number | string | null = null;
  draft = { name: '', icon: '', color: '#c9f45b' };

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.labels().subscribe({
      next: value => { this.labels.set(value.labels ?? []); this.iconCatalog.set(value.icon_catalog ?? []); },
      error: () => this.error.set('No se han podido cargar las etiquetas.'),
      complete: () => this.loading.set(false)
    });
  }

  startNew() {
    this.editingId = null;
    this.draft = { name: '', icon: '', color: '#c9f45b' };
    this.message.set('');
  }

  edit(label: ActivityLabel) {
    this.editingId = label.id;
    this.draft = { name: label.name, icon: label.icon ?? '', color: label.color ?? '#c9f45b' };
    this.message.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  save() {
    const name = this.draft.name.trim();
    const icon = this.draft.icon.trim();
    if (!name) { this.error.set('Escribe un nombre para la etiqueta.'); return; }
    if (icon && !this.iconCatalog().includes(icon)) { this.error.set('Selecciona un icono de la biblioteca.'); return; }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const body = { name, icon: icon || null, color: this.draft.color };
    const request = this.editingId === null ? this.api.createLabel(body) : this.api.updateLabel(this.editingId, body);
    request.subscribe({
      next: () => { const wasEditing = this.editingId !== null; this.startNew(); this.message.set(wasEditing ? 'Etiqueta actualizada.' : 'Etiqueta creada.'); this.load(); },
      error: () => this.error.set('No se ha podido guardar la etiqueta. Comprueba el nombre, color e icono.'),
      complete: () => this.saving.set(false)
    });
  }

  remove(label: ActivityLabel) {
    if (!window.confirm(`¿Borrar la etiqueta «${label.name}»? Se quitará también de las actividades asignadas.`)) return;
    this.api.deleteLabel(label.id).subscribe({ next: () => { this.message.set('Etiqueta borrada.'); this.load(); }, error: () => this.error.set('No se ha podido borrar la etiqueta.') });
  }
}
