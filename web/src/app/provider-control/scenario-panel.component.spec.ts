import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../core/config';
import { SourcesService } from '../sources/sources.service';
import { answerSources, nextTurn } from '../testing/http-helpers';
import { ScenarioPanelComponent } from './scenario-panel.component';

describe('ScenarioPanelComponent', () => {
  let http: HttpTestingController;
  let sources: SourcesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ScenarioPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    sources = TestBed.inject(SourcesService);
  });

  async function render() {
    const pending = sources.load();
    answerSources(http);
    await pending;
    const fixture = TestBed.createComponent(ScenarioPanelComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const set = (selector: string, value: string, event: string) => {
      const el = root.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
      el.value = value;
      el.dispatchEvent(new Event(event));
      fixture.detectChanges();
    };
    const apply = () => {
      (root.querySelector('#apply-scenario') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    return { fixture, root, set, apply };
  }

  it('lista los pagos del API y el campo de monto para AMOUNT', async () => {
    const { root } = await render();
    expect(root.querySelectorAll('#scenario-payment option').length).toBe(3);
    expect(root.querySelector('#scenario-amount')).not.toBeNull();
  });

  it('no envía la solicitud con un monto fuera de rango y muestra el error', async () => {
    const { root, set, apply } = await render();
    set('#scenario-payment', 'pay_1', 'change');
    set('#scenario-amount', '50000', 'input');
    apply();
    http.expectNone(`${API_BASE_URL}/control/settlements`);
    expect(root.querySelector('#scenario-validation')?.textContent).toContain('49999');
  });

  it('envía AMOUNT válido y muestra el mensaje de alcance', async () => {
    const { fixture, root, set, apply } = await render();
    set('#scenario-payment', 'pay_1', 'change');
    set('#scenario-amount', '1600', 'input');
    apply();
    const req = http.expectOne(`${API_BASE_URL}/control/settlements`);
    expect(req.request.body).toEqual({ paymentId: 'pay_1', mode: 'AMOUNT', amountCents: 1600 });
    req.flush({ configured: true });
    await nextTurn();
    answerSources(http);
    await nextTurn();
    fixture.detectChanges();
    expect(root.querySelector('#scenario-outcome')?.textContent).toContain('reporte simulado del proveedor');
    expect(root.querySelector('#scenario-outcome')?.textContent).toContain('Vuelve a conciliar');
  });

  it('MISSING oculta el monto y se envía sin amountCents', async () => {
    const { root, set, apply } = await render();
    set('#scenario-mode', 'MISSING', 'change');
    expect(root.querySelector('#scenario-amount')).toBeNull();
    set('#scenario-payment', 'pay_2', 'change');
    apply();
    expect(http.expectOne(`${API_BASE_URL}/control/settlements`).request.body).toEqual({ paymentId: 'pay_2', mode: 'MISSING' });
  });

  it('ORPHAN pide un ID nuevo, deshabilita el selector de pago y muestra el 409', async () => {
    const { fixture, root, set, apply } = await render();
    set('#scenario-mode', 'ORPHAN', 'change');
    expect((root.querySelector('#scenario-payment') as HTMLSelectElement).disabled).toBe(true);
    apply();
    expect(root.querySelector('#scenario-validation')?.textContent).toContain('ID nuevo');
    set('#orphan-id', 'pay_dup', 'input');
    set('#scenario-amount', '900', 'input');
    apply();
    http.expectOne(`${API_BASE_URL}/control/settlements`).flush({ code: 'PROVIDER_ALREADY_EXISTS' }, { status: 409, statusText: 'Conflict' });
    await nextTurn();
    fixture.detectChanges();
    expect(root.querySelector('#scenario-outcome')?.textContent).toContain('PROVIDER_ALREADY_EXISTS');
    expect(root.querySelector('#scenario-outcome')?.classList.contains('error')).toBe(true);
  });
});
