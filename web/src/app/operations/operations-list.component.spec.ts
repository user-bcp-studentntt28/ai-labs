import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../core/config';
import { SourcesService } from '../sources/sources.service';
import { answerSources, nextTurn } from '../testing/http-helpers';
import { WORKFLOW_STORAGE } from '../tracking/workflow-storage.service';
import { OperationsListComponent } from './operations-list.component';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

describe('OperationsListComponent', () => {
  let http: HttpTestingController;
  let sources: SourcesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OperationsListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: WORKFLOW_STORAGE, useValue: new MemoryStorage() }]
    });
    http = TestBed.inject(HttpTestingController);
    sources = TestBed.inject(SourcesService);
  });

  async function loadSources(): Promise<void> {
    const pending = sources.load();
    answerSources(http);
    await pending;
  }

  async function render() {
    await loadSources();
    const fixture = TestBed.createComponent(OperationsListComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const rowIds = () => [...root.querySelectorAll('[data-row]')].map(el => el.getAttribute('data-row'));
    const setInput = (selector: string, value: string, event: string) => {
      const el = root.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
      el.value = value;
      el.dispatchEvent(new Event(event));
      fixture.detectChanges();
    };
    return { fixture, root, rowIds, setInput };
  }

  it('sin fuentes cargadas pide cargarlas', () => {
    const fixture = TestBed.createComponent(OperationsListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carga las fuentes');
  });

  it('muestra solo las operaciones de la wallet y deja BALANCE_MISMATCH en la sección Saldo de wallet', async () => {
    const { root, rowIds } = await render();
    expect(rowIds()).toEqual(['pay_1', 'pay_2']);
    const balance = root.querySelector('app-wallet-balance')!;
    expect(balance.textContent).toContain('Saldo de wallet');
    expect(balance.querySelector('[data-balance-incident="inc_balance"]')).not.toBeNull();
    expect(root.querySelector('[data-row="inc_balance"]')).toBeNull();
  });

  it('avisa que hay referencias del grupo sin pago en la wallet y permite incluirlas', async () => {
    const { fixture, root, rowIds } = await render();
    expect(root.querySelector('[data-testid="scope-note"]')?.textContent).toContain('1 referencia(s) del grupo');
    const toggle = root.querySelector('#include-group') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(rowIds()).toEqual(['pay_1', 'pay_2', 'pay_orphan']);
  });

  it('otra wallet sin pagos no muestra operaciones del grupo', async () => {
    sources.walletId.set('wallet-nueva');
    const pending = sources.load();
    answerSources(http, { payments: [] });
    await pending;
    const fixture = TestBed.createComponent(OperationsListComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[data-row]').length).toBe(0);
    expect(root.querySelector('[data-testid="empty"]')?.textContent).toContain('wallet-nueva no tiene pagos');
    expect(root.querySelector('[data-balance-incident]')).toBeNull();
    expect(root.querySelector('[data-testid="scope-note"]')?.textContent).toContain('wallet-nueva');
  });

  it('antes de ejecutar muestra "Sin ejecutar" y el estado del API por separado', async () => {
    const { root } = await render();
    const row = root.querySelector('[data-row="pay_2"]')!;
    expect(row.querySelector('[data-testid="presentation"]')?.textContent).toContain('Sin ejecutar');
    expect(row.querySelector('[data-testid="api-status"]')?.textContent).toContain('Abierta');
  });

  it('señala la fuente que falta', async () => {
    const { fixture, root } = await render();
    expect(root.querySelector('[data-row="pay_2"] [data-testid="missing"]')?.textContent).toContain('Ledger');
    const toggle = root.querySelector('#include-group') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(root.querySelector('[data-row="pay_orphan"] [data-testid="missing"]')?.textContent).toContain('Wallet');
  });

  it('filtra por búsqueda, estado y motivo', async () => {
    const { fixture, root, rowIds, setInput } = await render();
    setInput('#search-input', 'inc_amount', 'input');
    expect(rowIds()).toEqual(['pay_2']);
    setInput('#search-input', '', 'input');
    setInput('#status-filter', 'RESOLVED', 'change');
    expect(rowIds()).toEqual(['pay_1']);
    setInput('#status-filter', '', 'change');
    setInput('#reason-filter', 'DUPLICATE_PROVIDER', 'change');
    expect(rowIds()).toEqual(['pay_1']);
    setInput('#reason-filter', 'MISSING_WALLET', 'change');
    expect(rowIds()).toEqual([]);
    const toggle = root.querySelector('#include-group') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(rowIds()).toEqual(['pay_orphan']);
  });

  it('el detalle muestra estados, motivos del API y datos de wallet, proveedor y ledger', async () => {
    const { fixture, root } = await render();
    (root.querySelector('[data-row="pay_1"]') as HTMLElement).click();
    fixture.detectChanges();
    const detail = root.querySelector('[data-testid="detail"]')!;
    expect(detail.querySelector('[data-testid="incident-card"]')?.textContent).toContain('Resuelta');
    expect(detail.querySelector('[data-testid="incident-card"]')?.textContent).toContain('DUPLICATE_PROVIDER');
    expect(detail.querySelector('[data-testid="wallet-card"]')?.textContent).toContain('S/ 15.00');
    expect(detail.querySelector('[data-testid="provider-card"]')?.textContent).toContain('S/ 15.00');
    expect(detail.querySelectorAll('[data-testid="ledger-row"]').length).toBe(2);
    (detail.querySelector('[data-testid="close"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="detail"]')).toBeNull();
  });

  it('recarga fuentes desde el detalle', async () => {
    const { fixture, root } = await render();
    (root.querySelector('[data-row="pay_1"]') as HTMLElement).click();
    fixture.detectChanges();
    (root.querySelector('[data-testid="reload"]') as HTMLElement).click();
    answerSources(http);
    await nextTurn();
  });

  it('ejecuta una nueva conciliación desde el detalle y pasa a "Conciliada"', async () => {
    const { fixture, root } = await render();
    (root.querySelector('[data-row="pay_1"]') as HTMLElement).click();
    fixture.detectChanges();
    (root.querySelector('[data-testid="reconcile"]') as HTMLElement).click();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush({ status: 'DIFFERENCES', differences: [] });
    await nextTurn();
    answerSources(http);
    await nextTurn();
    fixture.detectChanges();
    expect(root.querySelector('[data-row="pay_1"] [data-testid="presentation"]')?.textContent).toContain('Conciliada');
    expect(root.querySelector('[data-row="pay_1"] [data-testid="api-status"]')?.textContent).toContain('Resuelta');
  });
});
