import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from '../core/api-errors';
import { API_BASE_URL, API_PATHS, DEFAULT_WALLET_ID } from '../core/config';
import { Incident, LedgerEntry, Payment, ProviderPayment, SourceKey } from '../core/models';

export type SourceStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface SourceState {
  status: SourceStatus;
  loadedAt: Date | null;
  error: string | null;
}

export const SOURCE_KEYS: SourceKey[] = ['payments', 'settlements', 'ledger', 'incidents'];

const FORMAT_ERROR = 'La respuesta no tiene el formato de lista definido en el contrato.';

type SourceStates = Record<SourceKey, SourceState>;

function initialStates(): SourceStates {
  const empty = (): SourceState => ({ status: 'idle', loadedAt: null, error: null });
  return { payments: empty(), settlements: empty(), ledger: empty(), incidents: empty() };
}

type SourceOutcome = { key: SourceKey; data: unknown[] } | { key: SourceKey; error: string };

@Injectable({ providedIn: 'root' })
export class SourcesService {
  private readonly http = inject(HttpClient);

  readonly walletId = signal(DEFAULT_WALLET_ID);
  readonly activeWalletId = signal(DEFAULT_WALLET_ID);
  readonly sourceStates = signal<SourceStates>(initialStates());
  readonly loading = signal(false);

  private readonly paymentsData = signal<Payment[]>([]);
  private readonly settlementsData = signal<ProviderPayment[]>([]);
  private readonly ledgerData = signal<LedgerEntry[]>([]);
  private readonly incidentsData = signal<Incident[]>([]);

  readonly payments = this.paymentsData.asReadonly();
  readonly settlements = this.settlementsData.asReadonly();
  readonly ledger = this.ledgerData.asReadonly();
  readonly incidents = this.incidentsData.asReadonly();

  readonly missingSources = computed(() =>
    SOURCE_KEYS.filter(key => this.sourceStates()[key].status !== 'loaded')
  );
  readonly loaded = computed(() => this.missingSources().length === 0);
  readonly canRunReconciliation = computed(() => this.loaded() && !this.loading());

  async load(): Promise<boolean> {
    if (this.loading()) return false;
    const wallet = this.walletId().trim() || DEFAULT_WALLET_ID;
    this.activeWalletId.set(wallet);
    this.loading.set(true);
    this.sourceStates.update(states => this.mapStates(states, () => ({ status: 'loading' })));

    try {
      const outcomes = await Promise.all(SOURCE_KEYS.map(key => this.fetchSource(key, wallet)));
      this.applyOutcomes(outcomes);
      return this.loaded();
    } finally {
      this.loading.set(false);
    }
  }

  private mapStates(states: SourceStates, patch: (key: SourceKey) => Partial<SourceState>): SourceStates {
    const next = { ...states };
    for (const key of SOURCE_KEYS) next[key] = { ...states[key], ...patch(key) };
    return next;
  }

  private async fetchSource(key: SourceKey, wallet: string): Promise<SourceOutcome> {
    try {
      const params = key === 'payments' ? { walletId: wallet } : undefined;
      const data = await firstValueFrom(this.http.get<unknown>(`${API_BASE_URL}${API_PATHS[key]}`, { params }));
      if (!Array.isArray(data)) return { key, error: FORMAT_ERROR };
      return { key, data };
    } catch (error) {
      return { key, error: describeHttpError(error) };
    }
  }

  // Los datos se confirman de forma atómica: si falla una fuente no queda una carga parcial visible.
  private applyOutcomes(outcomes: SourceOutcome[]): void {
    const now = new Date();
    const byKey = new Map(outcomes.map(outcome => [outcome.key, outcome]));
    this.sourceStates.update(states =>
      this.mapStates(states, key => {
        const outcome = byKey.get(key)!;
        return 'error' in outcome
          ? { status: 'error', error: outcome.error }
          : { status: 'loaded', error: null, loadedAt: now };
      })
    );

    const allLoaded = outcomes.every(outcome => !('error' in outcome));
    const dataOf = <T>(key: SourceKey): T[] => {
      const outcome = byKey.get(key)!;
      return allLoaded && 'data' in outcome ? (outcome.data as T[]) : [];
    };
    this.paymentsData.set(dataOf<Payment>('payments'));
    this.settlementsData.set(dataOf<ProviderPayment>('settlements'));
    this.ledgerData.set(dataOf<LedgerEntry>('ledger'));
    this.incidentsData.set(dataOf<Incident>('incidents'));
  }
}
