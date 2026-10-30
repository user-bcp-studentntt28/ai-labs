import { HttpTestingController } from '@angular/common/http/testing';
import { API_BASE_URL } from '../core/config';
import { INCIDENTS, LEDGER, PAYMENTS, SETTLEMENTS } from './fixtures';

export interface SourceBodies {
  payments?: unknown;
  settlements?: unknown;
  ledger?: unknown;
  incidents?: unknown;
}

export function answerSources(http: HttpTestingController, bodies: SourceBodies = {}): void {
  http.expectOne(r => r.url === `${API_BASE_URL}/payments`).flush(bodies.payments ?? PAYMENTS);
  http.expectOne(`${API_BASE_URL}/settlements`).flush(bodies.settlements ?? SETTLEMENTS);
  http.expectOne(`${API_BASE_URL}/ledger`).flush(bodies.ledger ?? LEDGER);
  http.expectOne(`${API_BASE_URL}/reconciliations/incidents`).flush(bodies.incidents ?? INCIDENTS);
}

export function failSource(http: HttpTestingController, path: string, status = 500): void {
  http.expectOne(r => r.url === `${API_BASE_URL}${path}`).flush('error', { status, statusText: 'Error' });
}

export function nextTurn(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
