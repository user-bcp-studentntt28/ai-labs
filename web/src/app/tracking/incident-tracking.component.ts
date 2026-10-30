import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { API_STATUS_LABELS, ROLE_LABELS, reasonLabel } from '../core/labels';
import { Incident } from '../core/models';
import { SupervisorBriefingService } from '../supervisor-agent/briefing.service';
import { SupervisorBriefingComponent } from '../supervisor-agent/supervisor-briefing.component';
import { TrackingService } from './tracking.service';
import { WORKFLOW_ACTIONS, WorkflowAction, WorkflowState, availableActions } from './workflow';

const STATE_TONES: Partial<Record<WorkflowState, string>> = {
  'En revisión': 'pending',
  'Cerrada localmente': 'closed',
  Devuelta: 'returned'
};

@Component({
  selector: 'app-incident-tracking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SupervisorBriefingComponent],
  template: `
    <div class="incident-work" [attr.data-incident]="incident.id">
      <h3>{{ reasonLabel(incident.reason) }} · {{ incident.id }}</h3>
      <div class="incident-owner">
        Estado de atención (local):
        <span class="local-state" [class]="'local-state ' + tone()" data-testid="local-state">{{ record().state }}</span>
        · Estado en el API: <b data-testid="api-state">{{ apiLabels[incident.status] }}</b>
      </div>
      <div class="incident-owner">El seguimiento local no modifica el estado del API ni se comparte entre usuarios.</div>

      @if (record().state === 'Cerrada localmente' && incident.status === 'OPEN') {
        <div class="scenario-warning" data-testid="closed-warning">
          Cierre local: el API todavía informa «{{ apiLabels[incident.status] }}». El estado del API no cambió.
        </div>
      }

      @if (!tracking.storageAvailable()) {
        <div class="scenario-warning" data-testid="storage-unavailable" role="alert">
          El almacenamiento local no está disponible. Las transiciones no se pueden guardar.
        </div>
      }

      @if (actions().length > 0) {
        <div class="human-form">
          <label>
            Nota {{ noteRequired() ? '(obligatoria)' : '(opcional)' }}
            <textarea
              [value]="note()"
              (input)="onNote($event)"
              placeholder="Describe qué revisaste y qué decidiste."
              data-testid="note"
            ></textarea>
          </label>
          <div class="drawer-actions">
            @for (action of actions(); track $index) {
              <button
                type="button"
                class="btn"
                [class.btn-primary]="action !== 'return'"
                [class.btn-danger]="action === 'return'"
                [attr.data-action]="action"
                [disabled]="!tracking.storageAvailable()"
                (click)="perform(action)"
              >
                {{ workflowActions[action].label }}
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="incident-owner" data-testid="no-actions">
          {{ tracking.role() === 'ANALYST' ? 'No hay acciones del analista para este estado.' : 'No hay acciones del supervisor para este estado.' }}
        </div>
      }

      @if (error()) {
        <div class="source-status error" role="alert" data-testid="transition-error">{{ error() }}</div>
      }

      <app-supervisor-briefing [incidentId]="incident.id" />

      @if (record().history.length > 0) {
        <ol class="audit-list" data-testid="history">
          @for (entry of record().history; track entry.at + entry.action) {
            <li>
              <b>{{ roleLabels[entry.role] }}</b> · {{ entry.action }} · {{ entry.at | date: 'short' }}
              @if (entry.note) {
                <div class="local-note">{{ entry.note }}</div>
              }
            </li>
          }
        </ol>
      }
    </div>
  `
})
export class IncidentTrackingComponent {
  @Input({ required: true }) incident!: Incident;

  protected readonly tracking = inject(TrackingService);
  private readonly briefings = inject(SupervisorBriefingService);
  protected readonly note = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly reasonLabel = reasonLabel;
  protected readonly apiLabels = API_STATUS_LABELS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly workflowActions = WORKFLOW_ACTIONS;

  protected record() {
    return this.tracking.recordFor(this.incident.id);
  }

  protected tone(): string {
    return STATE_TONES[this.record().state] ?? '';
  }

  protected actions(): WorkflowAction[] {
    return availableActions(this.record().state, this.tracking.role());
  }

  protected noteRequired(): boolean {
    return this.actions().some(action => WORKFLOW_ACTIONS[action].noteRequired);
  }

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected perform(action: WorkflowAction): void {
    const note = this.note();
    const result = this.tracking.perform(this.incident.id, action, note);
    if ('error' in result) {
      this.error.set(result.error);
      return;
    }
    this.error.set(null);
    this.note.set('');
    void this.briefings.requestFor(this.incident, action, this.record().state, note);
  }
}
