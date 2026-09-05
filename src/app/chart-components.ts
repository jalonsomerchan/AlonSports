import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, effect, input } from '@angular/core';

export interface TrainingLoadChartPoint {
  label?: string;
  date?: string;
  load?: number;
  fitness?: number;
  fatigue?: number;
}

export interface MonthlyDistanceChartPoint { month?: string; distance?: number; }
export interface SportDistributionChartPoint { sport_type?: string; distance?: number; }

function registerChart() {
  return import('chart.js').then(({ Chart, registerables }) => {
    Chart.register(...registerables);
    return Chart;
  });
}

const chartColors = {
  ink: '#f0f2eb',
  muted: '#65705f',
  lime: '#c9f45b',
  blue: '#76a8ff',
  orange: '#f0a45d',
  panel: '#181c16',
  grid: 'rgba(255,255,255,.06)',
};

function lineOptions(scales: Record<string, unknown> = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'start', labels: { color: '#aab3a3', boxWidth: 9, boxHeight: 9, padding: 12, font: { size: 9 } } },
      tooltip: { backgroundColor: '#182019', borderColor: 'rgba(201,244,91,.25)', borderWidth: 1, titleColor: chartColors.ink, bodyColor: '#c7d0bd', padding: 9 },
    },
    scales: Object.keys(scales).length ? scales : {
      x: { display: false },
      y: { display: false },
    },
    elements: { line: { tension: .3 }, point: { radius: 0, hoverRadius: 3 } },
  };
}

@Component({
  selector: 'app-mini-chart',
  template: `<div class="chart-canvas mini-chart" role="img" aria-label="Gráfica de evolución"><canvas #canvas></canvas></div>`,
  styles: [`.chart-canvas{position:relative;width:100%;height:100%}.chart-canvas canvas{display:block;width:100%!important;height:100%!important}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniChart implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly values = input<number[] | undefined>();
  private chart?: import('chart.js').Chart;
  private chartConstructor: any;
  private readonly redraw = effect(() => { const values = this.chartValues(); if (this.chart) this.update(values); });

  ngAfterViewInit() {
    registerChart().then(Chart => { this.chartConstructor = Chart; this.chart = new Chart(this.canvas.nativeElement, this.config(this.chartValues())); });
  }

  private chartValues() { return this.values()?.length ? this.values()! : [18, 23, 19, 32, 27, 38, 36, 45, 42, 56, 52, 62]; }
  private config(values: number[]): any { return { type: 'line', data: { labels: values.map((_, index) => index + 1), datasets: [{ data: values, borderColor: chartColors.lime, backgroundColor: 'rgba(201,244,91,.18)', fill: true, borderWidth: 2.5 }] }, options: lineOptions() }; }
  private update(values: number[]) { if (!this.chart) return; const data = this.config(values).data; this.chart.data.labels = data.labels; this.chart.data.datasets = data.datasets as any; this.chart.update('none'); }
  ngOnDestroy() { this.redraw.destroy(); this.chart?.destroy(); }
}

@Component({
  selector: 'app-segment-spark',
  template: `<div class="chart-canvas segment-spark" role="img" aria-label="Evolución del rendimiento del segmento"><canvas #canvas></canvas></div>`,
  styles: [`.chart-canvas{position:relative;width:100%;height:100%}.chart-canvas canvas{display:block;width:100%!important;height:100%!important}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentSpark implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly data = input<number[]>([]);
  readonly color = input('#c9f45b');
  private chart?: import('chart.js').Chart;
  private chartConstructor: any;
  private readonly redraw = effect(() => { const values = this.data(); const color = this.color(); if (this.chart) this.update(values, color); });

  ngAfterViewInit() { registerChart().then(Chart => { this.chartConstructor = Chart; this.chart = new Chart(this.canvas.nativeElement, this.config(this.data(), this.color())); }); }
  private config(values: number[], color: string): any { const points = values.length ? values : [1, 2]; return { type: 'line', data: { labels: points.map((_, index) => index + 1), datasets: [{ data: points, borderColor: color, backgroundColor: 'transparent', borderWidth: 2.5 }] }, options: { ...lineOptions(), plugins: { legend: { display: false }, tooltip: { enabled: false } } } }; }
  private update(values: number[], color: string) { if (!this.chart) return; const data = this.config(values, color).data; this.chart.data.labels = data.labels; this.chart.data.datasets = data.datasets as any; this.chart.update('none'); }
  ngOnDestroy() { this.redraw.destroy(); this.chart?.destroy(); }
}

@Component({
  selector: 'app-segment-performance-chart',
  template: `<div class="chart-canvas segment-performance-chart" role="img" aria-label="Evolución del tiempo en los esfuerzos del segmento"><canvas #canvas></canvas></div>`,
  styles: [`.chart-canvas{position:relative;width:100%;height:230px}.chart-canvas canvas{display:block;width:100%!important;height:100%!important}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentPerformanceChart implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly values = input<number[]>([]);
  readonly color = input('#c9f45b');
  private chart?: import('chart.js').Chart;
  private chartConstructor: any;
  private readonly redraw = effect(() => {
    const values = this.values();
    const color = this.color();
    if (this.chart) this.update(values, color);
  });

  ngAfterViewInit() {
    registerChart().then(Chart => {
      this.chartConstructor = Chart;
      this.chart = new Chart(this.canvas.nativeElement, this.config(this.values(), this.color()));
    });
  }

  private config(values: number[], color: string): any {
    const points = values.length ? values : [0, 0];
    return {
      type: 'line',
      data: {
        labels: points.map((_, index) => `Esfuerzo ${index + 1}`),
        datasets: [{
          label: 'Tiempo por esfuerzo',
          data: points,
          borderColor: color,
          backgroundColor: 'rgba(201,244,91,.12)',
          fill: true,
          borderWidth: 2.5,
        }],
      },
      options: {
        ...lineOptions({
          x: {
            ticks: { color: chartColors.muted, maxRotation: 0, autoSkip: true, font: { size: 9 } },
            grid: { color: chartColors.grid },
          },
          y: {
            reverse: true,
            title: { display: true, text: 'tiempo', color: chartColors.muted, font: { size: 9 } },
            ticks: {
              color: chartColors.muted,
              font: { size: 9 },
              callback: (value: string | number) => this.duration(Number(value)),
            },
            grid: { color: chartColors.grid },
          },
        }),
        plugins: {
          ...lineOptions().plugins,
          legend: { display: false },
          tooltip: {
            ...lineOptions().plugins.tooltip,
            callbacks: { label: (context: any) => ` ${this.duration(Number(context.raw ?? 0))}` },
          },
        },
      },
    };
  }

  private duration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
  }

  private update(values: number[], color: string) {
    if (!this.chart) return;
    const data = this.config(values, color).data;
    this.chart.data.labels = data.labels;
    this.chart.data.datasets = data.datasets as any;
    this.chart.update('none');
  }

  ngOnDestroy() { this.redraw.destroy(); this.chart?.destroy(); }
}

@Component({
  selector: 'app-training-load-chart',
  template: `<div class="chart-canvas training-load-chart" role="img" aria-label="Evolución de carga, fitness y fatiga"><canvas #canvas></canvas></div>`,
  styles: [`.chart-canvas{position:relative;width:100%;height:230px}.chart-canvas canvas{display:block;width:100%!important;height:100%!important}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingLoadChart implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly series = input<TrainingLoadChartPoint[]>([]);
  private chart?: import('chart.js').Chart;
  private chartConstructor: any;
  private readonly redraw = effect(() => { const series = this.series(); if (this.chart) this.update(series); });

  ngAfterViewInit() { registerChart().then(Chart => { this.chartConstructor = Chart; this.chart = new Chart(this.canvas.nativeElement, this.config(this.series())); }); }
  private config(series: TrainingLoadChartPoint[]): any { const labels = series.map((point, index) => point.label ?? point.date ?? String(index + 1)); return { type: 'line', data: { labels, datasets: [
    { label: 'Carga diaria', data: series.map(point => point.load ?? 0), borderColor: chartColors.lime, backgroundColor: 'rgba(201,244,91,.1)', fill: true, borderWidth: 2 },
    { label: 'Fitness', data: series.map(point => point.fitness ?? 0), borderColor: chartColors.blue, backgroundColor: 'transparent', fill: false, borderWidth: 2 },
    { label: 'Fatiga', data: series.map(point => point.fatigue ?? 0), borderColor: chartColors.orange, backgroundColor: 'transparent', fill: false, borderWidth: 2 },
  ] }, options: lineOptions({ x: { ticks: { color: chartColors.muted, maxRotation: 0, autoSkip: true, font: { size: 9 } }, grid: { color: chartColors.grid } }, y: { beginAtZero: true, ticks: { color: chartColors.muted, font: { size: 9 } }, grid: { color: chartColors.grid } } }) }; }
  private update(series: TrainingLoadChartPoint[]) { if (!this.chart) return; const data = this.config(series).data; this.chart.data.labels = data.labels; this.chart.data.datasets = data.datasets as any; this.chart.update('none'); }
  ngOnDestroy() { this.redraw.destroy(); this.chart?.destroy(); }
}

@Component({
  selector: 'app-compare-chart',
  template: `<div class="chart-canvas compare-chart-canvas" role="img" aria-label="Comparación de velocidad de dos actividades"><canvas #canvas></canvas></div>`,
  styles: [`.chart-canvas{position:relative;width:100%;height:230px}.chart-canvas canvas{display:block;width:100%!important;height:100%!important}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareChart implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly one = input<number[]>([]);
  readonly two = input<number[]>([]);
  readonly oneLabel = input('Actividad A');
  readonly twoLabel = input('Actividad B');
  private chart?: import('chart.js').Chart;
  private chartConstructor: any;
  private readonly redraw = effect(() => { const values = [this.one(), this.two(), this.oneLabel(), this.twoLabel()]; if (this.chart) this.update(values[0] as number[], values[1] as number[], values[2] as string, values[3] as string); });

  ngAfterViewInit() { registerChart().then(Chart => { this.chartConstructor = Chart; this.chart = new Chart(this.canvas.nativeElement, this.config(this.one(), this.two(), this.oneLabel(), this.twoLabel())); }); }
  private config(one: number[], two: number[], oneLabel: string, twoLabel: string): any { const length = Math.max(one.length, two.length, 1); return { type: 'line', data: { labels: Array.from({ length }, (_, index) => `${index + 1}`), datasets: [
    { label: oneLabel, data: one, borderColor: chartColors.lime, backgroundColor: 'rgba(201,244,91,.08)', fill: true, borderWidth: 2.5 },
    { label: twoLabel, data: two, borderColor: chartColors.blue, backgroundColor: 'rgba(118,168,255,.08)', fill: true, borderWidth: 2.5 },
  ] }, options: lineOptions({ x: { ticks: { color: chartColors.muted, maxRotation: 0, autoSkip: true, font: { size: 9 } }, grid: { color: chartColors.grid } }, y: { beginAtZero: true, title: { display: true, text: 'km/h', color: chartColors.muted, font: { size: 9 } }, ticks: { color: chartColors.muted, font: { size: 9 } }, grid: { color: chartColors.grid } } }) }; }
  private update(one: number[], two: number[], oneLabel: string, twoLabel: string) { if (!this.chart) return; const data = this.config(one, two, oneLabel, twoLabel).data; this.chart.data.labels = data.labels; this.chart.data.datasets = data.datasets as any; this.chart.update('none'); }
  ngOnDestroy() { this.redraw.destroy(); this.chart?.destroy(); }
}

@Component({
  selector: 'app-monthly-distance-chart',
  template: `<div class="chart-canvas monthly-distance-chart" role="img" aria-label="Evolución mensual de distancia"><canvas #canvas></canvas></div>`,
  styles: [`.chart-canvas{position:relative;width:100%;height:230px}.chart-canvas canvas{display:block;width:100%!important;height:100%!important}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyDistanceChart implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly rows = input<MonthlyDistanceChartPoint[]>([]);
  private chart?: import('chart.js').Chart;
  private chartConstructor: any;
  private readonly redraw = effect(() => { const rows = this.rows(); if (this.chart) this.update(rows); });

  ngAfterViewInit() { registerChart().then(Chart => { this.chartConstructor = Chart; this.chart = new Chart(this.canvas.nativeElement, this.config(this.rows())); }); }
  private config(rows: MonthlyDistanceChartPoint[]): any { return { type: 'bar', data: { labels: rows.map(row => row.month ?? '—'), datasets: [{ label: 'Distancia (km)', data: rows.map(row => Number(row.distance ?? 0) / 1000), backgroundColor: 'rgba(201,244,91,.72)', borderColor: chartColors.lime, borderWidth: 1, borderRadius: 6, maxBarThickness: 34 }] }, options: { ...lineOptions({ x: { ticks: { color: chartColors.muted, maxRotation: 0, autoSkip: true, font: { size: 9 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: chartColors.muted, font: { size: 9 } }, grid: { color: chartColors.grid }, title: { display: true, text: 'km', color: chartColors.muted, font: { size: 9 } } } }), plugins: { ...lineOptions().plugins, legend: { display: false } } } }; }
  private update(rows: MonthlyDistanceChartPoint[]) { if (!this.chart) return; const data = this.config(rows).data; this.chart.data.labels = data.labels; this.chart.data.datasets = data.datasets as any; this.chart.update('none'); }
  ngOnDestroy() { this.redraw.destroy(); this.chart?.destroy(); }
}

@Component({
  selector: 'app-sport-distribution-chart',
  template: `<div class="chart-canvas sport-distribution-chart" role="img" aria-label="Distribución de distancia por deporte"><canvas #canvas></canvas></div>`,
  styles: [`.chart-canvas{position:relative;width:100%;height:190px}.chart-canvas canvas{display:block;width:100%!important;height:100%!important}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportDistributionChart implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  readonly rows = input<SportDistributionChartPoint[]>([]);
  private chart?: import('chart.js').Chart;
  private chartConstructor: any;
  private readonly redraw = effect(() => { const rows = this.rows(); if (this.chart) this.update(rows); });

  ngAfterViewInit() { registerChart().then(Chart => { this.chartConstructor = Chart; this.chart = new Chart(this.canvas.nativeElement, this.config(this.rows())); }); }
  private config(rows: SportDistributionChartPoint[]): any { const labels = rows.map(row => this.sport(row.sport_type)); return { type: 'doughnut', data: { labels, datasets: [{ data: rows.map(row => Number(row.distance ?? 0) / 1000), backgroundColor: [chartColors.lime, chartColors.blue, chartColors.orange, '#7dffb2'], borderColor: chartColors.panel, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: '#aab3a3', boxWidth: 9, padding: 12, font: { size: 9 } } }, tooltip: { backgroundColor: '#182019', borderColor: 'rgba(201,244,91,.25)', borderWidth: 1, titleColor: chartColors.ink, bodyColor: '#c7d0bd', callbacks: { label: (context: any) => ` ${Number(context.raw ?? 0).toFixed(1)} km` } } } } }; }
  private sport(value: unknown) { const sport = String(value ?? '').toLowerCase(); return sport.includes('ride') || sport.includes('cycl') ? 'Ciclismo' : sport.includes('walk') ? 'Caminar' : 'Correr'; }
  private update(rows: SportDistributionChartPoint[]) { if (!this.chart) return; const data = this.config(rows).data; this.chart.data.labels = data.labels; this.chart.data.datasets = data.datasets as any; this.chart.update('none'); }
  ngOnDestroy() { this.redraw.destroy(); this.chart?.destroy(); }
}
