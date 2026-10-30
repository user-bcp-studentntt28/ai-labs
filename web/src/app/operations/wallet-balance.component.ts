import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { API_STATUS_LABELS, reasonLabel } from '../core/labels';
import { Incident } from '../core/models';
import { IncidentTrackingComponent } from '../tracking/incident-tracking.component';
import { buildWalletIncidents } from './operations.view-model';

@Component({
  selector: 'app-wallet-balance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IncidentTrackingComponent],
  template: `
    <section class="wallet-balance" aria-labelledby="wallet-balance-title">
      <h3 id="wallet-balance-title">Saldo de wallet</h3>
      @if (incidents().length === 0) {
        <div class="source-meta" data-testid="no-balance-incidents">
          El API no reporta diferencias de saldo para esta wallet.
        </div>
      } @else {
        @for (incident of incidents(); track incident.id) {
          <article class="source-card balance-card" [attr.data-balance-incident]="incident.id">
            <div class="source-name">{{ incident.id }} · {{ statusLabels[incident.status] }}</div>
            <div class="source-value">{{ reasonLabel(incident.reason) }}</div>
            <div class="source-meta">Referencia del API: {{ incident.payment_id }} (nivel de wallet, no es un pago)</div>
            <app-incident-tracking [incident]="incident" />
          </article>
        }
      }
    </section>
  `
})
export class WalletBalanceComponent {
  @Input() set allIncidents(value: Incident[]) {
    this.walletIncidents = buildWalletIncidents(value ?? []);
  }

  protected walletIncidents: Incident[] = [];
  protected readonly statusLabels = API_STATUS_LABELS;
  protected readonly reasonLabel = reasonLabel;

  protected incidents(): Incident[] {
    return this.walletIncidents;
  }
}
