import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, AfterViewInit, computed, effect, inject, input, output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type * as maplibregl from 'maplibre-gl';
import type { GeoJSON as GeoJSONData } from 'geojson';
import { Activity, ApiService, SportsDataStore } from './app';
import { MAP_STYLE, distanceBetween, toMapLibreCoordinates } from './map-config';

const FALLBACK_ROUTE: [number, number][] = [
  [40.4143, -3.6996], [40.4137, -3.6978], [40.4148, -3.6959], [40.4164, -3.6945],
  [40.4172, -3.6921], [40.4187, -3.6902], [40.4204, -3.6891], [40.4213, -3.6912],
  [40.4205, -3.694], [40.4188, -3.6965], [40.4169, -3.698], [40.4143, -3.6996],
];

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

@Component({
  selector: 'app-segment-selection',
  imports: [MatIconModule],
  template: `
    <div class="segment-selection">
      <div class="selection-map maplibre-shell">
        <div #map class="maplibre-host"></div>
        <div class="selection-map-topline"><span class="live-dot"></span> PREVISUALIZACIÓN DEL TRAMO <span class="topline-hint">Arrastra los marcadores o pulsa el recorrido</span></div>
        <div class="selection-handles">
          <button type="button" [class.active]="activeHandle() === 'start'" (click)="activeHandle.set('start')"><span class="handle-number">1</span><span><small>INICIO</small><strong>{{ formatDistance(startDistance()) }}</strong></span><mat-icon>my_location</mat-icon></button>
          <button type="button" [class.active]="activeHandle() === 'end'" (click)="activeHandle.set('end')"><span class="handle-number end">2</span><span><small>FINAL</small><strong>{{ formatDistance(endDistance()) }}</strong></span><mat-icon>flag</mat-icon></button>
        </div>
        <div class="selection-map-hint"><mat-icon>touch_app</mat-icon><span>Selecciona <b>{{ activeHandle() === 'start' ? 'el inicio' : 'el final' }}</b> del segmento en el mapa</span></div>
        <div class="selection-legend"><span><i class="selection-route-dot"></i> Tramo seleccionado</span><span><i class="full-route-dot"></i> Resto de la actividad</span><span class="map-location">MADRID · RETIRO</span></div>
      </div>

      <div class="video-timeline">
        <div class="timeline-head">
          <button class="play-button" type="button" (click)="togglePlayback()" [attr.aria-label]="playing() ? 'Pausar recorrido' : 'Reproducir recorrido'"><mat-icon>{{ playing() ? 'pause' : 'play_arrow' }}</mat-icon></button>
          <div class="timeline-copy"><strong>{{ playing() ? 'Reproduciendo recorrido' : 'Recorrido de la actividad' }}</strong><span>Usa la línea de tiempo para ajustar el tramo como en un vídeo</span></div>
          <div class="timeline-time"><b>{{ formatTime(currentSeconds()) }}</b><span>/ {{ formatTime(totalSeconds()) }}</span></div>
        </div>
        <div class="range-track" [class.is-playing]="playing()">
          <div class="track-base"></div>
          <div class="track-progress" [style.width.%]="currentRatio()"></div>
          <div class="track-selection" [style.left.%]="startRatio()" [style.width.%]="selectionWidth()"></div>
          <input class="range-input range-start" type="range" min="0" [max]="maxIndex()" [value]="startIndex()" aria-label="Inicio del segmento" (input)="onStartInput($event)" />
          <input class="range-input range-end" type="range" min="0" [max]="maxIndex()" [value]="endIndex()" aria-label="Final del segmento" (input)="onEndInput($event)" />
          <span class="timeline-playhead" [style.left.%]="currentRatio()"></span>
          <span class="range-label start-label" [style.left.%]="startRatio()">INICIO</span>
          <span class="range-label end-label" [style.left.%]="endRatio()">FINAL</span>
        </div>
        <div class="timeline-axis"><span>0:00</span><span>{{ formatDistance(totalDistance()) }}</span><span>{{ formatTime(totalSeconds()) }}</span></div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentSelectionMap implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) private mapElement!: ElementRef<HTMLDivElement>;
  readonly points = input<[number, number][]>(FALLBACK_ROUTE);
  readonly startIndex = input(2);
  readonly endIndex = input(8);
  readonly startChange = output<number>();
  readonly endChange = output<number>();
  readonly activeHandle = signal<'start' | 'end'>('start');
  readonly playing = signal(false);
  readonly playIndex = signal(2);
  readonly maxIndex = computed(() => Math.max(2, this.points().length - 1));
  readonly totalDistance = computed(() => this.routeDistance(this.points()));
  readonly startDistance = computed(() => this.distanceAt(this.startIndex()));
  readonly endDistance = computed(() => this.distanceAt(this.endIndex()));
  readonly totalSeconds = computed(() => Math.max(1, Math.round(this.totalDistance() / 1000 * 315)));
  readonly currentSeconds = computed(() => Math.round(this.totalSeconds() * this.playIndex() / this.maxIndex()));
  readonly startRatio = computed(() => this.ratio(this.startIndex()));
  readonly endRatio = computed(() => this.ratio(this.endIndex()));
  readonly currentRatio = computed(() => this.ratio(this.playIndex()));
  readonly selectionWidth = computed(() => Math.max(0, this.endRatio() - this.startRatio()));
  private map?: maplibregl.Map;
  private maplibre?: typeof import('maplibre-gl');
  private styleReady = false;
  private routeMarkers: maplibregl.Marker[] = [];
  private playbackTimer?: number;
  private readonly redraw = effect(() => { const points = this.points(); if (this.styleReady && points.length > 1) this.drawRoute(points); });

  async ngAfterViewInit() {
    if (typeof window === 'undefined') return;
    const maplibre = await import('maplibre-gl');
    this.maplibre = maplibre;
    const initial = toMapLibreCoordinates(this.points());
    this.map = new maplibre.Map({
      container: this.mapElement.nativeElement,
      style: MAP_STYLE,
      center: initial[0] ?? [-3.7038, 40.4168],
      zoom: 13,
      attributionControl: { compact: true },
    });
    this.map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
    this.map.addControl(new maplibre.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
    this.map.on('click', event => this.selectNearest([event.lngLat.lat, event.lngLat.lng]));
    const renderRoute = () => {
      this.styleReady = true;
      this.drawRoute(this.points());
      window.setTimeout(() => this.map?.resize(), 0);
    };
    this.map.once('style.load', renderRoute);
    this.map.once('load', renderRoute);
    this.map.once('idle', renderRoute);
  }

  onStartInput(event: Event) { this.setStart(Number((event.target as HTMLInputElement).value)); }
  onEndInput(event: Event) { this.setEnd(Number((event.target as HTMLInputElement).value)); }
  private setStart(value: number) { this.startChange.emit(clamp(Math.min(value, this.endIndex() - 2), 0, Math.max(0, this.maxIndex() - 2))); this.playIndex.set(Math.max(this.playIndex(), value)); }
  private setEnd(value: number) { this.endChange.emit(clamp(Math.max(value, this.startIndex() + 2), 2, this.maxIndex())); }

  private selectNearest(latlng: [number, number]) {
    const points = this.points();
    if (!this.map || !points.length) return;
    let nearest = 0; let distance = Number.POSITIVE_INFINITY;
    const click = this.map.project({ lng: latlng[1], lat: latlng[0] });
    points.forEach((point, index) => { const candidate = this.map!.project({ lng: point[1], lat: point[0] }); const next = Math.hypot(candidate.x - click.x, candidate.y - click.y); if (next < distance) { distance = next; nearest = index; } });
    if (this.activeHandle() === 'start') this.setStart(nearest); else this.setEnd(nearest);
  }

  private drawRoute(points: [number, number][]) {
    if (!this.map || !this.styleReady || points.length < 2) return;
    const coords = toMapLibreCoordinates(points);
    if (coords.length < 2) return;
    const start = clamp(this.startIndex(), 0, coords.length - 1); const end = clamp(this.endIndex(), start + 1, coords.length - 1);
    this.setLineSource('segment-full-route', coords);
    this.setLineSource('segment-selected-route', coords.slice(start, end + 1));
    const playPoint = coords[clamp(this.playIndex(), 0, coords.length - 1)];
    this.setGeoJsonSource('segment-playhead', { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: playPoint }, properties: {} });
    if (!this.map.getLayer('segment-full-shadow')) {
      this.map.addLayer({ id: 'segment-full-shadow', type: 'line', source: 'segment-full-route', paint: { 'line-color': '#11180f', 'line-width': 12, 'line-opacity': .72, 'line-blur': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      this.map.addLayer({ id: 'segment-full-line', type: 'line', source: 'segment-full-route', paint: { 'line-color': '#7b8770', 'line-width': 4, 'line-opacity': .62 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      this.map.addLayer({ id: 'segment-selected-shadow', type: 'line', source: 'segment-selected-route', paint: { 'line-color': '#11180f', 'line-width': 12, 'line-opacity': .95, 'line-blur': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      this.map.addLayer({ id: 'segment-selected-line', type: 'line', source: 'segment-selected-route', paint: { 'line-color': '#c9f45b', 'line-width': 6, 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      this.map.addLayer({ id: 'segment-playhead', type: 'circle', source: 'segment-playhead', paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#11180f', 'circle-stroke-width': 3 } });
    }
    this.routeMarkers.forEach(marker => marker.remove());
    this.routeMarkers = [
      this.createMarker(points[start], 'start', 'Inicio', index => this.setStart(index)),
      this.createMarker(points[end], 'end', 'Final', index => this.setEnd(index)),
    ];
    const bounds = new this.maplibre!.LngLatBounds(coords[0], coords[0]);
    coords.slice(1).forEach(point => bounds.extend(point));
    this.map.fitBounds(bounds, { padding: 42, maxZoom: 16, duration: 0 });
  }

  private createMarker(point: [number, number], type: 'start' | 'end', label: string, update: (index: number) => void) {
    const icon = document.createElement('span');
    icon.className = `segment-handle-marker handle-pin ${type}`;
    icon.innerHTML = `<b>${type === 'start' ? '1' : '2'}</b><em>${label}</em>`;
    const marker = new this.maplibre!.Marker({ element: icon, draggable: true }).setLngLat([point[1], point[0]]).addTo(this.map!);
    marker.on('dragstart', () => this.activeHandle.set(type));
    marker.on('dragend', () => { const dragged = marker.getLngLat(); const index = this.nearestIndex([dragged.lat, dragged.lng]); update(index); });
    return marker;
  }

  private nearestIndex(latlng: [number, number]) { const distances = this.points().map(point => distanceBetween(point, latlng)); return distances.indexOf(Math.min(...distances)); }
  private ratio(index: number) { return this.maxIndex() ? clamp(index / this.maxIndex() * 100, 0, 100) : 0; }
  private distanceAt(index: number) { return this.routeDistance(this.points().slice(0, clamp(index + 1, 1, this.points().length))); }
  private routeDistance(points: [number, number][]) { return points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0); }
  private setLineSource(id: string, coordinates: [number, number][]) { this.setGeoJsonSource(id, { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates }, properties: {} }); }
  private setGeoJsonSource(id: string, data: unknown) { if (!this.map) return; const source = this.map.getSource(id) as maplibregl.GeoJSONSource | undefined; if (source) source.setData(data as GeoJSONData); else this.map.addSource(id, { type: 'geojson', data: data as GeoJSONData }); }
  formatDistance(meters: number) { return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`; }
  formatTime(seconds: number) { const value = Math.max(0, Math.round(seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }

  togglePlayback() {
    if (this.playing()) { this.stopPlayback(); return; }
    if (this.playIndex() >= this.endIndex()) this.playIndex.set(this.startIndex());
    this.playing.set(true);
    this.playbackTimer = window.setInterval(() => { const next = this.playIndex() + 1; if (next >= this.endIndex()) { this.playIndex.set(this.endIndex()); this.stopPlayback(); } else this.playIndex.set(next); }, 180);
  }
  private stopPlayback() { this.playing.set(false); if (this.playbackTimer) window.clearInterval(this.playbackTimer); this.playbackTimer = undefined; }
  ngOnDestroy() { this.stopPlayback(); this.redraw.destroy(); this.styleReady = false; this.routeMarkers.forEach(marker => marker.remove()); this.map?.remove(); }
}

@Component({
  selector: 'app-segment-creator',
  imports: [RouterLink, FormsModule, MatIconModule, SegmentSelectionMap],
  template: `
    <section class="page segment-creator-page">
      <div class="back-row"><a routerLink="/app/segments"><mat-icon>arrow_back</mat-icon> Segmentos</a><span class="creator-step"><span>01</span> NUEVO SEGMENTO</span></div>
      <div class="creator-heading"><div><p class="eyebrow">CONSTRUYE TU TRAMO</p><h1>Recorta un segmento<br /><span>de tu actividad.</span></h1><p class="muted">Elige una salida y marca exactamente dónde empieza y termina. Tu recorrido, convertido en un reto.</p></div><div class="creator-progress"><span class="progress-done"><i>✓</i> Actividad</span><span class="progress-line"></span><span class="progress-current"><i>2</i> Tramo</span><span class="progress-line"></span><span><i>3</i> Guardar</span></div></div>

      <div class="activity-picker-card">
        <div class="picker-icon"><mat-icon>directions_run</mat-icon></div>
        <div class="picker-copy"><span class="eyebrow">PASO 1 · ACTIVIDAD DE REFERENCIA</span><strong>{{ selectedActivity()?.name || 'Selecciona una actividad' }}</strong><small>{{ selectedActivity() ? selectedActivity()!.date + ' · ' + selectedActivity()!.distance.toFixed(2) + ' km · ' + selectedActivity()!.location : 'La ruta aparecerá en el mapa al elegir una actividad' }}</small></div>
        <select aria-label="Actividad de referencia" [ngModel]="activityId()" (ngModelChange)="loadActivityMap($event)"><option value="">Selecciona una actividad</option>@for (activity of activities(); track activity.id) { <option [value]="activity.id">{{ activity.name }} · {{ activity.date }}</option> }</select>
      </div>

      <div class="creator-layout">
        <main class="creator-stage">
          <div class="stage-heading"><div><p class="eyebrow">PASO 2 · DEFINE LOS LÍMITES</p><h2>¿Qué parte quieres repetir?</h2></div><span class="stage-status"><i></i> {{ routeLoading() ? 'Cargando GPS…' : 'Ruta lista para editar' }}</span></div>
          <app-segment-selection [points]="routePoints()" [startIndex]="start" [endIndex]="end" (startChange)="setStart($event)" (endChange)="setEnd($event)" />
          <div class="selection-summary"><div><span class="summary-marker start">1</span><div><small>EMPIEZA EN</small><strong>{{ formatDistance(startDistance()) }}</strong></div></div><span class="summary-connector"></span><div><span class="summary-marker end">2</span><div><small>TERMINA EN</small><strong>{{ formatDistance(endDistance()) }}</strong></div></div><div class="summary-total"><small>DISTANCIA DEL SEGMENTO</small><strong>{{ formatDistance(segmentDistance()) }}</strong></div></div>
        </main>

        <aside class="creator-sidebar">
          <div class="creator-form-card"><div class="form-card-heading"><span class="form-number">03</span><div><p class="eyebrow">DALE UN NOMBRE</p><h2>Hazlo memorable</h2></div></div><label>Nombre del segmento<input [(ngModel)]="name" maxlength="100" placeholder="Ej. La recta del lago" /></label><div class="form-divider"></div><p class="eyebrow">PERSONALIZA</p><div class="color-picker"><span>Color en tus gráficos</span><div><button type="button" class="color-option lime" [class.selected]="color === '#c9f45b'" (click)="color = '#c9f45b'" aria-label="Lima"></button><button type="button" class="color-option blue" [class.selected]="color === '#76a8ff'" (click)="color = '#76a8ff'" aria-label="Azul"></button><button type="button" class="color-option orange" [class.selected]="color === '#f0a45d'" (click)="color = '#f0a45d'" aria-label="Naranja"></button></div></div><label class="radius-label">Radio de coincidencia<select [(ngModel)]="radius"><option [ngValue]="50">50 m · preciso</option><option [ngValue]="80">80 m · recomendado</option><option [ngValue]="120">120 m · flexible</option></select></label><div class="creator-note"><mat-icon>auto_awesome</mat-icon><span>Al guardarlo, compararemos este tramo con todas tus actividades compatibles.</span></div><button class="primary-button full save-segment-button" type="button" (click)="save()" [disabled]="saving() || !activityId()">{{ saving() ? 'Guardando segmento…' : saved() ? 'Segmento guardado' : 'Crear segmento' }} <mat-icon>{{ saved() ? 'check' : 'arrow_forward' }}</mat-icon></button>@if (saved()) { <a class="saved-link" routerLink="/app/segments">Ver mis segmentos <mat-icon>arrow_forward</mat-icon></a> }</div>
          <div class="shortcut-card"><mat-icon>tips_and_updates</mat-icon><div><strong>Consejo rápido</strong><p>Pulsa <b>1 Inicio</b> o <b>2 Final</b> para elegir qué marcador mover.</p></div></div>
        </aside>
      </div>
      @if (error()) { <p class="api-error">{{ error() }}</p> }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentCreatorPage {
  private readonly api = inject(ApiService);
  private readonly data = inject(SportsDataStore);
  readonly activities = computed(() => this.data.activities());
  readonly routePoints = signal<[number, number][]>(FALLBACK_ROUTE);
  readonly routeLoading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly activityId = signal('');
  name = '';
  start = 2;
  end = 8;
  radius = 80;
  color = '#c9f45b';
  private readonly autoSelect = effect(() => { const first = this.activities()[0]; if (first && !this.activityId()) { this.activityId.set(first.id); this.loadActivityMap(first.id); } });
  readonly selectedActivity = computed<Activity | undefined>(() => this.activities().find(activity => activity.id === this.activityId()));
  readonly startDistance = computed(() => this.distanceAt(this.start));
  readonly endDistance = computed(() => this.distanceAt(this.end));
  readonly segmentDistance = computed(() => Math.max(0, this.endDistance() - this.startDistance()));

  constructor() { this.data.loadActivities(); }

  loadActivityMap(id: string) {
    this.activityId.set(id); this.saved.set(false); this.error.set('');
    if (!id) { this.routePoints.set(FALLBACK_ROUTE); this.start = 2; this.end = 8; return; }
    this.routeLoading.set(true);
    this.api.activityMap(id).subscribe({
      next: response => {
        const points = response.map?.points;
        this.routePoints.set(Array.isArray(points) && points.length > 2 ? points as [number, number][] : FALLBACK_ROUTE);
        this.start = Math.max(0, Math.floor(this.routePoints().length * .18));
        this.end = Math.min(this.routePoints().length - 1, Math.max(this.start + 2, Math.floor(this.routePoints().length * .72)));
      },
      error: () => { this.routePoints.set(FALLBACK_ROUTE); this.start = 2; this.end = 8; this.routeLoading.set(false); },
      complete: () => this.routeLoading.set(false),
    });
  }

  setStart(index: number) { this.start = clamp(index, 0, Math.max(0, this.end - 2)); this.saved.set(false); }
  setEnd(index: number) { this.end = clamp(index, this.start + 2, this.routePoints().length - 1); this.saved.set(false); }
  private distanceAt(index: number) { return this.routePoints().slice(0, clamp(index + 1, 1, this.routePoints().length)).slice(1).reduce((total, point, offset) => total + distanceBetween(this.routePoints()[offset], point), 0); }
  formatDistance(meters: number) { return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`; }

  save() {
    if (!this.activityId()) { this.error.set('Selecciona una actividad de referencia.'); return; }
    if (this.end <= this.start + 1) { this.error.set('El segmento debe incluir al menos tres puntos.'); return; }
    this.saving.set(true); this.error.set('');
    this.api.createSegment({ activity_id: this.activityId(), name: this.name.trim() || 'Nuevo segmento', start_index: this.start, end_index: this.end, color: this.color, radius: this.radius }).subscribe({ next: () => { this.saved.set(true); this.data.loadSegments(true); }, error: () => this.error.set('No se ha podido guardar el segmento.'), complete: () => this.saving.set(false) });
  }
}
