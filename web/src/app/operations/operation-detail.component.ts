import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { API_STATUS_LABELS, paymentStatusLabel, reasonLabel } from '../core/labels';
import { formatCents } from '../core/money';
import { ExecutionService } from '../execution/execution.service';
import { SourcesService } from '../sources/sources.service';
import { IncidentTrackingComponent } from '../tracking/incident-tracking.component';
import { MISSING_SOURCE_LABELS, OperationRow, PRESENTATION_LABELS } from './operations.view-model';

@Component({
  selector: 'app-operation-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IncidentTrackingComponent],
  template: `
    <aside class="drawer open" aria-label="Detalle de operación" data-testid="detail">
      <div class="drawer-head">
        <div class="drawer-topline">
          <div class="drawer-title">Detalle de operación</div>
          <button class="close-btn" type="button" aria-label="Cerrar" data-testid="close" (click)="closed.emit()">×</button>
        </div>
        <div class="drawer-ref">{{ row.id }}</div>
      </div>
      <div class="drawer-body">
        <div class="incident-owner">
          Estado de presentación: <b data-testid="presentation">{{ presentationLabels[row.presentation] }}</b>
          @if (row.missingSources.length > 0) {
            · Falta en: {{ missingLabels() }}
          }
        </div>

        @for (incident of row.incidents; track incident.id) {
          <app-incident-tracking [incident]="incident" />
        }

        <div class="section-label">Resultado de conciliación</div>
        <div class="compare">
          <div class="source-card" data-testid="wallet-card">
            <div class="source-name">Wallet · GET /payments</div>
            <div class="source-value">
              {{ row.payment ? money(row.payment.amount) + ' · ' + paymentStatus(row.payment.status) : 'Sin pago' }}
            </div>
            <div class="source-meta">
              {{ row.payment ? 'Destinatario ' + row.payment.recipient + ' · ' + row.payment.wallet_id : 'El ID no aparece en los pagos de la wallet consultada.' }}
            </div>
          </div>
          <div class="source-card" data-testid="provider-card">
            <div class="source-name">Proveedor · GET /settlements</div>
            <div class="source-value">
              {{ row.settlements.length ? money(row.settlements[0].amount) + ' · ' + paymentStatus(row.settlements[0].status) : 'Sin registro' }}
            </div>
            <div class="source-meta">
              {{ row.settlements.length > 1 ? row.settlements.length + ' filas con este ID.' : 'Respuesta del API del grupo.' }}
            </div>
          </div>
        </div>

        <div class="section-label">Incidencias · GET /reconciliations/incidents</div>
        @for (incident of row.incidents; track incident.id) {
          <div class="source-card" data-testid="incident-card">
            <div class="source-name">{{ incident.id }} · {{ statusLabels[incident.status] }} ({{ incident.status }})</div>
            <div class="source-value">{{ reasonLabel(incident.reason) }}</div>
            <div class="source-meta">{{ incident.reason }}</div>
          </div>
        } @empty {
          <div class="source-card"><div class="source-value">El API no reporta incidencias para esta operación.</div></div>
        }

        <div class="section-label">Ledger · GET /ledger ({{ row.ledger.length }} asientos)</div>
        @for (entry of row.ledger; track entry.id) {
          <div class="ledger-row" data-testid="ledger-row">
            <span>#{{ entry.id }} · {{ entry.kind }} · {{ entry.account }}</span>
            <b>{{ money(entry.amount) }}</b>
          </div>
        } @empty {
          <div class="source-meta">No hay asientos asociados a este recurso en la respuesta consultada.</div>
        }

        <div class="section-label">Actualizar y conciliar</div>
        <div class="drawer-actions">
          <button class="btn" type="button" data-testid="reload" [disabled]="sources.loading()" (click)="sources.load()">
            Recargar fuentes
          </button>
          <button class="btn btn-primary" type="button" data-testid="reconcile" [disabled]="!execution.canRun()" (click)="execution.run()">
            Nueva conciliación
          </button>
        </div>
      </div>
    </aside>
  `
})
export class OperationDetailComponent {
  @Input({ required: true }) row!: OperationRow;
  @Output() readonly closed = new EventEmitter<void>();

  protected readonly sources = inject(SourcesService);
  protected readonly execution = inject(ExecutionService);

  protected readonly presentationLabels = PRESENTATION_LABELS;
  protected readonly statusLabels = API_STATUS_LABELS;
  protected readonly reasonLabel = reasonLabel;
  protected readonly paymentStatus = paymentStatusLabel;
  protected readonly money = formatCents;

  protected missingLabels(): string {
    return this.row.missingSources.map(source => MISSING_SOURCE_LABELS[source]).join(', ');
  }
}
