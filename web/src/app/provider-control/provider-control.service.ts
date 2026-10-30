import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorCode, describeHttpError } from '../core/api-errors';
import { API_BASE_URL, API_PATHS } from '../core/config';
import { SourcesService } from '../sources/sources.service';
import { ControlBody } from './validation';

export interface ControlOutcome {
  kind: 'success' | 'neutral' | 'error';
  message: string;
}

const SCOPE_NOTICE =
  'Solo cambió el reporte simulado del proveedor; wallet y ledger no se modificaron. Vuelve a conciliar para ver el resultado.';
const FORMAT_ERROR = 'La respuesta no confirma si el control quedó configurado.';

export function describeControlError(error: unknown, body: ControlBody): string {
  if (!(error instanceof HttpErrorResponse)) return describeHttpError(error);
  const code = apiErrorCode(error);
  if (error.status === 400 && code === 'INVALID_MODE') return `Modo inválido (INVALID_MODE): ${body.mode} no es un escenario permitido.`;
  if (error.status === 404) return `El pago ${body.paymentId} no existe (404).`;
  if (error.status === 409 && code === 'PROVIDER_ALREADY_EXISTS') {
    return `El ID ${body.paymentId} ya existe en el proveedor (409 PROVIDER_ALREADY_EXISTS).`;
  }
  return describeHttpError(error);
}

@Injectable({ providedIn: 'root' })
export class ProviderControlService {
  private readonly http = inject(HttpClient);
  private readonly sources = inject(SourcesService);

  readonly busy = signal(false);
  readonly outcome = signal<ControlOutcome | null>(null);

  async apply(body: ControlBody): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.outcome.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<{ configured?: unknown }>(`${API_BASE_URL}${API_PATHS.controlSettlements}`, body)
      );
      this.outcome.set(this.interpret(response, body));
      if (this.outcome()?.kind !== 'error') await this.sources.load();
    } catch (error) {
      this.outcome.set({ kind: 'error', message: describeControlError(error, body) });
    } finally {
      this.busy.set(false);
    }
  }

  private interpret(response: { configured?: unknown } | null, body: ControlBody): ControlOutcome {
    if (typeof response?.configured !== 'boolean') return { kind: 'error', message: FORMAT_ERROR };
    if (response.configured) {
      return { kind: 'success', message: `Control ${body.mode} aplicado sobre ${body.paymentId}. ${SCOPE_NOTICE}` };
    }
    if (body.mode === 'CLEAR') {
      return { kind: 'neutral', message: `${body.paymentId} no tenía alteración que limpiar. ${SCOPE_NOTICE}` };
    }
    return { kind: 'error', message: 'El API respondió que el control no quedó configurado.' };
  }
}
