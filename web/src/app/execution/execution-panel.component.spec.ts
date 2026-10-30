import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../core/config';
import { SourcesService } from '../sources/sources.service';
import { answerSources, failSource, nextTurn } from '../testing/http-helpers';
import { ExecutionPanelComponent } from './execution-panel.component';

describe('ExecutionPanelComponent', () => {
  let http: HttpTestingController;
  let sources: SourcesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ExecutionPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    sources = TestBed.inject(SourcesService);
  });

  async function loadSources(): Promise<void> {
    const pending = sources.load();
    answerSources(http);
    await pending;
  }

  function render() {
    const fixture = TestBed.createComponent(ExecutionPanelComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('deshabilita la conciliación sin fuentes y lo explica', () => {
    const { root } = render();
    expect((root.querySelector('#run-reconciliation') as HTMLButtonElement).disabled).toBe(true);
    expect(root.querySelector('#run-blocked')).not.toBeNull();
  });

  it('con fuentes cargadas habilita la acción y muestra las métricas', async () => {
    await loadSources();
    const { fixture, root } = render();
    fixture.detectChanges();
    expect((root.querySelector('#run-reconciliation') as HTMLButtonElement).disabled).toBe(false);
    expect(root.querySelector('#metric-payments')?.textContent).toContain('2');
    expect(root.querySelector('#metric-open')?.textContent).toContain('3');
  });

  it('muestra DIFFERENCES con su cantidad tras ejecutar', async () => {
    await loadSources();
    const { fixture, root } = render();
    (root.querySelector('#run-reconciliation') as HTMLButtonElement).click();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush({ status: 'DIFFERENCES', differences: [{}, {}] });
    await nextTurn();
    answerSources(http);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('#execution-result')?.textContent).toContain('DIFFERENCES');
    expect(root.querySelector('#execution-result')?.textContent).toContain('2 diferencias');
    expect(root.querySelector('#metric-result')?.textContent).toContain('DIFFERENCES');
  });

  it('muestra por separado ejecución exitosa y actualización fallida', async () => {
    await loadSources();
    const { fixture, root } = render();
    (root.querySelector('#run-reconciliation') as HTMLButtonElement).click();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush({ status: 'MATCHED', differences: [] });
    await nextTurn();
    failSource(http, '/payments');
    http.expectOne(`${API_BASE_URL}/settlements`).flush([]);
    http.expectOne(`${API_BASE_URL}/ledger`).flush([]);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush([]);
    await nextTurn();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('#execution-result')?.textContent).toContain('se ejecutó');
    expect(root.querySelector('#refresh-error')).not.toBeNull();
    expect(root.querySelector('#execution-error')).toBeNull();
  });

  it('muestra que la conciliación no se ejecutó si el POST falla', async () => {
    await loadSources();
    const { fixture, root } = render();
    (root.querySelector('#run-reconciliation') as HTMLButtonElement).click();
    http.expectOne(`${API_BASE_URL}/reconciliations`).flush('x', { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('#execution-error')?.textContent).toContain('no se ejecutó');
    expect(root.querySelector('#execution-result')).toBeNull();
  });
});
