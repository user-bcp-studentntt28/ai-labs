import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { answerSources } from '../testing/http-helpers';
import { API_BASE_URL } from '../core/config';
import { INCIDENTS, LEDGER, PAYMENTS, SETTLEMENTS } from '../testing/fixtures';
import { SourcesService } from './sources.service';

describe('SourcesService', () => {
  let service: SourcesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SourcesService);
    http = TestBed.inject(HttpTestingController);
  });

  function answerAll(overrides: Partial<Record<string, unknown>> = {}): void {
    answerSources(http, overrides);
  }

  it('consulta las cuatro fuentes con la wallet por defecto', async () => {
    const pending = service.load();
    const payments = http.expectOne(r => r.url === `${API_BASE_URL}/payments`);
    expect(payments.request.params.get('walletId')).toBe('wallet-demo');
    payments.flush(PAYMENTS);
    http.expectOne(`${API_BASE_URL}/settlements`).flush(SETTLEMENTS);
    http.expectOne(`${API_BASE_URL}/ledger`).flush(LEDGER);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush(INCIDENTS);
    expect(await pending).toBe(true);
    expect(service.loaded()).toBe(true);
    expect(service.payments()).toEqual(PAYMENTS);
    expect(service.sourceStates().payments.loadedAt).toBeInstanceOf(Date);
  });

  it('usa la wallet indicada por el analista', async () => {
    service.walletId.set('  wallet-x ');
    const pending = service.load();
    const payments = http.expectOne(r => r.url === `${API_BASE_URL}/payments`);
    expect(payments.request.params.get('walletId')).toBe('wallet-x');
    payments.flush([]);
    http.expectOne(`${API_BASE_URL}/settlements`).flush([]);
    http.expectOne(`${API_BASE_URL}/ledger`).flush([]);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush([]);
    await pending;
    expect(service.activeWalletId()).toBe('wallet-x');
  });

  it('trata [] como carga válida sin error', async () => {
    const pending = service.load();
    answerAll({ payments: [], settlements: [], ledger: [], incidents: [] });
    expect(await pending).toBe(true);
    expect(service.loaded()).toBe(true);
    expect(Object.values(service.sourceStates()).every(s => s.error === null)).toBe(true);
  });

  it('si falla una fuente, no marca el conjunto como cargado ni expone datos parciales', async () => {
    const pending = service.load();
    http.expectOne(r => r.url === `${API_BASE_URL}/payments`).flush(PAYMENTS);
    http.expectOne(`${API_BASE_URL}/settlements`).flush('boom', { status: 500, statusText: 'Server Error' });
    http.expectOne(`${API_BASE_URL}/ledger`).flush(LEDGER);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush(INCIDENTS);
    expect(await pending).toBe(false);
    expect(service.loaded()).toBe(false);
    expect(service.sourceStates().settlements.status).toBe('error');
    expect(service.sourceStates().settlements.error).toContain('500');
    expect(service.sourceStates().payments.status).toBe('loaded');
    expect(service.payments()).toEqual([]);
    expect(service.missingSources()).toEqual(['settlements']);
    expect(service.canRunReconciliation()).toBe(false);
  });

  it('una respuesta que no es lista se trata como error de formato', async () => {
    const pending = service.load();
    answerAll({ ledger: { not: 'a list' } });
    expect(await pending).toBe(false);
    expect(service.sourceStates().ledger.status).toBe('error');
    expect(service.sourceStates().ledger.error).toContain('formato');
  });

  it('un error de red informa CORS/conexión', async () => {
    const pending = service.load();
    http.expectOne(r => r.url === `${API_BASE_URL}/payments`).error(new ProgressEvent('error'));
    http.expectOne(`${API_BASE_URL}/settlements`).flush(SETTLEMENTS);
    http.expectOne(`${API_BASE_URL}/ledger`).flush(LEDGER);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush(INCIDENTS);
    await pending;
    expect(service.sourceStates().payments.error).toContain('CORS');
  });

  it('antes de cargar la conciliación está bloqueada y lista todas las fuentes faltantes', () => {
    expect(service.canRunReconciliation()).toBe(false);
    expect(service.missingSources()).toEqual(['payments', 'settlements', 'ledger', 'incidents']);
  });

  it('con las cuatro fuentes cargadas la conciliación queda habilitada', async () => {
    const pending = service.load();
    answerAll();
    await pending;
    expect(service.canRunReconciliation()).toBe(true);
    expect(service.missingSources()).toEqual([]);
  });

  it('actualizar vuelve a consultar y solo cambia la fecha de las fuentes exitosas', async () => {
    let pending = service.load();
    answerAll();
    await pending;
    const firstSettlementsDate = service.sourceStates().settlements.loadedAt;

    await new Promise(resolve => setTimeout(resolve, 5));
    pending = service.load();
    http.expectOne(r => r.url === `${API_BASE_URL}/payments`).flush(PAYMENTS);
    http.expectOne(`${API_BASE_URL}/settlements`).flush('x', { status: 503, statusText: 'Unavailable' });
    http.expectOne(`${API_BASE_URL}/ledger`).flush(LEDGER);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush(INCIDENTS);
    await pending;
    expect(service.sourceStates().settlements.loadedAt).toBe(firstSettlementsDate);
    expect(service.sourceStates().ledger.loadedAt!.getTime()).toBeGreaterThan(firstSettlementsDate!.getTime());
  });

  it('ignora una segunda carga mientras hay una en curso', async () => {
    const first = service.load();
    expect(service.loading()).toBe(true);
    expect(await service.load()).toBe(false);
    answerAll();
    expect(await first).toBe(true);
    expect(service.loading()).toBe(false);
  });
});
