import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { API_STATUS_LABELS, reasonLabel } from '../core/labels';
import { IncidentReason } from '../core/models';
import { formatCents } from '../core/money';
import { ExecutionService } from '../execution/execution.service';
import { SourcesService } from '../sources/sources.service';
import { TrackingService } from '../tracking/tracking.service';
import { OperationDetailComponent } from './operation-detail.component';
import {
  FILTERABLE_REASONS,
  MISSING_SOURCE_LABELS,
  OperationFilters,
  OperationRow,
  PRESENTATION_LABELS,
  buildOperationRows,
  filterRows,
  scopeToWallet
} from './operations.view-model';
import { WalletBalanceComponent } from './wallet-balance.component';

@Component({
  selector: 'app-operations-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OperationDetailComponent, WalletBalanceComponent],
  template: `
    <section class="panel" aria-labelledby="operations-title">
      <div class="panel-head">
        <div>
          <h2 id="operations-title">Operaciones conciliadas</h2>
          <div class="panel-caption">Selecciona una fila para ver el detalle y registrar el seguimiento local.</div>
        </div>
      </div>

      <app-wallet-balance [allIncidents]="scoped().sources.incidents" />

      <div class="scope-note" data-testid="scope-note">
        Mostrando las operaciones de la wallet <b>{{ sources.activeWalletId() }}</b>: solo sus pagos dependen de la wallet;
        settlements, ledger e incidencias del API son del grupo completo.
        @if (sources.loaded() && scoped().outsideCount > 0) {
          <label class="scope-toggle">
            <input type="checkbox" id="include-group" [checked]="includeGroup()" (change)="onIncludeGroup($event)" />
            Incluir {{ scoped().outsideCount }} referencia(s) del grupo sin pago en esta wallet
          </label>
        }
      </div>

      <div class="filters">
        <label class="search">
          <input
            id="search-input"
            type="search"
            placeholder="Buscar referencia, motivo o ID de incidencia..."
            aria-label="Buscar operaciones"
            [value]="filters().query"
            (input)="onQuery($event)"
          />
        </label>
        <select id="status-filter" aria-label="Filtrar por estado" (change)="onStatus($event)">
          <option value="">Todos los estados</option>
          <option value="OPEN">Incidencia abierta</option>
          <option value="RESOLVED">Incidencia resuelta</option>
        </select>
        <select id="reason-filter" aria-label="Filtrar por motivo" (change)="onReason($event)">
          <option value="">Todos los motivos</option>
          @for (reason of reasons; track reason) {
            <option [value]="reason">{{ reasonLabel(reason) }}</option>
          }
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pago / recurso</th>
              <th>Wallet</th>
              <th>Proveedor</th>
              <th>Monto PEN</th>
              <th>Incidencia</th>
              <th>Atención local</th>
              <th>Estado API</th>
              <th>Presentación</th>
              <th>Ledger</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visibleRows(); track row.id) {
              <tr [attr.data-row]="row.id" (click)="select(row.id)" tabindex="0" (keydown.enter)="select(row.id)">
                <td><span class="ref">{{ row.id }}</span></td>
                <td>{{ row.payment ? row.payment.wallet_id : 'Falta' }}</td>
                <td>{{ row.settlements.length ? money(row.settlements[0].amount) : 'Falta' }}</td>
                <td class="amount">{{ money(row.amount) }}</td>
                <td>{{ reasonsOf(row) }}</td>
                <td>{{ localStates(row) }}</td>
                <td>
                  @for (incident of row.incidents; track incident.id) {
                    <span class="status" [class]="'status ' + incident.status.toLowerCase()" data-testid="api-status">
                      {{ statusLabels[incident.status] }}
                    </span>
                  } @empty {
                    <span class="subtext">—</span>
                  }
                </td>
                <td>
                  <span class="status matched" data-testid="presentation">{{ presentationLabels[row.presentation] }}</span>
                  @if (row.missingSources.length > 0) {
                    <div class="subtext" data-testid="missing">Falta: {{ missingLabels(row) }}</div>
                  }
                </td>
                <td>{{ row.ledger.length }} asientos</td>
              </tr>
            }
          </tbody>
        </table>
        @if (!sources.loaded()) {
          <div class="empty" data-testid="empty">Carga las fuentes del grupo para ver las operaciones.</div>
        } @else if (rows().length === 0) {
          <div class="empty" data-testid="empty">La wallet {{ sources.activeWalletId() }} no tiene pagos que mostrar.</div>
        } @else if (visibleRows().length === 0) {
          <div class="empty" data-testid="empty">No hay operaciones que coincidan con los filtros.</div>
        }
      </div>
      <div class="table-footer">
        <span data-testid="count">{{ visibleRows().length }} de {{ rows().length }} operaciones</span>
        <span>{{ lastUpdated() }}</span>
      </div>
    </section>

    @if (selectedRow(); as row) {
      <div class="backdrop open" (click)="select(null)"></div>
      <app-operation-detail [row]="row" (closed)="select(null)" />
    }
  `
})
export class OperationsListComponent {
  protected readonly sources = inject(SourcesService);
  private readonly execution = inject(ExecutionService);
  private readonly tracking = inject(TrackingService);

  protected readonly reasons: IncidentReason[] = FILTERABLE_REASONS;
  protected readonly statusLabels = API_STATUS_LABELS;
  protected readonly presentationLabels = PRESENTATION_LABELS;
  protected readonly reasonLabel = reasonLabel;
  protected readonly money = formatCents;

  protected readonly filters = signal<OperationFilters>({ query: '', status: '', reason: '' });
  protected readonly includeGroup = signal(false);
  private readonly selectedId = signal<string | null>(null);

  private readonly allSources = computed(() => ({
    payments: this.sources.payments(),
    settlements: this.sources.settlements(),
    ledger: this.sources.ledger(),
    incidents: this.sources.incidents()
  }));
  protected readonly scoped = computed(() => {
    const scope = scopeToWallet(this.allSources(), this.sources.activeWalletId());
    return this.includeGroup() ? { ...scope, sources: this.allSources() } : scope;
  });

  protected readonly rows = computed(() => buildOperationRows(this.scoped().sources, this.execution.hasRun()));
  protected readonly visibleRows = computed(() => filterRows(this.rows(), this.filters()));
  protected readonly selectedRow = computed(() => this.rows().find(row => row.id === this.selectedId()) ?? null);

  protected lastUpdated(): string {
    const date = this.sources.sourceStates().incidents.loadedAt;
    return date ? `Consultado ${date.toLocaleString('es-PE')}` : 'Sin consulta';
  }

  protected select(id: string | null): void {
    this.selectedId.set(id);
  }

  protected onIncludeGroup(event: Event): void {
    this.includeGroup.set((event.target as HTMLInputElement).checked);
  }

  protected onQuery(event: Event): void {
    this.filters.update(current => ({ ...current, query: (event.target as HTMLInputElement).value }));
  }

  protected onStatus(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as OperationFilters['status'];
    this.filters.update(current => ({ ...current, status }));
  }

  protected onReason(event: Event): void {
    const reason = (event.target as HTMLSelectElement).value as OperationFilters['reason'];
    this.filters.update(current => ({ ...current, reason }));
  }

  protected reasonsOf(row: OperationRow): string {
    const reasons = [...new Set(row.incidents.map(incident => reasonLabel(incident.reason)))];
    return reasons.length ? reasons.join(', ') : '—';
  }

  protected localStates(row: OperationRow): string {
    const states = [...new Set(row.incidents.map(incident => this.tracking.recordFor(incident.id).state))];
    return states.length ? states.join(', ') : '—';
  }

  protected missingLabels(row: OperationRow): string {
    return row.missingSources.map(source => MISSING_SOURCE_LABELS[source]).join(', ');
  }
}
