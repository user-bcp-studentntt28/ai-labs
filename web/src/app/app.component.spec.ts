import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppComponent } from './app.component';
import { API_BASE_URL } from './core/config';
import { answerSources, nextTurn } from './testing/http-helpers';
import { TrackingService } from './tracking/tracking.service';
import { WORKFLOW_STORAGE } from './tracking/workflow-storage.service';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

describe('AppComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: WORKFLOW_STORAGE, useValue: new MemoryStorage() }]
    });
    http = TestBed.inject(HttpTestingController);
  });

  function render() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('muestra el shell con todos los paneles y no consulta el API al abrir', () => {
    const { root } = render();
    for (const selector of ['app-sources-panel', 'app-execution-panel', 'app-operations-list', 'app-scenario-panel']) {
      expect(root.querySelector(selector), selector).not.toBeNull();
    }
    expect(root.textContent).toContain('API · GRUPO 3');
    expect(root.textContent).toContain('Demo sin autenticación');
    http.expectNone(() => true);
  });

  it('el selector de rol cambia el rol registrado sin pedir credenciales', () => {
    const { fixture, root } = render();
    const select = root.querySelector('#active-role') as HTMLSelectElement;
    select.value = 'SUPERVISOR';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(TestBed.inject(TrackingService).role()).toBe('SUPERVISOR');
    expect(root.querySelector('input[type="password"]')).toBeNull();
  });

  it('flujo completo: cargar, conciliar y revisar en el detalle', async () => {
    const { fixture, root } = render();
    (root.querySelector('#load-sources') as HTMLButtonElement).click();
    answerSources(http);
    await nextTurn();
    fixture.detectChanges();
    expect((root.querySelector('#run-reconciliation') as HTMLButtonElement).disabled).toBe(false);

    (root.querySelector('#run-reconciliation') as HTMLButtonElement).click();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush({ status: 'DIFFERENCES', differences: [{}, {}, {}] });
    await nextTurn();
    answerSources(http);
    await nextTurn();
    fixture.detectChanges();
    expect(root.querySelector('#execution-result')?.textContent).toContain('3 diferencias');

    (root.querySelector('[data-row="pay_2"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="detail"] [data-testid="presentation"]')?.textContent).toContain('Con incidencias');
  });
});
