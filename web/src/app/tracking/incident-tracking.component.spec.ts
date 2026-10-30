import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Incident } from '../core/models';
import { Briefing } from '../supervisor-agent/briefing';
import { IncidentTrackingComponent } from './incident-tracking.component';
import { TrackingService } from './tracking.service';
import { WORKFLOW_STORAGE } from './workflow-storage.service';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

const INCIDENT: Incident = { id: 'inc_1', payment_id: 'pay_1', reason: 'AMOUNT_MISMATCH', status: 'OPEN' };
const AGENT_URL = 'http://localhost:8100/briefings';
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

describe('IncidentTrackingComponent', () => {
  function setup(storage: Storage | null = new MemoryStorage()) {
    TestBed.configureTestingModule({
      imports: [IncidentTrackingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: WORKFLOW_STORAGE, useValue: storage }]
    });
    const fixture = TestBed.createComponent(IncidentTrackingComponent);
    fixture.componentInstance.incident = INCIDENT;
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const click = (action: string) => {
      (root.querySelector(`[data-action="${action}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    const type = (value: string) => {
      const textarea = root.querySelector('[data-testid="note"]') as HTMLTextAreaElement;
      textarea.value = value;
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, root, click, type, tracking: TestBed.inject(TrackingService), http: TestBed.inject(HttpTestingController) };
  }

  it('muestra a la vez el estado local y el estado del API', () => {
    const { root } = setup();
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('Sin atender');
    expect(root.querySelector('[data-testid="api-state"]')?.textContent).toContain('Abierta');
  });

  it('el analista recorre iniciar atención y enviar a revisión', () => {
    const { root, click, type } = setup();
    click('start');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('En atención');
    type('Corregido el importe');
    click('submit');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('En revisión');
    expect(root.querySelector('[data-testid="no-actions"]')).not.toBeNull();
  });

  it('el supervisor no puede aprobar sin nota y el estado no cambia', () => {
    const { root, click, type, tracking, fixture } = setup();
    click('start');
    type('Corregido el importe');
    click('submit');
    tracking.role.set('SUPERVISOR');
    fixture.detectChanges();
    click('approve');
    expect(root.querySelector('[data-testid="transition-error"]')?.textContent).toContain('requiere una nota');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('En revisión');
  });

  it('aprobar con nota cierra localmente y avisa que el API no cambió', () => {
    const { root, click, type, tracking, fixture } = setup();
    click('start');
    type('Corregido el importe');
    click('submit');
    tracking.role.set('SUPERVISOR');
    fixture.detectChanges();
    type('Revisé la evidencia');
    click('approve');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('Cerrada localmente');
    expect(root.querySelector('[data-testid="closed-warning"]')?.textContent).toContain('El estado del API no cambió');
    expect(root.querySelector('[data-testid="api-state"]')?.textContent).toContain('Abierta');
    expect(root.querySelector('[data-testid="history"]')?.textContent).toContain('Revisé la evidencia');
  });

  it('devolver con observaciones pasa a Devuelta y permite iniciar atención otra vez', () => {
    const { root, click, type, tracking, fixture } = setup();
    click('start');
    type('Corregido el importe');
    click('submit');
    tracking.role.set('SUPERVISOR');
    fixture.detectChanges();
    type('Falta evidencia');
    click('return');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('Devuelta');
    tracking.role.set('ANALYST');
    fixture.detectChanges();
    click('start');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('En atención');
  });

  it('con almacenamiento no disponible avisa y deshabilita las acciones', () => {
    const { root } = setup(null);
    expect(root.querySelector('[data-testid="storage-unavailable"]')).not.toBeNull();
    expect((root.querySelector('[data-action="start"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enviar a revisión sin respuesta del analista se rechaza y no llama al agente', () => {
    const { root, click, http } = setup();
    click('start');
    http.expectOne(AGENT_URL).flush(BRIEFING);
    click('submit');
    expect(root.querySelector('[data-testid="transition-error"]')?.textContent).toContain('requiere una nota');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('En atención');
    http.expectNone(AGENT_URL);
  });

  it('al iniciar y enviar a revisión el agente deja el mensaje que luego lee el supervisor', async () => {
    const { fixture, root, click, type, tracking, http } = setup();
    click('start');
    expect(root.querySelector('[data-testid="briefing-loading"]')).not.toBeNull();
    const started = http.expectOne(AGENT_URL);
    expect(started.request.body).toMatchObject({ event: 'STARTED', paymentId: 'pay_1', reason: 'AMOUNT_MISMATCH' });
    started.flush(BRIEFING);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="briefing-loading"]')).toBeNull();
    expect(root.querySelector('[data-testid="briefing-headline"]')?.textContent).toContain(BRIEFING.headline);

    type('Proveedor confirmó S/ 15.00');
    click('submit');
    const submitted = http.expectOne(AGENT_URL);
    expect(submitted.request.body).toMatchObject({ event: 'SUBMITTED', analystNote: 'Proveedor confirmó S/ 15.00' });
    submitted.flush({ ...BRIEFING, event: 'SUBMITTED', recommendation: 'La respuesta es consistente; puede aprobar.' });
    await fixture.whenStable();

    tracking.role.set('SUPERVISOR');
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="briefing-priority"]')?.textContent).toContain('Prioridad alta');
    expect(root.querySelector('[data-testid="briefing-recommendation"]')?.textContent).toContain('puede aprobar');
    expect(root.querySelector('[data-testid="briefing-evidence"]')?.textContent).toContain('S/ 16.00');
    expect(root.querySelector('[data-testid="briefing-meta"]')?.textContent).toContain('Resumen automático sin IA');
  });

  it('si el agente falla, la transición se conserva y se avisa', async () => {
    const { fixture, root, click, http } = setup();
    click('start');
    http.expectOne(AGENT_URL).error(new ProgressEvent('error'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('En atención');
    expect(root.querySelector('[data-testid="briefing-error"]')?.textContent).toContain('agente supervisor');
  });

  it('indica que el resumen fue generado con IA y con qué modelo', async () => {
    const { fixture, root, click, http } = setup();
    click('start');
    http.expectOne(AGENT_URL).flush({ ...BRIEFING, source: 'llm', model: 'claude-sonnet-5.5' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="briefing-meta"]')?.textContent).toContain('Generado con IA (claude-sonnet-5.5)');
  });});

