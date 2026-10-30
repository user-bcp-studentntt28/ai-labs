import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SourcesService } from '../sources/sources.service';
import { WORKFLOW_STORAGE, WorkflowStorageService } from './workflow-storage.service';
import { TrackingService } from './tracking.service';

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

function setup(storage: Storage | null) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: WORKFLOW_STORAGE, useValue: storage }
    ]
  });
  return {
    tracking: TestBed.inject(TrackingService),
    sources: TestBed.inject(SourcesService),
    storage: TestBed.inject(WorkflowStorageService),
    http: TestBed.inject(HttpTestingController)
  };
}

describe('TrackingService', () => {
  let fake: FakeStorage;

  beforeEach(() => {
    fake = new FakeStorage();
  });

  it('guarda la transición, el historial y el rol, y lo recupera con una nueva instancia', () => {
    const { tracking } = setup(fake);
    expect(tracking.perform('inc_1', 'start', '').ok).toBe(true);
    tracking.role.set('ANALYST');
    expect(tracking.perform('inc_1', 'submit', 'listo').ok).toBe(true);
    expect(tracking.recordFor('inc_1').state).toBe('En revisión');

    TestBed.resetTestingModule();
    const again = setup(fake).tracking;
    const record = again.recordFor('inc_1');
    expect(record.state).toBe('En revisión');
    expect(record.history.map(entry => entry.role)).toEqual(['ANALYST', 'ANALYST']);
    expect(record.history[1].note).toBe('listo');
  });

  it('usa la clave conciliacion:workflow:<grupo>:<wallet>', () => {
    const { tracking } = setup(fake);
    tracking.perform('inc_1', 'start', '');
    expect([...fake.data.keys()]).toEqual(['conciliacion:workflow:3:wallet-demo']);
  });

  it('el seguimiento queda separado por wallet', async () => {
    const { tracking, sources, http } = setup(fake);
    tracking.perform('inc_1', 'start', '');
    sources.walletId.set('wallet-b');
    const pending = sources.load();
    http.match(() => true).forEach(req => req.flush([]));
    await pending;
    expect(tracking.recordFor('inc_1').state).toBe('Sin atender');
    expect(fake.data.has('conciliacion:workflow:3:wallet-b')).toBe(false);
  });

  it('el selector de rol solo cambia el rol registrado, sin credenciales', () => {
    const { tracking } = setup(fake);
    tracking.perform('inc_1', 'start', '');
    tracking.role.set('ANALYST');
    tracking.perform('inc_1', 'submit', 'respuesta');
    tracking.role.set('SUPERVISOR');
    expect(tracking.perform('inc_1', 'approve', 'ok').ok).toBe(true);
    expect(tracking.recordFor('inc_1').history.at(-1)?.role).toBe('SUPERVISOR');
  });

  it('rechaza la transición inválida o sin nota y no guarda nada', () => {
    const { tracking } = setup(fake);
    tracking.perform('inc_1', 'start', '');
    tracking.perform('inc_1', 'submit', 'respuesta');
    tracking.role.set('SUPERVISOR');
    const result = tracking.perform('inc_1', 'approve', '  ');
    expect(result.ok).toBe(false);
    expect(tracking.recordFor('inc_1').state).toBe('En revisión');
  });

  it('con almacenamiento no disponible informa y no confirma la transición', () => {
    const { tracking } = setup(null);
    const result = tracking.perform('inc_1', 'start', '');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('no está disponible');
    expect(tracking.storageAvailable()).toBe(false);
    expect(tracking.recordFor('inc_1').state).toBe('Sin atender');
  });

  it('si la escritura falla, el estado vuelve al valor anterior', () => {
    const { tracking } = setup(fake);
    tracking.perform('inc_1', 'start', '');
    fake.failWrites = true;
    const result = tracking.perform('inc_1', 'submit', 'respuesta');
    expect(result.ok).toBe(false);
    expect(tracking.recordFor('inc_1').state).toBe('En atención');
  });

  it('descarta solo el registro dañado y avisa', () => {
    fake.data.set(
      'conciliacion:workflow:3:wallet-demo',
      JSON.stringify({
        version: 1,
        records: {
          ok: { state: 'En atención', history: [] },
          bad: { state: 'Inventado', history: [] }
        }
      })
    );
    const { tracking } = setup(fake);
    expect(tracking.recordFor('ok').state).toBe('En atención');
    expect(tracking.recordFor('bad').state).toBe('Sin atender');
    expect(tracking.discardNotice()).toContain('bad');
  });

  it('un documento ilegible se descarta con aviso y no bloquea el seguimiento', () => {
    fake.data.set('conciliacion:workflow:3:wallet-demo', '{no es json');
    const { tracking } = setup(fake);
    expect(tracking.discardNotice()).toContain('dañado');
    expect(tracking.perform('inc_1', 'start', '').ok).toBe(true);
    expect(tracking.discardNotice()).toBeNull();
  });

  it('nunca realiza peticiones HTTP', () => {
    const { tracking, http } = setup(fake);
    tracking.perform('inc_1', 'start', '');
    http.expectNone(() => true);
  });
});

