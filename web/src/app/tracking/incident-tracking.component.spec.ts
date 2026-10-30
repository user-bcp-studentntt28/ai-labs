import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Incident } from '../core/models';
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
    return { fixture, root, click, type, tracking: TestBed.inject(TrackingService) };
  }

  it('muestra a la vez el estado local y el estado del API', () => {
    const { root } = setup();
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('Sin atender');
    expect(root.querySelector('[data-testid="api-state"]')?.textContent).toContain('Abierta');
  });

  it('el analista recorre iniciar atención y enviar a revisión', () => {
    const { root, click } = setup();
    click('start');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('En atención');
    click('submit');
    expect(root.querySelector('[data-testid="local-state"]')?.textContent).toContain('En revisión');
    expect(root.querySelector('[data-testid="no-actions"]')).not.toBeNull();
  });

  it('el supervisor no puede aprobar sin nota y el estado no cambia', () => {
    const { root, click, tracking, fixture } = setup();
    click('start');
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
});
