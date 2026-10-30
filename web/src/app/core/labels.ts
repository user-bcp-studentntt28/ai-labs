import { ApiIncidentStatus, IncidentReason, Role, SourceKey } from './models';

export const REASON_LABELS: Record<IncidentReason, string> = {
  DUPLICATE_PROVIDER: 'Duplicado en proveedor',
  MISSING_WALLET: 'Falta en wallet',
  MISSING_PROVIDER: 'Falta en proveedor',
  AMOUNT_MISMATCH: 'Monto diferente',
  STATUS_MISMATCH: 'Estado diferente',
  LEDGER_MISMATCH: 'Ledger diferente',
  LEDGER_UNBALANCED: 'Ledger desbalanceado',
  BALANCE_MISMATCH: 'Saldo diferente'
};

export const API_STATUS_LABELS: Record<ApiIncidentStatus, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta'
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  SUCCEEDED: 'Aprobado',
  REJECTED: 'Rechazado',
  REVERSED: 'Reversado'
};

export const SOURCE_LABELS: Record<SourceKey, string> = {
  payments: 'Pagos wallet',
  settlements: 'Settlements',
  ledger: 'Ledger',
  incidents: 'Incidencias'
};

export const ROLE_LABELS: Record<Role, string> = {
  ANALYST: 'Analista',
  SUPERVISOR: 'Supervisor'
};

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason as IncidentReason] ?? reason;
}

export function apiStatusLabel(status: string): string {
  return API_STATUS_LABELS[status as ApiIncidentStatus] ?? status;
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}
