import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ApiService, countRestDays } from './app';
import { TrainingLoadChart } from './chart-components';
import { MetricInfoComponent } from './metric-info';

interface LoadPoint { day?: string; label?: string; date?: string; load?: number; fitness?: number; fatigue?: number; form?: number; freshness?: number; }
interface Goal { id?: number | string; period_type?: string; sport_type?: string | null; metric?: string; target?: number; period_start?: string; period_end?: string; current_value?: number; }
interface Workout { id: number | string; planned_date: string; name: string; sport_type?: string; workout_type?: string; duration_minutes?: number | null; distance_meters?: number | null; intensity?: string; notes?: string | null; }
interface CalendarActivity { id: number | string; start_date_local?: string; distance?: number; moving_time?: number; total_elevation_gain?: number; sport_type?: string; }

@Component({
  selector: 'app-progress',
  imports: [RouterLink, FormsModule, MatIconModule, TrainingLoadChart, MetricInfoComponent],
  template: `
    <section class="page progress-page">
      <div class="back-row"><a routerLink="/app/dashboard"><mat-icon>arrow_back</mat-icon> Resumen</a><span class="api-badge">DATOS REALES</span></div>
      <div class="page-heading"><div><p class="eyebrow">CARGA · PLAN · PROGRESO</p><h1>Tu progreso</h1><p class="muted">Entiende cómo estás y decide qué toca después.</p><a class="text-button" routerLink="/app/statistics">Ver estadísticas históricas <mat-icon>arrow_forward</mat-icon></a></div><button class="round-button" type="button" (click)="reload()" [disabled]="loading()" aria-label="Actualizar progreso"><mat-icon>refresh</mat-icon></button></div>

      @if (loading()) { <div class="loading-state"><mat-icon>sync</mat-icon><p>Calculando tu estado físico…</p></div> }
      @else {
        @if (error()) { <p class="api-error">{{ error() }}</p> }
        <section class="readiness-card" [class.warning]="statusTone() === 'warning'" [class.fresh]="statusTone() === 'fresh'">
          <div><p class="eyebrow lime">ESTADO ACTUAL</p><h2>{{ statusLabel() }}</h2><p>{{ statusText() }}</p></div>
          <div class="readiness-score"><strong>{{ signed(current()?.form) }}</strong><span>forma <app-metric-info title="Forma" calculation="Fitness menos Fatiga. Fitness es una media exponencial de la carga diaria con memoria de 42 días; Fatiga usa la misma lógica con una memoria de 7 días." importance="Resume si la carga reciente está por encima o por debajo de tu base. Un valor positivo suele indicar más frescura; uno negativo, más fatiga acumulada." /></span></div>
        </section>

        <div class="load-grid">
          <article class="detail-card"><span class="metric-card-label">CARGA · 7 DÍAS <app-metric-info title="Carga · 7 días" calculation="Suma de la carga de todas tus actividades de los últimos 7 días. La carga de cada sesión usa duración × esfuerzo percibido (sRPE) cuando existe; si no, estima la intensidad con potencia, pulso o una base de 2 puntos por minuto." importance="Mide el estímulo reciente que todavía puede influir en tu recuperación y ayuda a detectar semanas demasiado exigentes." /></span><strong>{{ number(acuteScore()) }}</strong><p>Esfuerzo reciente</p></article>
          <article class="detail-card"><span class="metric-card-label">FITNESS <app-metric-info title="Fitness" calculation="Media móvil exponencial de la carga diaria con una memoria de 42 días (CTL). La serie se recalcula con días de calentamiento previos para evitar que el valor empiece artificialmente en cero." importance="Representa tu base de entrenamiento acumulada: sube lentamente con constancia y baja lentamente cuando dejas de entrenar." /></span><strong>{{ number(current()?.fitness) }}</strong><p>Base de las últimas semanas</p></article>
          <article class="detail-card"><span class="metric-card-label">FATIGA <app-metric-info title="Fatiga" calculation="Media móvil exponencial de la carga diaria con una memoria de 7 días (ATL). Da más peso a lo que has hecho recientemente." importance="Ayuda a decidir si conviene apretar o recuperar: una fatiga alta junto a un Fitness estable suele pedir una sesión fácil o descanso." /></span><strong>{{ number(current()?.fatigue) }}</strong><p>Respuesta a la carga</p></article>
          <article class="detail-card"><span class="metric-card-label">DESCANSO <app-metric-info title="Días de descanso" calculation="Número de días de los últimos 7, contando hoy, en los que no hay ninguna actividad registrada. Una actividad aunque sea corta hace que ese día no cuente como descanso." importance="Te da una señal sencilla de recuperación y regularidad. No sustituye cómo te sientes: dolor, sueño o enfermedad deben pesar más que este contador." /></span><strong>{{ restDays() }} <small>días</small></strong><p>Sin actividad en 7 días</p></article>
        </div>

        <article class="chart-card load-chart-card">
          <div class="card-heading"><div><span class="eyebrow">FITNESS & FRESHNESS · 6 SEMANAS <app-metric-info title="Carga en perspectiva" calculation="Cada punto representa un día. Carga diaria aparece como esfuerzo acumulado; Fitness y Fatiga son medias exponenciales de 42 y 7 días. La Forma es la diferencia entre ambas." importance="Ver las curvas juntas evita interpretar una sesión aislada: permite distinguir un pico puntual de una tendencia y ajustar el siguiente entrenamiento." /></span><h2>Carga en perspectiva</h2></div><span class="chart-method">{{ method() }}</span></div>
          @if (series().length) {
            <app-training-load-chart [series]="series()" />
            <div class="chart-legend"><span><i class="legend-load"></i>Carga diaria</span><span><i class="legend-fitness"></i>Fitness</span><span><i class="legend-fatigue"></i>Fatiga</span></div>
          } @else { <div class="empty-state">Aún no hay suficientes actividades para dibujar la carga.</div> }
        </article>

        @if (insights().length) { <section class="insight-list"><div class="section-heading compact"><div><p class="eyebrow">LECTURA DE TUS DATOS</p><h2>Una señal para esta semana</h2></div></div>@for (insight of insights().slice(0, 2); track insight.title) { <article class="insight-card" [class.warning]="insight.tone === 'warning'"><span class="insight-icon"><mat-icon>{{ insight.tone === 'warning' ? 'warning' : 'auto_awesome' }}</mat-icon></span><div><strong>{{ insight.title }}</strong><p>{{ insight.text }}</p></div></article>}</section> }

        <section class="progress-columns">
          <article class="progress-panel"><div class="section-heading compact"><div><p class="eyebrow">OBJETIVOS ACTIVOS</p><h2>Lo que quieres conseguir</h2></div></div>
            @for (goal of goals(); track goal.id || goal.metric) { <div class="goal-row"><div class="goal-row-head"><span>{{ goalLabel(goal) }}</span><strong>{{ goalProgress(goal) }}%</strong></div><div class="goal-track"><i [style.width.%]="goalProgress(goal)"></i></div><small>{{ goalCurrent(goal) }} / {{ goalTarget(goal) }} · {{ periodLabel(goal) }}</small></div> } @empty { <div class="empty-state">Todavía no tienes objetivos activos. Crea uno para saber qué te falta.</div> }
            <div class="goal-form"><label>Periodo<select [(ngModel)]="goalPeriod"><option value="week">Semanal</option><option value="month">Mensual</option><option value="year">Anual</option></select></label><label>Deporte<select [(ngModel)]="goalSport"><option value="">Todos</option><option value="Run">Correr</option><option value="Ride">Ciclismo</option><option value="Walk">Caminar</option></select></label><label>Métrica<select [(ngModel)]="goalMetric"><option value="distance">Distancia (km)</option><option value="time">Tiempo (min)</option><option value="elevation">Desnivel (m)</option><option value="activities">Actividades</option></select></label><label>Objetivo<input type="number" min="1" [(ngModel)]="goalTargetValue" /></label><button class="outline-button" type="button" (click)="saveGoal()" [disabled]="savingGoal()">{{ savingGoal() ? 'Guardando…' : 'Añadir objetivo' }}</button></div>
          </article>

          <article class="progress-panel"><div class="section-heading compact"><div><p class="eyebrow">PRÓXIMAS SESIONES</p><h2>Plan de entrenamiento</h2></div></div>
            @for (workout of workouts(); track workout.id) { <div class="workout-row"><div class="workout-date">{{ shortDate(workout.planned_date) }}</div><div><strong>{{ workout.name }}</strong><small>{{ workout.sport_type || 'Run' }} · {{ workoutDescription(workout) }}</small></div><button class="icon-button" type="button" (click)="removeWorkout(workout)" [disabled]="deletingWorkout() === workout.id" aria-label="Borrar sesión"><mat-icon>close</mat-icon></button></div> } @empty { <div class="empty-state">No hay sesiones planificadas todavía.</div> }
            <div class="workout-form"><label>Fecha<input type="date" [(ngModel)]="workoutDate" /></label><label>Sesión<input [(ngModel)]="workoutName" placeholder="Rodaje suave" /></label><div class="two-fields"><label>Duración (min)<input type="number" min="1" [(ngModel)]="workoutDuration" /></label><label>Intensidad<select [(ngModel)]="workoutIntensity"><option value="recovery">Recuperación</option><option value="easy">Suave</option><option value="moderate">Moderada</option><option value="hard">Alta</option><option value="race">Competición</option></select></label></div><button class="primary-button full" type="button" (click)="saveWorkout()" [disabled]="savingWorkout()">{{ savingWorkout() ? 'Guardando…' : 'Planificar sesión' }} <mat-icon>event</mat-icon></button></div>
          </article>
        </section>

        <article class="calendar-panel"><div class="section-heading compact"><div><p class="eyebrow">CALENDARIO · 14 DÍAS</p><h2>Actividad y continuidad</h2></div><span class="calendar-summary">{{ activeDays() }} días activos <app-metric-info title="Días activos" calculation="Cuenta las fechas distintas con al menos una actividad dentro de los 14 días mostrados en el calendario." importance="La continuidad semanal suele ser más útil que una sola sesión grande para construir hábitos y sostener el progreso." /></span></div><div class="calendar-strip">@for (day of calendarDays(); track day.key) { <div class="calendar-day" [class.today]="day.today" [class.active]="day.active" [class.planned]="day.planned"><span>{{ day.label }}</span><strong>{{ day.number }}</strong><i>{{ day.active ? '●' : day.planned ? '○' : '·' }}</i></div> }</div></article>
      }
    </section>
  `,
  styles: [`
    .metric-card-label{display:flex;align-items:center;gap:4px}
    .progress-page{max-width:1080px}.readiness-card{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 24px;margin-bottom:12px;border-radius:16px;background:linear-gradient(120deg,#29351d,#1b2417);border:1px solid rgba(201,244,91,.22)}.readiness-card.warning{background:linear-gradient(120deg,#3b2d1d,#241c16);border-color:rgba(240,164,93,.3)}.readiness-card.fresh{background:linear-gradient(120deg,#1f352a,#17241b)}.readiness-card h2{font-size:25px;letter-spacing:-.05em;margin:3px 0 6px}.readiness-card p:not(.eyebrow){color:#c4cfbb;font-size:11px;max-width:560px}.readiness-score{min-width:88px;text-align:center}.readiness-score strong{display:block;font-size:34px;letter-spacing:-.08em;color:var(--lime)}.readiness-score span{color:var(--muted);font-size:10px}.load-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.load-grid .detail-card{min-height:112px}.load-grid .detail-card strong{font-size:25px}.chart-method{color:var(--muted);font-size:9px;text-align:right;max-width:230px}.load-chart{display:block;width:100%;height:190px;margin-top:12px;overflow:visible}.load-line,.fitness-line,.fatigue-line{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.load-line{stroke:var(--lime);stroke-width:2}.fitness-line{stroke:#76a8ff}.fatigue-line{stroke:#f0a45d}.load-area{fill:rgba(201,244,91,.1)}.chart-legend{display:flex;gap:18px;color:var(--muted);font-size:10px}.chart-legend span{display:flex;align-items:center;gap:6px}.chart-legend i{width:8px;height:8px;border-radius:50%;display:block}.legend-load{background:var(--lime)}.legend-fitness{background:#76a8ff}.legend-fatigue{background:#f0a45d}.insight-list{margin-top:24px}.insight-card.warning{border-color:rgba(240,164,93,.22);background:rgba(240,164,93,.06)}.progress-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}.progress-panel,.calendar-panel{padding:18px;background:var(--panel);border:1px solid var(--line);border-radius:15px}.progress-panel .section-heading{margin-bottom:12px}.goal-row{padding:12px 0;border-bottom:1px solid var(--line)}.goal-row-head{display:flex;justify-content:space-between;font-size:11px}.goal-row-head strong{color:var(--lime)}.goal-row small,.workout-row small{display:block;color:var(--muted);font-size:9px;margin-top:6px}.goal-track{height:6px;background:#30392b;border-radius:6px;overflow:hidden;margin-top:9px}.goal-track i{display:block;height:100%;background:var(--lime);border-radius:inherit}.goal-form,.workout-form{display:grid;gap:9px;margin-top:15px}.goal-form{grid-template-columns:1fr 1fr}.goal-form label:last-of-type{grid-column:1 / -1}.goal-form button{grid-column:1 / -1}.goal-form label,.workout-form label{color:var(--muted);font-size:10px}.goal-form input,.goal-form select,.workout-form input,.workout-form select{display:block;width:100%;margin-top:5px}.progress-page input,.progress-page select{background:#11150f;border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:10px;font-size:11px;outline:0}.progress-page input:focus,.progress-page select:focus{border-color:var(--lime)}.workout-row{display:grid;grid-template-columns:64px 1fr 28px;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.workout-date{color:var(--lime);font-size:10px;font-weight:800}.workout-row strong{font-size:11px}.workout-row .icon-button{width:26px;height:26px;color:var(--muted)}.workout-form .two-fields{margin:0;gap:8px}.calendar-panel{margin-top:12px}.calendar-summary{color:var(--lime);font-size:10px}.calendar-strip{display:grid;grid-template-columns:repeat(14,1fr);gap:7px}.calendar-day{min-height:76px;padding:9px 5px;text-align:center;border:1px solid var(--line);border-radius:10px;color:var(--muted);background:#141912}.calendar-day span{display:block;font-size:8px;text-transform:uppercase}.calendar-day strong{display:block;color:var(--ink);font-size:17px;margin:7px 0 3px}.calendar-day i{font-style:normal;color:#53604e;font-size:12px}.calendar-day.active{border-color:rgba(201,244,91,.35);background:rgba(201,244,91,.08)}.calendar-day.active i{color:var(--lime)}.calendar-day.planned{border-color:rgba(118,168,255,.35)}.calendar-day.planned i{color:#76a8ff}.calendar-day.today{box-shadow:inset 0 -2px var(--lime)}
    @media(max-width:800px){.load-grid{grid-template-columns:repeat(2,1fr)}.progress-columns{grid-template-columns:1fr}.calendar-strip{grid-template-columns:repeat(7,1fr)}.calendar-day:nth-child(n+8){display:none}.readiness-card{padding:18px}.chart-method{display:none}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressPage {
  private readonly api = inject(ApiService);
  readonly loading = signal(true); readonly error = signal(''); readonly load = signal<Record<string, any> | null>(null); readonly stats = signal<Record<string, any> | null>(null); readonly analysis = signal<Record<string, any> | null>(null); readonly goals = signal<Goal[]>([]); readonly activities = signal<CalendarActivity[]>([]); readonly marks = signal<Record<string, any>[]>([]); readonly workouts = signal<Workout[]>([]);
  readonly savingGoal = signal(false); readonly savingWorkout = signal(false); readonly deletingWorkout = signal<number | string | null>(null);
  goalPeriod = 'month'; goalMetric = 'distance'; goalTargetValue = 100; goalSport = ''; workoutDate = this.dateKey(1); workoutName = ''; workoutDuration = 45; workoutIntensity = 'easy';
  private pending = 0;
  readonly series = computed(() => {
    const source = (this.load()?.['series'] ?? this.load()?.['fitness_days'] ?? []) as LoadPoint[];
    return source
      .filter((point) => point && (point.day || point.date || point.label))
      .slice()
      .sort((a, b) => String(a.day ?? a.date ?? a.label).localeCompare(String(b.day ?? b.date ?? b.label)))
      .slice(-42);
  });
  readonly current = computed(() => (this.load()?.['current'] ?? this.series().at(-1) ?? null) as LoadPoint | null);
  readonly insights = computed(() => (this.analysis()?.['insights'] ?? []) as Array<{ tone: string; title: string; text: string }>);
  readonly method = computed(() => String(this.load()?.['method'] ?? 'Carga estimada con tus actividades'));
  readonly activeDays = computed(() => new Set(this.activities().map(item => this.dayKey(item.start_date_local))).size);
  readonly calendarDays = computed(() => Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + index); const key = this.dateKeyFrom(date); return { key, label: date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''), number: date.getDate(), today: index === 0, active: this.activities().some(item => this.dayKey(item.start_date_local) === key), planned: this.workouts().some(item => item.planned_date === key) }; }));
  readonly acuteScore = computed(() => Number(this.load()?.['acute_score'] ?? this.current()?.load ?? 0));
  readonly restDays = computed(() => countRestDays(this.load()));

  constructor() { this.reload(); }
  reload() { this.loading.set(true); this.error.set(''); this.pending = 5; const done = () => { this.pending -= 1; if (this.pending <= 0) this.loading.set(false); };
    this.api.trainingLoad().subscribe({ next: value => this.load.set(value), error: () => { this.fail('carga'); done(); }, complete: done });
    this.api.statistics().subscribe({ next: value => this.stats.set(value), error: () => { this.fail('estadísticas'); done(); }, complete: done });
    this.api.analysis().subscribe({ next: value => this.analysis.set(value), error: () => { this.fail('análisis'); done(); }, complete: done });
    this.api.goals().subscribe({ next: value => this.goals.set(value.goals ?? []), error: () => { this.fail('objetivos'); done(); }, complete: done });
    const start = this.dateKey(0); const end = this.dateKey(13);
    this.api.calendar(start, end).subscribe({ next: value => { this.activities.set((value.activities ?? []) as CalendarActivity[]); this.marks.set(value.marks ?? []); this.workouts.set((value.planned_workouts ?? []) as Workout[]); }, error: () => { this.fail('calendario'); done(); }, complete: done });
  }
  saveGoal() { this.savingGoal.set(true); const body = { period_type: this.goalPeriod, metric: this.goalMetric, target: Number(this.goalTargetValue), period_start: this.periodStart(), sport_type: this.goalSport || null }; this.api.createGoal(body).subscribe({ next: value => this.goals.set(value.goals ?? []), error: () => this.error.set('No se ha podido guardar el objetivo.'), complete: () => this.savingGoal.set(false) }); }
  saveWorkout() { if (!this.workoutName.trim() || !this.workoutDate) { this.error.set('Indica una fecha y un nombre para la sesión.'); return; } this.savingWorkout.set(true); this.api.createPlannedWorkout({ planned_date: this.workoutDate, name: this.workoutName.trim(), sport_type: 'Run', duration_minutes: Number(this.workoutDuration) || null, intensity: this.workoutIntensity }).subscribe({ next: value => { this.workouts.update(items => [...items, { id: value.id, planned_date: this.workoutDate, name: this.workoutName.trim(), sport_type: 'Run', duration_minutes: Number(this.workoutDuration) || null, intensity: this.workoutIntensity }].sort((a, b) => a.planned_date.localeCompare(b.planned_date))); this.workoutName = ''; }, error: () => this.error.set('No se ha podido planificar la sesión.'), complete: () => this.savingWorkout.set(false) }); }
  removeWorkout(workout: Workout) { this.deletingWorkout.set(workout.id); this.api.deletePlannedWorkout(workout.id).subscribe({ next: () => this.workouts.update(items => items.filter(item => item.id !== workout.id)), error: () => this.error.set('No se ha podido borrar la sesión.'), complete: () => this.deletingWorkout.set(null) }); }
  statusLabel() { const form = Number(this.current()?.form ?? 0); return form > 5 ? 'Fresco para apretar' : form < -5 ? 'Toca recuperar' : 'Listo para entrenar'; }
  statusTone() { const form = Number(this.current()?.form ?? 0); return form < -5 ? 'warning' : form > 5 ? 'fresh' : 'neutral'; }
  statusText() { const ratio = Number(this.load()?.['ratio']); if (ratio > 1.5) return 'La carga reciente está muy por encima de tu base. Prioriza una sesión fácil o descanso.'; if (Number(this.current()?.form ?? 0) > 5) return 'Tu fatiga está controlada respecto a tu fitness. Es un buen momento para una sesión de calidad.'; return 'La carga está dentro de un rango razonable. Alterna estímulo y recuperación para seguir progresando.'; }
  number(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number.toFixed(1) : '—'; }
  signed(value: unknown) { const number = Number(value); return Number.isFinite(number) ? `${number > 0 ? '+' : ''}${number.toFixed(1)}` : '—'; }
  goalLabel(goal: Goal) { return ({ distance: 'Distancia', time: 'Tiempo', elevation: 'Desnivel', activities: 'Actividades' } as Record<string, string>)[goal.metric ?? 'distance'] ?? 'Objetivo'; }
  goalProgress(goal: Goal) { const target = Number(goal.target ?? 0); if (!target) return 0; const value = this.goalValue(goal); return Math.min(100, Math.round(value / target * 100)); }
  goalCurrent(goal: Goal) { const value = this.goalValue(goal); return goal.metric === 'distance' ? `${value.toFixed(1)} km` : `${Math.round(value)} ${goal.metric === 'time' ? 'min' : goal.metric === 'elevation' ? 'm' : ''}`; }
  goalTarget(goal: Goal) { const value = Number(goal.target ?? 0); return goal.metric === 'distance' ? `${value.toFixed(1)} km` : `${value} ${goal.metric === 'time' ? 'min' : goal.metric === 'elevation' ? 'm' : ''}`; }
  periodLabel(goal: Goal) { return `${goal.period_start ?? '—'} → ${goal.period_end ?? '—'}`; }
  workoutDescription(workout: Workout) { return workout.duration_minutes ? `${workout.duration_minutes} min · ${workout.intensity ?? 'suave'}` : workout.distance_meters ? `${(Number(workout.distance_meters) / 1000).toFixed(1)} km` : 'Sesión planificada'; }
  shortDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', ''); }
  private goalValue(goal: Goal) { if (Number.isFinite(Number(goal.current_value))) return Number(goal.current_value); const start = goal.period_start ?? ''; const end = goal.period_end ?? ''; const daily = ((this.stats()?.['daily_30'] ?? []) as CalendarActivity[]).filter(item => { const day = this.dayKey(item.start_date_local); return day >= start && day <= end; }); return daily.reduce((sum, item) => sum + this.metricValue(goal.metric, item), 0); }
  private metricValue(metric: string | undefined, item: CalendarActivity) { return metric === 'distance' ? Number(item.distance ?? 0) / 1000 : metric === 'time' ? Number(item.moving_time ?? 0) / 60 : metric === 'elevation' ? Number(item.total_elevation_gain ?? 0) : 1; }
  private periodStart() { return this.goalPeriod === 'year' ? `${new Date().getFullYear()}-01-01` : this.goalPeriod === 'month' ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01` : this.dateKeyFrom(this.monday(new Date())); }
  private monday(date: Date) { const value = new Date(date); const day = value.getDay() || 7; value.setDate(value.getDate() - day + 1); return value; }
  private dateKey(days: number) { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + days); return this.dateKeyFrom(date); }
  private dateKeyFrom(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private dayKey(value: unknown) { return String(value ?? '').slice(0, 10); }
  private fail(area: string) { this.error.update(message => message || `No se han podido cargar ${area}.`); }
}
