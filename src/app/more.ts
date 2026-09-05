import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, RouteMap } from './app';

@Component({
  selector: 'app-more',
  imports: [RouterLink, MatIconModule],
  template: `
    <section class="page more-page">
      <div class="page-heading"><div><p class="eyebrow">TODO TU ENTRENAMIENTO</p><h1>Más</h1><p class="muted">Herramientas para entender, planificar y comparar tus salidas.</p></div></div>
      <div class="more-grid">
        <a class="more-card lime" routerLink="/app/progress"><span class="more-icon"><mat-icon>insights</mat-icon></span><div><h2>Progreso</h2><p>Carga, fitness, fatiga, objetivos y próximas sesiones.</p></div><mat-icon class="arrow">arrow_forward</mat-icon></a>
        <a class="more-card blue" routerLink="/app/statistics"><span class="more-icon"><mat-icon>bar_chart</mat-icon></span><div><h2>Estadísticas</h2><p>Histórico mensual, deportes, récords e insights.</p></div><mat-icon class="arrow">arrow_forward</mat-icon></a>
        <a class="more-card orange" routerLink="/app/compare"><span class="more-icon"><mat-icon>compare_arrows</mat-icon></span><div><h2>Comparar actividades</h2><p>Contrasta dos salidas con sus métricas y streams.</p></div><mat-icon class="arrow">arrow_forward</mat-icon></a>
        <a class="more-card green" routerLink="/app/routes"><span class="more-icon"><mat-icon>map</mat-icon></span><div><h2>Rutas</h2><p>Consulta tus recorridos guardados y descarga GPX o TCX.</p></div><mat-icon class="arrow">arrow_forward</mat-icon></a>
        <a class="more-card purple" routerLink="/app/labels"><span class="more-icon"><mat-icon>sell</mat-icon></span><div><h2>Etiquetas</h2><p>Crea categorías y organiza tus actividades por color e icono.</p></div><mat-icon class="arrow">arrow_forward</mat-icon></a>
        <a class="more-card" routerLink="/app/import"><span class="more-icon"><mat-icon>upload_file</mat-icon></span><div><h2>Importar actividad</h2><p>Sincroniza con Strava o añade un archivo FIT, GPX o TCX.</p></div><mat-icon class="arrow">arrow_forward</mat-icon></a>
      </div>
      <article class="more-note"><mat-icon>lightbulb</mat-icon><div><strong>Tu siguiente decisión empieza aquí</strong><p>Usa Progreso para saber cómo estás, Estadísticas para ver la tendencia y Comparar para aprender de una salida concreta.</p></div></article>
    </section>
  `,
  styles: [`
    .more-page{max-width:900px}.more-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.more-card{display:flex;align-items:center;gap:14px;min-height:132px;padding:18px;color:var(--ink);text-decoration:none;background:var(--panel);border:1px solid var(--line);border-radius:15px;transition:transform .18s ease,border-color .18s ease}.more-card:hover,.more-card:focus-visible{transform:translateY(-2px);border-color:rgba(201,244,91,.5);outline:0}.more-card.lime{background:linear-gradient(135deg,rgba(201,244,91,.14),var(--panel))}.more-card.blue{background:linear-gradient(135deg,rgba(118,168,255,.13),var(--panel))}.more-card.orange{background:linear-gradient(135deg,rgba(240,164,93,.13),var(--panel))}.more-card.purple{background:linear-gradient(135deg,rgba(190,128,255,.13),var(--panel))}.more-icon{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:12px;background:var(--panel-2);color:var(--lime)}.blue .more-icon{color:#76a8ff}.orange .more-icon{color:var(--orange)}.purple .more-icon{color:#c084fc}.more-card h2{font-size:15px;letter-spacing:-.03em}.more-card p{color:var(--muted);font-size:10px;line-height:1.4;margin-top:6px}.more-card div{flex:1}.more-card .arrow{color:var(--muted);font-size:19px;width:19px;height:19px}.more-note{display:flex;gap:10px;align-items:flex-start;margin-top:18px;padding:16px;background:rgba(201,244,91,.06);border:1px solid rgba(201,244,91,.14);border-radius:13px}.more-note>mat-icon{color:var(--lime);font-size:20px;width:20px;height:20px}.more-note strong{font-size:11px}.more-note p{color:var(--muted);font-size:10px;line-height:1.5;margin-top:5px}@media(max-width:620px){.more-grid{grid-template-columns:1fr}.more-card{min-height:112px}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MorePage {}

@Component({
  selector: 'app-routes',
  imports: [RouterLink, MatIconModule],
  template: `<section class="page routes-page"><div class="back-row"><a routerLink="/app/more"><mat-icon>arrow_back</mat-icon> Más</a><span class="api-badge">RUTAS</span></div><div class="page-heading"><div><p class="eyebrow">PREPARA TU PRÓXIMA SALIDA</p><h1>Rutas</h1><p class="muted">Tus recorridos guardados, listos para revisar o descargar.</p></div><button class="round-button" type="button" (click)="load()" [disabled]="loading()" aria-label="Actualizar rutas"><mat-icon>refresh</mat-icon></button></div>@if (loading()) { <div class="loading-state"><mat-icon>sync</mat-icon><p>Cargando rutas…</p></div> } @else { @if (error()) { <p class="api-error">{{ error() }}</p> }<div class="route-summary"><div><strong>{{ routes().length }}</strong><span>rutas disponibles</span></div><div><strong>{{ localRoutes() }}</strong><span>guardadas localmente</span></div><div><strong>{{ stravaRoutes() }}</strong><span>sincronizadas</span></div></div><div class="route-list">@for (route of routes(); track route['id']) { <a class="saved-route-card" [routerLink]="['/app/routes', route['id']]"><span class="route-card-icon"><mat-icon>route</mat-icon></span><div><h2>{{ route['name'] || 'Ruta sin nombre' }}</h2><p>{{ distance(route['distance']) }} · +{{ elevation(route['elevation_gain']) }} m · {{ source(route['source']) }}</p></div><mat-icon class="arrow">arrow_forward</mat-icon></a> } @empty { <div class="empty-state"><mat-icon>map</mat-icon><p>Aún no hay rutas sincronizadas.</p></div> }</div> }</section>`,
  styles: [` .routes-page{max-width:900px}.route-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:22px}.route-summary>div{background:var(--panel);padding:17px}.route-summary strong,.route-summary span{display:block}.route-summary strong{font-size:24px;color:var(--lime)}.route-summary span{color:var(--muted);font-size:10px;margin-top:4px}.route-list{display:grid;gap:10px}.saved-route-card{display:flex;align-items:center;gap:13px;padding:17px;background:var(--panel);border:1px solid var(--line);border-radius:14px}.saved-route-card:hover{border-color:rgba(201,244,91,.4)}.route-card-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--lime-soft);color:var(--lime)}.saved-route-card>div{flex:1;min-width:0}.saved-route-card h2{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.saved-route-card p{color:var(--muted);font-size:10px;margin-top:5px}.saved-route-card>.arrow{color:var(--muted);font-size:19px;width:19px;height:19px}@media(max-width:620px){.route-summary{grid-template-columns:1fr 1fr}.route-summary>div:last-child{grid-column:1/-1}} `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutesPage {
  private readonly api = inject(ApiService);
  readonly routes = signal<Record<string, any>[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly localRoutes = computed(() => this.routes().filter(route => route['source'] === 'local').length);
  readonly stravaRoutes = computed(() => this.routes().filter(route => route['source'] !== 'local').length);
  constructor() { this.load(); }
  load() { this.loading.set(true); this.error.set(''); this.api.routes().subscribe({ next: value => this.routes.set(value.routes ?? []), error: () => this.error.set('No se han podido cargar las rutas.'), complete: () => this.loading.set(false) }); }
  distance(value: unknown) { const meters = Number(value); return Number.isFinite(meters) ? `${(meters / 1000).toFixed(1)} km` : '—'; }
  elevation(value: unknown) { const meters = Number(value); return Number.isFinite(meters) ? Math.round(meters) : 0; }
  source(value: unknown) { return value === 'local' ? 'Local' : 'Strava'; }
}

@Component({
  selector: 'app-route-detail',
  imports: [RouterLink, MatIconModule, RouteMap],
  template: `<section class="page route-detail-page"><div class="back-row"><a routerLink="/app/routes"><mat-icon>arrow_back</mat-icon> Rutas</a><span class="api-badge">DETALLE</span></div>@if (loading()) { <div class="loading-state"><mat-icon>sync</mat-icon><p>Cargando ruta…</p></div> } @else if (error()) { <p class="api-error">{{ error() }}</p> } @else { <div class="page-heading"><div><p class="eyebrow">RECORRIDO GUARDADO</p><h1>{{ route()?.['name'] || 'Ruta' }}</h1><p class="muted">{{ route()?.['description'] || 'Revisa el recorrido antes de salir.' }}</p></div><div class="route-downloads"><a class="outline-button" [href]="exportUrl('gpx')">GPX <mat-icon>download</mat-icon></a><a class="outline-button" [href]="exportUrl('tcx')">TCX <mat-icon>download</mat-icon></a></div></div><app-route-map [routePoints]="points()" /><div class="route-detail-metrics"><article class="detail-card"><span>DISTANCIA</span><strong>{{ distance(route()?.['distance']) }}</strong></article><article class="detail-card"><span>DESNIVEL</span><strong>+{{ elevation(route()?.['elevation_gain']) }} m</strong></article><article class="detail-card"><span>TIEMPO ESTIMADO</span><strong>{{ duration(route()?.['estimated_moving_time']) }}</strong></article></div> }</section>`,
  styles: [` .route-detail-page{max-width:1000px}.route-downloads{display:flex;gap:8px;flex-wrap:wrap}.route-detail-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.route-detail-metrics .detail-card{min-height:100px}.route-detail-metrics .detail-card strong{font-size:20px}@media(max-width:620px){.route-downloads{width:100%}.route-downloads a{flex:1}.route-detail-metrics{grid-template-columns:1fr}} `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteDetailPage {
  private readonly routeParams = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  readonly id = this.routeParams.snapshot.paramMap.get('id') ?? '';
  readonly route = signal<Record<string, any> | null>(null);
  readonly points = signal<[number, number][]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() { this.load(); }
  load() { this.api.route(this.id).subscribe({ next: value => { this.route.set(value.route); this.points.set(value.map?.points ?? value.streams?.['latlng']?.data ?? []); }, error: () => this.error.set('No se ha podido cargar el detalle de la ruta.'), complete: () => this.loading.set(false) }); }
  exportUrl(format: 'gpx' | 'tcx') { return `${this.api.baseUrl}/routes/${encodeURIComponent(this.id)}/export/${format}`; }
  distance(value: unknown) { const meters = Number(value); return Number.isFinite(meters) ? `${(meters / 1000).toFixed(1)} km` : '—'; }
  elevation(value: unknown) { const meters = Number(value); return Number.isFinite(meters) ? Math.round(meters) : 0; }
  duration(value: unknown) { const seconds = Number(value); return Number.isFinite(seconds) && seconds > 0 ? `${Math.floor(seconds / 3600)} h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')} min` : '—'; }
}
