import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from '../core/api-errors';
import { API_BASE_URL, API_PATHS } from '../core/config';
import { ReconciliationResult } from '../core/models';
import { SourcesService } from '../sources/sources.service';

export type ExecutionStatus = 'idle' | 'running' | 'succeeded' | 'failed';
type RefreshOutcome = 'ok' | 'failed' | null;

const RESPONSE_SHAPE_ERROR = 'La respuesta no coincide con el esquema Reconciliation del contrato.';
const VALID_STATUSES = ['MATCHED', 'DIFFERENCES'];

function isReconciliationResult(value: unknown): value is ReconciliationResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReconciliationResult>;
  return VALID_STATUSES.includes(candidate.status as string) && Array.isArray(candidate.differences);
}

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private readonly http = inject(HttpClient);
  private readonly sources = inject(SourcesService);

  readonly status = signal<ExecutionStatus>('idle');
  readonly result = signal<ReconciliationResult | null>(null);
  readonly executionError = signal<string | null>(null);
  private readonly refreshOutcome = signal<RefreshOutcome>(null);

  readonly hasRun = computed(() => this.result() !== null);
  readonly differenceCount = computed(() => this.result()?.differences.length ?? 0);
  readonly running = computed(() => this.status() === 'running');
  readonly refreshFailed = computed(() => this.refreshOutcome() === 'failed' && !this.sources.loaded());
  readonly canRun = computed(() => this.sources.canRunReconciliation() && !this.running());

  async run(): Promise<void> {
    if (!this.canRun()) return;
    this.status.set('running');
    this.executionError.set(null);
    this.refreshOutcome.set(null);

    const result = await this.postReconciliation();
    if (!result) return;

    this.result.set(result);
    this.status.set('succeeded');
    const refreshed = await this.sources.load();
    this.refreshOutcome.set(refreshed ? 'ok' : 'failed');
  }

  private async postReconciliation(): Promise<ReconciliationResult | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(`${API_BASE_URL}${API_PATHS.reconciliations}`, null)
      );
      if (isReconciliationResult(response)) return response;
      this.fail(RESPONSE_SHAPE_ERROR);
    } catch (error) {
      this.fail(describeHttpError(error));
    }
    return null;
  }

  private fail(detail: string): void {
    this.status.set('failed');
    this.executionError.set(`La conciliación no se ejecutó: ${detail}`);
  }
}
