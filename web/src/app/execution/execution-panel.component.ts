import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SourcesService } from '../sources/sources.service';
import { ExecutionService } from './execution.service';

@Component({
  selector: 'app-execution-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="execution-title">
      <div class="panel-head">
        <div>
          <h2 id="execution-title">Ejecución de la conciliación</h2>
          <div class="panel-caption">POST /reconciliations compara pagos, reporte, asientos y saldos. No corrige datos.</div>
        </div>
        <button
          class="btn btn-primary"
          id="run-reconciliation"
          type="button"
          [disabled]="!execution.canRun()"
          (click)="execution.run()"
        >
          {{ execution.running() ? 'Ejecutando…' : 'Ejecutar conciliación' }}
        </button>
      </div>

      @if (!sources.canRunReconciliation() && !execution.running()) {
        <div class="source-status" id="run-blocked" role="status">
          Carga las cuatro fuentes para habilitar la conciliación.
        </div>
      }
      @if (execution.executionError(); as error) {
        <div class="source-status error" id="execution-error" role="alert">{{ error }}</div>
      }
      @if (execution.result(); as result) {
        <div class="source-status" [class.success]="result.status === 'MATCHED'" id="execution-result" role="status">
          La conciliación se ejecutó · {{ result.status }} · {{ execution.differenceCount() }} diferencias en la respuesta.
        </div>
      }
      @if (execution.refreshFailed()) {
        <div class="source-status error" id="refresh-error" role="alert">
          La actualización posterior de fuentes falló. Usa «Actualizar fuentes» para volver a cargarlas.
        </div>
      }

      <div class="metrics" aria-label="Resultado de conciliación">
        <article class="metric">
          <div class="metric-label">Pagos wallet</div>
          <div class="metric-value" id="metric-payments">{{ loadedOrDash(sources.payments().length) }}</div>
          <div class="metric-foot">Respuesta de GET /payments</div>
        </article>
        <article class="metric">
          <div class="metric-label">Resultado de conciliación</div>
          <div class="metric-value" id="metric-result">{{ execution.result()?.status ?? '—' }}</div>
          <div class="metric-foot">{{ resultFoot() }}</div>
        </article>
        <article class="metric">
          <div class="metric-label">Incidencias abiertas</div>
          <div class="metric-value" id="metric-open">{{ loadedOrDash(openIncidents()) }}</div>
          <div class="metric-foot">Grupo completo · estado OPEN del API</div>
        </article>
        <article class="metric">
          <div class="metric-label">Asientos de ledger</div>
          <div class="metric-value" id="metric-ledger">{{ loadedOrDash(sources.ledger().length) }}</div>
          <div class="metric-foot">Grupo completo · GET /ledger</div>
        </article>
      </div>
    </section>
  `
})
export class ExecutionPanelComponent {
  protected readonly sources = inject(SourcesService);
  protected readonly execution = inject(ExecutionService);

  protected readonly openIncidents = computed(
    () => this.sources.incidents().filter(incident => incident.status === 'OPEN').length
  );

  protected loadedOrDash(value: number): string {
    return this.sources.loaded() ? String(value) : '—';
  }

  protected resultFoot(): string {
    return this.execution.hasRun()
      ? `${this.execution.differenceCount()} diferencias en POST /reconciliations`
      : 'Ejecuta POST /reconciliations';
  }
}
