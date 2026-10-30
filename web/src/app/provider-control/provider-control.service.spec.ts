import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../core/config';
import { SourcesService } from '../sources/sources.service';
import { answerSources, nextTurn } from '../testing/http-helpers';
import { ProviderControlService } from './provider-control.service';

const URL = `${API_BASE_URL}/control/settlements`;

describe('ProviderControlService', () => {
  let service: ProviderControlService;
  let sources: SourcesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProviderControlService);
    sources = TestBed.inject(SourcesService);
    http = TestBed.inject(HttpTestingController);
  });

  it('AMOUNT envía paymentId, mode y amountCents y avisa que hay que volver a conciliar', async () => {
    const pending = service.apply({ paymentId: 'pay_1', mode: 'AMOUNT', amountCents: 1600 });
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ paymentId: 'pay_1', mode: 'AMOUNT', amountCents: 1600 });
    req.flush({ configured: true });
    await nextTurn();
    answerSources(http);
    await pending;
    expect(service.outcome()?.kind).toBe('success');
    expect(service.outcome()?.message).toContain('reporte simulado del proveedor');
    expect(service.outcome()?.message).toContain('Vuelve a conciliar');
    expect(sources.loaded()).toBe(true);
  });

  it('MISSING y DUPLICATE se envían sin amountCents', async () => {
    for (const mode of ['MISSING', 'DUPLICATE'] as const) {
      const pending = service.apply({ paymentId: 'pay_1', mode });
      const req = http.expectOne(URL);
      expect(req.request.body).toEqual({ paymentId: 'pay_1', mode });
      req.flush({ configured: true });
      await nextTurn();
      answerSources(http);
      await pending;
    }
  });

  it('ORPHAN envía el ID nuevo y el monto', async () => {
    const pending = service.apply({ paymentId: 'pay_new', mode: 'ORPHAN', amountCents: 900 });
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ paymentId: 'pay_new', mode: 'ORPHAN', amountCents: 900 });
    req.flush({ configured: true });
    await nextTurn();
    answerSources(http);
    await pending;
  });

  it('409 PROVIDER_ALREADY_EXISTS se muestra como error, no como éxito, y no recarga', async () => {
    const pending = service.apply({ paymentId: 'pay_1', mode: 'ORPHAN', amountCents: 900 });
    http.expectOne(URL).flush({ code: 'PROVIDER_ALREADY_EXISTS' }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(service.outcome()?.kind).toBe('error');
    expect(service.outcome()?.message).toContain('PROVIDER_ALREADY_EXISTS');
    http.expectNone(`${API_BASE_URL}/settlements`);
  });

  it('400 INVALID_MODE se muestra', async () => {
    const pending = service.apply({ paymentId: 'pay_1', mode: 'AMOUNT', amountCents: 5 });
    http.expectOne(URL).flush({ code: 'INVALID_MODE' }, { status: 400, statusText: 'Bad Request' });
    await pending;
    expect(service.outcome()?.message).toContain('INVALID_MODE');
  });

  it('404 informa que el pago no existe', async () => {
    const pending = service.apply({ paymentId: 'pay_x', mode: 'MISSING' });
    http.expectOne(URL).flush({ code: 'PAYMENT_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await pending;
    expect(service.outcome()?.message).toContain('no existe');
  });

  it('un error de red se informa', async () => {
    const pending = service.apply({ paymentId: 'pay_1', mode: 'MISSING' });
    http.expectOne(URL).error(new ProgressEvent('error'));
    await pending;
    expect(service.outcome()?.kind).toBe('error');
    expect(service.outcome()?.message).toContain('CORS');
  });

  it('CLEAR sin alteración previa es un resultado neutral, no un error', async () => {
    const pending = service.apply({ paymentId: 'pay_1', mode: 'CLEAR' });
    http.expectOne(URL).flush({ configured: false });
    await nextTurn();
    answerSources(http);
    await pending;
    expect(service.outcome()?.kind).toBe('neutral');
  });

  it('una respuesta sin configured es error de formato', async () => {
    const pending = service.apply({ paymentId: 'pay_1', mode: 'MISSING' });
    http.expectOne(URL).flush({});
    await pending;
    expect(service.outcome()?.kind).toBe('error');
  });

  it('solo llama a /control/settlements como escritura', async () => {
    const pending = service.apply({ paymentId: 'pay_1', mode: 'MISSING' });
    http.expectOne(URL).flush({ configured: true });
    await nextTurn();
    const writes = http.match(r => r.method !== 'GET');
    expect(writes).toEqual([]);
    answerSources(http);
    await pending;
  });
});
