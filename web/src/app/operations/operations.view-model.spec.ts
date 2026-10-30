import { describe, expect, it } from 'vitest';
import { INCIDENTS, LEDGER, PAYMENTS, SETTLEMENTS } from '../testing/fixtures';
import {
  NO_FILTERS,
  OperationSources,
  buildOperationRows,
  buildWalletIncidents,
  filterRows,
  scopeToWallet
} from './operations.view-model';

const SOURCES: OperationSources = {
  payments: PAYMENTS,
  settlements: SETTLEMENTS,
  ledger: LEDGER,
  incidents: INCIDENTS
};

describe('buildOperationRows', () => {
  const rows = buildOperationRows(SOURCES, true);
  const byId = (id: string) => rows.find(row => row.id === id)!;

  it('une pagos, settlements y ledger de una referencia en una sola fila', () => {
    const row = byId('pay_1');
    expect(rows.filter(r => r.id === 'pay_1').length).toBe(1);
    expect(row.payment?.amount).toBe(1500);
    expect(row.settlements.length).toBe(1);
    expect(row.ledger.length).toBe(2);
    expect(row.missingSources).toEqual([]);
  });

  it('marca la fuente que falta cuando hay pago sin asiento', () => {
    expect(byId('pay_2').missingSources).toEqual(['ledger']);
  });

  it('marca wallet como faltante en un registro solo del proveedor', () => {
    const row = byId('pay_orphan');
    expect(row.payment).toBeNull();
    expect(row.missingSources).toEqual(['wallet', 'ledger']);
    expect(row.amount).toBe(900);
  });

  it('no asocia BALANCE_MISMATCH a una operación ni crea una fila para la wallet', () => {
    expect(rows.some(row => row.id === 'wallet-demo')).toBe(false);
    expect(rows.flatMap(row => row.incidents).some(i => i.reason === 'BALANCE_MISMATCH')).toBe(false);
  });

  it('no crea filas para operaciones que solo existen en el ledger', () => {
    expect(rows.some(row => row.id === 'opening')).toBe(false);
  });

  it('ordena por referencia', () => {
    expect(rows.map(row => row.id)).toEqual([...rows.map(row => row.id)].sort());
  });
});

describe('buildWalletIncidents', () => {
  it('devuelve solo BALANCE_MISMATCH', () => {
    expect(buildWalletIncidents(INCIDENTS).map(i => i.id)).toEqual(['inc_balance']);
  });
});

describe('scopeToWallet', () => {
  it('conserva solo lo que pertenece a los pagos de la wallet y cuenta el resto', () => {
    const scoped = scopeToWallet(SOURCES, 'wallet-demo');
    expect(scoped.sources.settlements.map(s => s.id)).toEqual(['pay_1', 'pay_2']);
    expect(scoped.sources.ledger.map(e => e.operation)).toEqual(['pay_1', 'pay_1']);
    expect(scoped.sources.incidents.map(i => i.id)).toEqual(['inc_amount', 'inc_old', 'inc_balance']);
    expect(scoped.outsideCount).toBe(1);
  });

  it('una wallet sin pagos no muestra registros del grupo y los cuenta aparte', () => {
    const scoped = scopeToWallet({ ...SOURCES, payments: [] }, 'wallet-nueva');
    expect(buildOperationRows(scoped.sources, true)).toEqual([]);
    expect(scoped.sources.incidents).toEqual([]);
    expect(scoped.outsideCount).toBe(4);
  });

  it('BALANCE_MISMATCH de otra wallet queda fuera', () => {
    const scoped = scopeToWallet(SOURCES, 'otra-wallet');
    expect(scoped.sources.incidents.some(i => i.reason === 'BALANCE_MISMATCH')).toBe(false);
  });
});

describe('estados de presentación', () => {
  it('muestra Sin ejecutar si no hay ejecución en la sesión', () => {
    const rows = buildOperationRows(SOURCES, false);
    expect(rows.every(row => row.presentation === 'NOT_RUN')).toBe(true);
    expect(rows.find(r => r.id === 'pay_2')!.incidents[0].status).toBe('OPEN');
  });

  it('muestra Conciliada si hay ejecución y ninguna incidencia OPEN', () => {
    const rows = buildOperationRows(SOURCES, true);
    expect(rows.find(r => r.id === 'pay_1')!.presentation).toBe('MATCHED');
    expect(rows.find(r => r.id === 'pay_2')!.presentation).toBe('WITH_INCIDENTS');
  });
});

describe('filterRows', () => {
  const rows = buildOperationRows(SOURCES, true);
  const ids = (list: typeof rows) => list.map(row => row.id);

  it('sin filtros devuelve todas', () => {
    expect(filterRows(rows, NO_FILTERS)).toEqual(rows);
  });

  it('busca por identificador de incidencia', () => {
    expect(ids(filterRows(rows, { ...NO_FILTERS, query: 'inc_amount' }))).toEqual(['pay_2']);
  });

  it('busca por referencia y por motivo (código o etiqueta)', () => {
    expect(ids(filterRows(rows, { ...NO_FILTERS, query: 'PAY_ORPHAN' }))).toEqual(['pay_orphan']);
    expect(ids(filterRows(rows, { ...NO_FILTERS, query: 'monto diferente' }))).toEqual(['pay_2']);
    expect(ids(filterRows(rows, { ...NO_FILTERS, query: 'MISSING_WALLET' }))).toEqual(['pay_orphan']);
  });

  it('filtra por motivo del enum', () => {
    expect(ids(filterRows(rows, { ...NO_FILTERS, reason: 'DUPLICATE_PROVIDER' }))).toEqual(['pay_1']);
  });

  it('filtra por estado OPEN o RESOLVED', () => {
    expect(ids(filterRows(rows, { ...NO_FILTERS, status: 'OPEN' }))).toEqual(['pay_2', 'pay_orphan']);
    expect(ids(filterRows(rows, { ...NO_FILTERS, status: 'RESOLVED' }))).toEqual(['pay_1']);
  });

  it('combina filtros', () => {
    expect(filterRows(rows, { query: 'pay_2', status: 'RESOLVED', reason: '' })).toEqual([]);
  });
});
