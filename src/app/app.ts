import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  input,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import type * as maplibregl from 'maplibre-gl';
import type { GeoJSON as GeoJSONData } from 'geojson';
import { MAP_STYLE, distanceBetween, toMapLibreCoordinates } from './map-config';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  ActivatedRoute,
} from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable, catchError, forkJoin, map, of, shareReplay, tap } from 'rxjs';
import { MiniChart, SegmentPerformanceChart, SegmentSpark } from './chart-components';
import { PwaService } from './pwa.service';

export type Sport = 'Run' | 'Ride' | 'Walk';
export type ActivityDateTag = 'Hoy' | 'Ayer' | 'Esta semana' | '';
export interface Activity {
  id: string;
  name: string;
  sport_type: Sport;
  date: string;
  date_tag?: ActivityDateTag;
  distance: number;
  moving_time: number;
  moving_time_seconds?: number;
  elapsed_time_seconds?: number;
  elevation: number;
  speed: number;
  max_speed?: number | null;
  pace: string;
  effort: number;
  calories?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  cadence?: number | null;
  source?: string;
  device_name?: string | null;
  color: string;
  location: string;
  labels?: ActivityLabel[];
}
export interface DashboardChartPoint {
  label: string;
  distance: number;
  elevation: number;
  speed: number;
}

export function countRestDays(load: Record<string, any> | null | undefined, today = new Date()) {
  const rows = Array.isArray(load?.['days']) && load['days'].length
    ? load['days'] as Array<Record<string, any>>
    : (Array.isArray(load?.['series']) ? load['series'] : load?.['fitness_days']) as Array<Record<string, any>> | undefined;
  const activeDays = new Set(
    (rows ?? [])
      .filter((row) => 'activities' in row ? Number(row['activities']) > 0 : Number(row['load'] ?? 0) > 0)
      .map((row) => String(row['day'] ?? row['date'] ?? '').slice(0, 10))
      .filter(Boolean),
  );
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  let rest = 0;
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() - index);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    if (!activeDays.has(key)) rest += 1;
  }
  if (rows?.length) return rest;
  const fallback = Number(load?.['rest_days']);
  return Number.isFinite(fallback) ? Math.max(0, Math.min(7, fallback)) : 0;
}
export interface Segment {
  id: string;
  name: string;
  distance: string;
  elevation: string;
  best: string;
  average: string;
  attempts: number;
  rank: string;
  rank_position?: number | null;
  absolute_rank_position?: number | null;
  color: string;
  trend: number[];
}
export interface ActivityLabel {
  id: number | string;
  name: string;
  icon?: string | null;
  color?: string | null;
  activity_count?: number;
}
export interface ActivityJournal {
  notes?: string;
  perceived_exertion?: number | null;
  soreness?: string;
  workout_type?: string;
  companions?: string;
  tags?: string;
}

export function formatActivityDate(value: unknown) {
  if (!value) return '—';
  const raw = String(value);
  const parsed = new Date(raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw);
  if (Number.isNaN(parsed.getTime())) return '—';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function activityDateTag(value: unknown): ActivityDateTag {
  if (!value) return '';
  const raw = String(value);
  const parsed = new Date(raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const today = new Date();
  const dayStart = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((dayStart(today) - dayStart(parsed)) / 86400000);
  return difference === 0
    ? 'Hoy'
    : difference === 1
      ? 'Ayer'
      : difference >= 2 && difference <= 6
        ? 'Esta semana'
        : '';
}

export const ACTIVITIES: Activity[] = [
  {
    id: '987654321',
    name: 'Rodaje de martes',
    sport_type: 'Run',
    date: '04/09/2026 18:30',
    date_tag: 'Hoy',
    distance: 8.5,
    moving_time: 45,
    moving_time_seconds: 2700,
    elevation: 75,
    speed: 11.3,
    pace: '5:18 /km',
    effort: 7,
    calories: 612,
    average_heartrate: 154,
    max_heartrate: 172,
    cadence: 168,
    source: 'Strava',
    device_name: 'Garmin Forerunner 265',
    color: '#c9f45b',
    location: 'Parque del Retiro',
  },
  {
    id: '987654320',
    name: 'Vuelta Casa de Campo',
    sport_type: 'Ride',
    date: '03/09/2026 08:14',
    date_tag: 'Ayer',
    distance: 32.4,
    moving_time: 84,
    moving_time_seconds: 5040,
    elevation: 410,
    speed: 23.1,
    pace: '23.1 km/h',
    effort: 8,
    calories: 890,
    source: 'Strava',
    color: '#76a8ff',
    location: 'Casa de Campo',
  },
  {
    id: '987654319',
    name: 'Paseo de recuperación',
    sport_type: 'Walk',
    date: '31/08/2026 10:02',
    date_tag: 'Esta semana',
    distance: 5.2,
    moving_time: 62,
    moving_time_seconds: 3720,
    elevation: 28,
    speed: 5.0,
    pace: '11:55 /km',
    effort: 3,
    calories: 260,
    source: 'Strava',
    color: '#f0a45d',
    location: 'Madrid Río',
  },
  {
    id: '987654318',
    name: 'Umbral · 4 x 1 km',
    sport_type: 'Run',
    date: '29/08/2026 19:05',
    date_tag: 'Esta semana',
    distance: 10.2,
    moving_time: 51,
    moving_time_seconds: 3060,
    elevation: 92,
    speed: 12.0,
    pace: '5:00 /km',
    effort: 9,
    calories: 730,
    source: 'Strava',
    color: '#c9f45b',
    location: 'Parque Juan Carlos I',
  },
];
export const SEGMENTS: Segment[] = [
  {
    id: 's-01',
    name: 'Cuesta de Moyano',
    distance: '0.82 km',
    elevation: '+38 m',
    best: '3:42',
    average: '4:08',
    attempts: 26,
    rank: '5 / 38',
    absolute_rank_position: 3,
    color: '#c9f45b',
    trend: [34, 27, 30, 22, 24, 16, 19, 12],
  },
  {
    id: 's-02',
    name: 'Recta del Lago',
    distance: '1.24 km',
    elevation: '+4 m',
    best: '4:58',
    average: '5:21',
    attempts: 18,
    rank: '2 / 24',
    absolute_rank_position: 2,
    color: '#76a8ff',
    trend: [28, 29, 24, 26, 18, 19, 14, 11],
  },
  {
    id: 's-03',
    name: 'Subida del Ángel',
    distance: '0.46 km',
    elevation: '+27 m',
    best: '2:14',
    average: '2:31',
    attempts: 11,
    rank: '8 / 19',
    absolute_rank_position: 8,
    color: '#f0a45d',
    trend: [40, 33, 35, 28, 31, 25, 26, 20],
  },
];
const DEFAULT_ROUTE: [number, number][] = [
  [40.4143, -3.6996],
  [40.4137, -3.6978],
  [40.4148, -3.6959],
  [40.4164, -3.6945],
  [40.4172, -3.6921],
  [40.4187, -3.6902],
  [40.4204, -3.6891],
];

export interface ApiUser {
  id: number | string;
  firstname: string;
  lastname?: string;
  username?: string;
  city?: string;
  country?: string;
  profile_url?: string;
  scopes?: string;
  last_sync_at?: string;
  strava_connected?: boolean;
}
export interface ApiPreferences {
  language?: string;
  distance_unit?: string;
  elevation_unit?: string;
  temperature_unit?: string;
  week_starts_on?: number;
  theme?: string;
}
export interface ApiSession {
  authenticated: boolean;
  user: ApiUser | null;
  preferences?: ApiPreferences;
  csrf_token: string;
}
export interface ApiDashboard {
  user?: ApiUser;
  stats?: { total?: number; distance?: number; moving_time?: number; elevation?: number };
  trend?: unknown[];
  activities?: unknown[];
}
export interface ActivityPagination {
  limit: number;
  cursor: string | null;
  has_next: boolean;
  next_cursor: string | null;
}
export interface ApiActivities {
  activities: unknown[];
  count: number;
  pagination?: ActivityPagination;
}
export interface ApiSegments {
  segments?: unknown[];
  groups?: unknown[];
  strava_segments?: unknown[];
}
export interface StravaAuthorization {
  authorization_url: string;
}
export interface NormalizedMap {
  bounds: { south: number; west: number; north: number; east: number } | null;
  points: [number, number][];
  geojson?: unknown;
  point_count: number;
  simplified: boolean;
}
export interface ApiSegmentDetail {
  segment: Record<string, any>;
  map: NormalizedMap;
  ranking: {
    attempts: number;
    best_time: number | null;
    average_time: number | null;
    best_speed: number | null;
    top_efforts: any[];
  };
  evolution: any[];
  efforts_by_activity: any[];
  goal: Record<string, any> | null;
}
export interface ApiProfile {
  profile: ApiUser;
  preferences: ApiPreferences;
}
export interface ApiShare {
  ok?: boolean;
  share_type?: string;
  token?: string;
  url?: string;
  expires_at?: string | null;
  hide_name?: boolean;
  hide_time?: boolean;
  hide_start?: boolean;
}
export const API_BASE_URL = 'https://alon.one/sports/api/v1';

@Injectable({ providedIn: 'root' })
export class CsrfStore {
  readonly token = signal('');
  set(token: string) {
    this.token.set(token || '');
  }
  clear() {
    this.token.set('');
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = API_BASE_URL;
  session() {
    return this.http.get<ApiSession>(`${this.baseUrl}/auth/session`);
  }
  csrfToken() {
    return this.http.get<ApiSession>(`${this.baseUrl}/auth/csrf`);
  }
  stravaAuthorization() {
    return this.http.get<StravaAuthorization>(`${this.baseUrl}/auth/strava`);
  }
  dashboard() {
    return this.http.get<ApiDashboard>(`${this.baseUrl}/dashboard`);
  }
  activities(limit = 100, cursor?: string | null) {
    let params = new HttpParams().set('limit', limit);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<ApiActivities>(`${this.baseUrl}/activities`, { params });
  }
  activity(id: string) {
    return this.http.get<Record<string, unknown>>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}`,
    );
  }
  activityMap(id: string) {
    return this.http.get<{ activity_id: string | number; map: NormalizedMap }>(
      `${this.baseUrl}/maps/activities/${encodeURIComponent(id)}`,
    );
  }
  updateActivity(id: string, body: unknown) {
    return this.http.put<Record<string, unknown>>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}`,
      body,
    );
  }
  activityNotes(id: string) {
    return this.http.get<Record<string, unknown>>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/notes`,
    );
  }
  updateActivityNotes(id: string, body: unknown) {
    return this.http.put<Record<string, unknown>>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/notes`,
      body,
    );
  }
  refreshActivityFromStrava(id: string) {
    return this.http.post<{ ok: boolean; activity: Record<string, any> }>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/refresh`,
      {},
    );
  }
  refreshActivityWeather(id: string) {
    return this.http.post<{ ok: boolean; weather: Record<string, any> }>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/weather`,
      {},
    );
  }
  cropActivity(id: string, startIndex: number, endIndex: number) {
    return this.http.post<{ ok: boolean; ids: string[]; activities: Record<string, any>[] }>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/crop`,
      { start_index: startIndex, end_index: endIndex },
    );
  }
  splitActivity(id: string, index: number) {
    return this.http.post<{ ok: boolean; ids: string[]; activities: Record<string, any>[] }>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/split`,
      { index },
    );
  }
  mergeActivities(firstId: string, secondId: string) {
    return this.http.post<{ ok: boolean; id: string | number }>(
      `${this.baseUrl}/activities/merge`,
      { first_id: firstId, second_id: secondId },
    );
  }
  routes() {
    return this.http.get<{ routes: Record<string, any>[] }>(`${this.baseUrl}/routes`);
  }
  createRoute(body: unknown) {
    return this.http.post<{ ok: boolean; id: string | number; route: Record<string, any> }>(
      `${this.baseUrl}/routes`,
      body,
    );
  }
  route(id: string) {
    return this.http.get<{
      route: Record<string, any>;
      streams: Record<string, any>;
      map: { points: [number, number][] };
    }>(`${this.baseUrl}/routes/${encodeURIComponent(id)}`);
  }
  labels() {
    return this.http.get<{ labels: ActivityLabel[]; icon_catalog?: string[] }>(
      `${this.baseUrl}/labels`,
    );
  }
  createLabel(body: { name: string; icon: string | null; color: string }) {
    return this.http.post<{ ok: boolean; label: ActivityLabel }>(`${this.baseUrl}/labels`, body);
  }
  updateLabel(id: number | string, body: { name: string; icon: string | null; color: string }) {
    return this.http.put<{ ok: boolean; label: ActivityLabel }>(
      `${this.baseUrl}/labels/${encodeURIComponent(id)}`,
      body,
    );
  }
  deleteLabel(id: number | string) {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/labels/${encodeURIComponent(id)}`);
  }
  setActivityLabels(id: string, labelIds: Array<number | string>) {
    return this.http.put<{ ok: boolean; labels: ActivityLabel[] }>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/labels`,
      { label_ids: labelIds },
    );
  }
  importActivity(body: FormData) {
    return this.http.post<Record<string, unknown>>(`${this.baseUrl}/activities/import`, body);
  }
  syncActivities() {
    return this.http.post<Record<string, unknown>>(`${this.baseUrl}/activities/sync`, {});
  }
  deleteActivity(id: string) {
    return this.http.delete<Record<string, unknown>>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}`,
    );
  }
  profile() {
    return this.http.get<ApiProfile>(`${this.baseUrl}/profile`);
  }
  updateProfile(body: unknown) {
    return this.http.put<{ ok: boolean; profile: ApiUser }>(`${this.baseUrl}/profile`, body);
  }
  updatePreferences(body: ApiPreferences) {
    return this.http.put<{ ok: boolean; preferences: ApiPreferences }>(
      `${this.baseUrl}/preferences`,
      body,
    );
  }
  segments() {
    return this.http.get<ApiSegments>(`${this.baseUrl}/segments`);
  }
  createSegment(body: unknown) {
    return this.http.post<{ ok: boolean; id: string | number; segment: Record<string, unknown> }>(
      `${this.baseUrl}/segments`,
      body,
    );
  }
  segment(id: string) {
    return this.http.get<Record<string, unknown>>(
      `${this.baseUrl}/segments/${encodeURIComponent(id)}`,
    );
  }
  segmentDetail(id: string) {
    return this.http.get<ApiSegmentDetail>(
      `${this.baseUrl}/segments/${encodeURIComponent(id)}/detail`,
    );
  }
  statistics(sport?: string) {
    let params = new HttpParams();
    if (sport) params = params.set('sport', sport);
    return this.http.get<Record<string, any>>(`${this.baseUrl}/statistics`, { params });
  }
  analysis() {
    return this.http.get<Record<string, any>>(`${this.baseUrl}/analysis`);
  }
  trainingLoad() {
    return this.http.get<Record<string, any>>(`${this.baseUrl}/training-load`);
  }
  goals() {
    return this.http.get<{ goals: Record<string, any>[] }>(`${this.baseUrl}/goals`);
  }
  createGoal(body: unknown) {
    return this.http.post<{ ok: boolean; goals: Record<string, any>[] }>(
      `${this.baseUrl}/goals`,
      body,
    );
  }
  calendar(start: string, end: string) {
    return this.http.get<{
      start: string;
      end: string;
      activities: unknown[];
      marks: Record<string, any>[];
      planned_workouts: Record<string, any>[];
    }>(`${this.baseUrl}/calendar`, {
      params: new HttpParams().set('start', start).set('end', end),
    });
  }
  plannedWorkouts(start: string, end: string) {
    return this.http.get<{ planned_workouts: Record<string, any>[] }>(
      `${this.baseUrl}/planned-workouts`,
      { params: new HttpParams().set('start', start).set('end', end) },
    );
  }
  createPlannedWorkout(body: unknown) {
    return this.http.post<{ ok: boolean; id: number }>(`${this.baseUrl}/planned-workouts`, body);
  }
  deletePlannedWorkout(id: string | number) {
    return this.http.delete<{ ok: boolean }>(
      `${this.baseUrl}/planned-workouts/${encodeURIComponent(id)}`,
    );
  }
  compare(one: string | number, two: string | number) {
    return this.http.get<Record<string, any>>(`${this.baseUrl}/compare`, {
      params: new HttpParams().set('one', one).set('two', two),
    });
  }
  getShare(id: string) {
    return this.http.get<ApiShare>(`${this.baseUrl}/activities/${encodeURIComponent(id)}/share`);
  }
  createShare(id: string, body: unknown) {
    return this.http.post<ApiShare>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/share`,
      body,
    );
  }
  updateShare(id: string, body: unknown) {
    return this.http.put<ApiShare>(
      `${this.baseUrl}/activities/${encodeURIComponent(id)}/share`,
      body,
    );
  }
  revokeShare(id: string) {
    return this.http.delete<ApiShare>(`${this.baseUrl}/activities/${encodeURIComponent(id)}/share`);
  }
  mutation<T>(method: 'post' | 'put' | 'delete', path: string, body?: unknown) {
    return this.http.request<T>(method, `${this.baseUrl}${path}`, { body });
  }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly status = signal<'loading' | 'authenticated' | 'anonymous'>('loading');
  readonly authenticated = computed(() => this.status() === 'authenticated');
  readonly user = signal<ApiUser | null>(null);
  readonly preferences = signal<ApiPreferences>({});
  readonly error = signal('');
  private init$?: Observable<boolean>;
  private readonly api = inject(ApiService);
  private readonly csrf = inject(CsrfStore);
  private readonly pwaLoginMarker = 'alon-sports-pwa-authenticated';
  initialize(force = false) {
    if (force) this.init$ = undefined;
    if (!this.init$)
      this.init$ = this.api.session().pipe(
        tap((session) => this.applySession(session)),
        map((session) => session.authenticated),
        catchError(() => {
          this.status.set('anonymous');
          this.user.set(null);
          return of(false);
        }),
        shareReplay(1),
      );
    return this.init$;
  }
  refreshSession() {
    return this.initialize(true);
  }
  private applySession(session: ApiSession) {
    this.csrf.set(session.csrf_token);
    this.user.set(session.user);
    this.preferences.set(session.preferences ?? {});
    this.status.set(session.authenticated ? 'authenticated' : 'anonymous');
    if (session.authenticated && typeof window !== 'undefined')
      window.localStorage.setItem(this.pwaLoginMarker, '1');
  }
  setError(message: string) {
    this.error.set(message);
  }
  loginWithStrava() {
    this.error.set('');
    this.api.stravaAuthorization().subscribe({
      next: (response) => {
        if (response.authorization_url && typeof window !== 'undefined')
          window.location.assign(response.authorization_url);
        else this.error.set('La API no ha devuelto una URL válida de Strava.');
      },
      error: () => this.error.set('No se ha podido iniciar la conexión con Strava.'),
    });
  }
  isStandalonePwa() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }
  shouldRecoverPwaSession() {
    if (!this.isStandalonePwa() || typeof window === 'undefined') return false;
    return window.localStorage.getItem(this.pwaLoginMarker) === '1';
  }
  bridgePwaSession() {
    if (typeof window === 'undefined') return;
    const returnTo = new URL(window.location.href);
    returnTo.searchParams.set('auth', 'bridge');
    returnTo.searchParams.set('bridge', '1');
    window.location.assign(`${API_BASE_URL}/auth/bridge?return_to=${encodeURIComponent(returnTo.toString())}`);
  }
  clearPwaLoginMarker() {
    if (typeof window !== 'undefined') window.localStorage.removeItem(this.pwaLoginMarker);
  }
  logout() {
    this.init$ = undefined;
    this.user.set(null);
    this.status.set('anonymous');
    this.clearPwaLoginMarker();
    this.api
      .mutation<{ ok: boolean }>('post', '/auth/logout')
      .pipe(catchError(() => of({ ok: false })))
      .subscribe(() => this.csrf.clear());
  }
}

@Injectable({ providedIn: 'root' })
export class SportsDataStore {
  readonly activities = signal<Activity[]>([]);
  readonly segments = signal<Segment[]>([]);
  readonly dashboard = signal<ApiDashboard | null>(null);
  readonly pagination = signal<ActivityPagination>({
    limit: 100,
    cursor: null,
    has_next: false,
    next_cursor: null,
  });
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly api = inject(ApiService);
  loadDashboard(force = false) {
    if (this.dashboard() && !force) return;
    this.loading.set(true);
    this.api
      .dashboard()
      .subscribe({
        next: (value) => this.dashboard.set(value),
        error: () => this.error.set('No se ha podido cargar el resumen.'),
        complete: () => this.loading.set(false),
      });
  }
  loadActivities(force = false) {
    if (this.activities().length && !force) return;
    this.loading.set(true);
    this.api.activities(100).subscribe({
      next: (response) => {
        this.activities.set(response.activities.map((item) => this.toActivity(item)));
        if (response.pagination) this.pagination.set(response.pagination);
      },
      error: () => this.error.set('No se han podido cargar las actividades.'),
      complete: () => this.loading.set(false),
    });
  }
  loadMoreActivities() {
    const page = this.pagination();
    if (!page.has_next || !page.next_cursor) return;
    this.loading.set(true);
    this.api.activities(page.limit, page.next_cursor).subscribe({
      next: (response) => {
        this.activities.update((items) => [
          ...items,
          ...response.activities.map((item) => this.toActivity(item)),
        ]);
        if (response.pagination) this.pagination.set(response.pagination);
      },
      error: () => this.error.set('No se han podido cargar más actividades.'),
      complete: () => this.loading.set(false),
    });
  }
  refresh() {
    this.dashboard.set(null);
    this.activities.set([]);
    this.pagination.set({ limit: 100, cursor: null, has_next: false, next_cursor: null });
    this.loadDashboard(true);
    this.loadActivities(true);
    this.loadSegments(true);
  }
  loadSegments(force = false) {
    if (this.segments().length && !force) return;
    this.api
      .segments()
      .subscribe({
        next: (response) =>
          this.segments.set((response.segments ?? []).map((item) => this.toSegment(item))),
        error: () => this.error.set('No se han podido cargar los segmentos.'),
      });
  }
  toActivity(raw: unknown): Activity {
    const item: any = raw ?? {};
    const sport = this.sport(item.sport_type);
    const distance = Number(item.distance ?? 0) / 1000;
    const moving = Number(item.moving_time ?? 0);
    const speed = Number(item.average_speed ?? 0) * 3.6;
    const dateValue = item.start_date_local ?? item.start_date;
    return {
      id: String(item.id),
      name: String(item.name ?? 'Actividad sin nombre'),
      sport_type: sport,
      date: formatActivityDate(dateValue),
      date_tag: activityDateTag(dateValue),
      distance,
      moving_time: Math.round(moving / 60),
      moving_time_seconds: moving,
      elapsed_time_seconds: Number(item.elapsed_time ?? moving),
      elevation: Math.round(Number(item.total_elevation_gain ?? 0)),
      speed,
      max_speed: this.optionalNumber(item.max_speed, 3.6),
      pace: sport === 'Ride' ? this.speedLabel(speed) : this.pace(speed / 3.6, distance),
      effort: Number(item.perceived_exertion ?? 0),
      calories: this.optionalNumber(item.calories),
      average_heartrate: this.optionalNumber(item.average_heartrate),
      max_heartrate: this.optionalNumber(item.max_heartrate),
      cadence: this.optionalNumber(item.average_cadence ?? item.cadence),
      source: String(item.source ?? 'API'),
      device_name: item.device_name ? String(item.device_name) : null,
      color: sport === 'Ride' ? '#76a8ff' : sport === 'Walk' ? '#f0a45d' : '#c9f45b',
      location: String(item.location_city ?? item.city ?? item.location ?? 'Sin ubicación'),
      labels: Array.isArray(item._labels)
        ? (item._labels as ActivityLabel[])
        : Array.isArray(item.labels)
          ? (item.labels as ActivityLabel[])
          : [],
    };
  }
  toSegment(raw: unknown): Segment {
    const item: any = raw ?? {};
    const distance = Number(item.distance ?? 0);
    const attempts = Number(item.attempts ?? item.attempt_count ?? item.effort_count ?? 0);
    const position = Number(item.rank_position ?? item.ranking_position ?? 0);
    const previousAttempts = Number(item.previous_attempt_count ?? item.previous_attempts ?? 0);
    const absolutePosition = Number(
      item.absolute_rank_position ?? item.absolute_position ?? item.all_time_rank_position ?? 0,
    );
    const rankAttempts = previousAttempts > 0 ? previousAttempts + 1 : attempts;
    return {
      id: String(item.id ?? item.segment_id),
      name: String(item.name ?? 'Segmento'),
      distance:
        typeof item.distance === 'string' ? item.distance : `${(distance / 1000).toFixed(2)} km`,
      elevation: `+${Math.round(Number(item.elevation_gain ?? item.total_elevation_gain ?? 0))} m`,
      best: this.duration(Number(item.best_time ?? item.pr_time ?? item.record_time ?? 0)),
      average: this.duration(
        Number(item.average_time ?? item.avg_time ?? item.mean_time ?? item.average_duration ?? 0),
      ),
      attempts,
      rank:
        position > 0 && rankAttempts > 0
          ? `${position} / ${rankAttempts}`
          : item.rank
            ? String(item.rank)
            : '—',
      rank_position: position > 0 ? position : null,
      absolute_rank_position: absolutePosition > 0 ? absolutePosition : null,
      color: String(item.color ?? '#c9f45b'),
      trend: [34, 27, 30, 22, 24, 16, 19, 12],
    };
  }
  private sport(value: unknown): Sport {
    return String(value).toLowerCase().includes('ride') ||
      String(value).toLowerCase().includes('cycl')
      ? 'Ride'
      : String(value).toLowerCase().includes('walk')
        ? 'Walk'
        : 'Run';
  }
  private pace(speed: number, distance: number) {
    const seconds = speed > 0 ? 1000 / speed : distance > 0 ? 3600 / distance : 0;
    return seconds
      ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} /km`
      : '—';
  }
  private speedLabel(speed: number) {
    return speed > 0 ? `${speed.toFixed(1)} km/h` : '—';
  }
  private optionalNumber(value: unknown, multiplier = 1) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number * multiplier : null;
  }
  private duration(seconds: number) {
    return seconds
      ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
      : '—';
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatIconModule],
  template: `
    <router-outlet />
    @if (booting()) {
      <div class="app-splash" role="status" aria-label="Cargando Alon Sports">
        <div class="app-splash-orbit"></div>
        <img src="images/alon-route-art.png" alt="" width="170" height="170" />
        <p class="app-splash-brand">ALON <em>SPORTS</em></p>
        <span>Tu entrenamiento, más claro.</span>
      </div>
    }
    @if (pwa.isOffline()) {
      <div class="pwa-status pwa-status-offline" role="status">
        <mat-icon>cloud_off</mat-icon
        ><span>Sin conexión · tus datos se sincronizarán al volver.</span>
      </div>
    }
    @if (pwa.updateAvailable()) {
      <div class="pwa-update" role="status">
        <span
          ><strong>Nueva versión disponible</strong
          ><small>Actualiza para seguir usando Alon Sports.</small></span
        ><button type="button" (click)="pwa.applyUpdate()">Actualizar</button>
      </div>
    }
    @if (pwa.canInstall() && !pwa.isInstalled()) {
      <aside class="pwa-install" aria-label="Instalar Alon Sports">
        <span class="pwa-install-icon"
          ><img src="icons/icon-96.png" alt="" width="42" height="42"
        /></span>
        <span
          ><strong>Instala Alon Sports</strong
          ><small>Accede más rápido y úsala a pantalla completa.</small></span
        >
        <button type="button" (click)="pwa.install()">Instalar</button>
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly pwa = inject(PwaService);
  readonly booting = signal(true);

  constructor() {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => this.booting.set(false), 520);
    }
  }
}

@Component({
  selector: 'app-login',
  imports: [MatIconModule],
  template: `
    <main class="login-page">
      <div class="login-grid"></div>
      <section class="login-card">
        <div class="brand-lockup">
          <span class="brand-mark">A</span><span>ALON <em>SPORTS</em></span>
        </div>
        <div class="login-intro">
          <p class="eyebrow">TU ENTRENAMIENTO, MÁS CLARO</p>
          <h1>Vuelve a<br /><span>moverte.</span></h1>
          <p class="login-copy">
            Analiza tus salidas, sigue tus segmentos y encuentra tu próximo pequeño récord.
          </p>
        </div>
        <div class="api-login-note">
          <mat-icon>lock</mat-icon
          ><span
            >Acceso seguro mediante la cuenta de Strava. La API mantiene la sesión en una cookie
            HttpOnly.</span
          >
        </div>
        @if (error()) {
          <p class="api-error" role="alert">{{ error() }}</p>
        }
        <button class="primary-button login-submit" type="button" (click)="submit()">
          Continuar con Strava <mat-icon>arrow_forward</mat-icon>
        </button>
        <div class="login-divider"><span>OAuth seguro</span></div>
        <button class="strava-button" type="button" (click)="submit()">
          <span class="strava-dot">S</span> Conectar con Strava
        </button>
        <p class="login-foot">Al continuar aceptas sincronizar tus actividades con Alon Sports.</p>
      </section>
      <aside class="login-aside">
        <p class="eyebrow">PRÓXIMA SALIDA</p>
        <p class="aside-quote">“La constancia<br /><strong>se mide en días.</strong>”</p>
        <div class="aside-route"><span>Madrid · 06:42</span><span>08.5 km</span></div>
        <div class="route-line"><i></i><i></i><i></i><i></i></div>
      </aside>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly error = this.auth.error;
  constructor() {
    const result = this.route.snapshot.queryParamMap.get('auth');
    const bridge = this.route.snapshot.queryParamMap.get('bridge') === '1';
    if (result === 'error') {
      this.auth.setError(
        this.route.snapshot.queryParamMap.get('message') ??
          'No se ha podido completar la conexión con Strava.',
      );
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } else if (result === 'success') {
      this.auth.refreshSession().subscribe((authenticated) => {
        if (authenticated) this.router.navigateByUrl('/app/dashboard', { replaceUrl: true });
        else if (!bridge && this.auth.isStandalonePwa()) this.auth.bridgePwaSession();
        else {
          if (bridge) this.auth.clearPwaLoginMarker();
          this.auth.setError('Strava se conectó, pero no se ha podido recuperar la sesión.');
          this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      });
    } else if (result === 'bridge-anonymous') {
      this.auth.clearPwaLoginMarker();
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } else if (!bridge && this.auth.shouldRecoverPwaSession()) {
      this.auth.bridgePwaSession();
    }
  }
  submit() {
    this.auth.loginWithStrava();
  }
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <div class="app-frame">
      <aside class="side-nav">
        <a class="brand-lockup side-brand" routerLink="/app/dashboard"
          ><span class="brand-mark">A</span><span>ALON <em>SPORTS</em></span></a
        >
        <nav class="main-nav" aria-label="Principal">
          <a
            routerLink="/app/dashboard"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            ><mat-icon>dashboard</mat-icon><span>Resumen</span></a
          ><a routerLink="/app/activities" routerLinkActive="active"
            ><mat-icon>directions_run</mat-icon><span>Actividades</span></a
          ><a routerLink="/app/segments" routerLinkActive="active"
            ><mat-icon>route</mat-icon><span>Segmentos</span></a
          ><a routerLink="/app/import" routerLinkActive="active"
            ><mat-icon>add_circle</mat-icon><span>Importar</span></a
          ><a routerLink="/app/more" routerLinkActive="active"
            ><mat-icon>more_horiz</mat-icon><span>Más</span></a
          >
        </nav>
        <div class="side-bottom">
          <a routerLink="/app/settings" routerLinkActive="active"
            ><mat-icon>settings</mat-icon><span>Configuración</span></a
          ><button class="profile-mini" routerLink="/app/settings">
            <span class="avatar">JA</span
            ><span><strong>Jorge Alonso</strong><small>Ver perfil</small></span
            ><mat-icon>more_horiz</mat-icon>
          </button>
        </div>
      </aside>
      <main class="content-column">
        <header class="mobile-header">
          <a class="brand-lockup" routerLink="/app/dashboard"
            ><span class="brand-mark">A</span><span>ALON <em>SPORTS</em></span></a
          ><button class="icon-button" routerLink="/app/settings">
            <span class="avatar small">JA</span>
          </button>
        </header>
        <router-outlet />
      </main>
      <nav class="bottom-nav" aria-label="Navegación móvil">
        <a
          routerLink="/app/dashboard"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          ><mat-icon>dashboard</mat-icon><span>Resumen</span></a
        ><a routerLink="/app/activities" routerLinkActive="active"
          ><mat-icon>directions_run</mat-icon><span>Salidas</span></a
        ><a routerLink="/app/segments" routerLinkActive="active"
          ><mat-icon>route</mat-icon><span>Segmentos</span></a
        ><a routerLink="/app/more" routerLinkActive="active"
          ><mat-icon>more_horiz</mat-icon><span>Más</span></a
        ><a routerLink="/app/settings" routerLinkActive="active"
          ><mat-icon>person</mat-icon><span>Perfil</span></a
        >
      </nav>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {}

@Component({
  selector: 'app-dashboard-chart',
  template: `<div class="dashboard-chart">
    <canvas
      #canvas
      aria-label="Evolución de kilómetros diarios durante los últimos 30 días"
    ></canvas>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardChart implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly points = input<DashboardChartPoint[]>([]);
  private chart?: import('chart.js').Chart;
  private resizeObserver?: ResizeObserver;
  private readonly redraw = effect(() => {
    const points = this.points();
    if (this.chart) this.update(points);
  });

  ngAfterViewInit() {
    if (typeof window === 'undefined') return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      const render = () => {
        if (this.chart) return;
        this.chart = new Chart(this.canvas.nativeElement, {
          type: 'line',
          data: this.chartData(this.points()),
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#182019',
                borderColor: 'rgba(201,244,91,.25)',
                borderWidth: 1,
                titleColor: '#f0f2eb',
                bodyColor: '#c7d0bd',
                padding: 10,
                callbacks: { label: (context: any) => ` ${Number(context.raw ?? 0).toFixed(1)} km` },
              },
            },
            scales: {
              x: {
                ticks: { color: '#65705f', maxTicksLimit: 6, maxRotation: 0, font: { size: 9 } },
                grid: { display: false },
              },
              y: {
                beginAtZero: true,
                title: { display: true, text: 'km', color: '#c9f45b', font: { size: 9, weight: 'bold' } },
                ticks: { color: '#9dbb61', font: { size: 9 } },
                grid: { color: 'rgba(255,255,255,.07)' },
              },
            },
            elements: { line: { tension: 0.35 }, point: { radius: 0, hoverRadius: 4 } },
          },
        });
        const host = this.canvas.nativeElement.parentElement;
        if (host && typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
          this.resizeObserver.observe(host);
        }
        requestAnimationFrame(() => this.chart?.resize());
      };
      requestAnimationFrame(() => requestAnimationFrame(render));
    });
  }

  private chartData(points: DashboardChartPoint[]) {
    return {
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: 'Kilómetros por día',
          data: points.map((point) => point.distance),
          borderColor: '#c9f45b',
          backgroundColor: 'rgba(201,244,91,.16)',
          borderWidth: 2.5,
          pointBackgroundColor: '#c9f45b',
          fill: true,
        },
      ],
    };
  }
  private update(points: DashboardChartPoint[]) {
    if (!this.chart) return;
    const data = this.chartData(points);
    this.chart.data.labels = data.labels;
    this.chart.data.datasets = data.datasets as any;
    this.chart.update('none');
  }
  ngOnDestroy() {
    this.redraw.destroy();
    this.resizeObserver?.disconnect();
    this.chart?.destroy();
  }
}

@Component({
  selector: 'app-activity-charts',
  imports: [MatIconModule],
  template: `<div class="activity-chart-grid">
    <article class="chart-card activity-data-chart">
      <div class="card-heading">
        <div>
          <span class="eyebrow">RITMO Y VELOCIDAD</span>
          <h2>Cómo has corrido</h2>
        </div>
        <mat-icon>speed</mat-icon>
      </div>
      <div class="activity-chart-canvas">
        <canvas #paceCanvas aria-label="Ritmo y velocidad de la actividad"></canvas>
      </div>
      <div class="chart-axis"><span>Inicio</span><span>Distancia</span><span>Final</span></div>
    </article>
    <article class="chart-card activity-data-chart">
      <div class="card-heading">
        <div>
          <span class="eyebrow">ALTITUD</span>
          <h2>Perfil del recorrido</h2>
        </div>
        <mat-icon>terrain</mat-icon>
      </div>
      <div class="activity-chart-canvas">
        <canvas #elevationCanvas aria-label="Perfil de altitud de la actividad"></canvas>
      </div>
      <div class="chart-axis"><span>Inicio</span><span>Distancia</span><span>Final</span></div>
    </article>
    <article class="chart-card activity-data-chart">
      <div class="card-heading">
        <div>
          <span class="eyebrow">FRECUENCIA CARDÍACA</span>
          <h2>Respuesta del cuerpo</h2>
        </div>
        <mat-icon>favorite</mat-icon>
      </div>
      <div class="activity-chart-canvas">
        <canvas #heartCanvas aria-label="Frecuencia cardíaca de la actividad"></canvas>
      </div>
      <div class="chart-axis"><span>Inicio</span><span>Media</span><span>Final</span></div>
    </article>
    <article class="chart-card activity-data-chart">
      <div class="card-heading">
        <div>
          <span class="eyebrow">ZONAS DE PULSO</span>
          <h2>Tiempo por intensidad</h2>
        </div>
        <mat-icon>donut_large</mat-icon>
      </div>
      <div class="activity-zone-canvas">
        <canvas #zoneCanvas aria-label="Distribución de zonas cardíacas"></canvas>
      </div>
      <p class="chart-empty" [class.visible]="!hasHeartRate()">
        No hay datos de frecuencia cardíaca.
      </p>
    </article>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityCharts implements AfterViewInit, OnDestroy {
  @ViewChild('paceCanvas', { static: true }) private paceCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('elevationCanvas', { static: true })
  private elevationCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('heartCanvas', { static: true }) private heartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('zoneCanvas', { static: true }) private zoneCanvas!: ElementRef<HTMLCanvasElement>;
  readonly streams = input<Record<string, any> | null | undefined>();
  readonly hasHeartRate = computed(() => this.values('heartrate').length > 0);
  private readonly charts: import('chart.js').Chart[] = [];
  private chartType: any;
  private chartReady = false;
  private readonly redraw = effect(() => {
    this.streams();
    if (this.chartReady) this.render();
  });

  ngAfterViewInit() {
    if (typeof window === 'undefined') return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      this.chartType = Chart;
      this.chartReady = true;
      this.render();
    });
  }

  private render() {
    this.charts.splice(0).forEach((chart) => chart.destroy());
    const labels = this.labels();
    const speed = this.values('velocity_smooth').map((value) => value * 3.6);
    const pace = speed.map((value) => (value > 0 ? 60 / value : null));
    const altitude = this.values('altitude');
    const heartRate = this.values('heartrate');
    this.charts.push(
      new (this.chartConstructor())(this.paceCanvas.nativeElement, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Velocidad km/h',
              data: speed,
              borderColor: '#76a8ff',
              backgroundColor: 'rgba(118,168,255,.12)',
              fill: true,
              yAxisID: 'speed',
            },
            {
              label: 'Ritmo min/km',
              data: pace,
              borderColor: '#c9f45b',
              backgroundColor: 'transparent',
              yAxisID: 'pace',
            },
          ],
        },
        options: this.lineOptions({
          speed: { position: 'left', title: 'km/h', color: '#76a8ff' },
          pace: { position: 'right', title: 'min/km', color: '#c9f45b', reverse: true },
        }),
      }),
    );
    this.charts.push(
      new (this.chartConstructor())(this.elevationCanvas.nativeElement, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Altitud m',
              data: altitude,
              borderColor: '#f0a45d',
              backgroundColor: 'rgba(240,164,93,.18)',
              fill: true,
            },
          ],
        },
        options: this.lineOptions({ y: { position: 'left', title: 'metros', color: '#f0a45d' } }),
      }),
    );
    this.charts.push(
      new (this.chartConstructor())(this.heartCanvas.nativeElement, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Pulso bpm',
              data: heartRate,
              borderColor: '#ff7184',
              backgroundColor: 'rgba(255,113,132,.14)',
              fill: true,
            },
          ],
        },
        options: this.lineOptions({ y: { position: 'left', title: 'bpm', color: '#ff7184' } }),
      }),
    );
    const zones = this.heartZones(heartRate);
    this.charts.push(
      new (this.chartConstructor())(this.zoneCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Z1 Recuperación', 'Z2 Aeróbica', 'Z3 Tempo', 'Z4 Umbral', 'Z5 Máxima'],
          datasets: [
            {
              data: zones,
              backgroundColor: ['#7dffb2', '#c9f45b', '#f0a45d', '#ff9a5b', '#ff5b70'],
              borderColor: '#181c16',
              borderWidth: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '64%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#aab3a3', boxWidth: 9, padding: 10, font: { size: 9 } },
            },
            tooltip: {
              backgroundColor: '#182019',
              borderColor: 'rgba(201,244,91,.25)',
              borderWidth: 1,
              titleColor: '#f0f2eb',
              bodyColor: '#c7d0bd',
            },
          },
        },
      }),
    );
  }

  private chartConstructor(): any {
    return this.chartType;
  }
  private labels() {
    const distance = this.values('distance');
    return (distance.length ? distance : this.values('velocity_smooth')).map((value, index) =>
      distance.length ? `${(value / 1000).toFixed(1)} km` : `${index + 1}`,
    );
  }
  private values(name: string) {
    const values = this.streams()?.[name]?.data;
    return Array.isArray(values)
      ? values.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
  }
  private heartZones(values: number[]) {
    if (!values.length) return [0, 0, 0, 0, 0];
    const zones = [0, 0, 0, 0, 0];
    values.forEach(
      (value) => zones[value < 120 ? 0 : value < 145 ? 1 : value < 160 ? 2 : value < 175 ? 3 : 4]++,
    );
    return zones;
  }
  private lineOptions(
    axes: Record<
      string,
      { position: 'left' | 'right'; title: string; color: string; reverse?: boolean }
    >,
  ) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: { color: '#aab3a3', boxWidth: 9, boxHeight: 9, padding: 12, font: { size: 9 } },
        },
        tooltip: {
          backgroundColor: '#182019',
          borderColor: 'rgba(201,244,91,.25)',
          borderWidth: 1,
          titleColor: '#f0f2eb',
          bodyColor: '#c7d0bd',
          padding: 9,
        },
      },
      scales: Object.fromEntries(
        Object.entries(axes).map(([key, axis]) => [
          key,
          {
            position: axis.position,
            beginAtZero: !axis.reverse,
            reverse: axis.reverse ?? false,
            title: {
              display: true,
              text: axis.title,
              color: axis.color,
              font: { size: 9, weight: 'bold' },
            },
            ticks: { color: axis.color, font: { size: 9 } },
            grid: { color: 'rgba(255,255,255,.06)' },
          },
        ]),
      ),
      elements: { line: { tension: 0.3 }, point: { radius: 0, hoverRadius: 3 } },
    };
  }
  ngOnDestroy() {
    this.redraw.destroy();
    this.charts.splice(0).forEach((chart) => chart.destroy());
  }
}

@Component({
  selector: 'app-activity-card',
  imports: [RouterLink, MatIconModule],
  inputs: ['activity'],
  template: `<a class="activity-card" [routerLink]="['/app/activity', activity.id, 'overview']"
    ><div class="activity-icon" [style.--sport-color]="activity.color">
      <mat-icon>{{
        activity.sport_type === 'Ride'
          ? 'directions_bike'
          : activity.sport_type === 'Walk'
            ? 'directions_walk'
            : 'directions_run'
      }}</mat-icon>
    </div>
    <div class="activity-info">
      <div class="activity-title-row">
        <h3>{{ activity.name }}</h3>
        <mat-icon class="arrow">arrow_outward</mat-icon>
      </div>
      <p class="activity-date">
        @if (activity.date_tag) {
          <span
            class="date-tag"
            [class.today]="activity.date_tag === 'Hoy'"
            [class.yesterday]="activity.date_tag === 'Ayer'"
            [class.this-week]="activity.date_tag === 'Esta semana'"
            >{{ activity.date_tag }}</span
          >
        }
        {{ activity.date }}
      </p>
      @if (activity.labels?.length) {
        <div class="activity-labels" aria-label="Etiquetas">
          @for (label of activity.labels; track label.id) {
            <span class="activity-label" [style.--label-color]="label.color || '#c9f45b'"
              ><i></i>{{ label.name }}</span
            >
          }
        </div>
      }
      <div class="activity-meta">
        <span
          ><small>Distancia</small
          ><strong>{{ activity.distance.toFixed(1) }} <em>km</em></strong></span
        ><span
          ><small>Tiempo</small><strong>{{ activity.moving_time }} <em>min</em></strong></span
        ><span
          ><small>Desnivel acumulado</small
          ><strong>{{ activity.elevation }} <em>m</em></strong></span
        ><span
          ><small>Velocidad media</small
          ><strong>{{ activity.speed.toFixed(1) }} <em>km/h</em></strong></span
        >
      </div>
    </div></a
  >`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityCard {
  activity!: Activity;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatIconModule, DashboardChart, ActivityCard],
  template: `
    <section class="page dashboard-page">
      <div class="page-heading">
        <div>
          <p class="eyebrow">JUEVES, 04 SEP 2026</p>
          <h1>Hola, Jorge <span>✦</span></h1>
          <p class="muted">Tu cuerpo recuerda lo que tu mente empieza.</p>
        </div>
        <button class="round-button" routerLink="/app/import" aria-label="Añadir actividad">
          <mat-icon>add</mat-icon>
        </button>
      </div>
      <div class="week-banner">
        <div>
          <p class="eyebrow lime">ESTA SEMANA</p>
          <strong>Tu mejor versión se construye aquí.</strong>
        </div>
        <div class="week-ring">
          <span>74<small>%</small></span>
        </div>
      </div>
      <div class="stats-grid">
        <article class="stat-card">
          <span class="stat-label">DISTANCIA</span>
          <strong>56.8 <small>km</small></strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">TIEMPO EN MOVIMIENTO</span>
          <strong>4h 12<small>min</small></strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">DESNIVEL ACUMULADO</span>
          <strong>842 <small>m</small></strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">VELOCIDAD MEDIA</span>
          <strong>11.3 <small>km/h</small></strong>
        </article>
      </div>
      <article class="chart-card">
        <div class="card-heading">
          <div>
            <span class="eyebrow">VOLUMEN · ÚLTIMAS 8 SEMANAS</span>
            <h2>Tu ritmo, en perspectiva</h2>
          </div>
          <button class="select-button">8 semanas <mat-icon>expand_more</mat-icon></button>
        </div>
        <div class="chart-total">
          <strong>182.4</strong><span> km totales</span
          ><span class="positive">+18.6% vs. anterior</span>
        </div>
        <app-dashboard-chart [points]="chartPoints" />
        <div class="chart-axis">
          <span>km</span><span>altitud acumulada</span><span>velocidad media</span>
        </div>
      </article>
      <section class="section-heading">
        <div>
          <p class="eyebrow">TU HISTORIAL</p>
          <h2>Últimas actividades</h2>
        </div>
        <a routerLink="/app/activities">Ver todas <mat-icon>arrow_forward</mat-icon></a>
      </section>
      <div class="activity-list">
        @for (activity of activities; track activity.id) {
          <app-activity-card [activity]="activity" />
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  readonly activities = ACTIVITIES.slice(0, 3);
  readonly chartPoints: DashboardChartPoint[] = ACTIVITIES.map((activity, index) => ({
    label: `S${index + 1}`,
    distance: activity.distance,
    elevation: activity.elevation,
    speed: activity.speed,
  }));
}

@Component({
  selector: 'app-activities',
  imports: [RouterLink, ActivityCard, MatIconModule],
  template: `<section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">TU HISTORIAL</p>
        <h1>Actividades</h1>
        <p class="muted">{{ activities.length }} salidas · septiembre 2026</p>
      </div>
      <button class="round-button" routerLink="/app/import"><mat-icon>add</mat-icon></button>
    </div>
    <div class="filter-row">
      <button class="filter active">Todas</button><button class="filter">Correr</button
      ><button class="filter">Ciclismo</button><button class="filter">Caminar</button
      ><button class="filter icon-only"><mat-icon>tune</mat-icon></button>
    </div>
    <div class="month-label">SEPTIEMBRE <span>2026</span></div>
    <div class="activity-list">
      @for (activity of activities; track activity.id) {
        <app-activity-card [activity]="activity" />
      }
    </div>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivitiesPage {
  readonly activities = ACTIVITIES;
}

type RouteMapLayer = 'standard' | 'topographic' | 'contrast';

@Component({
  selector: 'app-route-map',
  template: `<div class="route-map maplibre-shell" [class.activity-route-map]="activityName()">
    <div #map class="maplibre-host"></div>
    <svg #routeOverlay class="map-route-overlay" aria-hidden="true" focusable="false">
      <polyline class="map-route-overlay-shadow"></polyline>
      <polyline class="map-route-overlay-line"></polyline>
      <g #routeDecorations class="map-route-decorations"></g>
    </svg>
    <div class="map-topbar">
      <div class="map-context">
        <span class="map-live-dot"></span>
        <div>
          <span class="map-kicker">{{ sportLabel() || 'RECORRIDO GPS' }}</span>
          <strong>{{ activityName() || 'Ruta de actividad' }}</strong>
        </div>
      </div>
      <span class="map-location">{{ location() || 'Madrid' }}</span>
    </div>
    <div class="map-tools">
      <button type="button" class="map-tool-button" [class.active]="showLayerMenu()" (click)="toggleLayerMenu()" aria-haspopup="true" [attr.aria-expanded]="showLayerMenu()">Capas</button>
      <button type="button" class="map-tool-button" [class.active]="showInfoMenu()" (click)="toggleInfoMenu()" aria-haspopup="true" [attr.aria-expanded]="showInfoMenu()">Información</button>
      @if (showLayerMenu()) {
        <div class="map-tool-menu map-layer-menu" role="menu" aria-label="Capas del mapa">
          <span class="map-menu-title">CAPA BASE</span>
          <button type="button" role="menuitemradio" [class.selected]="activeLayer() === 'standard'" [attr.aria-checked]="activeLayer() === 'standard'" (click)="setMapLayer('standard')">Mapa</button>
          <button type="button" role="menuitemradio" [class.selected]="activeLayer() === 'topographic'" [attr.aria-checked]="activeLayer() === 'topographic'" (click)="setMapLayer('topographic')">Topográfico</button>
          <button type="button" role="menuitemradio" [class.selected]="activeLayer() === 'contrast'" [attr.aria-checked]="activeLayer() === 'contrast'" (click)="setMapLayer('contrast')">Contraste</button>
        </div>
      }
      @if (showInfoMenu()) {
        <div class="map-tool-menu map-info-menu" aria-label="Información visible en el mapa">
          <span class="map-menu-title">PANEL INFERIOR</span>
          <label><input type="checkbox" [checked]="showKilometers()" (change)="showKilometers.set($any($event.target).checked)" /> Kilómetros</label>
          <label><input type="checkbox" [checked]="showAverageSpeed()" (change)="showAverageSpeed.set($any($event.target).checked)" /> Velocidad media</label>
          <label><input type="checkbox" [checked]="showMaxSpeed()" (change)="showMaxSpeed.set($any($event.target).checked)" /> Velocidad máxima</label>
          <label><input type="checkbox" [checked]="showCadence()" (change)="showCadence.set($any($event.target).checked)" /> Cadencia</label>
          <label><input type="checkbox" [checked]="showDuration()" (change)="showDuration.set($any($event.target).checked)" /> Tiempo en movimiento</label>
          <label><input type="checkbox" [checked]="showElevation()" (change)="showElevation.set($any($event.target).checked)" /> Desnivel</label>
          <span class="map-menu-title map-menu-title-spaced">ELEMENTOS DEL MAPA</span>
          <label><input type="checkbox" [checked]="showMapKilometres()" (change)="showMapKilometres.set($any($event.target).checked)" /> Kilómetros sobre la ruta</label>
          <label><input type="checkbox" [checked]="showDirection()" (change)="showDirection.set($any($event.target).checked)" /> Sentido de marcha</label>
          <label><input type="checkbox" [checked]="colorBySpeed()" (change)="colorBySpeed.set($any($event.target).checked)" /> Color por velocidad</label>
          <small class="map-menu-hint">Los datos de actividad se muestran en el panel inferior; aquí solo se controla la lectura de la trazada.</small>
        </div>
      }
    </div>
    <div class="map-legend">
      <span><i class="start-dot"></i> Inicio</span><span><i class="end-dot"></i> Final</span>
      @if (colorBySpeed()) { <span><i class="speed-dot"></i> Velocidad</span> }
      <span><i class="checkpoint-dot"></i> Hitos</span>
    </div>
  </div>
  @if (hasVisibleMapData()) {
    <div class="map-stats" aria-label="Datos visibles de la actividad">
      <div class="map-stats-heading"><span>DATOS DE LA ACTIVIDAD</span><small>Panel complementario</small></div>
      @if (showKilometers()) { <span><strong>{{ distanceLabel() }}</strong><small>DISTANCIA</small></span> }
      @if (showDuration()) { <span><strong>{{ duration() || '—' }}</strong><small>EN MOVIMIENTO</small></span> }
      @if (showAverageSpeed()) { <span><strong>{{ averageSpeedLabel() }}</strong><small>VELOCIDAD MEDIA</small></span> }
      @if (showMaxSpeed()) { <span><strong>{{ maxSpeedLabel() }}</strong><small>VELOCIDAD MÁXIMA</small></span> }
      @if (showCadence()) { <span><strong>{{ cadenceLabel() }}</strong><small>CADENCIA MEDIA</small></span> }
      @if (showElevation()) { <span><strong>{{ elevationLabel() }}</strong><small>DESNIVEL</small></span> }
    </div>
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteMap implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) private mapElement!: ElementRef<HTMLDivElement>;
  @ViewChild('routeOverlay', { static: true }) private routeOverlayElement!: ElementRef<SVGSVGElement>;
  @ViewChild('routeDecorations', { static: true }) private routeDecorationsElement!: ElementRef<SVGGElement>;
  readonly routePoints = input<[number, number][]>(DEFAULT_ROUTE);
  readonly activityName = input('');
  readonly sportLabel = input('');
  readonly location = input('');
  readonly distance = input<number | null>(null);
  readonly duration = input('');
  readonly pace = input('');
  readonly averageSpeed = input<number | null>(null);
  readonly maxSpeed = input<number | null | undefined>(null);
  readonly elevation = input<number | null>(null);
  readonly streams = input<Record<string, any> | null | undefined>();
  readonly activeLayer = signal<RouteMapLayer>('standard');
  readonly showLayerMenu = signal(false);
  readonly showInfoMenu = signal(false);
  readonly showKilometers = signal(true);
  readonly showAverageSpeed = signal(true);
  readonly showMaxSpeed = signal(true);
  readonly showCadence = signal(false);
  readonly showDuration = signal(true);
  readonly showElevation = signal(true);
  readonly colorBySpeed = signal(true);
  readonly showMapKilometres = signal(true);
  readonly showDirection = signal(true);
  readonly hasVisibleMapData = computed(() => this.showKilometers() || this.showDuration() || this.showAverageSpeed() || this.showMaxSpeed() || this.showCadence() || this.showElevation());
  readonly speedValues = computed(() => this.values('velocity_smooth').map((value) => value * 3.6));
  readonly maxSpeedLabel = computed(() => {
    const values = this.speedValues().filter((value) => value >= 0);
    const streamValue = values.length ? Math.max(...values) : null;
    const value = this.maxSpeed() ?? streamValue;
    return value === null ? '—' : `${value.toFixed(1)} km/h`;
  });
  readonly averageSpeedLabel = computed(() => {
    const inputValue = this.averageSpeed();
    if (inputValue !== null && inputValue !== undefined && Number.isFinite(inputValue)) return `${inputValue.toFixed(1)} km/h`;
    const values = this.speedValues().filter((value) => value > 0);
    const value = values.length ? values.reduce((total, item) => total + item, 0) / values.length : null;
    return value === null ? (this.pace() || '—') : `${value.toFixed(1)} km/h`;
  });
  readonly cadenceLabel = computed(() => {
    const values = this.values('cadence').filter((value) => value > 0);
    const value = values.length ? values.reduce((total, item) => total + item, 0) / values.length : null;
    return value === null ? '—' : `${Math.round(value)} rpm`;
  });
  readonly routeDistance = computed(() => this.routePoints().reduce((total, point, index, points) => {
    if (!index) return total;
    return total + distanceBetween(points[index - 1], point);
  }, 0));
  readonly distanceLabel = computed(() => {
    const value = this.distance() ?? this.routeDistance() / 1000;
    return value > 0 ? `${value.toFixed(2)} km` : '—';
  });
  readonly elevationLabel = computed(() => {
    const value = this.elevation();
    return value === null || value === undefined ? '—' : `+${Math.round(value)} m`;
  });
  private map?: maplibregl.Map;
  private maplibre?: typeof import('maplibre-gl');
  private styleReady = false;
  private routeMarkers: maplibregl.Marker[] = [];
  private lastRouteKey = '';
  private readonly routeSourceId = 'activity-route';
  private readonly checkpointsSourceId = 'activity-checkpoints';
  private readonly redraw = effect(() => {
    const points = this.routePoints();
    this.streams();
    this.colorBySpeed();
    this.showKilometers();
    this.showMapKilometres();
    this.showDirection();
    const routeKey = points.length ? `${points.length}:${points[0]?.join(',')}:${points.at(-1)?.join(',')}` : '';
    if (this.styleReady && points.length > 1) {
      this.drawRoute(points, routeKey !== this.lastRouteKey);
      this.lastRouteKey = routeKey;
    }
  });

  async ngAfterViewInit() {
    if (typeof window === 'undefined') return;
    const maplibre = await import('maplibre-gl');
    this.maplibre = maplibre;
    const initial = toMapLibreCoordinates(this.routePoints());
    this.map = new maplibre.Map({
      container: this.mapElement.nativeElement,
      style: MAP_STYLE,
      center: initial[0] ?? [-3.7038, 40.4168],
      zoom: 13,
      attributionControl: { compact: true },
    });
    this.map.addControl(new maplibre.NavigationControl({ showCompass: true }), 'top-right');
    this.map.addControl(new maplibre.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
    const renderRoute = () => {
      this.styleReady = true;
      this.applyMapLayer(this.activeLayer());
      this.drawRoute(this.routePoints(), true);
      window.setTimeout(() => this.map?.resize(), 0);
    };
    this.map.once('style.load', renderRoute);
    this.map.once('load', renderRoute);
    this.map.once('idle', renderRoute);
    const refreshOverlay = () => this.updateRouteOverlay(toMapLibreCoordinates(this.routePoints()));
    this.map.on('move', refreshOverlay);
    this.map.on('resize', refreshOverlay);
    this.map.on('rotate', refreshOverlay);
    this.map.on('pitch', refreshOverlay);
  }

  private drawRoute(points: [number, number][], fitToRoute = false) {
    if (!this.map || !this.maplibre || !this.styleReady || points.length < 2) return;
    const maplibre = this.maplibre;
    const coords = toMapLibreCoordinates(points);
    if (coords.length < 2) return;
    this.updateRouteOverlay(coords);
    const routeData = this.routeFeature(coords);
    const checkpoints = [0.25, 0.5, 0.75].map((progress, index) => {
      const point = coords[Math.min(coords.length - 1, Math.max(1, Math.round((coords.length - 1) * progress)))];
      return { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: point }, properties: { label: `Hito ${index + 1}`, progress: Math.round(progress * 100) } };
    });
    this.setGeoJsonSource(this.routeSourceId, routeData);
    this.setGeoJsonSource(this.checkpointsSourceId, { type: 'FeatureCollection' as const, features: checkpoints });
    if (!this.map.getLayer('activity-route-shadow')) {
      this.map.addLayer({ id: 'activity-route-shadow', type: 'line', source: this.routeSourceId, paint: { 'line-color': '#081008', 'line-width': 10, 'line-opacity': .82, 'line-blur': 1.2 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      this.map.addLayer({ id: 'activity-route-line', type: 'line', source: this.routeSourceId, paint: { 'line-color': '#c9f45b', 'line-width': 5, 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      this.map.addLayer({ id: 'activity-checkpoints', type: 'circle', source: this.checkpointsSourceId, paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#16200b', 'circle-stroke-width': 2 } });
    }
    this.routeMarkers.forEach(marker => marker.remove());
    this.routeMarkers = [
      this.addMarker(coords[0], 'marker-start', 'Inicio'),
      this.addMarker(coords.at(-1)!, 'marker-finish', this.duration() ? `Final · ${this.duration()}` : 'Final'),
    ];
    const bounds = new maplibre.LngLatBounds(coords[0], coords[0]);
    coords.slice(1).forEach(point => bounds.extend(point));
    if (fitToRoute) {
      this.map.fitBounds(bounds, {
        padding: { top: 98, bottom: 54, left: 48, right: 48 },
        maxZoom: 14,
        duration: 0,
      });
    }
    this.updateRouteOverlay(coords);
  }

  private updateRouteOverlay(points: [number, number][]) {
    if (!this.map || !this.routeOverlayElement) return;
    const svg = this.routeOverlayElement.nativeElement;
    const shadow = svg.querySelector<SVGPolylineElement>('.map-route-overlay-shadow');
    const line = svg.querySelector<SVGPolylineElement>('.map-route-overlay-line');
    const decorations = this.routeDecorationsElement?.nativeElement;
    if (!shadow || !line || !decorations) return;
    const width = this.mapElement.nativeElement.clientWidth;
    const height = this.mapElement.nativeElement.clientHeight;
    if (width <= 0 || height <= 0 || points.length < 2) return;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const projected = points.map(([longitude, latitude]) => {
      const point = this.map!.project({ lng: longitude, lat: latitude });
      return { x: point.x, y: point.y };
    });
    const screenPoints = projected.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    shadow.setAttribute('points', screenPoints);
    line.setAttribute('points', screenPoints);
    const speeds = this.speedValues();
    const speedColorsActive = this.colorBySpeed() && speeds.length > 1;
    line.style.opacity = speedColorsActive ? '0' : '1';
    const decorationParts: string[] = [];
    if (speedColorsActive) {
      for (let index = 0; index < projected.length - 1; index += 1) {
        const start = projected[index];
        const end = projected[index + 1];
        const speed = (speeds[index] ?? speeds[index - 1] ?? 0);
        decorationParts.push(`<line class="route-speed-segment" x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" stroke="${this.speedColor(speed)}" />`);
      }
    }
    const arrowStep = Math.max(18, Math.floor(projected.length / 16));
    if (this.showDirection()) {
      for (let index = Math.floor(arrowStep / 2); index < projected.length - 1; index += arrowStep) {
        const start = projected[Math.max(0, index - 2)];
        const end = projected[Math.min(projected.length - 1, index + 2)];
        const current = projected[index];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.max(Math.hypot(dx, dy), 1);
        const ux = dx / length;
        const uy = dy / length;
        const nx = -uy;
        const ny = ux;
        const tip = { x: current.x + ux * 7, y: current.y + uy * 7 };
        const base = { x: current.x - ux * 6, y: current.y - uy * 6 };
        decorationParts.push(`<polygon class="route-direction-arrow" points="${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${(base.x + nx * 4).toFixed(1)},${(base.y + ny * 4).toFixed(1)} ${(base.x - nx * 4).toFixed(1)},${(base.y - ny * 4).toFixed(1)}" />`);
      }
    }
    if (this.showMapKilometres()) {
      const distances = this.distanceValues(points);
      let nextKilometre = 1;
      distances.forEach((distance, index) => {
        if (distance < nextKilometre * 1000 || index === 0 || index >= projected.length) return;
        const point = projected[index];
        decorationParts.push(`<g class="route-kilometre-marker"><circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="10" /><text x="${point.x.toFixed(1)}" y="${(point.y + 3).toFixed(1)}">${nextKilometre}</text></g>`);
        nextKilometre += 1;
      });
    }
    decorations.innerHTML = decorationParts.join('');
  }

  toggleLayerMenu() {
    this.showLayerMenu.update((value) => !value);
    this.showInfoMenu.set(false);
  }

  toggleInfoMenu() {
    this.showInfoMenu.update((value) => !value);
    this.showLayerMenu.set(false);
  }

  setMapLayer(layer: RouteMapLayer) {
    this.activeLayer.set(layer);
    this.showLayerMenu.set(false);
    this.applyMapLayer(layer);
  }

  private applyMapLayer(layer: RouteMapLayer) {
    if (!this.map || !this.styleReady) return;
    if (this.map.getLayer('osm-raster')) this.map.setLayoutProperty('osm-raster', 'visibility', layer === 'topographic' ? 'none' : 'visible');
    if (this.map.getLayer('topographic-raster')) this.map.setLayoutProperty('topographic-raster', 'visibility', layer === 'topographic' ? 'visible' : 'none');
    if (this.map.getLayer('osm-raster')) {
      this.map.setPaintProperty('osm-raster', 'raster-saturation', layer === 'contrast' ? -0.85 : -0.45);
      this.map.setPaintProperty('osm-raster', 'raster-brightness-min', layer === 'contrast' ? 0.2 : 0.32);
      this.map.setPaintProperty('osm-raster', 'raster-brightness-max', layer === 'contrast' ? 0.78 : 0.9);
      this.map.setPaintProperty('osm-raster', 'raster-contrast', layer === 'contrast' ? 0.22 : 0.05);
    }
  }

  private values(name: string) {
    const values = this.streams()?.[name]?.data;
    return Array.isArray(values)
      ? values.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
  }

  private distanceValues(points: [number, number][]) {
    const stream = this.values('distance');
    if (stream.length >= points.length) return points.map((_, index) => stream[index]);
    let total = 0;
    return points.map((point, index) => {
      if (index) total += distanceBetween([points[index - 1][1], points[index - 1][0]], [point[1], point[0]]);
      return total;
    });
  }

  private speedColor(value: number) {
    const max = Math.max(25, ...this.speedValues());
    const ratio = Math.max(0, Math.min(1, value / max));
    return `hsl(${Math.round(12 + ratio * 112)} 88% 59%)`;
  }

  private routeFeature(coords: [number, number][]) {
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: coords },
        properties: {},
      }],
    };
  }

  private setGeoJsonSource(id: string, data: unknown) {
    if (!this.map) return;
    const source = this.map.getSource(id) as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data as GeoJSONData);
    else this.map.addSource(id, { type: 'geojson', data: data as GeoJSONData });
  }

  private addMarker(point: [number, number], className: string, label: string) {
    const element = document.createElement('span');
    element.className = `maplibre-route-marker ${className}`;
    if (!this.maplibre) throw new Error('MapLibre no está disponible');
    return new this.maplibre.Marker({ element }).setLngLat(point).setPopup(new this.maplibre.Popup({ offset: 12 }).setText(label)).addTo(this.map!);
  }

  ngOnDestroy() {
    this.redraw.destroy();
    this.styleReady = false;
    this.routeMarkers.forEach(marker => marker.remove());
    this.map?.remove();
  }
}

@Component({
  selector: 'app-activity',
  imports: [RouterLink, MatIconModule, RouteMap, ActivityCharts],
  template: `
    <section class="page activity-page">
      <div class="back-row">
        <a routerLink="/app/activities"><mat-icon>arrow_back</mat-icon> Actividades</a
        ><button class="icon-button"><mat-icon>more_horiz</mat-icon></button>
      </div>
      <div class="activity-hero">
        <div class="sport-pill"><mat-icon>directions_run</mat-icon> Correr</div>
        <p class="eyebrow">HOY · 18:30 · PARQUE DEL RETIRO</p>
        <h1>Rodaje de martes</h1>
        <p class="muted">Una salida sólida para mantener el ritmo.</p>
      </div>
      <div class="activity-score">
        <div>
          <span class="eyebrow">ESFUERZO RELATIVO</span><strong>7 <small>/ 10</small></strong>
        </div>
        <div class="score-bar"><i style="width: 70%"></i></div>
        <span class="score-label">Moderado</span>
      </div>
      <div class="activity-metrics">
        <div>
          <span>Distancia</span><strong>8.52 <small>km</small></strong>
        </div>
        <div><span>Tiempo</span><strong>45:02</strong></div>
        <div>
          <span>Ritmo medio</span><strong>5:18 <small>/km</small></strong>
        </div>
        <div>
          <span>Desnivel</span><strong>75 <small>m</small></strong>
        </div>
      </div>
      <nav class="sub-tabs" aria-label="Secciones de actividad">
        <a [routerLink]="['/app/activity', id, 'overview']" [class.active]="section === 'overview'"
          >Resumen</a
        ><a [routerLink]="['/app/activity', id, 'charts']" [class.active]="section === 'charts'"
          >Gráficos</a
        ><a [routerLink]="['/app/activity', id, 'stats']" [class.active]="section === 'stats'"
          >Estadísticas</a
        ><a [routerLink]="['/app/activity', id, 'segments']" [class.active]="section === 'segments'"
          >Segmentos</a
        ><a [routerLink]="['/app/activity', id, 'details']" [class.active]="section === 'details'"
          >Datos</a
        >
      </nav>
      @if (section === 'overview') {
        <app-route-map />
        <div class="section-heading compact">
          <div>
            <p class="eyebrow">RESUMEN DE LA SALIDA</p>
            <h2>Buen trabajo, Jorge.</h2>
          </div>
          <button class="icon-button"><mat-icon>share</mat-icon></button>
        </div>
        <div class="insight-card">
          <span class="insight-icon"><mat-icon>bolt</mat-icon></span>
          <div>
            <strong>Ritmo constante</strong>
            <p>Has mantenido una variación de solo 4% durante toda la salida.</p>
          </div>
        </div>
        <div class="segment-preview">
          <div class="section-heading compact">
            <div>
              <p class="eyebrow">SEGMENTOS DESTACADOS</p>
              <h2>3 esfuerzos</h2>
            </div>
            <a routerLink="/app/segments">Ver todos <mat-icon>arrow_forward</mat-icon></a>
          </div>
          @for (segment of segments; track segment.id) {
            <a class="segment-row" [routerLink]="['/app/segments', segment.id]"
              ><span class="segment-color" [style.background]="segment.color"></span>
              <div>
                <strong>{{ segment.name }}</strong>
                <p>{{ segment.distance }} · {{ segment.attempts }} intentos @if (segment.absolute_rank_position) { <span class="absolute-position">· Pos. abs.: {{ segment.absolute_rank_position }}º</span> }</p>
              </div>
              <b>{{ segment.best }}</b
              ><mat-icon>chevron_right</mat-icon></a
            >
          }
        </div>
      } @else if (section === 'charts') {
        <app-activity-charts [streams]="legacyStreams" />
      } @else if (section === 'stats') {
        <div class="detail-grid">
          <article class="detail-card">
            <span>RITMO MEDIO</span><strong>5:18 <small>/km</small></strong>
            <p class="positive">+ 12 seg vs. media</p>
          </article>
          <article class="detail-card">
            <span>FRECUENCIA CARDÍACA</span><strong>154 <small>bpm</small></strong>
            <p>Máx. 172 bpm</p>
          </article>
          <article class="detail-card">
            <span>CADENCIA</span><strong>168 <small>spm</small></strong>
            <p>Máx. 177 spm</p>
          </article>
          <article class="detail-card">
            <span>CALORÍAS</span><strong>612 <small>kcal</small></strong>
            <p>Estimación</p>
          </article>
        </div>
        <app-activity-charts [streams]="legacyStreams" />
      } @else if (section === 'segments') {
        <div class="segment-list">
          @for (segment of segments; track segment.id) {
            <a class="segment-row large" [routerLink]="['/app/segments', segment.id]"
              ><span class="segment-color" [style.background]="segment.color"></span>
              <div>
                <strong>{{ segment.name }}</strong>
                <p>{{ segment.distance }} · {{ segment.elevation }}</p>
                <small
                  >Tu posición: <b>{{ segment.rank }}</b></small
                >
              </div>
              <b>{{ segment.best }}</b
              ><mat-icon>chevron_right</mat-icon></a
            >
          }
        </div>
      } @else {
        <div class="details-list">
          <div><span>Nombre</span><strong>Rodaje de martes</strong></div>
          <div><span>Tipo</span><strong>Correr · Carrera</strong></div>
          <div><span>Inicio</span><strong>04 sep 2026, 18:30</strong></div>
          <div><span>Dispositivo</span><strong>Garmin Forerunner 265</strong></div>
          <div>
            <span>Fuente</span><strong>Strava <span class="source-dot"></span></strong>
          </div>
          <div><span>Notas</span><strong>Me encontré bien.</strong></div>
        </div>
        <button class="outline-button full"><mat-icon>edit</mat-icon> Editar actividad</button>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityPage {
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? ACTIVITIES[0].id;
  readonly section = this.route.snapshot.paramMap.get('section') ?? 'overview';
  readonly segments = SEGMENTS;
  readonly legacyStreams = {
    distance: { data: [0, 850, 1700, 2600, 3500, 4400, 5300, 6200, 7100, 8520] },
    velocity_smooth: { data: [2.9, 3.1, 3.0, 3.2, 3.15, 3.25, 3.18, 3.3, 3.2, 3.15] },
    altitude: { data: [620, 625, 628, 631, 638, 644, 651, 648, 655, 662] },
    heartrate: { data: [142, 148, 152, 155, 158, 160, 157, 162, 159, 154] },
  };
}

@Component({
  selector: 'app-segments',
  imports: [RouterLink, MatIconModule],
  template: `<section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">MARCA TU TERRENO</p>
        <h1>Segmentos</h1>
        <p class="muted">Tus tramos favoritos y sus récords.</p>
      </div>
      <button class="round-button" routerLink="/app/segments/new"><mat-icon>add</mat-icon></button>
    </div>
    <div class="segment-summary">
      <div><strong>3</strong><span>segmentos propios</span></div>
      <div><strong>4</strong><span>récords personales</span></div>
      <div><strong>2</strong><span>grupos activos</span></div>
    </div>
    <div class="filter-row">
      <button class="filter active">Todos</button><button class="filter">Más rápidos</button
      ><button class="filter">Más usados</button
      ><button class="filter icon-only"><mat-icon>tune</mat-icon></button>
    </div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">TUS SEGMENTOS</p>
        <h2>Último rendimiento</h2>
      </div>
      <button class="text-button">Ordenar <mat-icon>swap_vert</mat-icon></button>
    </div>
    <div class="segment-list">
      @for (segment of segments; track segment.id) {
        <a class="segment-card" [routerLink]="['/app/segments', segment.id]"
          ><div class="segment-card-top">
            <span class="segment-color" [style.background]="segment.color"></span>
            <div>
              <h3>{{ segment.name }}</h3>
              <p>{{ segment.distance }} · {{ segment.elevation }}</p>
            </div>
            <mat-icon>arrow_outward</mat-icon>
          </div>
          <div class="segment-card-bottom">
            <div>
              <span class="eyebrow">MEJOR TIEMPO</span><strong>{{ segment.best }}</strong>
            </div>
            <div>
              <span class="eyebrow">TIEMPO MEDIO</span><strong>{{ segment.average }}</strong>
            </div>
            <div>
              <span class="eyebrow">INTENTOS</span><strong>{{ segment.attempts }}</strong>
            </div>
          </div></a
        >
      }
    </div>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentsPage {
  readonly segments = SEGMENTS;
}

@Component({
  selector: 'app-segment-detail',
  imports: [RouterLink, MatIconModule, RouteMap, SegmentPerformanceChart],
  template: `<section class="page">
    <div class="back-row">
      <a routerLink="/app/segments"><mat-icon>arrow_back</mat-icon> Segmentos</a
      ><span class="api-badge">API</span>
    </div>
    @if (loading()) {
      <div class="loading-state">
        <mat-icon>sync</mat-icon>
        <p>Cargando detalle del segmento…</p>
      </div>
    } @else {
      <div class="segment-detail-title">
        <span class="segment-color big" [style.background]="color()"></span>
        <div>
          <p class="eyebrow">SEGMENTO PROPIO · {{ sportLabel() }}</p>
          <h1>{{ name() }}</h1>
          <p class="muted">{{ distance() }} · {{ elevation() }}</p>
        </div>
      </div>
      <div class="record-banner">
        <div>
          <span class="eyebrow lime">TU MEJOR TIEMPO</span><strong>{{ bestTime() }}</strong>
          <p>{{ attempts() }} esfuerzos registrados</p>
        </div>
        <mat-icon>emoji_events</mat-icon>
      </div>
      <div class="segment-metrics">
        <div>
          <span>Intentos</span><strong>{{ attempts() }}</strong>
        </div>
        <div>
          <span>Media</span><strong>{{ averageTime() }}</strong>
        </div>
        <div>
          <span>Velocidad máx.</span><strong>{{ bestSpeed() }}</strong>
        </div>
      </div>
      <div class="chart-card">
        <div class="card-heading">
          <div>
            <span class="eyebrow">EVOLUCIÓN · API</span>
            <h2>Tu rendimiento</h2>
          </div>
        </div>
        <app-segment-performance-chart [values]="trend()" [color]="color()" />
        <div class="chart-axis"><span>PRIMER ESFUERZO</span><span>ÚLTIMO ESFUERZO</span></div>
      </div>
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">RECORRIDO</p>
          <h2>El tramo</h2>
        </div>
      </div>
      <app-route-map [routePoints]="mapPoints()" />
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">RANKING PERSONAL</p>
          <h2>Mejores esfuerzos</h2>
        </div>
      </div>
      <div class="ranking-table">
        <div class="rank-row header">
          <span>#</span><span>Fecha</span><span>Tiempo</span><span>Ritmo</span>
        </div>
        @for (effort of efforts(); track effort.id) {
          <div class="rank-row">
            <span [class.medal]="effort.ranking_position === 1">{{ effort.ranking_position }}</span
            ><span class="ranking-date">
              @if (dateTag(effort.start_date_local)) {
                <span
                  class="date-tag"
                  [class.today]="dateTag(effort.start_date_local) === 'Hoy'"
                  [class.yesterday]="dateTag(effort.start_date_local) === 'Ayer'"
                  [class.this-week]="dateTag(effort.start_date_local) === 'Esta semana'"
                  >{{ dateTag(effort.start_date_local) }}</span
                >
              }
              {{ formatDate(effort.start_date_local) }}</span
            ><strong>{{ duration(effort.elapsed_time) }}</strong
            ><span>{{ speed(effort.average_speed) }}</span>
          </div>
        } @empty {
          <div class="empty-state">Todavía no hay esfuerzos registrados.</div>
        }
      </div>
    }
    @if (error()) {
      <p class="api-error">{{ error() }}</p>
    }
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly data = inject(SportsDataStore);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly loading = signal(true);
  readonly error = signal('');
  readonly detail = signal<ApiSegmentDetail | null>(null);
  private readonly fallback = SEGMENTS.find((item) => item.id === this.id) ?? SEGMENTS[0];
  readonly segment = computed(() => this.detail()?.segment ?? {});
  readonly name = computed(() => String(this.segment()['name'] ?? this.fallback.name));
  readonly color = computed(() => String(this.segment()['color'] ?? this.fallback.color));
  readonly distance = computed(() => {
    const value = Number(this.segment()['distance']);
    return Number.isFinite(value) && value > 0
      ? `${(value / 1000).toFixed(2)} km`
      : this.fallback.distance;
  });
  readonly elevation = computed(
    () => `+${Math.round(Number(this.segment()['elevation_gain'] ?? 0))} m`,
  );
  readonly attempts = computed(() =>
    Number(
      this.detail()?.ranking?.attempts ?? this.segment()['effort_count'] ?? this.fallback.attempts,
    ),
  );
  readonly bestTime = computed(
    () =>
      this.duration(
        Number(this.detail()?.ranking?.best_time ?? this.segment()['best_time'] ?? 0),
      ) || this.fallback.best,
  );
  readonly averageTime = computed(
    () => this.duration(Number(this.detail()?.ranking?.average_time ?? 0)) || '—',
  );
  readonly bestSpeed = computed(() => {
    const speed = Number(this.detail()?.ranking?.best_speed ?? this.segment()['best_speed'] ?? 0);
    return speed ? `${(speed * 3.6).toFixed(1)} km/h` : '—';
  });
  readonly efforts = computed(() =>
    (this.detail()?.ranking?.top_efforts ?? this.detail()?.efforts_by_activity ?? []).slice(0, 10),
  );
  readonly trend = computed(() =>
    (this.detail()?.evolution ?? [])
      .map((item) => Number(item.elapsed_time ?? 0))
      .filter((value) => value > 0),
  );
  readonly mapPoints = computed<[number, number][]>(() =>
    this.detail()?.map?.points?.length
      ? this.detail()!.map.points
      : DEFAULT_ROUTE,
  );
  readonly sportLabel = computed(() =>
    String(this.segment()['sport_type'] ?? 'Run')
      .toLowerCase()
      .includes('ride')
      ? 'CICLISMO'
      : 'CORRER',
  );
  constructor() {
    this.api
      .segmentDetail(this.id)
      .subscribe({
        next: (value) => this.detail.set(value),
        error: () => this.error.set('No se ha podido cargar el detalle agregado.'),
        complete: () => this.loading.set(false),
      });
  }
  duration(seconds: number) {
    return seconds
      ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
      : '';
  }
  speed(value: unknown) {
    const speed = Number(value ?? 0);
    return speed ? `${(speed * 3.6).toFixed(1)} km/h` : '—';
  }
  formatDate(value: unknown) {
    return formatActivityDate(value);
  }
  dateTag(value: unknown) {
    return activityDateTag(value);
  }
}

@Component({
  selector: 'app-segment-editor',
  imports: [RouterLink, FormsModule, MatIconModule, RouteMap],
  template: `<section class="page">
    <div class="back-row">
      <a routerLink="/app/segments"><mat-icon>arrow_back</mat-icon> Segmentos</a>
    </div>
    <div class="page-heading">
      <div>
        <p class="eyebrow">CREA TU TRAMO</p>
        <h1>Nuevo segmento</h1>
        <p class="muted">Define una parte de tu recorrido para seguirla siempre.</p>
      </div>
    </div>
    <div class="editor-map"><app-route-map [routePoints]="routePoints()" /></div>
    <div class="form-card">
      <p class="eyebrow">CONFIGURACIÓN</p>
      <label
        >Actividad de referencia<select [(ngModel)]="activityId">
          <option value="">Selecciona una actividad</option>
          @for (activity of activities(); track activity.id) {
            <option [value]="activity.id">{{ activity.name }}</option>
          }
        </select></label
      ><label>Nombre del segmento<input [(ngModel)]="name" placeholder="Ej. Cuesta final" /></label>
      <div class="two-fields">
        <label>Inicio del tramo<input type="number" [(ngModel)]="start" min="0" /></label
        ><label>Fin del tramo<input type="number" [(ngModel)]="end" min="1" /></label>
      </div>
      <div class="two-fields">
        <label
          >Radio de coincidencia<select [(ngModel)]="radius">
            <option [value]="50">50 m</option>
            <option [value]="80">80 m</option>
            <option [value]="120">120 m</option>
          </select></label
        ><label
          >Color<select [(ngModel)]="color">
            <option value="#c9f45b">Lima</option>
            <option value="#76a8ff">Azul</option>
            <option value="#f0a45d">Naranja</option>
          </select></label
        >
      </div>
      <div class="editor-note">
        <mat-icon>info</mat-icon
        ><span
          >La API recalculará automáticamente los esfuerzos de todas tus actividades
          compatibles.</span
        >
      </div>
      <button class="primary-button full" type="button" (click)="save()" [disabled]="saving()">
        {{ saving() ? 'Guardando…' : saved() ? 'Segmento guardado' : 'Guardar segmento' }}
        <mat-icon>{{ saved() ? 'check' : 'arrow_forward' }}</mat-icon>
      </button>
    </div>
    @if (error()) {
      <p class="api-error">{{ error() }}</p>
    }
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentEditorPage {
  private readonly api = inject(ApiService);
  private readonly data = inject(SportsDataStore);
  readonly activities = computed(() => this.data.activities());
  activityId = '';
  name = '';
  start = 120;
  end = 240;
  radius = 80;
  color = '#c9f45b';
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly routePoints = computed<[number, number][]>(() => DEFAULT_ROUTE);
  constructor() {
    this.data.loadActivities();
  }
  save() {
    if (!this.activityId) {
      this.error.set('Selecciona una actividad de referencia.');
      return;
    }
    if (this.end <= this.start || this.end - this.start < 2) {
      this.error.set('El segmento debe incluir al menos tres puntos.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api
      .createSegment({
        activity_id: this.activityId,
        name: this.name.trim() || 'Nuevo segmento',
        start_index: this.start,
        end_index: this.end,
        color: this.color,
        radius: this.radius,
      })
      .subscribe({
        next: () => {
          this.saved.set(true);
          this.data.loadSegments(true);
        },
        error: () => this.error.set('No se ha podido guardar el segmento.'),
        complete: () => this.saving.set(false),
      });
  }
}

@Component({
  selector: 'app-share',
  imports: [FormsModule, RouterLink, MatIconModule],
  template: `<section class="page share-studio-page">
    <div class="back-row">
      <a [routerLink]="['/app/activity', id, 'overview']"
        ><mat-icon>arrow_back</mat-icon> Actividad</a
      >
    </div>
    <div class="page-heading">
      <div>
        <p class="eyebrow">COMPARTE EL ESFUERZO</p>
        <h1>Crear tarjeta <span>para compartir</span></h1>
        <p class="muted">Diseña una imagen lista para publicar con los datos que tú elijas.</p>
      </div>
    </div>
    <div class="share-studio-layout">
      <div class="share-editor-column">
        <article class="share-control-card">
          <div class="share-card-heading">
            <div>
              <p class="eyebrow">1 · PLANTILLA</p>
              <h2>Elige una tarjeta</h2>
            </div>
            <span class="share-step">{{ selectedPreset().label }}</span>
          </div>
          <div class="share-preset-grid">
            @for (preset of presets; track preset.id) {
              <button type="button" class="share-preset" [class.selected]="preset.id === presetId()" (click)="presetId.set(preset.id)">
                <span class="share-preset-art" [class]="'preset-art-' + preset.id">
                  <i></i><b></b><em></em>
                </span>
                <strong>{{ preset.label }}</strong><small>{{ preset.description }}</small>
              </button>
            }
          </div>
        </article>

        <article class="share-control-card">
          <div class="share-card-heading">
            <div>
              <p class="eyebrow">2 · COMPOSICIÓN</p>
              <h2>Ajusta el lienzo</h2>
            </div>
          </div>
          <div class="share-field-group">
            <span class="share-label">TAMAÑO</span>
            <div class="segmented-control">
              @for (size of sizes; track size.id) {
                <button type="button" [class.active]="cardSize() === size.id" (click)="cardSize.set(size.id)"><mat-icon>{{ size.icon }}</mat-icon>{{ size.label }}</button>
              }
            </div>
          </div>
          <div class="share-field-group">
            <span class="share-label">ESTILO DEL MAPA</span>
            <div class="map-style-row">
              @for (map of mapStyles; track map.id) {
                <button type="button" class="map-style-option" [class.active]="mapStyle() === map.id" (click)="mapStyle.set(map.id)">
                  <span [class]="'map-style-swatch map-style-' + map.id"><i></i></span><small>{{ map.label }}</small>
                </button>
              }
            </div>
          </div>
          <div class="share-field-group two-fields">
            <label><span class="share-label">POSICIÓN DEL MAPA</span>
              <select [(ngModel)]="mapPosition"><option value="background">Fondo completo</option><option value="top">Parte superior</option><option value="bottom">Parte inferior</option></select>
            </label>
            <label><span class="share-label">ALINEACIÓN DEL TEXTO</span>
              <select [(ngModel)]="textPosition"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select>
            </label>
          </div>
        </article>

        <article class="share-control-card">
          <div class="share-card-heading">
            <div>
              <p class="eyebrow">3 · INFORMACIÓN</p>
              <h2>¿Qué quieres mostrar?</h2>
            </div>
            <button type="button" class="text-button" (click)="toggleAllFields()">{{ allFieldsSelected() ? 'Ocultar todo' : 'Mostrar todo' }}</button>
          </div>
          <div class="share-info-grid">
            @for (field of fieldOptions; track field.id) {
              <label class="share-check" [class.checked]="fields[field.id]">
                <input type="checkbox" [(ngModel)]="fields[field.id]" />
                <span class="share-check-box"><mat-icon>check</mat-icon></span>
                <span><strong>{{ field.label }}</strong><small>{{ field.description }}</small></span>
              </label>
            }
          </div>
        </article>

        <article class="share-control-card visibility-card">
          <div class="share-card-heading">
            <div><p class="eyebrow">PRIVACIDAD</p><h2>Protege tu recorrido</h2></div>
          </div>
          <button class="share-option share-option-button" type="button" (click)="hideStart = !hideStart">
            <span class="settings-icon"><mat-icon>visibility_off</mat-icon></span><span><strong>Ocultar punto de inicio</strong><small>Difumina los primeros metros de tu ruta</small></span><span class="toggle" [class.on]="hideStart"><i></i></span>
          </button>
        </article>
      </div>

      <aside class="share-preview-column">
        <div class="share-preview-sticky">
          <div class="share-preview-header"><div><p class="eyebrow">VISTA PREVIA</p><h2>Así se verá tu tarjeta</h2></div><span class="live-dot">EN DIRECTO</span></div>
          <div [class]="'share-card-preview ' + previewClasses()" [style.--preview-align]="textPosition" [style.--preview-justify]="textPosition === 'left' ? 'flex-start' : textPosition === 'right' ? 'flex-end' : 'center'">
            <div [class]="'share-card-map map-bg-' + mapStyle()">
              <svg viewBox="0 0 360 480" preserveAspectRatio="none" aria-label="Previsualización de la ruta">
                <path class="preview-road road-one" d="M-30 120 C 50 80, 84 165, 145 140 S 265 65, 395 100" />
                <path class="preview-road road-two" d="M-40 350 C 58 305, 98 380, 175 322 S 300 245, 400 280" />
                <path class="preview-route" [attr.d]="previewRoutePath()" />
                @if (hideStart) { <circle class="preview-hide-zone" cx="54" cy="365" r="34" /> }
                <circle class="preview-start" cx="54" cy="365" r="7" />
                <circle class="preview-finish" cx="306" cy="92" r="8" />
              </svg>
            </div>
            <div class="share-card-overlay"></div>
            <div class="share-card-content">
              @if (fields.brand) { <div class="share-card-brand"><span class="brand-mark">A</span><span>ALON <em>SPORTS</em></span></div> }
              @if (fields.title) { <div class="share-card-title"><span>{{ sportLabel() }}</span><h3>{{ activity().name }}</h3></div> }
              @if (fields.date) { <p class="share-card-date">{{ activity().date }} · {{ activity().location }}</p> }
              @if (fields.stats) {
                <div class="share-card-stats">
                  @if (fields.distance) { <span><strong>{{ activity().distance.toFixed(2) }}</strong><small>KM</small></span> }
                  @if (fields.time) { <span><strong>{{ durationLabel() }}</strong><small>TIEMPO</small></span> }
                  @if (fields.pace) { <span><strong>{{ activity().pace }}</strong><small>{{ activity().sport_type === 'Ride' ? 'VELOCIDAD' : 'RITMO' }}</small></span> }
                  @if (fields.elevation) { <span><strong>{{ activity().elevation }}</strong><small>DESNIVEL M</small></span> }
                </div>
              }
              @if (fields.footer) { <div class="share-card-footer"><span>Recorrido GPS</span><span>ALON SPORTS · {{ activity().sport_type.toUpperCase() }}</span></div> }
            </div>
          </div>
          <div class="share-preview-actions">
            <button class="primary-button full" type="button" (click)="downloadCard()"><mat-icon>download</mat-icon>{{ generatedImage() ? 'Descargar tarjeta PNG' : 'Generar tarjeta PNG' }}</button>
            <button class="outline-button full" type="button" (click)="nativeShareImage()"><mat-icon>ios_share</mat-icon>Compartir imagen</button>
          </div>
          @if (generatedImage()) { <p class="success-message share-generated-message"><mat-icon>check_circle</mat-icon>Imagen generada. Puedes descargarla o compartirla.</p> }
          @if (loading()) { <p class="share-loading"><mat-icon>sync</mat-icon> Cargando datos de la actividad…</p> }
        </div>
      </aside>
    </div>

    <section class="generated-cards-section">
      <div class="section-heading compact"><div><p class="eyebrow">TUS TARJETAS</p><h2>Genera distintas versiones</h2></div><span class="share-card-count">{{ savedCards().length }} guardadas</span></div>
      <div class="generated-card-list">
        @for (card of savedCards(); track card.id) {
          <button type="button" class="generated-card-item" (click)="restoreCard(card)"><span class="generated-card-thumb" [class]="'thumb-' + card.presetId"><mat-icon>{{ card.icon }}</mat-icon></span><span><strong>{{ card.label }}</strong><small>{{ card.sizeLabel }} · {{ card.mapLabel }}</small></span><mat-icon>edit</mat-icon></button>
        } @empty { <div class="empty-generated-cards"><mat-icon>collections</mat-icon><span>Aquí aparecerán tus versiones cuando generes más de una tarjeta.</span></div> }
      </div>
    </section>

    <section class="public-share-section">
      <div class="section-heading compact"><div><p class="eyebrow">ENLACE PÚBLICO</p><h2>Comparte también la actividad</h2></div></div>
      <p class="muted">Crea un enlace para quien quiera consultar todos los detalles de la salida.</p>
      <button class="primary-button" type="button" (click)="createLink()" [disabled]="saving()"><mat-icon>{{ shareUrl() ? 'content_copy' : 'link' }}</mat-icon>{{ saving() ? 'Generando…' : shareUrl() ? 'Copiar enlace público' : 'Crear enlace público' }}</button>
      @if (shareUrl()) { <p class="share-url">{{ shareUrl() }}</p> }
      <button class="outline-button share-native" type="button" (click)="nativeShare()"><mat-icon>share</mat-icon>Compartir enlace en otra app</button>
      @if (message()) { <p class="success-message">{{ message() }}</p> }
      @if (error()) { <p class="api-error">{{ error() }}</p> }
    </section>
    <canvas #exportCanvas class="share-export-canvas" aria-hidden="true"></canvas>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharePage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly data = inject(SportsDataStore);
  @ViewChild('exportCanvas') private exportCanvas?: ElementRef<HTMLCanvasElement>;
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly detail = signal<Record<string, any> | null>(null);
  readonly loading = signal(true);
  readonly share = signal<ApiShare | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly generatedImage = signal('');
  readonly presetId = signal<'route' | 'stats' | 'minimal'>('route');
  readonly cardSize = signal<'square' | 'portrait' | 'story'>('square');
  readonly mapStyle = signal<'night' | 'paper' | 'terrain'>('night');
  readonly savedCards = signal<Array<{ id: number; label: string; icon: string; presetId: string; sizeLabel: string; mapLabel: string; config: any }>>([]);
  readonly presets = [
    { id: 'route' as const, label: 'Ruta protagonista', description: 'Mapa a pantalla completa' },
    { id: 'stats' as const, label: 'Datos destacados', description: 'Tus métricas en primer plano' },
    { id: 'minimal' as const, label: 'Minimal', description: 'Limpia y fácil de leer' },
  ];
  readonly sizes = [
    { id: 'square' as const, label: 'Cuadrada', icon: 'crop_square' },
    { id: 'portrait' as const, label: 'Vertical', icon: 'crop_portrait' },
    { id: 'story' as const, label: 'Story', icon: 'phone_android' },
  ];
  readonly mapStyles = [
    { id: 'night' as const, label: 'Noche' },
    { id: 'paper' as const, label: 'Papel' },
    { id: 'terrain' as const, label: 'Relieve' },
  ];
  readonly fieldOptions = [
    { id: 'brand', label: 'Marca', description: 'Alon Sports' },
    { id: 'title', label: 'Nombre', description: 'Nombre de la actividad' },
    { id: 'date', label: 'Fecha y lugar', description: 'Cuándo y dónde' },
    { id: 'stats', label: 'Bloque de métricas', description: 'Resumen principal' },
    { id: 'distance', label: 'Distancia', description: 'Kilómetros recorridos' },
    { id: 'time', label: 'Tiempo', description: 'Tiempo en movimiento' },
    { id: 'pace', label: 'Ritmo / velocidad', description: 'Tu promedio' },
    { id: 'elevation', label: 'Desnivel', description: 'Metros positivos' },
    { id: 'footer', label: 'Pie de tarjeta', description: 'Detalles adicionales' },
  ] as const;
  fields: { brand: boolean; title: boolean; date: boolean; stats: boolean; distance: boolean; time: boolean; pace: boolean; elevation: boolean; footer: boolean } = { brand: true, title: true, date: true, stats: true, distance: true, time: true, pace: true, elevation: false, footer: true };
  mapPosition: 'background' | 'top' | 'bottom' = 'background';
  textPosition: 'left' | 'center' | 'right' = 'left';
  hideStart = true;
  readonly shareUrl = computed(() => this.share()?.url ?? '');
  readonly activity = computed(() => this.detail() ? this.data.toActivity(this.detail()?.['activity'] ?? this.detail()) : (this.data.activities().find((item) => item.id === this.id) ?? ACTIVITIES[0]));
  readonly routePoints = computed<[number, number][]>(() => {
    const map = this.detail()?.['map'] as NormalizedMap | undefined;
    const stream = this.detail()?.['streams']?.['latlng'];
    const raw = map?.points?.length ? map.points : stream?.data;
    return Array.isArray(raw) && raw.length > 1 ? raw as [number, number][] : DEFAULT_ROUTE;
  });
  readonly sportLabel = computed(() => this.activity().sport_type === 'Ride' ? 'Ciclismo' : this.activity().sport_type === 'Walk' ? 'Caminar' : 'Correr');
  readonly selectedPreset = computed(() => this.presets.find((preset) => preset.id === this.presetId()) ?? this.presets[0]);
  previewClasses() {
    return `share-card-size-${this.cardSize()} share-preset-${this.presetId()} share-map-position-${this.mapPosition}`;
  }
  allFieldsSelected() {
    return this.fieldOptions.every((field) => this.fields[field.id]);
  }
  readonly previewRoutePath = computed(() => this.routePath(this.routePoints(), 360, 480));
  constructor() {
    this.data.loadActivities();
    this.api.activity(this.id).subscribe({ next: (value) => this.detail.set(value), error: () => this.loading.set(false), complete: () => this.loading.set(false) });
    this.api
      .getShare(this.id)
      .subscribe({ next: (value) => this.share.set(value), error: () => undefined });
  }
  durationLabel() {
    const seconds = Number(this.activity().moving_time_seconds ?? this.activity().moving_time * 60);
    return seconds > 0 ? `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')}` : '—';
  }
  toggleAllFields() {
    const next = !this.allFieldsSelected();
    this.fieldOptions.forEach((field) => this.fields[field.id] = next);
  }
  restoreCard(card: { config: any }) {
    const config = card.config;
    this.presetId.set(config.presetId);
    this.cardSize.set(config.cardSize);
    this.mapStyle.set(config.mapStyle);
    this.mapPosition = config.mapPosition;
    this.textPosition = config.textPosition;
    this.fields = { ...config.fields };
    this.hideStart = config.hideStart;
    this.generatedImage.set('');
  }
  private routePath(points: [number, number][], width: number, height: number) {
    const coords = points.map(([lat, lng]) => ({ lat, lng }));
    const minLat = Math.min(...coords.map((point) => point.lat));
    const maxLat = Math.max(...coords.map((point) => point.lat));
    const minLng = Math.min(...coords.map((point) => point.lng));
    const maxLng = Math.max(...coords.map((point) => point.lng));
    const pad = 42;
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);
    return coords.map((point, index) => {
      const x = pad + ((point.lng - minLng) / lngRange) * (width - pad * 2);
      const y = height - pad - ((point.lat - minLat) / latRange) * (height - pad * 2);
      return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }
  downloadCard() {
    const canvas = this.exportCanvas?.nativeElement;
    if (!canvas) return;
    const dimensions = this.cardSize() === 'square' ? [1080, 1080] : this.cardSize() === 'portrait' ? [1080, 1350] : [1080, 1920];
    canvas.width = dimensions[0]; canvas.height = dimensions[1];
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width, height = canvas.height;
    const colors = this.mapStyle() === 'night' ? { bg: '#121912', line: '#c9f45b', road: '#31432d', text: '#f3f7ee', muted: '#9dab98' } : this.mapStyle() === 'paper' ? { bg: '#e9e5d7', line: '#263622', road: '#bdc7ad', text: '#182019', muted: '#54614c' } : { bg: '#3c5143', line: '#e4f0b5', road: '#829a7a', text: '#f7fbeb', muted: '#d1dcc9' };
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, width, height);
    const mapTop = this.mapPosition === 'bottom' ? height * .38 : 0;
    const mapHeight = this.mapPosition === 'background' ? height : height * .62;
    ctx.save(); ctx.globalAlpha = this.mapStyle() === 'paper' ? .42 : .32;
    for (let index = -2; index < 12; index += 1) { ctx.strokeStyle = colors.road; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(index * 180, mapTop); ctx.lineTo(index * 180 + 500, mapTop + mapHeight); ctx.stroke(); }
    ctx.restore();
    const routeCoords = this.routePoints().map(([lat, lng]) => ({ lat, lng }));
    const minLat = Math.min(...routeCoords.map((point) => point.lat)), maxLat = Math.max(...routeCoords.map((point) => point.lat));
    const minLng = Math.min(...routeCoords.map((point) => point.lng)), maxLng = Math.max(...routeCoords.map((point) => point.lng));
    const routePad = width * .12, latRange = Math.max(maxLat - minLat, .0001), lngRange = Math.max(maxLng - minLng, .0001);
    const routeXY = routeCoords.map((point) => [routePad + ((point.lng - minLng) / lngRange) * (width - routePad * 2), mapTop + mapHeight - routePad - ((point.lat - minLat) / latRange) * (mapHeight - routePad * 2)] as [number, number]);
    ctx.beginPath(); routeXY.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = 'rgba(0,0,0,.42)'; ctx.lineWidth = width * .025; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); routeXY.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = colors.line; ctx.lineWidth = width * .012; ctx.stroke();
    if (this.hideStart) { const [x, y] = routeXY[0]; ctx.fillStyle = colors.bg; ctx.globalAlpha = .92; ctx.beginPath(); ctx.arc(x, y, width * .08, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    const [startX, startY] = routeXY[0], [endX, endY] = routeXY.at(-1)!; ctx.fillStyle = colors.bg; ctx.beginPath(); ctx.arc(startX, startY, width * .022, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = colors.line; ctx.beginPath(); ctx.arc(endX, endY, width * .026, 0, Math.PI * 2); ctx.fill();
    const contentY = this.mapPosition === 'top' ? height * .67 : height * .12; const alignX = this.textPosition === 'center' ? width / 2 : this.textPosition === 'right' ? width * .88 : width * .12; ctx.textAlign = this.textPosition as CanvasTextAlign; ctx.fillStyle = colors.text;
    if (this.fields['brand']) { ctx.font = `800 ${Math.round(width * .022)}px Arial`; ctx.fillText('ALON SPORTS', alignX, contentY); }
    let lineY = contentY + width * .08; if (this.fields['title']) { ctx.font = `800 ${Math.round(width * .052)}px Arial`; ctx.fillText(this.activity().name, alignX, lineY); lineY += width * .045; }
    if (this.fields['date']) { ctx.fillStyle = colors.muted; ctx.font = `${Math.round(width * .018)}px Arial`; ctx.fillText(`${this.activity().date} · ${this.activity().location}`, alignX, lineY); lineY += width * .08; }
    if (this.fields['stats']) { const metrics: Array<[string, string]> = []; if (this.fields['distance']) metrics.push([this.activity().distance.toFixed(2), 'KM']); if (this.fields['time']) metrics.push([this.durationLabel(), 'TIEMPO']); if (this.fields['pace']) metrics.push([this.activity().pace, this.activity().sport_type === 'Ride' ? 'VELOCIDAD' : 'RITMO']); if (this.fields['elevation']) metrics.push([String(this.activity().elevation), 'DESNIVEL M']); metrics.forEach(([value, label], index) => { const spread = metrics.length > 1 ? width * .22 : 0; const x = this.textPosition === 'center' ? width / 2 + (index - (metrics.length - 1) / 2) * spread : alignX + index * width * .18; ctx.fillStyle = colors.text; ctx.font = `800 ${Math.round(width * .028)}px Arial`; ctx.fillText(value, x, lineY); ctx.fillStyle = colors.muted; ctx.font = `800 ${Math.round(width * .012)}px Arial`; ctx.fillText(label, x, lineY + width * .026); }); }
    if (this.fields['footer']) { ctx.fillStyle = colors.muted; ctx.font = `800 ${Math.round(width * .012)}px Arial`; ctx.fillText('ALON SPORTS · ACTIVIDAD GPS', alignX, height - width * .08); }
    const image = canvas.toDataURL('image/png'); this.generatedImage.set(image);
    const link = document.createElement('a'); link.href = image; link.download = `alon-sports-${this.id}-${this.presetId()}.png`; link.click();
    this.saveCurrentCard();
  }
  private saveCurrentCard() {
    const preset = this.selectedPreset(); const size = this.sizes.find((item) => item.id === this.cardSize()); const map = this.mapStyles.find((item) => item.id === this.mapStyle());
    this.savedCards.update((cards) => [...cards.filter((card) => card.presetId !== preset.id || card.sizeLabel !== size?.label), { id: Date.now(), label: preset.label, icon: this.cardSize() === 'story' ? 'phone_android' : this.cardSize() === 'portrait' ? 'crop_portrait' : 'crop_square', presetId: preset.id, sizeLabel: size?.label ?? '', mapLabel: map?.label ?? '', config: { presetId: this.presetId(), cardSize: this.cardSize(), mapStyle: this.mapStyle(), mapPosition: this.mapPosition, textPosition: this.textPosition, fields: { ...this.fields }, hideStart: this.hideStart } }]);
  }
  nativeShareImage() {
    const url = this.generatedImage(); if (!url) { this.downloadCard(); return; }
    if (typeof navigator !== 'undefined' && navigator.share) fetch(url).then((response) => response.blob()).then((blob) => { const file = new File([blob], `alon-sports-${this.id}.png`, { type: 'image/png' }); return navigator.share({ title: this.activity().name, files: [file] }); }).catch(() => undefined);
    else this.downloadCard();
  }
  createLink() {
    if (this.shareUrl()) {
      this.copy(this.shareUrl());
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api
      .createShare(this.id, {
        share_type: 'activity',
        regenerate: false,
        hide_start: this.hideStart,
        hide_name: false,
        hide_time: false,
      })
      .subscribe({
        next: (value) => {
          this.share.set(value);
          this.copy(value.url ?? '');
        },
        error: () => this.error.set('No se ha podido crear el enlace público.'),
        complete: () => this.saving.set(false),
      });
  }
  private copy(url: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard)
      navigator.clipboard
        .writeText(url)
        .then(() => this.message.set('Enlace copiado al portapapeles.'))
        .catch(() => this.message.set(url));
    else this.message.set(url);
  }
  nativeShare() {
    const url = this.shareUrl();
    if (typeof navigator !== 'undefined' && 'share' in navigator)
      (navigator as Navigator & { share: (data: ShareData) => Promise<void> })
        .share({ title: 'Alon Sports', url })
        .catch(() => undefined);
    else if (url) this.copy(url);
  }
}

@Component({
  selector: 'app-import',
  imports: [RouterLink, FormsModule, MatIconModule],
  template: `<section class="page">
    <div class="back-row">
      <a routerLink="/app/dashboard"><mat-icon>arrow_back</mat-icon> Resumen</a>
    </div>
    <div class="page-heading">
      <div>
        <p class="eyebrow">AÑADE TU HISTORIA</p>
        <h1>Importar actividad</h1>
        <p class="muted">Trae una salida de Strava o sube un archivo.</p>
      </div>
    </div>
    <article class="strava-connect-card">
      <div class="strava-brand">
        <span class="strava-dot">S</span>
        <div>
          <strong>Strava conectado</strong>
          <p>Sincroniza actividades y rutas nuevas.</p>
        </div>
      </div>
      <button class="outline-button" type="button" (click)="sync()" [disabled]="syncing()">
        {{ syncing() ? 'Sincronizando…' : 'Sincronizar ahora' }} <mat-icon>sync</mat-icon>
      </button>
    </article>
    <div class="upload-divider"><span>o importa un archivo</span></div>
    <label class="drop-zone"
      ><input type="file" accept=".fit,.gpx,.tcx" (change)="selectFile($event)" /><mat-icon
        >upload_file</mat-icon
      ><strong>{{ fileName || 'Arrastra tu archivo aquí' }}</strong
      ><span>FIT, GPX o TCX · máximo 25 MB</span
      ><button type="button" class="outline-button">Elegir archivo</button></label
    >
    <div class="form-card">
      <p class="eyebrow">DETALLES DE LA ACTIVIDAD</p>
      <label>Nombre<input [(ngModel)]="name" placeholder="Ej. Rodaje de domingo" /></label>
      <div class="two-fields">
        <label
          >Deporte<select [(ngModel)]="sport">
            <option>Run</option>
            <option>Ride</option>
            <option>Walk</option>
          </select></label
        ><label>Fecha<input type="date" [(ngModel)]="date" /></label>
      </div>
      <button class="primary-button full" type="button" (click)="import()" [disabled]="importing()">
        {{
          importing() ? 'Importando…' : imported() ? 'Actividad importada' : 'Importar actividad'
        }}
        <mat-icon>{{ imported() ? 'check' : 'arrow_forward' }}</mat-icon>
      </button>
    </div>
    @if (error()) {
      <p class="api-error">{{ error() }}</p>
    }
    @if (syncConfirmationOpen()) {
      <div
        class="modal-backdrop"
        role="presentation"
        tabindex="-1"
        (click)="closeSyncConfirmation()"
        (keydown.escape)="closeSyncConfirmation()"
      >
        <section
          class="confirmation-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-confirmation-title"
          (click)="$event.stopPropagation()"
        >
          <button
            class="icon-button modal-close"
            type="button"
            aria-label="Cerrar confirmación"
            (click)="closeSyncConfirmation()"
          >
            <mat-icon>close</mat-icon>
          </button>
          <span class="confirmation-icon"><mat-icon>check</mat-icon></span>
          <p class="eyebrow lime">STRAVA SINCRONIZADO</p>
          <h2 id="sync-confirmation-title">
            @if (syncImportedCount() === 1) {
              Actividad importada
            } @else {
              Actividades importadas
            }
          </h2>
          @if (syncImportedCount() > 0) {
            <p class="muted">
              Se han añadido {{ syncImportedCount() }}
              {{ syncImportedCount() === 1 ? 'actividad nueva' : 'actividades nuevas' }} desde Strava.
            </p>
          } @else {
            <p class="muted">No hay actividades nuevas para importar.</p>
          }
          @if (syncImportedActivities().length) {
            <div class="imported-activity-list">
              @for (activity of syncImportedActivities(); track activity.id) {
                <a class="imported-activity-row" [routerLink]="['/app/activity', activity.id, 'overview']">
                  <span class="activity-icon" [style.--sport-color]="activity.color">
                    <mat-icon>{{ activity.sport_type === 'Ride' ? 'directions_bike' : activity.sport_type === 'Walk' ? 'directions_walk' : 'directions_run' }}</mat-icon>
                  </span>
                  <span>
                    <strong>{{ activity.name }}</strong>
                    <small>{{ activity.date }}</small>
                  </span>
                  <mat-icon>arrow_forward</mat-icon>
                </a>
              }
            </div>
          }
          @if (syncImportedCount() === 1 && syncImportedActivities().length === 1) {
            <a
              class="primary-button full"
              [routerLink]="['/app/activity', syncImportedActivities()[0].id, 'overview']"
              (click)="closeSyncConfirmation()"
            >
              Ver actividad <mat-icon>arrow_forward</mat-icon>
            </a>
          } @else {
            <button class="outline-button full" type="button" (click)="closeSyncConfirmation()">
              Continuar
            </button>
          }
        </section>
      </div>
    }
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportPage {
  private readonly api = inject(ApiService);
  private readonly data = inject(SportsDataStore);
  name = '';
  sport: Sport = 'Run';
  date = new Date().toISOString().slice(0, 10);
  fileName = '';
  private file: File | null = null;
  readonly syncing = signal(false);
  readonly importing = signal(false);
  readonly imported = signal(false);
  readonly error = signal('');
  readonly syncConfirmationOpen = signal(false);
  readonly syncImportedActivities = signal<Activity[]>([]);
  readonly syncImportedCount = signal(0);
  private syncKnownActivityIds = new Set<string>();
  selectFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.file = file;
    this.fileName = file?.name ?? '';
    this.error.set(
      file && file.size > 25 * 1024 * 1024 ? 'El archivo supera el límite de 25 MB.' : '',
    );
  }
  sync() {
    this.syncing.set(true);
    this.error.set('');
    this.syncKnownActivityIds = new Set(this.data.activities().map((activity) => activity.id));
    this.api
      .syncActivities()
      .subscribe({
        next: (response) => {
          this.data.refresh();
          this.resolveSyncConfirmation(response);
        },
        error: () => this.error.set('No se han podido sincronizar las actividades.'),
        complete: () => this.syncing.set(false),
      });
  }
  closeSyncConfirmation() {
    this.syncConfirmationOpen.set(false);
  }
  private resolveSyncConfirmation(response: Record<string, unknown>) {
    const activities = this.extractSyncActivities(response);
    const activityIds = this.extractSyncActivityIds(response);
    const count = this.extractSyncCount(response, activities.length || activityIds.size);
    if (activities.length || count === 0) {
      this.openSyncConfirmation(activities, count);
      return;
    }
    this.api.activities(100).subscribe({
      next: (latest) => {
        const all = latest.activities.map((item) => this.data.toActivity(item));
        const fresh = all.filter((activity) =>
          activityIds.size ? activityIds.has(activity.id) : !this.syncKnownActivityIds.has(activity.id),
        );
        this.openSyncConfirmation(fresh.slice(0, count), count);
      },
      error: () => this.openSyncConfirmation([], count),
    });
  }
  private openSyncConfirmation(activities: Activity[], count: number) {
    this.syncImportedActivities.set(activities);
    this.syncImportedCount.set(Math.max(count, activities.length));
    this.syncConfirmationOpen.set(true);
  }
  private extractSyncActivities(response: Record<string, unknown>) {
    const singular = response['activity'];
    const singularActivity = this.toImportedActivity(singular);
    if (singularActivity) return [singularActivity];
    const sources = ['imported_activities', 'new_activities', 'imported', 'created', 'activities'];
    for (const key of sources) {
      const value = response[key];
      if (!Array.isArray(value)) continue;
      const activities = value
        .map((item) => {
          const raw = item && typeof item === 'object' && 'activity' in item
            ? (item as Record<string, unknown>)['activity']
            : item;
          return this.toImportedActivity(raw);
        })
        .filter((activity): activity is Activity => activity !== null);
      if (activities.length) return this.uniqueActivities(activities);
    }
    return [];
  }
  private toImportedActivity(raw: unknown) {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    const id = record['id'] ?? record['activity_id'];
    return id === undefined || id === null
      ? null
      : this.data.toActivity({ ...record, id });
  }
  private extractSyncActivityIds(response: Record<string, unknown>) {
    const ids = new Set<string>();
    for (const key of ['imported_ids', 'new_activity_ids', 'activity_ids']) {
      const value = response[key];
      if (Array.isArray(value)) value.forEach((id) => ids.add(String(id)));
    }
    if (response['activity_id'] !== undefined && response['activity_id'] !== null) {
      ids.add(String(response['activity_id']));
    }
    return ids;
  }
  private extractSyncCount(response: Record<string, unknown>, fallback: number) {
    for (const key of [
      'imported_count',
      'imported_activities_count',
      'new_count',
      'count',
      'created_count',
      'imported',
    ]) {
      const value = Number(response[key]);
      if (Number.isFinite(value)) return Math.max(0, value);
    }
    return fallback;
  }
  private uniqueActivities(activities: Activity[]) {
    return activities.filter((activity, index, items) =>
      items.findIndex((candidate) => candidate.id === activity.id) === index,
    );
  }
  import() {
    if (!this.file) {
      this.error.set('Selecciona un archivo FIT, GPX o TCX.');
      return;
    }
    if (this.file.size > 25 * 1024 * 1024) return;
    this.importing.set(true);
    this.imported.set(false);
    this.error.set('');
    const form = new FormData();
    form.append('name', this.name.trim() || this.file.name);
    form.append('sport_type', this.sport);
    form.append('date', this.date);
    form.append('activity_file', this.file);
    this.api.importActivity(form).subscribe({
      next: () => {
        this.imported.set(true);
        this.data.refresh();
      },
      error: () => this.error.set('No se ha podido importar la actividad.'),
      complete: () => this.importing.set(false),
    });
  }
}

@Component({
  selector: 'app-settings',
  imports: [FormsModule, MatIconModule],
  template: `<section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">TU CUENTA</p>
        <h1>Perfil y ajustes</h1>
        <p class="muted">Preferencias guardadas en tu cuenta.</p>
      </div>
    </div>
    <div class="profile-card">
      <span class="avatar large">{{ initials() }}</span>
      <div>
        <h2>{{ displayName() }}</h2>
        <p>{{ location() }}</p>
        <span class="connected"
          ><i></i>
          {{
            user()?.strava_connected === false ? 'Strava desconectado' : 'Strava conectado'
          }}</span
        >
      </div>
    </div>
    <div class="settings-group form-card">
      <p class="eyebrow">PERFIL</p>
      <div class="two-fields">
        <label>Nombre<input [(ngModel)]="profileForm.firstname" /></label
        ><label>Apellidos<input [(ngModel)]="profileForm.lastname" /></label>
      </div>
      <div class="two-fields">
        <label>Usuario<input [(ngModel)]="profileForm.username" /></label
        ><label>Ciudad<input [(ngModel)]="profileForm.city" /></label>
      </div>
      <label>País<input [(ngModel)]="profileForm.country" /></label>
    </div>
    <div class="settings-group form-card">
      <p class="eyebrow">PREFERENCIAS</p>
      <div class="two-fields">
        <label
          >Distancia<select [(ngModel)]="preferencesForm.distance_unit">
            <option value="km">Kilómetros</option>
            <option value="mi">Millas</option>
          </select></label
        ><label
          >Desnivel<select [(ngModel)]="preferencesForm.elevation_unit">
            <option value="m">Metros</option>
            <option value="ft">Pies</option>
          </select></label
        >
      </div>
      <div class="two-fields">
        <label
          >Temperatura<select [(ngModel)]="preferencesForm.temperature_unit">
            <option value="c">Celsius</option>
            <option value="f">Fahrenheit</option>
          </select></label
        ><label
          >Apariencia<select [(ngModel)]="preferencesForm.theme">
            <option value="dark">Oscuro</option>
            <option value="light">Claro</option>
            <option value="system">Sistema</option>
          </select></label
        >
      </div>
      <button class="primary-button full" type="button" (click)="save()" [disabled]="saving()">
        {{ saving() ? 'Guardando…' : saved() ? 'Cambios guardados' : 'Guardar cambios' }}
        <mat-icon>{{ saved() ? 'check' : 'arrow_forward' }}</mat-icon>
      </button>
    </div>
    @if (error()) {
      <p class="api-error">{{ error() }}</p>
    }
    <div class="settings-group">
      <p class="eyebrow">DATOS Y CONEXIONES</p>
      <div class="settings-row">
        <span class="settings-icon"><mat-icon>sync</mat-icon></span
        ><span><strong>Strava</strong><small>Sesión protegida por cookie HttpOnly</small></span
        ><span class="connected-dot"></span>
      </div>
    </div>
    <button class="logout-button" (click)="logout()">Cerrar sesión</button>
    <p class="version">ALON SPORTS · V1.0.0</p>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly user = signal<ApiUser | null>(this.auth.user());
  readonly profileForm: Partial<ApiUser> = {};
  readonly preferencesForm: ApiPreferences = {};
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  constructor() {
    this.preferencesForm = { ...this.auth.preferences() };
    this.api.profile().subscribe({
      next: (response) => {
        this.user.set(response.profile);
        Object.assign(this.profileForm, {
          firstname: response.profile.firstname,
          lastname: response.profile.lastname,
          username: response.profile.username,
          city: response.profile.city,
          country: response.profile.country,
        });
        Object.assign(this.preferencesForm, response.preferences);
      },
      error: () => this.error.set('No se ha podido cargar el perfil completo.'),
    });
  }
  readonly displayName = computed(() => {
    const user = this.user();
    return [user?.firstname, user?.lastname].filter(Boolean).join(' ') || 'Atleta';
  });
  readonly location = computed(
    () => [this.user()?.city, this.user()?.country].filter(Boolean).join(', ') || 'Sin ubicación',
  );
  readonly initials = computed(() =>
    this.displayName()
      .split(' ')
      .map((name) => name[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );
  save() {
    this.saving.set(true);
    this.saved.set(false);
    const body = {
      firstname: this.profileForm.firstname,
      lastname: this.profileForm.lastname,
      username: this.profileForm.username || null,
      city: this.profileForm.city || null,
      country: this.profileForm.country || null,
    };
    this.api.updateProfile(body).subscribe({
      next: (response) => {
        this.user.set(response.profile);
        this.auth.user.set(response.profile);
        this.api.updatePreferences(this.preferencesForm).subscribe({
          next: (result) => {
            this.auth.preferences.set(result.preferences);
            this.saved.set(true);
            this.saving.set(false);
          },
          error: () => {
            this.error.set('El perfil se guardó, pero no las preferencias.');
            this.saving.set(false);
          },
        });
      },
      error: () => {
        this.error.set('No se han podido guardar los cambios.');
        this.saving.set(false);
      },
    });
  }
  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}

@Component({
  selector: 'app-live-dashboard',
  imports: [RouterLink, MatIconModule, DashboardChart, ActivityCard],
  template: `
    <section class="page dashboard-page">
      <div class="page-heading">
        <div>
          <p class="eyebrow">TU RESUMEN REAL</p>
          <h1>Hola, {{ firstName() }} <span>✦</span></h1>
          <p class="muted">Datos sincronizados desde Alon Sports.</p>
        </div>
        <div class="dashboard-actions">
          <button
            class="outline-button dashboard-sync"
            type="button"
            aria-label="Actualizar datos de Strava"
            (click)="syncStrava()"
            [disabled]="syncing()"
          >
            <mat-icon>{{ syncing() ? 'sync' : 'refresh' }}</mat-icon>
            {{ syncing() ? 'Actualizando…' : 'Actualizar Strava' }}
          </button>
          <button class="round-button" routerLink="/app/import" aria-label="Añadir actividad">
            <mat-icon>add</mat-icon>
          </button>
        </div>
      </div>
      @if (syncMessage()) {
        <p class="dashboard-sync-message" role="status">{{ syncMessage() }}</p>
      }
      <div class="week-banner">
        <div>
          <p class="eyebrow lime">ESTADO DE ENTRENAMIENTO</p>
          <strong>{{ loading() ? 'Calculando tu estado…' : statusTitle() }}</strong>
          <span class="week-status-detail">{{ statusDetail() }}</span>
        </div>
        <div class="week-ring" [style.background]="ringBackground()">
          <span>{{ readiness() }}<small>%</small></span>
        </div>
      </div>
      <div class="stats-grid">
        <article class="stat-card">
          <span class="stat-label">DISTANCIA</span>
          <strong>{{ distance() }} <small>km</small></strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">TIEMPO EN MOVIMIENTO</span>
          <strong>{{ movingTime() }} <small>min</small></strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">DESNIVEL ACUMULADO</span>
          <strong>{{ elevation() }} <small>m</small></strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">VELOCIDAD MEDIA</span>
          <strong>{{ averageSpeed() }} <small>km/h</small></strong>
        </article>
      </div>
      <article class="chart-card">
        <div class="card-heading">
          <div>
            <span class="eyebrow">VOLUMEN · DATOS DEL DASHBOARD</span>
            <h2>Tu ritmo, en perspectiva</h2>
          </div>
          <a class="text-button" routerLink="/app/progress"
            >Ver progreso <mat-icon>arrow_forward</mat-icon></a
          >
        </div>
        <div class="chart-total">
          <strong>{{ distance() }}</strong
          ><span> km sincronizados</span><span class="positive">{{ statusDetail() }}</span>
        </div>
        <app-dashboard-chart [points]="trendPoints()" />
        <div class="dashboard-chart-footer">
          <span><i class="chart-key lime"></i>Distancia por día</span><span>{{ activeTrendDays() }} días activos · últimos 30 días</span>
        </div>
      </article>
      <section class="section-heading">
        <div>
          <p class="eyebrow">TU HISTORIAL</p>
          <h2>Últimas actividades</h2>
        </div>
        <a routerLink="/app/activities">Ver todas <mat-icon>arrow_forward</mat-icon></a>
      </section>
      <div class="activity-list">
        @for (activity of activities(); track activity.id) {
          <app-activity-card [activity]="activity" />
        }
      </div>
      @if (error()) {
        <p class="api-error">{{ error() }}</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveDashboardPage {
  private readonly data = inject(SportsDataStore);
  private readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  readonly loading = this.data.loading;
  readonly activities = computed(() => this.data.activities().slice(0, 3));
  readonly firstName = computed(() => this.auth.user()?.firstname ?? 'Atleta');
  readonly trainingLoad = signal<Record<string, any> | null>(null);
  readonly loadError = signal('');
  readonly syncing = signal(false);
  readonly syncMessage = signal('');
  readonly syncError = signal('');
  readonly error = computed(() => this.data.error() || this.loadError() || this.syncError());
  readonly trendPoints = computed<DashboardChartPoint[]>(() => {
    const source = (this.data.dashboard()?.trend ?? []) as any[];
    const byDay = new Map(source.map((item) => [String(item.day ?? '').slice(0, 10), item]));
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const pad = (value: number) => String(value).padStart(2, '0');
    return Array.from({ length: 31 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - 30 + index);
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const item = byDay.get(key) ?? {};
      const distance = Number(item.distance ?? 0) / 1000;
      const movingTime = Number(item.moving_time ?? 0);
      return {
        label: item.day
          ? String(item.day).slice(5).replace('-', '/')
          : pad(date.getDate()) + '/' + pad(date.getMonth() + 1),
        distance,
        elevation: Number(item.elevation ?? 0),
        speed: Number(
          item.average_speed ?? (movingTime > 0 ? ((distance * 1000) / movingTime) * 3.6 : 0),
        ),
      };
    });
  });
  readonly activeTrendDays = computed(() => this.trendPoints().filter((point) => point.distance > 0).length);
  readonly distance = computed(() =>
    this.formatNumber(this.data.dashboard()?.stats?.distance ?? 0),
  );
  readonly movingTime = computed(() =>
    Math.round(Number(this.data.dashboard()?.stats?.moving_time ?? 0) / 60),
  );
  readonly elevation = computed(() =>
    Math.round(Number(this.data.dashboard()?.stats?.elevation ?? 0)),
  );
  readonly averageSpeed = computed(() => {
    const distance = Number(this.data.dashboard()?.stats?.distance ?? 0);
    const moving = Number(this.data.dashboard()?.stats?.moving_time ?? 0);
    return moving > 0 ? ((distance / moving) * 3.6).toFixed(1) : '—';
  });
  readonly readiness = computed(() => {
    const current = this.trainingLoad()?.['current'] ?? {};
    const freshness = Number(current['freshness'] ?? current['form'] ?? 0);
    return Math.max(0, Math.min(100, Math.round(60 + freshness * 3)));
  });
  readonly ringBackground = computed(
    () => `conic-gradient(var(--lime) 0 ${this.readiness()}%, #3b4630 ${this.readiness()}% 100%)`,
  );
  statusTitle() {
    const current = this.trainingLoad()?.['current'] ?? {};
    const freshness = Number(current['freshness'] ?? current['form'] ?? 0);
    return freshness > 5
      ? 'Fresco para apretar'
      : freshness < -5
        ? 'Toca recuperar'
        : 'Listo para entrenar';
  }
  statusDetail() {
    const load = this.trainingLoad();
    if (!load) return 'Carga estimada con tus actividades';
    const rest = countRestDays(load);
    const ratio = Number(load['ratio']);
    return ratio > 1.5
      ? 'Carga reciente alta · prioriza recuperación'
      : `${rest} días de descanso en los últimos 7`;
  }
  constructor() {
    this.data.loadDashboard();
    this.data.loadActivities();
    this.loadTrainingLoad();
  }
  syncStrava() {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.syncMessage.set('');
    this.syncError.set('');
    this.api.syncActivities().subscribe({
      next: () => {
        this.data.refresh();
        this.loadTrainingLoad();
        this.syncMessage.set('Datos de Strava actualizados.');
      },
      error: () => {
        this.syncError.set('No se han podido actualizar los datos de Strava.');
        this.syncing.set(false);
      },
      complete: () => this.syncing.set(false),
    });
  }
  private loadTrainingLoad() {
    this.api.trainingLoad().subscribe({
      next: (value) => this.trainingLoad.set(value),
      error: () => this.loadError.set('No se ha podido cargar el estado de entrenamiento.'),
    });
  }
  private formatNumber(meters: number) {
    return (Number(meters) / 1000).toFixed(1);
  }
}

@Component({
  selector: 'app-live-activities',
  imports: [RouterLink, ActivityCard, MatIconModule],
  template: `<section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">DATOS SINCRONIZADOS</p>
        <h1>Actividades</h1>
        <p class="muted">{{ filteredActivities().length }} salidas visibles · cursor API</p>
      </div>
      <button class="round-button" routerLink="/app/import"><mat-icon>add</mat-icon></button>
    </div>
    <div class="filter-row">
      <button class="filter" [class.active]="filter() === 'All'" (click)="filter.set('All')">
        Todas</button
      ><button class="filter" [class.active]="filter() === 'Run'" (click)="filter.set('Run')">
        Correr</button
      ><button class="filter" [class.active]="filter() === 'Ride'" (click)="filter.set('Ride')">
        Ciclismo</button
      ><button class="filter" [class.active]="filter() === 'Walk'" (click)="filter.set('Walk')">
        Caminar
      </button>
    </div>
    <div class="month-label">ACTIVIDADES RECIENTES <span>API</span></div>
    <div class="activity-list">
      @for (activity of filteredActivities(); track activity.id) {
        <app-activity-card [activity]="activity" />
      } @empty {
        <div class="empty-state">No hay actividades para este filtro.</div>
      }
    </div>
    @if (hasNext()) {
      <button
        class="outline-button full load-more"
        type="button"
        (click)="loadMore()"
        [disabled]="loading()"
      >
        {{ loading() ? 'Cargando…' : 'Cargar más actividades' }} <mat-icon>expand_more</mat-icon>
      </button>
    }
    @if (error()) {
      <p class="api-error">{{ error() }}</p>
    }
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveActivitiesPage {
  private readonly data = inject(SportsDataStore);
  readonly activities = computed(() => this.data.activities());
  readonly filteredActivities = computed(() =>
    this.filter() === 'All'
      ? this.activities()
      : this.activities().filter((activity) => activity.sport_type === this.filter()),
  );
  readonly filter = signal<Sport | 'All'>('All');
  readonly error = this.data.error;
  readonly loading = this.data.loading;
  readonly hasNext = computed(() => this.data.pagination().has_next);
  constructor() {
    this.data.loadActivities();
  }
  loadMore() {
    this.data.loadMoreActivities();
  }
}

@Component({
  selector: 'app-live-segments',
  imports: [RouterLink, MatIconModule],
  template: `<section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">DATOS SINCRONIZADOS</p>
        <h1>Segmentos</h1>
        <p class="muted">Tus segmentos propios calculados por la API.</p>
      </div>
      <button class="round-button" routerLink="/app/segments/new"><mat-icon>add</mat-icon></button>
    </div>
    <div class="segment-summary">
      <div>
        <strong>{{ segments().length }}</strong
        ><span>segmentos cargados</span>
      </div>
      <div><strong>API</strong><span>fuente de datos</span></div>
      <div><strong>Live</strong><span>último estado</span></div>
    </div>
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">TUS SEGMENTOS</p>
        <h2>Último rendimiento</h2>
      </div>
    </div>
    <div class="segment-list">
      @for (segment of segments(); track segment.id) {
        <a class="segment-card" [routerLink]="['/app/segments', segment.id]"
          ><div class="segment-card-top">
            <span class="segment-color" [style.background]="segment.color"></span>
            <div>
              <h3>{{ segment.name }}</h3>
              <p>{{ segment.distance }} · {{ segment.elevation }}</p>
            </div>
            <mat-icon>arrow_outward</mat-icon>
          </div>
          <div class="segment-card-bottom">
            <div>
              <span class="eyebrow">MEJOR TIEMPO</span><strong>{{ segment.best }}</strong>
            </div>
            <div>
              <span class="eyebrow">TIEMPO MEDIO</span><strong>{{ segment.average }}</strong>
            </div>
            <div>
              <span class="eyebrow">INTENTOS</span><strong>{{ segment.attempts }}</strong>
            </div>
          </div></a
        >
      }
    </div>
    @if (error()) {
      <p class="api-error">{{ error() }}</p>
    }
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveSegmentsPage {
  private readonly data = inject(SportsDataStore);
  readonly segments = computed(() => this.data.segments());
  readonly error = this.data.error;
  constructor() {
    this.data.loadSegments();
  }
}

@Component({
  selector: 'app-live-activity',
  imports: [FormsModule, RouterLink, MatIconModule, RouteMap, ActivityCharts],
  template: `<section class="page activity-page">
    <div class="back-row">
      <a routerLink="/app/activities"><mat-icon>arrow_back</mat-icon> Actividades</a
      ><a class="icon-button" [routerLink]="['/app/activity', id, 'share']"
        ><mat-icon>share</mat-icon></a
      >
    </div>
    @if (loading()) {
      <div class="loading-state">
        <mat-icon>sync</mat-icon>
        <p>Cargando detalle de actividad…</p>
      </div>
    } @else {
      <div class="activity-hero">
        <div class="sport-pill"><mat-icon>directions_run</mat-icon> {{ sportLabel() }}</div>
        <p class="eyebrow">
          @if (activity().date_tag) {
            <span
              class="date-tag"
              [class.today]="activity().date_tag === 'Hoy'"
              [class.yesterday]="activity().date_tag === 'Ayer'"
              [class.this-week]="activity().date_tag === 'Esta semana'"
              >{{ activity().date_tag }}</span
            >
          }
          {{ activity().date }} · {{ activity().location }}
        </p>
        <h1>{{ activity().name }}</h1>
        @if (activity().labels?.length) {
          <div
            class="activity-labels activity-labels-detail"
            aria-label="Etiquetas de la actividad"
          >
            @for (label of activity().labels; track label.id) {
              <span class="activity-label" [style.--label-color]="label.color || '#c9f45b'"
                ><i></i>{{ label.name }}</span
              >
            }
          </div>
        }
      </div>
      <div class="activity-metrics">
        <div>
          <span>Distancia</span
          ><strong>{{ activity().distance.toFixed(2) }} <small>km</small></strong>
        </div>
        <div>
          <span>Tiempo en movimiento</span
          ><strong>{{ formatDuration(activity().moving_time_seconds) }}</strong>
        </div>
        <div>
          <span>Ritmo medio</span><strong>{{ activity().pace }}</strong>
        </div>
        <div>
          <span>Velocidad media</span
          ><strong>{{ activity().speed.toFixed(1) }} <small>km/h</small></strong>
        </div>
        <div>
          <span>Desnivel acumulado</span
          ><strong>{{ activity().elevation }} <small>m</small></strong>
        </div>
      </div>
      <nav class="sub-tabs" aria-label="Secciones de actividad">
        <a
          [routerLink]="['/app/activity', id, 'overview']"
          [class.active]="section() === 'overview'"
          >Resumen</a
        ><a [routerLink]="['/app/activity', id, 'charts']" [class.active]="section() === 'charts'"
          >Gráficos</a
        ><a [routerLink]="['/app/activity', id, 'stats']" [class.active]="section() === 'stats'"
          >Estadísticas</a
        ><a
          [routerLink]="['/app/activity', id, 'segments']"
          [class.active]="section() === 'segments'"
          >Segmentos</a
        ><a [routerLink]="['/app/activity', id, 'details']" [class.active]="section() === 'details'"
          >Datos</a
        >
      </nav>
      @if (section() === 'overview') {
        <app-route-map
          [routePoints]="routePoints()"
          [activityName]="activity().name"
          [sportLabel]="sportLabel()"
          [location]="activity().location"
          [distance]="activity().distance"
          [duration]="formatDuration(activity().moving_time_seconds)"
          [pace]="activity().pace"
          [averageSpeed]="activity().speed"
          [maxSpeed]="activity().max_speed"
          [elevation]="activity().elevation"
          [streams]="detail()?.['streams']"
        />
        <div class="detail-grid summary-data">
          <article class="detail-card">
            <span>TIEMPO TOTAL</span
            ><strong>{{ formatDuration(activity().elapsed_time_seconds) }}</strong>
          </article>
          <article class="detail-card">
            <span>VELOCIDAD MEDIA</span
            ><strong>{{ activity().speed.toFixed(1) }} <small>km/h</small></strong>
          </article>
          <article class="detail-card">
            <span>DESNIVEL ACUMULADO</span
            ><strong>{{ activity().elevation }} <small>m</small></strong>
          </article>
          <article class="detail-card">
            <span>CALORÍAS</span><strong>{{ formatNumber(calories()) }} <small>kcal</small></strong>
          </article>
          <article class="detail-card">
            <span>FRECUENCIA CARDÍACA MEDIA</span
            ><strong>{{ formatNumber(averageHeartRate()) }} <small>bpm</small></strong>
          </article>
          <article class="detail-card">
            <span>CADENCIA MEDIA</span
            ><strong>{{ formatNumber(cadence()) }} <small>spm</small></strong>
          </article>
        </div>
        <div class="comparison-section">
          <div class="section-heading compact">
            <div>
              <p class="eyebrow">COMPARATIVA DE RENDIMIENTO</p>
              <h2>Respecto a tu media</h2>
            </div>
          </div>
          <p class="comparison-explainer">
            Tu salida queda en una sola columna. En cada periodo puedes ver la media, la diferencia
            real y cuánto se separa del comportamiento habitual.
          </p>
          @if (comparisons().length) {
            <div class="comparison-table-wrap">
              <div class="comparison-table" aria-label="Comparativa con tus medias">
                <div class="comparison-table-row comparison-table-head">
                  <span>Métrica</span>
                  <span>Esta salida</span>
                  @for (comparison of comparisons(); track comparison.key) {
                    <span>
                      <strong>{{ comparison.label }}</strong>
                      <small>{{ comparison.activities }} salidas</small>
                    </span>
                  }
                </div>
                @for (row of comparisonRows; track row.key) {
                  <div class="comparison-table-row">
                    <span class="comparison-metric">
                      <mat-icon>{{ row.icon }}</mat-icon>
                      <strong>{{ row.label }}</strong>
                      <small>{{ row.context }}</small>
                    </span>
                    <span class="comparison-current">
                      <strong>{{ comparisonCurrentLabel(row.key) }}</strong>
                      <small>Tu dato</small>
                    </span>
                    @for (comparison of comparisons(); track comparison.key) {
                      <span class="comparison-reference">
                        <small>Media {{ comparisonAverageLabel(comparison, row.key, row.unit) }}</small>
                        <b
                          [class.above]="comparisonDelta(comparisonCurrentValue(row.key), comparison, row.key) > 0"
                          [class.below]="comparisonDelta(comparisonCurrentValue(row.key), comparison, row.key) < 0"
                        >{{ comparisonDeltaAbsoluteLabel(comparisonCurrentValue(row.key), comparison, row.key, row.unit) }}</b>
                        <em
                          [class.above]="comparisonDelta(comparisonCurrentValue(row.key), comparison, row.key) > 0"
                          [class.below]="comparisonDelta(comparisonCurrentValue(row.key), comparison, row.key) < 0"
                        >{{ comparisonDeltaSummary(comparisonCurrentValue(row.key), comparison, row.key) }}</em>
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
            <div class="comparison-legend">
              <span><i class="legend-dot neutral"></i> Media = promedio del periodo</span>
              <span><i class="legend-dot positive"></i> Más que tu media</span>
              <span><i class="legend-dot warning"></i> Menos que tu media</span>
            </div>
          } @else {
            <div class="empty-state">No hay suficientes datos para comparar esta actividad.</div>
          }
        </div>
        <div class="segment-preview">
          <div class="section-heading compact">
            <div>
              <p class="eyebrow">SEGMENTOS DESTACADOS</p>
              <h2>{{ segments().length }} esfuerzos</h2>
            </div>
            <a routerLink="/app/segments">Ver todos <mat-icon>arrow_forward</mat-icon></a>
          </div>
          @for (segment of segments(); track segment.id) {
            <a class="segment-row" [routerLink]="['/app/segments', segment.id]"
              ><span
                class="segment-color position-badge"
                [attr.data-position]="segment.rank_position ?? '—'"
                [class.gold]="segment.rank_position === 1"
                [class.silver]="segment.rank_position === 2"
                [class.bronze]="segment.rank_position === 3"
              ></span>
              <div>
                <strong>{{ segment.name }}</strong>
                <p>{{ segment.distance }} · {{ segment.attempts }} intentos @if (segment.absolute_rank_position) { <span class="absolute-position">· Pos. abs.: {{ segment.absolute_rank_position }}º</span> }</p>
              </div>
              <b>{{ segment.best }}</b
              ><mat-icon>chevron_right</mat-icon></a
            >
          }
        </div>
      } @else if (section() === 'charts') {
        <app-route-map
          [routePoints]="routePoints()"
          [activityName]="activity().name"
          [sportLabel]="sportLabel()"
          [location]="activity().location"
          [distance]="activity().distance"
          [duration]="formatDuration(activity().moving_time_seconds)"
          [pace]="activity().pace"
          [averageSpeed]="activity().speed"
          [maxSpeed]="activity().max_speed"
          [elevation]="activity().elevation"
          [streams]="detail()?.['streams']"
        />
        <div class="insight-card">
          <span class="insight-icon"><mat-icon>show_chart</mat-icon></span>
          <div>
            <strong>Análisis de la salida</strong>
            <p>
              {{ streamsLabel() }} Explora ritmo, velocidad, altitud, pulso y zonas de intensidad.
            </p>
          </div>
        </div>
        <app-activity-charts [streams]="detail()?.['streams']" />
      } @else if (section() === 'stats') {
        <div class="detail-grid">
          <article class="detail-card">
            <span>RITMO MEDIO</span><strong>{{ activity().pace }}</strong>
            <p>Promedio en movimiento</p>
          </article>
          <article class="detail-card">
            <span>VELOCIDAD MÁXIMA</span
            ><strong>{{ formatNumber(activity().max_speed, 1) }} <small>km/h</small></strong>
            <p>Mejor punta registrada</p>
          </article>
          <article class="detail-card">
            <span>FRECUENCIA CARDÍACA</span
            ><strong>{{ formatNumber(averageHeartRate()) }} <small>bpm</small></strong>
            <p>Máx. {{ formatNumber(maxHeartRate()) }} bpm</p>
          </article>
          <article class="detail-card">
            <span>CADENCIA</span><strong>{{ formatNumber(cadence()) }} <small>spm</small></strong>
            <p>Media de la salida</p>
          </article>
          <article class="detail-card">
            <span>CALORÍAS</span><strong>{{ formatNumber(calories()) }} <small>kcal</small></strong>
            <p>Estimación</p>
          </article>
          <article class="detail-card">
            <span>DESNIVEL ACUMULADO</span
            ><strong>{{ activity().elevation }} <small>m</small></strong>
            <p>Ganancia positiva</p>
          </article>
        </div>
      } @else if (section() === 'segments') {
        <div class="segment-list">
          @for (segment of segments(); track segment.id) {
            <a class="segment-row large" [routerLink]="['/app/segments', segment.id]"
              ><span
                class="segment-color position-badge"
                [attr.data-position]="segment.rank_position ?? '—'"
                [class.gold]="segment.rank_position === 1"
                [class.silver]="segment.rank_position === 2"
                [class.bronze]="segment.rank_position === 3"
              ></span>
              <div>
                <strong>{{ segment.name }}</strong>
                <p>{{ segment.distance }} · {{ segment.elevation }}</p>
                <small
                  >Tu posición: <b>{{ segment.rank }}</b></small
                >
              </div>
              <b>{{ segment.best }}</b
              ><mat-icon>chevron_right</mat-icon></a
            >
          } @empty {
            <div class="empty-state">No hay segmentos asociados a esta actividad.</div>
          }
        </div>
      } @else {
        <div class="details-list">
          <div>
            <span>Nombre</span><strong>{{ activity().name }}</strong>
          </div>
          <div>
            <span>Tipo</span><strong>{{ sportLabel() }}</strong>
          </div>
          <div>
            <span>Fecha</span
            ><strong class="date-value">
              @if (activity().date_tag) {
                <span
                  class="date-tag"
                  [class.today]="activity().date_tag === 'Hoy'"
                  [class.yesterday]="activity().date_tag === 'Ayer'"
                  [class.this-week]="activity().date_tag === 'Esta semana'"
                  >{{ activity().date_tag }}</span
                >
              }
              {{ activity().date }}</strong
            >
          </div>
          <div>
            <span>Tiempo total</span
            ><strong>{{ formatDuration(activity().elapsed_time_seconds) }}</strong>
          </div>
          <div>
            <span>Dispositivo</span><strong>{{ activity().device_name ?? '—' }}</strong>
          </div>
          <div>
            <span>Fuente</span
            ><strong>{{ activity().source ?? 'API' }} <span class="source-dot"></span></strong>
          </div>
          <div>
            <span>Calorías</span><strong>{{ formatNumber(calories()) }} kcal</strong>
          </div>
          <div>
            <span>Notas</span><strong>{{ detail()?.['notes']?.['notes'] ?? 'Sin notas' }}</strong>
          </div>
        </div>
        <div class="activity-actions">
          <div>
            <strong>Acciones de actividad</strong>
            <p>Actualiza datos importados o elimina esta salida de tu historial.</p>
          </div>
          <div class="activity-action-buttons">
            @if (activity().source === 'strava') {
              <button
                class="outline-button"
                type="button"
                (click)="refreshFromStrava()"
                [disabled]="activityActionLoading()"
              >
                {{ activityActionLoading() ? 'Actualizando…' : 'Actualizar desde Strava' }}
                <mat-icon>{{ activityActionLoading() ? 'sync' : 'refresh' }}</mat-icon>
              </button>
            }
            <button
              class="danger-button"
              type="button"
              (click)="deleteActivity()"
              [disabled]="activityActionLoading()"
            >
              Eliminar actividad <mat-icon>delete_outline</mat-icon>
            </button>
          </div>
          @if (activityActionMessage()) {
            <p class="activity-action-message">{{ activityActionMessage() }}</p>
          }
        </div>
        <article class="gps-tools-card">
          <div class="section-heading compact">
            <div>
              <p class="eyebrow">OPERACIONES GPS</p>
              <h2>Corrige el recorrido</h2>
            </div>
            <mat-icon>content_cut</mat-icon>
          </div>
          <p class="muted">
            Guarda este recorrido como una ruta o corrige sus puntos GPS. Las operaciones crean una
            nueva actividad derivada y conservan la original.
          </p>
          <label class="journal-field"
            >Nombre de la ruta<input
              [(ngModel)]="routeName"
              maxlength="255"
              placeholder="Ej. Vuelta al parque" /></label
          ><button
            class="outline-button full"
            type="button"
            (click)="createRouteFromActivity()"
            [disabled]="activityToolsLoading() || routeGpsPointCount() < 2"
          >
            {{ activityToolsLoading() ? 'Guardando ruta…' : 'Crear ruta desde esta actividad' }}
            <mat-icon>{{ activityToolsLoading() ? 'sync' : 'route' }}</mat-icon>
          </button>
          <div class="gps-tool-divider"></div>
          @if (streamPointCount() > 2) {
            <div class="two-fields">
              <label
                >Recortar desde<input
                  type="number"
                  min="0"
                  [max]="maxToolIndex()"
                  [(ngModel)]="cropStartIndex" /></label
              ><label
                >Recortar hasta<input
                  type="number"
                  min="1"
                  [max]="maxToolIndex()"
                  [(ngModel)]="cropEndIndex"
              /></label>
            </div>
            <button
              class="outline-button full"
              type="button"
              (click)="cropActivityRange()"
              [disabled]="activityToolsLoading()"
            >
              Recortar actividad <mat-icon>content_cut</mat-icon>
            </button>
            <div class="gps-tool-divider"></div>
            <label class="journal-field"
              >Dividir en el índice<input
                type="number"
                min="1"
                [max]="maxToolIndex()"
                [(ngModel)]="splitIndex" /></label
            ><button
              class="outline-button full"
              type="button"
              (click)="splitActivityAtIndex()"
              [disabled]="activityToolsLoading()"
            >
              Dividir actividad <mat-icon>call_split</mat-icon>
            </button>
            <div class="gps-tool-divider"></div>
            <label class="journal-field"
              >Unir con<select [(ngModel)]="mergeTargetId">
                <option value="">Selecciona otra actividad</option>
                @for (candidate of mergeCandidates(); track candidate.id) {
                  <option [value]="candidate.id">
                    {{ candidate.name }} · {{ candidate.date }}
                  </option>
                }
              </select></label
            ><button
              class="outline-button full"
              type="button"
              (click)="mergeWithActivity()"
              [disabled]="activityToolsLoading() || !mergeTargetId"
            >
              Unir actividades <mat-icon>merge_type</mat-icon>
            </button>
          } @else {
            <div class="empty-state">
              Esta actividad no tiene suficientes puntos GPS locales para editar el recorrido.
            </div>
          }
          @if (activityToolsMessage()) {
            <p class="activity-action-message">{{ activityToolsMessage() }}</p>
          }
        </article>
        <article class="journal-card">
          <div class="section-heading compact">
            <div>
              <p class="eyebrow">DIARIO DE LA SALIDA</p>
              <h2>Contextualiza tu entrenamiento</h2>
            </div>
            <mat-icon>edit_note</mat-icon>
          </div>
          <label class="journal-field"
            >Nombre<input [(ngModel)]="journal.name" maxlength="255"
          /></label>
          <div class="two-fields">
            <label
              >Tipo de sesión<select [(ngModel)]="journal.workout_type">
                <option value="">Sin especificar</option>
                <option value="Rodaje suave">Rodaje suave</option>
                <option value="Series">Series</option>
                <option value="Umbral">Umbral</option>
                <option value="Tirada larga">Tirada larga</option>
                <option value="Recuperación">Recuperación</option>
                <option value="Fuerza">Fuerza</option>
                <option value="Paseo">Paseo</option>
              </select></label
            ><label
              >Esfuerzo percibido<select [(ngModel)]="journal.perceived_exertion">
                <option [ngValue]="null">Sin valorar</option>
                @for (effort of effortOptions; track effort) {
                  <option [ngValue]="effort">{{ effort }} / 10</option>
                }
              </select></label
            >
          </div>
          <label class="journal-field"
            >Notas<textarea
              [(ngModel)]="journal.notes"
              rows="4"
              maxlength="2000"
              placeholder="¿Cómo te has encontrado?"
            ></textarea>
          </label>
          <div class="two-fields">
            <label
              >Molestias<input
                [(ngModel)]="journal.soreness"
                maxlength="255"
                placeholder="Ninguna" /></label
            ><label
              >Acompañantes<input
                [(ngModel)]="journal.companions"
                maxlength="255"
                placeholder="Opcional"
            /></label>
          </div>
          <label class="journal-field">Etiquetas</label>
          <div class="label-options">
            @for (label of labels(); track label.id) {
              <button
                type="button"
                class="label-chip"
                [style.--label-color]="label.color || '#c9f45b'"
                [class.selected]="isLabelSelected(label.id)"
                (click)="toggleLabel(label.id)"
              >
                {{ label.name }}
              </button>
            } @empty {
              <span class="journal-hint">No hay etiquetas disponibles.</span>
            }
          </div>
          <button
            class="primary-button full journal-save"
            type="button"
            (click)="saveJournal()"
            [disabled]="savingJournal()"
          >
            {{ savingJournal() ? 'Guardando…' : 'Guardar diario' }}
            <mat-icon>{{ savingJournal() ? 'sync' : 'save' }}</mat-icon>
          </button>
          @if (journalMessage()) {
            <p class="success-message">{{ journalMessage() }}</p>
          }
        </article>
        <article class="weather-card">
          <div class="section-heading compact">
            <div>
              <p class="eyebrow">CONDICIONES DE LA SALIDA</p>
              <h2>Meteorología</h2>
            </div>
            <mat-icon>cloud</mat-icon>
          </div>
          @if (weather()) {
            <div class="weather-grid">
              <div>
                <strong>{{ temperature(weather()?.['temperature']) }}</strong
                ><span>Temperatura</span>
              </div>
              <div>
                <strong>{{ temperature(weather()?.['apparent_temperature']) }}</strong
                ><span>Sensación</span>
              </div>
              <div>
                <strong>{{ number(weather()?.['humidity']) }}%</strong><span>Humedad</span>
              </div>
              <div>
                <strong>{{ number(weather()?.['wind_speed']) }} km/h</strong><span>Viento</span>
              </div>
              <div>
                <strong>{{ number(weather()?.['precipitation'], 1) }} mm</strong
                ><span>Precipitación</span>
              </div>
              <div>
                <strong>{{ windDirection(weather()?.['wind_direction']) }}</strong
                ><span>Dirección</span>
              </div>
            </div>
          } @else {
            <p class="muted">Todavía no hay condiciones meteorológicas guardadas.</p>
          }
          <button
            class="outline-button weather-refresh"
            type="button"
            (click)="refreshWeather()"
            [disabled]="weatherLoading()"
          >
            {{ weatherLoading() ? 'Consultando…' : 'Actualizar meteorología' }}
            <mat-icon>{{ weatherLoading() ? 'sync' : 'refresh' }}</mat-icon>
          </button>
          @if (weatherMessage()) {
            <p class="weather-message">{{ weatherMessage() }}</p>
          }
        </article>
      }
    }
    @if (error()) {
      <p class="api-error">{{ error() }}</p>
    }
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveActivityPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly data = inject(SportsDataStore);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly section = signal(this.route.snapshot.paramMap.get('section') ?? 'overview');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly detail = signal<Record<string, any> | null>(null);
  readonly labels = signal<ActivityLabel[]>([]);
  readonly effortOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly comparisonRows = [
    { key: 'distance', label: 'Distancia', context: 'Volumen de la salida', unit: 'km', icon: 'straighten' },
    { key: 'moving_time', label: 'Tiempo en movimiento', context: 'Duración', unit: '', icon: 'schedule' },
    { key: 'elevation', label: 'Desnivel acumulado', context: 'Carga de desnivel', unit: 'm', icon: 'terrain' },
    { key: 'average_speed', label: 'Velocidad media', context: 'Ritmo de desplazamiento', unit: 'km/h', icon: 'speed' },
    { key: 'calories', label: 'Calorías', context: 'Gasto estimado', unit: 'kcal', icon: 'local_fire_department' },
    { key: 'average_heartrate', label: 'Pulso medio', context: 'Intensidad', unit: 'bpm', icon: 'favorite' },
  ];
  readonly journal = {
    name: '',
    notes: '',
    perceived_exertion: null as number | null,
    soreness: '',
    workout_type: '',
    companions: '',
    tags: '',
  };
  readonly selectedLabelIds = signal<number[]>([]);
  readonly savingJournal = signal(false);
  readonly journalMessage = signal('');
  readonly weather = signal<Record<string, any> | null>(null);
  readonly weatherLoading = signal(false);
  readonly weatherMessage = signal('');
  readonly activityActionLoading = signal(false);
  readonly activityActionMessage = signal('');
  readonly streamPointCount = computed(() => {
    const streams = this.detail()?.['streams'];
    const values = streams?.['time']?.data ?? streams?.['latlng']?.data;
    return Array.isArray(values) ? values.length : 0;
  });
  readonly routeGpsPointCount = computed(() => {
    const map = this.detail()?.['map'] as NormalizedMap | undefined;
    const values = map?.points?.length ? map.points : this.detail()?.['streams']?.['latlng']?.data;
    return Array.isArray(values) ? values.length : 0;
  });
  readonly mergeCandidates = computed(() =>
    this.data.activities().filter((item) => item.id !== this.id),
  );
  cropStartIndex = 0;
  cropEndIndex = 1;
  splitIndex = 1;
  mergeTargetId = '';
  routeName = '';
  readonly activityToolsLoading = signal(false);
  readonly activityToolsMessage = signal('');
  readonly activity = computed(() =>
    this.detail()
      ? this.data.toActivity(this.detail()?.['activity'] ?? this.detail())
      : (ACTIVITIES.find((item) => item.id === this.id) ?? ACTIVITIES[0]),
  );
  readonly segments = computed(() => {
    const raw = this.detail()?.['segments'];
    return Array.isArray(raw) && raw.length
      ? raw.map((item) => this.data.toSegment(item))
      : SEGMENTS;
  });
  readonly routePoints = computed<[number, number][]>(() => {
    const map = this.detail()?.['map'] as NormalizedMap | undefined;
    const stream = this.detail()?.['streams']?.['latlng'];
    const raw = map?.points?.length ? map.points : stream?.data;
    return Array.isArray(raw) && raw.length > 1 ? (raw as [number, number][]) : DEFAULT_ROUTE;
  });
  readonly streamsLabel = computed(() =>
    this.detail()?.['map']?.point_count
      ? `Mapa normalizado${this.detail()?.['map']?.simplified ? ' y simplificado' : ''}.`
      : 'La actividad no incluye mapa GPS disponible.',
  );
  readonly sportLabel = computed(() =>
    this.activity().sport_type === 'Ride'
      ? 'Ciclismo'
      : this.activity().sport_type === 'Walk'
        ? 'Caminar'
        : 'Correr',
  );
  readonly averageHeartRate = computed(
    () => this.activity().average_heartrate ?? this.streamAverage('heartrate'),
  );
  readonly maxHeartRate = computed(
    () => this.activity().max_heartrate ?? this.streamMaximum('heartrate'),
  );
  readonly cadence = computed(() => this.activity().cadence ?? this.streamAverage('cadence'));
  readonly calories = computed(() => this.activity().calories ?? null);
  readonly comparisons = computed(() => {
    const raw = this.detail()?.['comparisons'];
    return Array.isArray(raw) ? raw : [];
  });
  constructor() {
    this.route.paramMap.subscribe((params) =>
      this.section.set(params.get('section') ?? 'overview'),
    );
    this.api.activity(this.id).subscribe({
      next: (value) => {
        this.detail.set(value);
        this.loadJournal(value);
        this.loadWeather(value);
        this.initializeGpsTools();
      },
      error: () => this.error.set('No se ha podido cargar el detalle real.'),
      complete: () => this.loading.set(false),
    });
    this.api.labels().subscribe({ next: (value) => this.labels.set(value.labels ?? []) });
    this.data.loadActivities();
  }
  private initializeGpsTools() {
    const max = this.maxToolIndex();
    this.cropStartIndex = 0;
    this.cropEndIndex = max;
    this.splitIndex = Math.max(1, Math.floor(max / 2));
  }
  maxToolIndex() {
    return Math.max(1, this.streamPointCount() - 1);
  }
  private canEditRange(start: number, end: number) {
    const max = this.maxToolIndex();
    return this.streamPointCount() > 2 && start >= 0 && end > start && end <= max;
  }
  cropActivityRange() {
    const start = Math.round(Number(this.cropStartIndex));
    const end = Math.round(Number(this.cropEndIndex));
    if (!this.canEditRange(start, end)) {
      this.activityToolsMessage.set(
        'El rango debe contener al menos dos puntos y estar dentro de la actividad.',
      );
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm('¿Crear un recorte con este rango? La actividad original se conservará.')
    )
      return;
    this.activityToolsLoading.set(true);
    this.activityToolsMessage.set('');
    this.api
      .cropActivity(this.id, start, end)
      .subscribe({
        next: (value) => this.openDerivedActivity(value.activities[0]?.['id'] ?? value.ids[0]),
        error: () => this.activityToolsMessage.set('No se ha podido crear el recorte.'),
        complete: () => this.activityToolsLoading.set(false),
      });
  }
  splitActivityAtIndex() {
    const index = Math.round(Number(this.splitIndex));
    if (index < 1 || index >= this.maxToolIndex()) {
      this.activityToolsMessage.set('El punto de división no es válido.');
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm('¿Dividir esta actividad en dos? La actividad original se conservará.')
    )
      return;
    this.activityToolsLoading.set(true);
    this.activityToolsMessage.set('');
    this.api
      .splitActivity(this.id, index)
      .subscribe({
        next: (value) => this.openDerivedActivity(value.activities[0]?.['id'] ?? value.ids[0]),
        error: () => this.activityToolsMessage.set('No se ha podido dividir la actividad.'),
        complete: () => this.activityToolsLoading.set(false),
      });
  }
  mergeWithActivity() {
    if (!this.mergeTargetId || this.mergeTargetId === this.id) {
      this.activityToolsMessage.set('Selecciona otra actividad para unirla.');
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        '¿Unir estas dos actividades? Se creará una nueva y se conservarán las originales.',
      )
    )
      return;
    this.activityToolsLoading.set(true);
    this.activityToolsMessage.set('');
    this.api
      .mergeActivities(this.id, this.mergeTargetId)
      .subscribe({
        next: (value) => this.openDerivedActivity(value.id),
        error: () =>
          this.activityToolsMessage.set(
            'No se han podido unir las actividades. Deben tener el mismo deporte y streams disponibles.',
          ),
        complete: () => this.activityToolsLoading.set(false),
      });
  }
  createRouteFromActivity() {
    if (this.routeGpsPointCount() < 2) {
      this.activityToolsMessage.set(
        'Esta actividad no tiene suficientes puntos GPS para crear una ruta.',
      );
      return;
    }
    const name = this.routeName.trim() || this.activity().name;
    if (typeof window !== 'undefined' && !window.confirm(`¿Guardar «${name}» como ruta?`)) return;
    this.activityToolsLoading.set(true);
    this.activityToolsMessage.set('');
    this.api
      .createRoute({
        name,
        description: `Creada desde ${this.activity().name}`,
        points: this.routePoints(),
        distance: this.activity().distance * 1000,
        elevation_gain: this.activity().elevation,
        estimated_moving_time: this.activity().moving_time_seconds ?? 0,
        type: this.activity().sport_type === 'Ride' ? 2 : 1,
      })
      .subscribe({
        next: (value) => {
          const routeId = value.id ?? value.route?.['id'];
          if (routeId !== undefined && routeId !== null)
            this.router.navigate(['/app/routes', routeId]);
          else this.activityToolsMessage.set('La ruta se guardó sin devolver su identificador.');
        },
        error: () =>
          this.activityToolsMessage.set('No se ha podido guardar la actividad como ruta.'),
        complete: () => this.activityToolsLoading.set(false),
      });
  }
  private openDerivedActivity(id: string | number | undefined) {
    if (id !== undefined && id !== null) this.router.navigate(['/app/activity', id, 'overview']);
    else this.activityToolsMessage.set('La operación terminó sin devolver la nueva actividad.');
  }
  private loadJournal(value: Record<string, any>) {
    const activity = (value['activity'] ?? value) as Record<string, any>;
    const notes = (value['notes'] ?? {}) as ActivityJournal;
    this.journal.name = String(activity['name'] ?? '');
    this.routeName = this.journal.name;
    this.journal.notes = String(notes.notes ?? '');
    this.journal.perceived_exertion =
      notes.perceived_exertion == null ? null : Number(notes.perceived_exertion);
    this.journal.soreness = String(notes.soreness ?? '');
    this.journal.workout_type = String(notes.workout_type ?? '');
    this.journal.companions = String(notes.companions ?? '');
    this.journal.tags = String(notes.tags ?? '');
    const labels = Array.isArray(activity['_labels'])
      ? activity['_labels']
      : Array.isArray(value['labels'])
        ? value['labels']
        : [];
    this.selectedLabelIds.set(
      labels
        .map((label: any) => Number(label['id']))
        .filter((id: number) => Number.isFinite(id) && id > 0),
    );
  }
  private loadWeather(value: Record<string, any>) {
    const activity = (value['activity'] ?? value) as Record<string, any>;
    const raw = activity['weather_json'];
    if (raw && typeof raw === 'object') this.weather.set(raw as Record<string, any>);
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') this.weather.set(parsed);
      } catch {
        /* Datos antiguos no válidos: se podrán actualizar. */
      }
    }
  }
  refreshWeather() {
    this.weatherLoading.set(true);
    this.weatherMessage.set('');
    this.api.refreshActivityWeather(this.id).subscribe({
      next: (value) => {
        this.weather.set(value.weather);
        this.weatherMessage.set('Meteorología actualizada.');
      },
      error: () =>
        this.weatherMessage.set(
          'No se ha podido consultar la meteorología. Revisa que la actividad tenga ubicación.',
        ),
      complete: () => this.weatherLoading.set(false),
    });
  }
  refreshFromStrava() {
    this.activityActionLoading.set(true);
    this.activityActionMessage.set('');
    this.api.refreshActivityFromStrava(this.id).subscribe({
      next: (value) => {
        this.detail.update((current) =>
          current ? { ...current, activity: value.activity } : current,
        );
        this.activityActionMessage.set('Actividad actualizada desde Strava.');
      },
      error: () =>
        this.activityActionMessage.set('No se ha podido actualizar la actividad desde Strava.'),
      complete: () => this.activityActionLoading.set(false),
    });
  }
  deleteActivity() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('¿Eliminar esta actividad? Esta acción no se puede deshacer.')
    )
      return;
    this.activityActionLoading.set(true);
    this.activityActionMessage.set('');
    this.api.deleteActivity(this.id).subscribe({
      next: () => this.router.navigateByUrl('/app/activities'),
      error: () => {
        this.activityActionMessage.set('No se ha podido eliminar la actividad.');
        this.activityActionLoading.set(false);
      },
    });
  }
  isLabelSelected(id: number | string) {
    return this.selectedLabelIds().includes(Number(id));
  }
  toggleLabel(id: number | string) {
    const labelId = Number(id);
    if (!Number.isFinite(labelId)) return;
    this.selectedLabelIds.update((ids) =>
      ids.includes(labelId) ? ids.filter((value) => value !== labelId) : [...ids, labelId],
    );
  }
  saveJournal() {
    if (!this.journal.name.trim()) {
      this.error.set('El nombre de la actividad no puede estar vacío.');
      return;
    }
    this.savingJournal.set(true);
    this.journalMessage.set('');
    this.error.set('');
    forkJoin({
      activity: this.api.updateActivity(this.id, {
        name: this.journal.name.trim(),
        label_ids: this.selectedLabelIds(),
      }),
      notes: this.api.updateActivityNotes(this.id, {
        notes: this.journal.notes.trim(),
        perceived_exertion:
          this.journal.perceived_exertion == null ? null : Number(this.journal.perceived_exertion),
        soreness: this.journal.soreness.trim(),
        workout_type: this.journal.workout_type,
        companions: this.journal.companions.trim(),
        tags: this.journal.tags.trim(),
      }),
    }).subscribe({
      next: (result) => {
        this.detail.update((current) =>
          current
            ? {
                ...current,
                activity: result.activity['activity'] ?? result.activity,
                notes: result.notes['notes'] ?? result.notes,
              }
            : current,
        );
        this.data.loadActivities(true);
        this.journalMessage.set('Diario guardado.');
      },
      error: () => this.error.set('No se han podido guardar los cambios.'),
      complete: () => this.savingJournal.set(false),
    });
  }
  formatDuration(seconds: number | undefined) {
    if (!seconds) return '—';
    const total = Math.round(seconds);
    return `${Math.floor(total / 3600) ? `${Math.floor(total / 3600)} h ` : ''}${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  formatNumber(value: number | null | undefined, decimals = 0) {
    return value === null || value === undefined || !Number.isFinite(value)
      ? '—'
      : value.toFixed(decimals);
  }
  temperature(value: unknown) {
    const formatted = this.formatNumber(Number(value), 1);
    return formatted === '—' ? '—' : `${formatted} °C`;
  }
  number(value: unknown, decimals = 0) {
    return this.formatNumber(Number(value), decimals);
  }
  windDirection(value: unknown) {
    const degrees = Number(value);
    if (!Number.isFinite(degrees)) return '—';
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return labels[Math.round((((degrees % 360) + 360) % 360) / 45) % labels.length];
  }
  private streamAverage(name: string) {
    const values = this.streamValues(name);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }
  private streamMaximum(name: string) {
    const values = this.streamValues(name);
    return values.length ? Math.max(...values) : null;
  }
  private streamValues(name: string) {
    const values = this.detail()?.['streams']?.[name]?.data;
    return Array.isArray(values)
      ? values.filter(
          (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value),
        )
      : [];
  }
  comparisonMetric(comparison: any, key: string) {
    const value = Number(comparison?.[key]);
    if (!Number.isFinite(value)) return null;
    return key === 'distance'
      ? value / 1000
      : key === 'average_speed' || key === 'max_speed'
        ? value * 3.6
        : value;
  }
  comparisonCurrentValue(key: string) {
    const current = this.activity();
    switch (key) {
      case 'distance':
        return current.distance;
      case 'moving_time':
        return current.moving_time_seconds ?? null;
      case 'elevation':
        return current.elevation;
      case 'average_speed':
        return current.speed;
      case 'calories':
        return this.calories();
      case 'average_heartrate':
        return this.averageHeartRate();
      default:
        return null;
    }
  }
  comparisonCurrentLabel(key: string) {
    const value = this.comparisonCurrentValue(key);
    if (value === null || !Number.isFinite(value)) return '—';
    if (key === 'moving_time') return this.formatDuration(value);
    const decimals = key === 'distance' || key === 'average_speed' ? 1 : 0;
    const unit = this.comparisonRows.find((row) => row.key === key)?.unit ?? '';
    return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
  }
  comparisonAverageLabel(comparison: any, key: string, unit: string) {
    const value = this.comparisonMetric(comparison, key);
    if (value === null) return '—';
    const decimals = key === 'distance' || key === 'average_speed' ? 1 : 0;
    return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
  }
  comparisonDeltaAbsoluteLabel(
    current: number | null | undefined,
    comparison: any,
    key: string,
    unit: string,
  ) {
    const average = this.comparisonMetric(comparison, key);
    const value = Number(current);
    if (average === null || !Number.isFinite(value)) return 'Sin datos';
    const delta = value - average;
    if (key === 'moving_time') return this.signedDuration(delta);
    const decimals = key === 'distance' || key === 'average_speed' ? 1 : 0;
    return `${delta > 0 ? '+' : ''}${delta.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
  }
  comparisonDeltaSummary(current: number | null | undefined, comparison: any, key: string) {
    const delta = this.comparisonDelta(current, comparison, key);
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) return 'En línea con tu media';
    return `${delta > 0 ? '+' : ''}${delta.toFixed(0)}% · ${delta > 0 ? 'Más' : 'Menos'}`;
  }
  private signedDuration(seconds: number) {
    const sign = seconds > 0 ? '+' : seconds < 0 ? '−' : '';
    const total = Math.round(Math.abs(seconds));
    return `${sign}${Math.floor(total / 3600) ? `${Math.floor(total / 3600)} h ` : ''}${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  comparisonDelta(current: number | null | undefined, comparison: any, key: string) {
    const average = this.comparisonMetric(comparison, key);
    const value = Number(current);
    if (average === null || !Number.isFinite(value) || average === 0) return Number.NaN;
    return ((value - average) / average) * 100;
  }
  comparisonDeltaLabel(current: number | null | undefined, comparison: any, key: string) {
    const delta = this.comparisonDelta(current, comparison, key);
    return !Number.isFinite(delta) ? 'Sin datos' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`;
  }
}
