import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../core/config';
import { answerSources, failSource } from '../testing/http-helpers';
import { SourcesPanelComponent } from './sources-panel.component';

describe('SourcesPanelComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SourcesPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  function render() {
    const fixture = TestBed.createComponent(SourcesPanelComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('muestra wallet por defecto y las cuatro fuentes sin cargar con las faltantes', () => {
    const { root } = render();
    expect((root.querySelector('#wallet-id') as HTMLInputElement).value).toBe('wallet-demo');
    expect(root.querySelectorAll('[data-source]').length).toBe(4);
    expect(root.textContent).toContain('Fuentes que faltan');
  });

  it('al cargar muestra el estado de cada fuente y su fecha de carga', async () => {
    const { fixture, root } = render();
    (root.querySelector('#load-sources') as HTMLButtonElement).click();
    answerSources(http);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelectorAll('.source-pill.loaded').length).toBe(4);
    expect(root.textContent).toContain('Última carga exitosa');
    expect(root.textContent).toContain('Fuentes cargadas');
  });

  it('muestra el error de la fuente que falla y mantiene las faltantes', async () => {
    const { fixture, root } = render();
    (root.querySelector('#load-sources') as HTMLButtonElement).click();
    http.expectOne(r => r.url === `${API_BASE_URL}/payments`).flush([]);
    failSource(http, '/settlements', 500);
    http.expectOne(`${API_BASE_URL}/ledger`).flush([]);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-source="settlements"] .source-error')?.textContent).toContain('500');
    expect(root.textContent).toContain('Fuentes que faltan: Settlements');
  });

  it('usa la wallet escrita por el analista', () => {
    const { fixture, root } = render();
    const input = root.querySelector('#wallet-id') as HTMLInputElement;
    input.value = 'wallet-x';
    input.dispatchEvent(new Event('input'));
    (root.querySelector('#load-sources') as HTMLButtonElement).click();
    const req = http.expectOne(r => r.url === `${API_BASE_URL}/payments`);
    expect(req.request.params.get('walletId')).toBe('wallet-x');
    req.flush([]);
    http.expectOne(`${API_BASE_URL}/settlements`).flush([]);
    http.expectOne(`${API_BASE_URL}/ledger`).flush([]);
    http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush([]);
    fixture.detectChanges();
  });
});
