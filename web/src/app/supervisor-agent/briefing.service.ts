import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { describeHttpError } from '../core/api-errors';
import { AGENT_BASE_URL, AGENT_PATHS, BRIEFING_SCHEMA_VERSION, BRIEFING_STORAGE_PREFIX, GROUP_ID } from '../core/config';
import { Incident } from '../core/models';
import { SourcesService } from '../sources/sources.service';
import { WORKFLOW_STORAGE } from '../tracking/workflow-storage.service';
import { WorkflowAction } from '../tracking/workflow';
import { BRIEFING_EVENT_BY_ACTION, Briefing, BriefingRequest, isBriefing } from './briefing';

export type BriefingStatus = { kind: 'loading' } | { kind: 'error'; message: string };

const AGENT_UNREACHABLE = `No se pudo conectar con el agente supervisor (${AGENT_BASE_URL}). El flujo no se bloquea; el supervisor revisará sin resumen.`;
const AGENT_BAD_RESPONSE = 'El agente supervisor respondió con un formato inesperado. El flujo no se bloquea.';
const BRIEFING_NOT_SAVED = 'No se pudo guardar el resumen del agente en el almacenamiento local.';

type BriefingDocument = { version: number; briefings: Record<string, Briefing> };

@Injectable({ providedIn: 'root' })
export class SupervisorBriefingService {
  private readonly http = inject(HttpClient);
  private readonly sources = inject(SourcesService);
  private readonly storage = inject(WORKFLOW_STORAGE);
  private readonly stored = signal(0);
  private readonly latestRequest = new Map<string, number>();
  private requestCounter = 0;

  readonly statuses = signal<Record<string, BriefingStatus>>({});

  briefingFor(incidentId: string): Briefing | null {
    this.stored();
    return this.load(this.sources.activeWalletId()).briefings[incidentId] ?? null;
  }

  statusFor(incidentId: string): BriefingStatus | null {
    return this.statuses()[incidentId] ?? null;
  }

  // Solo las acciones del analista que cambian el estado generan resumen; el resto se ignora.
  async requestFor(incident: Incident, action: WorkflowAction, workflowState: string, note: string): Promise<void> {
    const event = BRIEFING_EVENT_BY_ACTION[action];
    if (!event) return;

    const walletId = this.sources.activeWalletId();
    const body: BriefingRequest = {
      incidentId: incident.id,
      paymentId: incident.payment_id,
      reason: incident.reason,
      walletId,
      event,
      analystNote: note.trim() || null,
      workflowState
    };
    const ticket = ++this.requestCounter;
    this.latestRequest.set(incident.id, ticket);
    this.setStatus(incident.id, { kind: 'loading' });

    try {
      const response = await firstValueFrom(this.http.post<unknown>(`${AGENT_BASE_URL}${AGENT_PATHS.briefings}`, body));
      if (this.latestRequest.get(incident.id) !== ticket) return;
      this.acceptResponse(walletId, incident.id, response);
    } catch (error) {
      if (this.latestRequest.get(incident.id) !== ticket) return;
      this.setStatus(incident.id, { kind: 'error', message: this.describeError(error) });
    }
  }

  private acceptResponse(walletId: string, incidentId: string, response: unknown): void {
    if (!isBriefing(response) || response.incidentId !== incidentId) {
      this.setStatus(incidentId, { kind: 'error', message: AGENT_BAD_RESPONSE });
      return;
    }
    if (!this.save(walletId, incidentId, response)) {
      this.setStatus(incidentId, { kind: 'error', message: BRIEFING_NOT_SAVED });
      return;
    }
    this.setStatus(incidentId, null);
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) return AGENT_UNREACHABLE;
    return `El agente supervisor no pudo generar el resumen (${describeHttpError(error)}). El flujo no se bloquea.`;
  }

  private setStatus(incidentId: string, status: BriefingStatus | null): void {
    this.statuses.update(current => {
      const rest = { ...current };
      delete rest[incidentId];
      return status ? { ...rest, [incidentId]: status } : rest;
    });
  }

  private keyFor(walletId: string): string {
    return `${BRIEFING_STORAGE_PREFIX}:${GROUP_ID}:${walletId}`;
  }

  private load(walletId: string): BriefingDocument {
    const empty: BriefingDocument = { version: BRIEFING_SCHEMA_VERSION, briefings: {} };
    if (!this.storage) return empty;
    try {
      const raw = this.storage.getItem(this.keyFor(walletId));
      if (raw === null) return empty;
      const parsed = JSON.parse(raw) as Partial<BriefingDocument> | null;
      if (!parsed || parsed.version !== BRIEFING_SCHEMA_VERSION || !parsed.briefings) return empty;
      const valid = Object.entries(parsed.briefings).filter(([, value]) => isBriefing(value));
      return { version: BRIEFING_SCHEMA_VERSION, briefings: Object.fromEntries(valid) };
    } catch {
      return empty;
    }
  }

  private save(walletId: string, incidentId: string, briefing: Briefing): boolean {
    if (!this.storage) return false;
    const document: BriefingDocument = {
      version: BRIEFING_SCHEMA_VERSION,
      briefings: { ...this.load(walletId).briefings, [incidentId]: briefing }
    };
    try {
      this.storage.setItem(this.keyFor(walletId), JSON.stringify(document));
    } catch {
      return false;
    }
    this.stored.update(value => value + 1);
    return true;
  }
}
