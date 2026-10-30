export const API_HOST = 'https://bcp-wallet-mock.yefri.workers.dev';
export const GROUP_ID = '3';
export const API_BASE_URL = `${API_HOST}/groups/${GROUP_ID}`;

export const DEFAULT_WALLET_ID = 'wallet-demo';

export const API_PATHS = {
  payments: '/payments',
  settlements: '/settlements',
  ledger: '/ledger',
  incidents: '/reconciliations/incidents',
  reconciliations: '/reconciliations',
  controlSettlements: '/control/settlements'
} as const;

export const MIN_SCENARIO_AMOUNT_CENTS = 1;
export const MAX_SCENARIO_AMOUNT_CENTS = 49999;

export const WORKFLOW_STORAGE_PREFIX = 'conciliacion:workflow';
export const WORKFLOW_SCHEMA_VERSION = 1;
