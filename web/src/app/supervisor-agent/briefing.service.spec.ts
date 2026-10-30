import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Incident } from '../core/models';
import { WORKFLOW_STORAGE } from '../tracking/workflow-storage.service';
import { Briefing, isBriefing } from './briefing';
import { SupervisorBriefingService } from './briefing.service';

class FakeStorage implements Storage {
  data = new Map<string, string>();
  failWrites = false;
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
}

const INCIDENT: Incident = { id: 'inc_1', payment_id: 'pay_1', reason: 'AMOUNT_MISMATCH', status: 'OPEN' };
const AGENT_URL = 'http://localhost:8100/briefings';
const STORAGE_KEY = 'conciliacion:briefing:3:wallet-demo';

const BRIEFING: Briefing = {
  incidentId: 'inc_1',
  event: 'STARTED',
  priority: 'HIGH',
  headline: 'Importe distinto entre wallet y proveedor',
  problem: 'El wallet registra S/ 15.00 y el proveedor S/ 16.00.',
  evidence: ['Wallet: S/ 15.00', 'Proveedor: S/ 16.00'],
  recommendation: 'Confirmar el importe con el proveedor.',
  source: 'fallback',
  model: null,
  generatedAt: '2026-10-30T20:00:00Z'
};

function setup(storage: Storage | null) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: WORKFLOW_STORAGE, useValue: storage }]
  });
  return { service: TestBed.inject(SupervisorBriefingService), http: TestBed.inject(HttpTestingController) };
}

describe('SupervisorBriefingService', () => {
  let fake: FakeStorage;

  beforeEach(() => {
    fake = new FakeStorage();
  });

  it('envía el evento STARTED con el contexto de la incidencia y guarda el resumen', async () => {
    const { service, http } = setup(fake);
    const pending = service.requestFor(INCIDENT, 'start', 'En atención', '  ');
    expect(service.statusFor('inc_1')).toEqual({ kind: 'loading' });

    const request = http.expectOne(AGENT_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      incidentId: 'inc_1',
      paymentId: 'pay_1',
      reason: 'AMOUNT_MISMATCH',
      walletId: 'wallet-demo',
      event: 'STARTED',
      analystNote: null,
      workflowState: 'En atención'
    });
    request.flush(BRIEFING);
    await pending;

    expect(service.briefingFor('inc_1')).toEqual(BRIEFING);
    expect(service.statusFor('inc_1')).toBeNull();
    expect(fake.data.has(STORAGE_KEY)).toBe(true);
  });

  it('envía la respuesta del analista con el evento SUBMITTED y reemplaza el resumen anterior', async () => {
    const { service, http } = setup(fake);
    const first = service.requestFor(INCIDENT, 'start', 'En atención', '');
    http.expectOne(AGENT_URL).flush(BRIEFING);
    await first;

    const second = service.requestFor(INCIDENT, 'submit', 'En revisión', ' Proveedor corrigió ');
    const request = http.expectOne(AGENT_URL);
    expect(request.request.body).toMatchObject({ event: 'SUBMITTED', analystNote: 'Proveedor corrigió', workflowState: 'En revisión' });
    request.flush({ ...BRIEFING, event: 'SUBMITTED', priority: 'LOW' });
    await second;

    expect(service.briefingFor('inc_1')?.event).toBe('SUBMITTED');
    expect(service.briefingFor('inc_1')?.priority).toBe('LOW');
  });

  it('las acciones del supervisor no llaman al agente', async () => {
    const { service, http } = setup(fake);
    await service.requestFor(INCIDENT, 'approve', 'Cerrada localmente', 'ok');
    await service.requestFor(INCIDENT, 'return', 'Devuelta', 'falta evidencia');
    http.expectNone(AGENT_URL);
  });

  it('si el agente no responde, informa sin bloquear y no guarda nada', async () => {
    const { service, http } = setup(fake);
    const pending = service.requestFor(INCIDENT, 'start', 'En atención', '');
    http.expectOne(AGENT_URL).error(new ProgressEvent('error'));
    await pending;

    const status = service.statusFor('inc_1');
    expect(status?.kind === 'error' && status.message).toContain('No se pudo conectar con el agente supervisor');
    expect(service.briefingFor('inc_1')).toBeNull();
  });

  it('un error HTTP del agente se informa con su código', async () => {
    const { service, http } = setup(fake);
    const pending = service.requestFor(INCIDENT, 'start', 'En atención', '');
    http.expectOne(AGENT_URL).flush({ detail: 'mock caído' }, { status: 502, statusText: 'Bad Gateway' });
    await pending;

    const status = service.statusFor('inc_1');
    expect(status?.kind === 'error' && status.message).toContain('HTTP 502');
  });

  it('rechaza una respuesta con formato inesperado o de otra incidencia', async () => {
    const { service, http } = setup(fake);
    const malformed = service.requestFor(INCIDENT, 'start', 'En atención', '');
    http.expectOne(AGENT_URL).flush({ headline: 'sin forma' });
    await malformed;
    expect(service.statusFor('inc_1')?.kind).toBe('error');

    const foreign = service.requestFor(INCIDENT, 'start', 'En atención', '');
    http.expectOne(AGENT_URL).flush({ ...BRIEFING, incidentId: 'otra' });
    await foreign;
    expect(service.statusFor('inc_1')?.kind).toBe('error');
    expect(service.briefingFor('inc_1')).toBeNull();
  });

  it('ignora una respuesta vieja cuando hay una solicitud más reciente', async () => {
    const { service, http } = setup(fake);
    const stale = service.requestFor(INCIDENT, 'start', 'En atención', '');
    const [staleRequest] = http.match(AGENT_URL);
    const latest = service.requestFor(INCIDENT, 'submit', 'En revisión', 'respuesta');
    const latestRequest = http.expectOne(AGENT_URL);

    latestRequest.flush({ ...BRIEFING, event: 'SUBMITTED' });
    staleRequest.flush(BRIEFING);
    await Promise.all([stale, latest]);

    expect(service.briefingFor('inc_1')?.event).toBe('SUBMITTED');
  });

  it('si no se puede guardar el resumen, lo informa', async () => {
    fake.failWrites = true;
    const { service, http } = setup(fake);
    const pending = service.requestFor(INCIDENT, 'start', 'En atención', '');
    http.expectOne(AGENT_URL).flush(BRIEFING);
    await pending;

    const status = service.statusFor('inc_1');
    expect(status?.kind === 'error' && status.message).toContain('almacenamiento local');
  });

  it('sin almacenamiento no guarda el resumen', async () => {
    const { service, http } = setup(null);
    const pending = service.requestFor(INCIDENT, 'start', 'En atención', '');
    http.expectOne(AGENT_URL).flush(BRIEFING);
    await pending;
    expect(service.statusFor('inc_1')?.kind).toBe('error');
    expect(service.briefingFor('inc_1')).toBeNull();
  });

  it('recupera los resúmenes guardados y descarta los dañados', () => {
    fake.data.set(STORAGE_KEY, JSON.stringify({ version: 1, briefings: { inc_1: BRIEFING, bad: { headline: 1 } } }));
    const { service } = setup(fake);
    expect(service.briefingFor('inc_1')).toEqual(BRIEFING);
    expect(service.briefingFor('bad')).toBeNull();
  });

  it('un documento ilegible o de otra versión se ignora', () => {
    fake.data.set(STORAGE_KEY, '{no es json');
    expect(setup(fake).service.briefingFor('inc_1')).toBeNull();
    TestBed.resetTestingModule();
    fake.data.set(STORAGE_KEY, JSON.stringify({ version: 99, briefings: { inc_1: BRIEFING } }));
    expect(setup(fake).service.briefingFor('inc_1')).toBeNull();
  });
});

describe('isBriefing', () => {
  it('acepta un resumen válido, también generado con IA', () => {
    expect(isBriefing(BRIEFING)).toBe(true);
    expect(isBriefing({ ...BRIEFING, source: 'llm', model: 'claude-sonnet-5.5' })).toBe(true);
  });

  it.each([null, 'texto', {}, { ...BRIEFING, priority: 'URGENT' }, { ...BRIEFING, evidence: [1] }, { ...BRIEFING, model: 5 }])(
    'rechaza %j',
    value => {
      expect(isBriefing(value)).toBe(false);
    }
  );
});
