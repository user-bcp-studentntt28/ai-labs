import { Incident, LedgerEntry, Payment, ProviderPayment } from '../core/models';

export const PAYMENTS: Payment[] = [
  { id: 'pay_1', wallet_id: 'wallet-demo', recipient: 'contact-demo', amount: 1500, status: 'SUCCEEDED' },
  { id: 'pay_2', wallet_id: 'wallet-demo', recipient: 'merchant-demo', amount: 2500, status: 'SUCCEEDED' }
];

export const SETTLEMENTS: ProviderPayment[] = [
  { id: 'pay_1', amount: 1500, status: 'SUCCEEDED' },
  { id: 'pay_2', amount: 2999, status: 'SUCCEEDED' },
  { id: 'pay_orphan', amount: 900, status: 'SUCCEEDED' }
];

export const LEDGER: LedgerEntry[] = [
  { id: 1, operation: 'opening', kind: 'FUNDING', account: 'wallet-demo', amount: 100000 },
  { id: 2, operation: 'pay_1', kind: 'PAYMENT', account: 'wallet-demo', amount: -1500 },
  { id: 3, operation: 'pay_1', kind: 'PAYMENT', account: 'clearing', amount: 1500 }
];

export const INCIDENTS: Incident[] = [
  { id: 'inc_amount', payment_id: 'pay_2', reason: 'AMOUNT_MISMATCH', status: 'OPEN' },
  { id: 'inc_orphan', payment_id: 'pay_orphan', reason: 'MISSING_WALLET', status: 'OPEN' },
  { id: 'inc_old', payment_id: 'pay_1', reason: 'DUPLICATE_PROVIDER', status: 'RESOLVED' },
  { id: 'inc_balance', payment_id: 'wallet-demo', reason: 'BALANCE_MISMATCH', status: 'OPEN' }
];
