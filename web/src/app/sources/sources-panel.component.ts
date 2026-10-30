import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SOURCE_LABELS } from '../core/labels';
import { SourceKey } from '../core/models';
import { SOURCE_KEYS, SourcesService } from './sources.service';

const STATUS_TEXT = {
  idle: 'Sin cargar',
  loading: 'Cargando…',
  loaded: 'Cargada',
  error: 'Error'
} as const;

@Component({
  selector: 'app-sources-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <section class="panel" aria-labelledby="sources-title">
      <div class="panel-head">
        <div>
          <h2 id="sources-title">Fuentes de conciliación</h2>
          <div class="panel-caption">Wallet, settlements, ledger e incidencias se consultan desde el mismo grupo.</div>
        </div>
      </div>
      <div class="api-form">
        <label class="field compact">Wallet ID
          <input
            id="wallet-id"
            type="text"
            aria-label="Wallet ID"
            [value]="sources.walletId()"
            (input)="onWalletInput($event)"
            (keydown.enter)="sources.load()"
          />
        </label>
        <button class="btn" id="load-sources" type="button" [disabled]="sources.loading()" (click)="sources.load()">
          Cargar fuentes
        </button>
        <button class="btn" id="refresh-sources" type="button" [disabled]="sources.loading()" (click)="sources.load()">
          Actualizar fuentes
        </button>
      </div>
      <ul class="source-list" aria-label="Estado de las fuentes">
        @for (key of keys; track key) {
          <li class="source-row" [attr.data-source]="key">
            <span class="source-row-name">{{ labels[key] }}</span>
            <span class="source-pill" [class]="'source-pill ' + sources.sourceStates()[key].status">
              {{ statusText[sources.sourceStates()[key].status] }}
            </span>
            @if (sources.sourceStates()[key].loadedAt; as loadedAt) {
              <span class="source-meta">Última carga exitosa {{ loadedAt | date: 'short' }}</span>
            }
            @if (sources.sourceStates()[key].error; as error) {
              <span class="source-error" role="alert">{{ error }}</span>
            }
          </li>
        }
      </ul>
      @if (sources.loaded()) {
        <div class="source-status success" role="status">
          Fuentes cargadas para la wallet <b>{{ sources.activeWalletId() }}</b> · {{ sources.payments().length }} pagos (wallet) ·
          {{ sources.settlements().length }} settlements, {{ sources.ledger().length }} asientos y
          {{ sources.incidents().length }} incidencias (grupo completo).
        </div>
      } @else if (!sources.loading()) {
        <div class="source-status" [class.error]="hasError()" role="status">
          Fuentes que faltan: {{ missingLabels() }}.
        </div>
      }
    </section>
  `
})
export class SourcesPanelComponent {
  protected readonly sources = inject(SourcesService);
  protected readonly keys = SOURCE_KEYS;
  protected readonly labels = SOURCE_LABELS;
  protected readonly statusText = STATUS_TEXT;

  protected onWalletInput(event: Event): void {
    this.sources.walletId.set((event.target as HTMLInputElement).value);
  }

  protected hasError(): boolean {
    return SOURCE_KEYS.some(key => this.sources.sourceStates()[key].status === 'error');
  }

  protected missingLabels(): string {
    return this.sources
      .missingSources()
      .map((key: SourceKey) => SOURCE_LABELS[key])
      .join(', ');
  }
}
