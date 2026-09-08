import { ChangeDetectionStrategy, Component, HostListener, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-metric-info',
  imports: [MatIconModule],
  template: `
    <button class="metric-info-trigger" type="button" (click)="open.set(true)" [attr.aria-label]="'Cómo se calcula ' + title()">
      <mat-icon aria-hidden="true">info</mat-icon>
    </button>
    @if (open()) {
      <div class="metric-info-backdrop" role="presentation" (click)="open.set(false)">
        <article class="metric-info-dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
          <button class="metric-info-close" type="button" (click)="open.set(false)" aria-label="Cerrar explicación"><mat-icon>close</mat-icon></button>
          <div class="metric-info-icon"><mat-icon>insights</mat-icon></div>
          <p class="metric-info-kicker">CÓMO LEER ESTE DATO</p>
          <h2>{{ title() }}</h2>
          <div class="metric-info-section"><span>Cálculo</span><p>{{ calculation() }}</p></div>
          <div class="metric-info-section"><span>Por qué importa</span><p>{{ importance() }}</p></div>
          <button class="primary-button metric-info-action" type="button" (click)="open.set(false)">Entendido</button>
        </article>
      </div>
    }
  `,
  styles: [`
    :host{display:inline-flex;vertical-align:middle}.metric-info-trigger{display:grid;place-items:center;width:22px;height:22px;padding:0;border:0;border-radius:50%;color:var(--muted);background:transparent;cursor:pointer;transition:color .16s ease,background .16s ease}.metric-info-trigger:hover,.metric-info-trigger:focus-visible{color:var(--lime);background:rgba(201,244,91,.1);outline:0}.metric-info-trigger mat-icon{font-size:16px;width:16px;height:16px}.metric-info-backdrop{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:20px;background:rgba(7,10,7,.78);backdrop-filter:blur(9px);animation:metric-info-fade .16s ease both}.metric-info-dialog{position:relative;width:min(100%,440px);max-height:calc(100dvh - 40px);overflow:auto;padding:30px 26px 24px;background:var(--panel);border:1px solid rgba(201,244,91,.25);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.48);animation:metric-info-slide .18s ease both}.metric-info-close{position:absolute;top:13px;right:13px;display:grid;place-items:center;width:31px;height:31px;padding:0;border:0;border-radius:50%;color:var(--muted);background:transparent;cursor:pointer}.metric-info-close:hover,.metric-info-close:focus-visible{color:var(--ink);background:var(--panel-2);outline:0}.metric-info-close mat-icon{font-size:18px;width:18px;height:18px}.metric-info-icon{display:grid;place-items:center;width:42px;height:42px;margin-bottom:15px;border-radius:13px;color:#18210e;background:var(--lime)}.metric-info-icon mat-icon{font-size:22px;width:22px;height:22px}.metric-info-kicker{margin:0 0 5px;color:var(--lime);font-size:9px;font-weight:900;letter-spacing:.13em}.metric-info-dialog h2{margin:0 38px 20px;font-size:24px;letter-spacing:-.05em}.metric-info-section{padding:13px 0;border-top:1px solid var(--line)}.metric-info-section span{color:var(--ink);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.metric-info-section p{margin:6px 0 0;color:var(--muted);font-size:11px;line-height:1.55}.metric-info-action{width:100%;margin-top:16px}@keyframes metric-info-fade{from{opacity:0}to{opacity:1}}@keyframes metric-info-slide{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:520px){.metric-info-backdrop{padding:12px}.metric-info-dialog{padding:27px 18px 19px;border-radius:17px}.metric-info-dialog h2{font-size:22px}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricInfoComponent {
  readonly title = input.required<string>();
  readonly calculation = input.required<string>();
  readonly importance = input.required<string>();
  readonly open = signal(false);

  @HostListener('document:keydown.escape')
  closeOnEscape() { this.open.set(false); }
}
