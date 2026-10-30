import { HttpErrorResponse } from '@angular/common/http';

const NETWORK_ERROR_MESSAGE =
  'No se pudo conectar al API. Verifica la conexión y que el servicio permita solicitudes desde esta página (CORS).';

export function apiErrorCode(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return '';
  const body = error.error;
  if (body && typeof body === 'object') {
    return String(body.code ?? body.error ?? '');
  }
  return '';
}

export function describeHttpError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error ? error.message : 'Error desconocido.';
  }
  if (error.status === 0) return NETWORK_ERROR_MESSAGE;
  const code = apiErrorCode(error);
  return `HTTP ${error.status}${code ? ` · ${code}` : ''}`;
}
