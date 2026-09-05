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
import * as L from 'leaflet';
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
const DEFAULT_ROUTE: L.LatLngExpression[] = [
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
  logout() {
    this.init$ = undefined;
    this.user.set(null);
    this.status.set('anonymous');
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
    if (result === 'error') {
      this.auth.setError(
        this.route.snapshot.queryParamMap.get('message') ??
          'No se ha podido completar la conexión con Strava.',
      );
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } else if (result === 'success') {
      this.auth.refreshSession().subscribe((authenticated) => {
        if (authenticated) this.router.navigateByUrl('/app/dashboard', { replaceUrl: true });
        else {
          this.auth.setError('Strava se conectó, pero no se ha podido recuperar la sesión.');
          this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      });
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
      aria-label="Evolución de kilómetros, altitud acumulada y velocidad media"
    ></canvas>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardChart implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly points = input<DashboardChartPoint[]>([]);
  private chart?: import('chart.js').Chart;
  private readonly redraw = effect(() => {
    const points = this.points();
    if (this.chart) this.update(points);
  });

  ngAfterViewInit() {
    if (typeof window === 'undefined') return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      this.chart = new Chart(this.canvas.nativeElement, {
        type: 'line',
        data: this.chartData(this.points()),
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'start',
              labels: {
                color: '#aab3a3',
                boxWidth: 9,
                boxHeight: 9,
                padding: 16,
                font: { size: 10, family: 'Inter, system-ui, sans-serif' },
              },
            },
            tooltip: {
              backgroundColor: '#182019',
              borderColor: 'rgba(201,244,91,.25)',
              borderWidth: 1,
              titleColor: '#f0f2eb',
              bodyColor: '#c7d0bd',
              padding: 10,
              displayColors: true,
            },
          },
          scales: {
            x: {
              ticks: { color: '#65705f', maxRotation: 0, autoSkip: true, font: { size: 9 } },
              grid: { color: 'rgba(255,255,255,.05)' },
            },
            distance: {
              position: 'left',
              beginAtZero: true,
              title: {
                display: true,
                text: 'km',
                color: '#c9f45b',
                font: { size: 9, weight: 'bold' },
              },
              ticks: { color: '#9dbb61', font: { size: 9 } },
              grid: { color: 'rgba(255,255,255,.07)' },
            },
            elevation: {
              position: 'right',
              beginAtZero: true,
              title: {
                display: true,
                text: 'altitud m',
                color: '#f0a45d',
                font: { size: 9, weight: 'bold' },
              },
              ticks: { color: '#c69463', font: { size: 9 } },
              grid: { drawOnChartArea: false },
            },
            speed: {
              position: 'right',
              beginAtZero: true,
              title: {
                display: true,
                text: 'km/h',
                color: '#76a8ff',
                font: { size: 9, weight: 'bold' },
              },
              ticks: { color: '#7fa9f2', font: { size: 9 } },
              grid: { drawOnChartArea: false },
              offset: true,
            },
          },
          elements: { line: { tension: 0.35 }, point: { radius: 2, hoverRadius: 4 } },
        },
      });
    });
  }

  private chartData(points: DashboardChartPoint[]) {
    return {
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: 'Kilómetros',
          data: points.map((point) => point.distance),
          yAxisID: 'distance',
          borderColor: '#c9f45b',
          backgroundColor: 'rgba(201,244,91,.12)',
          fill: true,
        },
        {
          label: 'Altitud acumulada',
          data: points.map((point) => point.elevation),
          yAxisID: 'elevation',
          borderColor: '#f0a45d',
          backgroundColor: 'transparent',
          fill: false,
        },
        {
          label: 'Velocidad media',
          data: points.map((point) => point.speed),
          yAxisID: 'speed',
          borderColor: '#76a8ff',
          backgroundColor: 'transparent',
          fill: false,
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
          <span class="stat-label">DISTANCIA</span><strong>56.8 <small>km</small></strong
          ><span class="stat-change positive"><mat-icon>trending_up</mat-icon> 12.4%</span>
        </article>
        <article class="stat-card">
          <span class="stat-label">TIEMPO EN MOVIMIENTO</span
          ><strong>4h 12<small>min</small></strong
          ><span class="stat-change positive"><mat-icon>trending_up</mat-icon> 8.1%</span>
        </article>
        <article class="stat-card">
          <span class="stat-label">DESNIVEL ACUMULADO</span><strong>842 <small>m</small></strong
          ><span class="stat-change neutral">+ 124 m</span>
        </article>
        <article class="stat-card">
          <span class="stat-label">VELOCIDAD MEDIA</span><strong>11.3 <small>km/h</small></strong
          ><span class="stat-change positive">Ritmo semanal</span>
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

@Component({
  selector: 'app-route-map',
  template: `<div class="route-map leaflet-shell">
    <div #map class="leaflet-host"></div>
    <div class="map-label">MADRID <span>•</span> RETIRO</div>
    <div class="map-legend">
      <span><i class="start-dot"></i> Inicio</span><span><i class="end-dot"></i> Final</span
      ><span class="map-duration">45:02</span>
    </div>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteMap implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) private mapElement!: ElementRef<HTMLDivElement>;
  readonly routePoints = input<L.LatLngExpression[]>(DEFAULT_ROUTE);
  private map?: L.Map;
  private routeLayer?: L.LayerGroup;
  private pointsLayer?: L.LayerGroup;
  private readonly redraw = effect(() => {
    const points = this.routePoints();
    if (this.map && points.length) this.drawRoute(points);
  });

  ngAfterViewInit() {
    if (typeof window === 'undefined') return;
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 });
    this.map = L.map(this.mapElement.nativeElement, {
      zoomControl: false,
      attributionControl: false,
      layers: [osm],
    }).setView([40.4168, -3.7038], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.pointsLayer = L.layerGroup().addTo(this.map);
    L.control
      .layers(
        { OpenStreetMap: osm, Relieve: topo },
        { Recorrido: this.routeLayer, 'Puntos clave': this.pointsLayer },
        { collapsed: true, position: 'topright' },
      )
      .addTo(this.map);
    this.drawRoute(this.routePoints());
    window.setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private drawRoute(points: L.LatLngExpression[]) {
    if (!this.map || !this.routeLayer || !this.pointsLayer || points.length < 2) return;
    this.routeLayer.clearLayers();
    this.pointsLayer.clearLayers();
    const coords = points.map((point) => L.latLng(point));
    L.polyline(coords, {
      color: '#081008',
      weight: 10,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this.routeLayer);
    L.polyline(coords, {
      color: '#c9f45b',
      weight: 5,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this.routeLayer);
    const startIcon = L.divIcon({
      className: 'leaflet-route-marker',
      html: '<span class="marker-start"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const finishIcon = L.divIcon({
      className: 'leaflet-route-marker',
      html: '<span class="marker-finish"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker(coords[0], { icon: startIcon })
      .bindTooltip('Inicio', { direction: 'top', offset: [0, -8] })
      .addTo(this.pointsLayer);
    L.marker(coords.at(-1)!, { icon: finishIcon })
      .bindTooltip('Final · 45:02', { direction: 'top', offset: [0, -8] })
      .addTo(this.pointsLayer);
    L.circleMarker(coords[Math.floor(coords.length / 2)], {
      radius: 5,
      color: '#16200b',
      weight: 2,
      fillColor: '#ffffff',
      fillOpacity: 1,
    })
      .bindPopup('<strong>Segmento destacado</strong><br>Cuesta de Moyano · 3:42')
      .addTo(this.pointsLayer);
    this.map.fitBounds(L.latLngBounds(coords), { padding: [28, 28] });
  }

  ngOnDestroy() {
    this.redraw.destroy();
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
                <p>{{ segment.distance }} · {{ segment.attempts }} intentos @if (segment.absolute_rank_position) { <span class="absolute-position">· Posición absoluta: {{ segment.absolute_rank_position }}º</span> }</p>
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
  readonly mapPoints = computed<L.LatLngExpression[]>(() =>
    this.detail()?.map?.points?.length
      ? (this.detail()!.map.points as L.LatLngExpression[])
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
  readonly routePoints = computed<L.LatLngExpression[]>(() => DEFAULT_ROUTE);
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
  imports: [RouterLink, MatIconModule],
  template: `<section class="page">
    <div class="back-row">
      <a [routerLink]="['/app/activity', id, 'overview']"
        ><mat-icon>arrow_back</mat-icon> Actividad</a
      >
    </div>
    <div class="page-heading">
      <div>
        <p class="eyebrow">COMPARTE EL ESFUERZO</p>
        <h1>Compartir actividad</h1>
        <p class="muted">Elige cómo quieres enseñar tu salida.</p>
      </div>
    </div>
    <div class="share-preview">
      <div class="share-preview-top">
        <span class="brand-lockup"
          ><span class="brand-mark">A</span><span>ALON <em>SPORTS</em></span></span
        ><span>ENLACE PÚBLICO</span>
      </div>
      <strong>Actividad {{ id }}</strong>
      <div class="share-preview-stats">
        <span>Protección de privacidad</span
        ><span>{{ shareUrl() ? 'Enlace activo' : 'Sin enlace activo' }}</span>
      </div>
      <div class="share-preview-route"></div>
    </div>
    <div class="settings-group">
      <p class="eyebrow">VISIBILIDAD</p>
      <button
        class="share-option share-option-button"
        type="button"
        (click)="hideStart = !hideStart"
      >
        <span class="settings-icon"><mat-icon>visibility_off</mat-icon></span
        ><span
          ><strong>Ocultar punto de inicio</strong><small>Protege tu ubicación exacta</small></span
        ><span class="toggle" [class.on]="hideStart"><i></i></span>
      </button>
      <div class="share-option">
        <span class="settings-icon"><mat-icon>schedule</mat-icon></span
        ><span><strong>Caducidad del enlace</strong><small>31 diciembre 2026</small></span>
      </div>
    </div>
    <button class="primary-button full" type="button" (click)="createLink()" [disabled]="saving()">
      <mat-icon>{{ shareUrl() ? 'content_copy' : 'link' }}</mat-icon>
      {{ saving() ? 'Generando…' : shareUrl() ? 'Copiar enlace' : 'Crear enlace público' }}
    </button>
    @if (shareUrl()) {
      <p class="share-url">{{ shareUrl() }}</p>
    }
    <button class="outline-button full share-native" type="button" (click)="nativeShare()">
      <mat-icon>share</mat-icon> Compartir en otra app
    </button>
    @if (message()) {
      <p class="success-message">{{ message() }}</p>
    }
    @if (error()) {
      <p class="api-error">{{ error() }}</p>
    }
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharePage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly share = signal<ApiShare | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  hideStart = true;
  readonly shareUrl = computed(() => this.share()?.url ?? '');
  constructor() {
    this.api
      .getShare(this.id)
      .subscribe({ next: (value) => this.share.set(value), error: () => undefined });
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
    this.api
      .syncActivities()
      .subscribe({
        next: () => this.data.refresh(),
        error: () => this.error.set('No se han podido sincronizar las actividades.'),
        complete: () => this.syncing.set(false),
      });
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
        <button class="round-button" routerLink="/app/import"><mat-icon>add</mat-icon></button>
      </div>
      <div class="week-banner">
        <div>
          <p class="eyebrow lime">ESTADO DE ENTRENAMIENTO</p>
          <strong>{{ loading() ? 'Calculando tu estado…' : statusTitle() }}</strong
          ><span class="week-status-detail">{{ statusDetail() }}</span>
        </div>
        <div class="week-ring" [style.background]="ringBackground()">
          <span>{{ readiness() }}<small>%</small></span>
        </div>
      </div>
      <div class="stats-grid">
        <article class="stat-card">
          <span class="stat-label">DISTANCIA</span
          ><strong>{{ distance() }} <small>km</small></strong
          ><span class="stat-change positive"><mat-icon>trending_up</mat-icon> Datos API</span>
        </article>
        <article class="stat-card">
          <span class="stat-label">TIEMPO EN MOVIMIENTO</span
          ><strong>{{ movingTime() }} <small>min</small></strong
          ><span class="stat-change positive"><mat-icon>trending_up</mat-icon> Datos API</span>
        </article>
        <article class="stat-card">
          <span class="stat-label">DESNIVEL ACUMULADO</span
          ><strong>{{ elevation() }} <small>m</small></strong
          ><span class="stat-change neutral">Acumulado</span>
        </article>
        <article class="stat-card">
          <span class="stat-label">VELOCIDAD MEDIA</span
          ><strong>{{ averageSpeed() }} <small>km/h</small></strong
          ><span class="stat-change positive">Calculada del volumen</span>
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
        <div class="chart-axis">
          <span>kilómetros</span><span>altitud acumulada</span><span>velocidad media</span>
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
  readonly error = computed(() => this.data.error() || this.loadError());
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
    const rest = Number(load['rest_days'] ?? 0);
    const ratio = Number(load['ratio']);
    return ratio > 1.5
      ? 'Carga reciente alta · prioriza recuperación'
      : `${rest} días de descanso en los últimos 7`;
  }
  constructor() {
    this.data.loadDashboard();
    this.data.loadActivities();
    this.api
      .trainingLoad()
      .subscribe({
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
        <p class="muted">Detalle real de tu salida.</p>
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
        <app-route-map [routePoints]="routePoints()" />
        <div class="insight-card">
          <span class="insight-icon"><mat-icon>cloud_done</mat-icon></span>
          <div>
            <strong>Detalle cargado desde la API</strong>
            <p>{{ streamsLabel() }}</p>
          </div>
        </div>
        <div class="detail-grid summary-data">
          <article class="detail-card">
            <span>TIEMPO TOTAL</span
            ><strong>{{ formatDuration(activity().elapsed_time_seconds) }}</strong>
            <p>Incluye las pausas</p>
          </article>
          <article class="detail-card">
            <span>VELOCIDAD MEDIA</span
            ><strong>{{ activity().speed.toFixed(1) }} <small>km/h</small></strong>
            <p>Calculada en movimiento</p>
          </article>
          <article class="detail-card">
            <span>DESNIVEL ACUMULADO</span
            ><strong>{{ activity().elevation }} <small>m</small></strong>
            <p>Ganancia positiva</p>
          </article>
          <article class="detail-card">
            <span>CALORÍAS</span><strong>{{ formatNumber(calories()) }} <small>kcal</small></strong>
            <p>Estimación de la actividad</p>
          </article>
          <article class="detail-card">
            <span>FRECUENCIA CARDÍACA MEDIA</span
            ><strong>{{ formatNumber(averageHeartRate()) }} <small>bpm</small></strong>
            <p>Máxima: {{ formatNumber(maxHeartRate()) }} bpm</p>
          </article>
          <article class="detail-card">
            <span>CADENCIA MEDIA</span
            ><strong>{{ formatNumber(cadence()) }} <small>spm</small></strong>
            <p>Pasos por minuto</p>
          </article>
        </div>
        <div class="comparison-section">
          <div class="section-heading compact">
            <div>
              <p class="eyebrow">COMPARATIVA DE RENDIMIENTO</p>
              <h2>Respecto a tu media</h2>
            </div>
          </div>
          <div class="comparison-grid">
            @for (comparison of comparisons(); track comparison.key) {
              <article class="comparison-card">
                <div class="comparison-heading">
                  <div>
                    <h3>{{ comparison.label }}</h3>
                    <span>{{ comparison.activities }} salidas</span>
                  </div>
                  <mat-icon>compare_arrows</mat-icon>
                </div>
                <div class="comparison-list">
                  <div>
                    <span
                      >Distancia<small
                        >Media: {{ comparisonAverageLabel(comparison, 'distance', 'km') }}</small
                      ></span
                    ><strong>{{ activity().distance.toFixed(1) }} km</strong
                    ><b
                      class="comparison-delta"
                      [class.above]="
                        comparisonDelta(activity().distance, comparison, 'distance') > 0
                      "
                      [class.below]="
                        comparisonDelta(activity().distance, comparison, 'distance') < 0
                      "
                      >{{ comparisonDeltaLabel(activity().distance, comparison, 'distance') }}</b
                    >
                  </div>
                  <div>
                    <span
                      >Tiempo en movimiento<small
                        >Media: {{ comparisonAverageLabel(comparison, 'moving_time', '') }}</small
                      ></span
                    ><strong>{{ formatDuration(activity().moving_time_seconds) }}</strong
                    ><b
                      class="comparison-delta"
                      [class.above]="
                        comparisonDelta(activity().moving_time_seconds, comparison, 'moving_time') >
                        0
                      "
                      [class.below]="
                        comparisonDelta(activity().moving_time_seconds, comparison, 'moving_time') <
                        0
                      "
                      >{{
                        comparisonDeltaLabel(
                          activity().moving_time_seconds,
                          comparison,
                          'moving_time'
                        )
                      }}</b
                    >
                  </div>
                  <div>
                    <span
                      >Desnivel acumulado<small
                        >Media: {{ comparisonAverageLabel(comparison, 'elevation', 'm') }}</small
                      ></span
                    ><strong>{{ activity().elevation }} m</strong
                    ><b
                      class="comparison-delta"
                      [class.above]="
                        comparisonDelta(activity().elevation, comparison, 'elevation') > 0
                      "
                      [class.below]="
                        comparisonDelta(activity().elevation, comparison, 'elevation') < 0
                      "
                      >{{ comparisonDeltaLabel(activity().elevation, comparison, 'elevation') }}</b
                    >
                  </div>
                  <div>
                    <span
                      >Velocidad media<small
                        >Media:
                        {{ comparisonAverageLabel(comparison, 'average_speed', 'km/h') }}</small
                      ></span
                    ><strong>{{ activity().speed.toFixed(1) }} km/h</strong
                    ><b
                      class="comparison-delta"
                      [class.above]="
                        comparisonDelta(activity().speed, comparison, 'average_speed') > 0
                      "
                      [class.below]="
                        comparisonDelta(activity().speed, comparison, 'average_speed') < 0
                      "
                      >{{ comparisonDeltaLabel(activity().speed, comparison, 'average_speed') }}</b
                    >
                  </div>
                  <div>
                    <span
                      >Calorías<small
                        >Media: {{ comparisonAverageLabel(comparison, 'calories', 'kcal') }}</small
                      ></span
                    ><strong>{{ formatNumber(calories()) }} kcal</strong
                    ><b
                      class="comparison-delta"
                      [class.above]="comparisonDelta(calories(), comparison, 'calories') > 0"
                      [class.below]="comparisonDelta(calories(), comparison, 'calories') < 0"
                      >{{ comparisonDeltaLabel(calories(), comparison, 'calories') }}</b
                    >
                  </div>
                  <div>
                    <span
                      >Frecuencia cardíaca<small
                        >Media:
                        {{ comparisonAverageLabel(comparison, 'average_heartrate', 'bpm') }}</small
                      ></span
                    ><strong>{{ formatNumber(averageHeartRate()) }} bpm</strong
                    ><b
                      class="comparison-delta"
                      [class.above]="
                        comparisonDelta(averageHeartRate(), comparison, 'average_heartrate') > 0
                      "
                      [class.below]="
                        comparisonDelta(averageHeartRate(), comparison, 'average_heartrate') < 0
                      "
                      >{{
                        comparisonDeltaLabel(averageHeartRate(), comparison, 'average_heartrate')
                      }}</b
                    >
                  </div>
                </div>
              </article>
            } @empty {
              <div class="empty-state">No hay suficientes datos para comparar esta actividad.</div>
            }
          </div>
          <div class="comparison-table" aria-label="Comparativa con tus medias">
            <div class="comparison-table-row comparison-table-head">
              <span>Métrica</span>
              @for (comparison of comparisons(); track comparison.key) {
                <span>{{ comparison.label }}</span>
              }
            </div>
            <div class="comparison-table-row">
              <span>Distancia</span>
              @for (comparison of comparisons(); track comparison.key) {
                <span
                  ><strong>{{ activity().distance.toFixed(1) }} km</strong
                  ><small>Media {{ comparisonAverageLabel(comparison, 'distance', 'km') }}</small
                  ><b
                    [class.above]="comparisonDelta(activity().distance, comparison, 'distance') > 0"
                    [class.below]="comparisonDelta(activity().distance, comparison, 'distance') < 0"
                    >{{ comparisonDeltaLabel(activity().distance, comparison, 'distance') }}</b
                  ></span
                >
              }
            </div>
            <div class="comparison-table-row">
              <span>Tiempo</span>
              @for (comparison of comparisons(); track comparison.key) {
                <span
                  ><strong>{{ formatDuration(activity().moving_time_seconds) }}</strong
                  ><small>Media {{ comparisonAverageLabel(comparison, 'moving_time', '') }}</small
                  ><b
                    [class.above]="
                      comparisonDelta(activity().moving_time_seconds, comparison, 'moving_time') > 0
                    "
                    [class.below]="
                      comparisonDelta(activity().moving_time_seconds, comparison, 'moving_time') < 0
                    "
                    >{{
                      comparisonDeltaLabel(
                        activity().moving_time_seconds,
                        comparison,
                        'moving_time'
                      )
                    }}</b
                  ></span
                >
              }
            </div>
            <div class="comparison-table-row">
              <span>Desnivel</span>
              @for (comparison of comparisons(); track comparison.key) {
                <span
                  ><strong>{{ activity().elevation }} m</strong
                  ><small>Media {{ comparisonAverageLabel(comparison, 'elevation', 'm') }}</small
                  ><b
                    [class.above]="
                      comparisonDelta(activity().elevation, comparison, 'elevation') > 0
                    "
                    [class.below]="
                      comparisonDelta(activity().elevation, comparison, 'elevation') < 0
                    "
                    >{{ comparisonDeltaLabel(activity().elevation, comparison, 'elevation') }}</b
                  ></span
                >
              }
            </div>
            <div class="comparison-table-row">
              <span>Velocidad</span>
              @for (comparison of comparisons(); track comparison.key) {
                <span
                  ><strong>{{ activity().speed.toFixed(1) }} km/h</strong
                  ><small
                    >Media {{ comparisonAverageLabel(comparison, 'average_speed', 'km/h') }}</small
                  ><b
                    [class.above]="
                      comparisonDelta(activity().speed, comparison, 'average_speed') > 0
                    "
                    [class.below]="
                      comparisonDelta(activity().speed, comparison, 'average_speed') < 0
                    "
                    >{{ comparisonDeltaLabel(activity().speed, comparison, 'average_speed') }}</b
                  ></span
                >
              }
            </div>
            <div class="comparison-table-row">
              <span>Calorías</span>
              @for (comparison of comparisons(); track comparison.key) {
                <span
                  ><strong>{{ formatNumber(calories()) }} kcal</strong
                  ><small>Media {{ comparisonAverageLabel(comparison, 'calories', 'kcal') }}</small
                  ><b
                    [class.above]="comparisonDelta(calories(), comparison, 'calories') > 0"
                    [class.below]="comparisonDelta(calories(), comparison, 'calories') < 0"
                    >{{ comparisonDeltaLabel(calories(), comparison, 'calories') }}</b
                  ></span
                >
              }
            </div>
            <div class="comparison-table-row">
              <span>Pulso medio</span>
              @for (comparison of comparisons(); track comparison.key) {
                <span
                  ><strong>{{ formatNumber(averageHeartRate()) }} bpm</strong
                  ><small
                    >Media
                    {{ comparisonAverageLabel(comparison, 'average_heartrate', 'bpm') }}</small
                  ><b
                    [class.above]="
                      comparisonDelta(averageHeartRate(), comparison, 'average_heartrate') > 0
                    "
                    [class.below]="
                      comparisonDelta(averageHeartRate(), comparison, 'average_heartrate') < 0
                    "
                    >{{
                      comparisonDeltaLabel(averageHeartRate(), comparison, 'average_heartrate')
                    }}</b
                  ></span
                >
              }
            </div>
          </div>
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
                <p>{{ segment.distance }} · {{ segment.attempts }} intentos @if (segment.absolute_rank_position) { <span class="absolute-position">· Posición absoluta: {{ segment.absolute_rank_position }}º</span> }</p>
              </div>
              <b>{{ segment.best }}</b
              ><mat-icon>chevron_right</mat-icon></a
            >
          }
        </div>
      } @else if (section() === 'charts') {
        <app-route-map [routePoints]="routePoints()" />
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
  readonly routePoints = computed<L.LatLngExpression[]>(() => {
    const map = this.detail()?.['map'] as NormalizedMap | undefined;
    const stream = this.detail()?.['streams']?.['latlng'];
    const raw = map?.points?.length ? map.points : stream?.data;
    return Array.isArray(raw) && raw.length > 1 ? (raw as L.LatLngExpression[]) : DEFAULT_ROUTE;
  });
  readonly streamsLabel = computed(() =>
    this.detail()?.['map']?.point_count
      ? `Mapa normalizado · ${this.detail()?.['map']?.point_count} puntos${this.detail()?.['map']?.simplified ? ' simplificados' : ''}.`
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
  comparisonAverageLabel(comparison: any, key: string, unit: string) {
    const value = this.comparisonMetric(comparison, key);
    if (value === null) return '—';
    const decimals = key === 'distance' || key === 'average_speed' ? 1 : 0;
    return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
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
