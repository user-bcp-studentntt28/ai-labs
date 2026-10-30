export type ApiIncidentStatus = 'OPEN' | 'RESOLVED';

export type IncidentReason =
  | 'DUPLICATE_PROVIDER'
  | 'MISSING_WALLET'
  | 'MISSING_PROVIDER'
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'LEDGER_MISMATCH'
  | 'LEDGER_UNBALANCED'
  | 'BALANCE_MISMATCH';

export interface Payment {
  id: string;
  wallet_id: string;
  recipient: string;
  amount: number;
  status: string;
}

export interface ProviderPayment {
  id: string;
  amount: number;
  status: string;
}

export interface LedgerEntry {
  id: number;
  operation: string;
  kind: string;
  account: string;
  amount: number;
}

export interface Incident {
  id: string;
  payment_id: string;
  reason: IncidentReason;
  status: ApiIncidentStatus;
}

export type ReconciliationStatus = 'MATCHED' | 'DIFFERENCES';

export interface ReconciliationResult {
  status: ReconciliationStatus;
  differences: unknown[];
}

export type SourceKey = 'payments' | 'settlements' | 'ledger' | 'incidents';

export type ControlMode = 'AMOUNT' | 'MISSING' | 'DUPLICATE' | 'ORPHAN' | 'CLEAR';

export type Role = 'ANALYST' | 'SUPERVISOR';
