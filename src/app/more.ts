import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

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
        <a class="more-card" routerLink="/app/import"><span class="more-icon"><mat-icon>upload_file</mat-icon></span><div><h2>Importar actividad</h2><p>Sincroniza con Strava o añade un archivo FIT, GPX o TCX.</p></div><mat-icon class="arrow">arrow_forward</mat-icon></a>
      </div>
      <article class="more-note"><mat-icon>lightbulb</mat-icon><div><strong>Tu siguiente decisión empieza aquí</strong><p>Usa Progreso para saber cómo estás, Estadísticas para ver la tendencia y Comparar para aprender de una salida concreta.</p></div></article>
    </section>
  `,
  styles: [`
    .more-page{max-width:900px}.more-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.more-card{display:flex;align-items:center;gap:14px;min-height:132px;padding:18px;color:var(--ink);text-decoration:none;background:var(--panel);border:1px solid var(--line);border-radius:15px;transition:transform .18s ease,border-color .18s ease}.more-card:hover,.more-card:focus-visible{transform:translateY(-2px);border-color:rgba(201,244,91,.5);outline:0}.more-card.lime{background:linear-gradient(135deg,rgba(201,244,91,.14),var(--panel))}.more-card.blue{background:linear-gradient(135deg,rgba(118,168,255,.13),var(--panel))}.more-card.orange{background:linear-gradient(135deg,rgba(240,164,93,.13),var(--panel))}.more-icon{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:12px;background:var(--panel-2);color:var(--lime)}.blue .more-icon{color:#76a8ff}.orange .more-icon{color:var(--orange)}.more-card h2{font-size:15px;letter-spacing:-.03em}.more-card p{color:var(--muted);font-size:10px;line-height:1.4;margin-top:6px}.more-card div{flex:1}.more-card .arrow{color:var(--muted);font-size:19px;width:19px;height:19px}.more-note{display:flex;gap:10px;align-items:flex-start;margin-top:18px;padding:16px;background:rgba(201,244,91,.06);border:1px solid rgba(201,244,91,.14);border-radius:13px}.more-note>mat-icon{color:var(--lime);font-size:20px;width:20px;height:20px}.more-note strong{font-size:11px}.more-note p{color:var(--muted);font-size:10px;line-height:1.5;margin-top:5px}@media(max-width:620px){.more-grid{grid-template-columns:1fr}.more-card{min-height:112px}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MorePage {}
