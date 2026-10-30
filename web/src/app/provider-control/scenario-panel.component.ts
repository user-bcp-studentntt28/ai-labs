import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ControlMode } from '../core/models';
import { formatCents } from '../core/money';
import { SourcesService } from '../sources/sources.service';
import { ProviderControlService } from './provider-control.service';
import { CONTROL_MODES, modeRequiresAmount, validateControlInput } from './validation';

@Component({
  selector: 'app-scenario-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="scenario-title">
      <div class="panel-head">
        <div>
          <h2 id="scenario-title">Escenarios del proveedor para verificar diferencias</h2>
          <div class="panel-caption">Usa estos controles solo para preparar escenarios en el mock del grupo.</div>
        </div>
      </div>
      <p class="scenario-warning">
        <b>Control de prueba del proveedor:</b> altera únicamente el reporte de settlements; no cambia wallet ni ledger.
        Después de aplicar un escenario, vuelve a ejecutar la conciliación. Usa CLEAR para restaurar el settlement de un pago.
      </p>
      <div class="scenario-body">
        <label class="field">Pago existente
          <select id="scenario-payment" [disabled]="mode() === 'ORPHAN' || !sources.loaded()" (change)="onPayment($event)">
            <option value="">{{ sources.loaded() ? 'Selecciona un pago del API' : 'Carga las fuentes para listar pagos' }}</option>
            @for (payment of sources.payments(); track payment.id) {
              <option [value]="payment.id" [selected]="payment.id === paymentId()">
                {{ payment.id }} · {{ money(payment.amount) }}
              </option>
            }
          </select>
        </label>
        <label class="field compact">Modo
          <select id="scenario-mode" (change)="onMode($event)">
            @for (option of modes; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>
        @if (needsAmount()) {
          <label class="field compact">Monto (céntimos PEN, 1 a 49999)
            <input id="scenario-amount" type="number" min="1" max="49999" step="1" [value]="amount()" (input)="onAmount($event)" placeholder="Importe en céntimos" />
          </label>
        }
        @if (mode() === 'ORPHAN') {
          <label class="field">Nuevo ID sin pago en wallet
            <input id="orphan-id" type="text" [value]="orphanId()" (input)="onOrphanId($event)" placeholder="Ingresa un ID nuevo" />
          </label>
        }
        <button class="btn" id="apply-scenario" type="button" [disabled]="control.busy()" (click)="apply()">
          Aplicar control
        </button>
      </div>
      @if (validationError()) {
        <div class="source-status error" id="scenario-validation" role="alert">{{ validationError() }}</div>
      }
      @if (control.outcome(); as outcome) {
        <div
          class="source-status"
          [class.success]="outcome.kind === 'success'"
          [class.error]="outcome.kind === 'error'"
          id="scenario-outcome"
          [attr.role]="outcome.kind === 'error' ? 'alert' : 'status'"
        >
          {{ outcome.message }}
        </div>
      }
    </section>
  `
})
export class ScenarioPanelComponent {
  protected readonly sources = inject(SourcesService);
  protected readonly control = inject(ProviderControlService);

  protected readonly modes = CONTROL_MODES;
  protected readonly money = formatCents;

  protected readonly mode = signal<ControlMode>('AMOUNT');
  protected readonly paymentId = signal('');
  protected readonly orphanId = signal('');
  protected readonly amount = signal('');
  protected readonly validationError = signal<string | null>(null);
  protected readonly needsAmount = computed(() => modeRequiresAmount(this.mode()));

  protected onPayment(event: Event): void {
    this.paymentId.set((event.target as HTMLSelectElement).value);
  }

  protected onMode(event: Event): void {
    this.mode.set((event.target as HTMLSelectElement).value as ControlMode);
    this.validationError.set(null);
  }

  protected onAmount(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
  }

  protected onOrphanId(event: Event): void {
    this.orphanId.set((event.target as HTMLInputElement).value);
  }

  protected async apply(): Promise<void> {
    const validation = validateControlInput({
      mode: this.mode(),
      paymentId: this.paymentId(),
      orphanId: this.orphanId(),
      amountCents: this.amount()
    });
    if ('error' in validation) {
      this.validationError.set(validation.error);
      return;
    }
    this.validationError.set(null);
    await this.control.apply(validation.body);
  }
}
