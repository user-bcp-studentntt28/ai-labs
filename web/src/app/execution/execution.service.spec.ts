import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../core/config';
import { SourcesService } from '../sources/sources.service';
import { INCIDENTS } from '../testing/fixtures';
import { answerSources, failSource, nextTurn } from '../testing/http-helpers';
import { ExecutionService } from './execution.service';

describe('ExecutionService', () => {
  let service: ExecutionService;
  let sources: SourcesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExecutionService);
    sources = TestBed.inject(SourcesService);
    http = TestBed.inject(HttpTestingController);
  });

  async function loadSources(): Promise<void> {
    const pending = sources.load();
    answerSources(http);
    await pending;
  }

  it('no envía POST si las fuentes no están cargadas', async () => {
    await service.run();
    http.expectNone(`${API_BASE_URL}/reconciliations`);
    expect(service.status()).toBe('idle');
  });

  it('envía POST sin cuerpo y muestra MATCHED con cero diferencias', async () => {
    await loadSources();
    const pending = service.run();
    const post = http.expectOne(`${API_BASE_URL}/reconciliations`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toBeNull();
    post.flush({ status: 'MATCHED', differences: [] });
    await nextTurn();
    answerSources(http);
    await pending;
    expect(service.result()?.status).toBe('MATCHED');
    expect(service.differenceCount()).toBe(0);
    expect(service.status()).toBe('succeeded');
  });

  it('muestra DIFFERENCES con la cantidad devuelta y refresca fuentes e incidencias', async () => {
    await loadSources();
    const pending = service.run();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush({ status: 'DIFFERENCES', differences: INCIDENTS.slice(0, 2) });
    await nextTurn();
    answerSources(http);
    await pending;
    expect(service.result()?.status).toBe('DIFFERENCES');
    expect(service.differenceCount()).toBe(2);
    expect(service.refreshFailed()).toBe(false);
  });

  it('una respuesta con forma inválida es error y no refresca', async () => {
    await loadSources();
    const pending = service.run();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush({ status: 'OTHER', differences: 'x' });
    await pending;
    http.expectNone(`${API_BASE_URL}/settlements`);
    expect(service.status()).toBe('failed');
    expect(service.executionError()).toContain('no se ejecutó');
    expect(service.result()).toBeNull();
  });

  it('si el POST falla informa que no se ejecutó y no actualiza fuentes', async () => {
    await loadSources();
    const pending = service.run();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush('x', { status: 500, statusText: 'Error' });
    await pending;
    http.expectNone(`${API_BASE_URL}/settlements`);
    expect(service.status()).toBe('failed');
    expect(service.executionError()).toContain('500');
    expect(sources.loaded()).toBe(true);
  });

  it('POST exitoso con refresco fallido conserva el resultado y bloquea hasta actualizar', async () => {
    await loadSources();
    const pending = service.run();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush({ status: 'DIFFERENCES', differences: [{}] });
    await nextTurn();
    failSource(http, '/payments');
    http.expectOne(`${API_BASE_URL}/settlements`).flush([]);
    http.expectOne(`${API_BASE_URL}/ledger`).flush([]);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush([]);
    await pending;
    expect(service.status()).toBe('succeeded');
    expect(service.refreshFailed()).toBe(true);
    expect(service.executionError()).toBeNull();
    expect(service.canRun()).toBe(false);

    const recover = sources.load();
    answerSources(http);
    await recover;
    expect(service.refreshFailed()).toBe(false);
    expect(service.canRun()).toBe(true);
  });

  it('repetir la ejecución conserva los IDs y reemplaza la lista sin duplicar', async () => {
    await loadSources();
    for (let i = 0; i < 2; i++) {
      const pending = service.run();
      http.expectOne(`${API_BASE_URL}/reconciliations`).flush({ status: 'DIFFERENCES', differences: INCIDENTS });
      await nextTurn();
      answerSources(http);
      await pending;
    }
    expect(sources.incidents().map(item => item.id)).toEqual(INCIDENTS.map(item => item.id));
  });

  it('no realiza escrituras distintas de POST /reconciliations', async () => {
    await loadSources();
    const pending = service.run();
    const requests = http.match(() => true);
    expect(requests.map(r => r.request.method)).toEqual(['POST']);
    requests[0].flush({ status: 'MATCHED', differences: [] });
    await nextTurn();
    answerSources(http);
    await pending;
  });
});
