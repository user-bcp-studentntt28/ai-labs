import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EVENT_LABELS, PRIORITY_LABELS } from './briefing';
import { SupervisorBriefingService } from './briefing.service';

@Component({
  selector: 'app-supervisor-briefing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (status(); as current) {
      @if (current.kind === 'loading') {
        <div class="briefing loading" data-testid="briefing-loading" role="status">
          El agente supervisor está leyendo los pagos y preparando el resumen…
        </div>
      } @else {
        <div class="source-status error briefing-error" data-testid="briefing-error" role="alert">{{ current.message }}</div>
      }
    }

    @if (briefing(); as item) {
      <section class="briefing" [class]="'briefing ' + item.priority.toLowerCase()" data-testid="briefing">
        <div class="briefing-head">
          <span class="briefing-priority" data-testid="briefing-priority">{{ priorityLabels[item.priority] }}</span>
          <b data-testid="briefing-headline">{{ item.headline }}</b>
        </div>
        <p data-testid="briefing-problem">{{ item.problem }}</p>
        @if (item.evidence.length > 0) {
          <ul data-testid="briefing-evidence">
            @for (line of item.evidence; track $index) {
              <li>{{ line }}</li>
            }
          </ul>
        }
        <p class="briefing-recommendation" data-testid="briefing-recommendation"><b>Para decidir:</b> {{ item.recommendation }}</p>
        <div class="briefing-meta" data-testid="briefing-meta">
          Mensaje del agente supervisor · {{ eventLabels[item.event] }} · {{ item.generatedAt | date: 'short' }} ·
          {{ item.source === 'llm' ? 'Generado con IA (' + item.model + ')' : 'Resumen automático sin IA' }}
        </div>
      </section>
    }
  `
})
export class SupervisorBriefingComponent {
  @Input({ required: true }) incidentId!: string;

  private readonly service = inject(SupervisorBriefingService);
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly eventLabels = EVENT_LABELS;

  protected briefing() {
    return this.service.briefingFor(this.incidentId);
  }

  protected status() {
    return this.service.statusFor(this.incidentId);
  }
}
