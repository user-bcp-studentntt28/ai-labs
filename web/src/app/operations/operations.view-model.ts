import { REASON_LABELS, reasonLabel } from '../core/labels';
import { Incident, IncidentReason, LedgerEntry, Payment, ProviderPayment } from '../core/models';

export type MissingSource = 'wallet' | 'proveedor' | 'ledger';
export type Presentation = 'NOT_RUN' | 'MATCHED' | 'WITH_INCIDENTS';

export const PRESENTATION_LABELS: Record<Presentation, string> = {
  NOT_RUN: 'Sin ejecutar',
  MATCHED: 'Conciliada',
  WITH_INCIDENTS: 'Con incidencias'
};

export const MISSING_SOURCE_LABELS: Record<MissingSource, string> = {
  wallet: 'Wallet',
  proveedor: 'Proveedor',
  ledger: 'Ledger'
};

export interface OperationRow {
  id: string;
  payment: Payment | null;
  settlements: ProviderPayment[];
  ledger: LedgerEntry[];
  incidents: Incident[];
  missingSources: MissingSource[];
  amount: number;
  presentation: Presentation;
}

export interface OperationSources {
  payments: Payment[];
  settlements: ProviderPayment[];
  ledger: LedgerEntry[];
  incidents: Incident[];
}

export interface OperationFilters {
  query: string;
  status: '' | 'OPEN' | 'RESOLVED';
  reason: '' | IncidentReason;
}

export const NO_FILTERS: OperationFilters = { query: '', status: '', reason: '' };

export const FILTERABLE_REASONS = (Object.keys(REASON_LABELS) as IncidentReason[]).filter(
  reason => reason !== 'BALANCE_MISMATCH'
);

export function isWalletLevelIncident(incident: Incident): boolean {
  return incident.reason === 'BALANCE_MISMATCH';
}

export function buildWalletIncidents(incidents: Incident[]): Incident[] {
  return incidents.filter(isWalletLevelIncident);
}

export interface WalletScope {
  sources: OperationSources;
  outsideCount: number;
}

// Solo /payments depende de la wallet; settlements, ledger e incidencias son del grupo.
// Se conserva lo que pertenece a la wallet y se cuenta lo demás para poder mostrarlo aparte.
export function scopeToWallet(sources: OperationSources, walletId: string): WalletScope {
  const own = new Set(sources.payments.map(payment => payment.id));
  const ownIncident = (incident: Incident): boolean =>
    isWalletLevelIncident(incident) ? incident.payment_id === walletId : own.has(incident.payment_id);

  const outsideReferences = new Set<string>([
    ...sources.settlements.filter(item => !own.has(item.id)).map(item => item.id),
    ...sources.incidents.filter(incident => !ownIncident(incident)).map(incident => incident.payment_id)
  ]);

  return {
    sources: {
      payments: sources.payments,
      settlements: sources.settlements.filter(item => own.has(item.id)),
      ledger: sources.ledger.filter(entry => own.has(entry.operation)),
      incidents: sources.incidents.filter(ownIncident)
    },
    outsideCount: outsideReferences.size
  };
}

function presentationFor(incidents: Incident[], hasRun: boolean): Presentation {
  if (!hasRun) return 'NOT_RUN';
  return incidents.some(incident => incident.status === 'OPEN') ? 'WITH_INCIDENTS' : 'MATCHED';
}

function missingSourcesFor(payment: Payment | null, settlements: ProviderPayment[], ledger: LedgerEntry[]): MissingSource[] {
  const missing: MissingSource[] = [];
  if (!payment) missing.push('wallet');
  if (settlements.length === 0) missing.push('proveedor');
  if (ledger.length === 0) missing.push('ledger');
  return missing;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function buildOperationRows(sources: OperationSources, hasRun: boolean): OperationRow[] {
  const operationIncidents = sources.incidents.filter(incident => !isWalletLevelIncident(incident));
  const paymentsById = new Map(sources.payments.map(payment => [payment.id, payment]));
  const settlementsById = groupBy(sources.settlements, item => item.id);
  const ledgerByOperation = groupBy(sources.ledger, entry => entry.operation);
  const incidentsById = groupBy(operationIncidents, incident => incident.payment_id);

  const ids = new Set<string>([...paymentsById.keys(), ...settlementsById.keys(), ...incidentsById.keys()]);

  return [...ids]
    .map(id => {
      const payment = paymentsById.get(id) ?? null;
      const settlements = settlementsById.get(id) ?? [];
      const ledger = ledgerByOperation.get(id) ?? [];
      const incidents = incidentsById.get(id) ?? [];
      return {
        id,
        payment,
        settlements,
        ledger,
        incidents,
        missingSources: missingSourcesFor(payment, settlements, ledger),
        amount: payment?.amount ?? settlements[0]?.amount ?? 0,
        presentation: presentationFor(incidents, hasRun)
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function matchesQuery(row: OperationRow, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase('es');
  const haystack = [
    row.id,
    ...row.incidents.flatMap(incident => [incident.id, incident.reason, reasonLabel(incident.reason)])
  ];
  return haystack.some(text => text.toLocaleLowerCase('es').includes(needle));
}

export function filterRows(rows: OperationRow[], filters: OperationFilters): OperationRow[] {
  const query = filters.query.trim();
  return rows.filter(
    row =>
      matchesQuery(row, query) &&
      (!filters.status || row.incidents.some(incident => incident.status === filters.status)) &&
      (!filters.reason || row.incidents.some(incident => incident.reason === filters.reason))
  );
}
