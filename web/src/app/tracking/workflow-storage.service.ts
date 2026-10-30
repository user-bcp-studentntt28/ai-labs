import { Injectable, InjectionToken, inject } from '@angular/core';
import { WORKFLOW_SCHEMA_VERSION, WORKFLOW_STORAGE_PREFIX } from '../core/config';
import { WorkflowRecord, isWorkflowRecord } from './workflow';

export const WORKFLOW_STORAGE = new InjectionToken<Storage | null>('WORKFLOW_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
});

export interface WorkflowLoadResult {
  records: Record<string, WorkflowRecord>;
  discarded: string[];
  documentCorrupted: boolean;
}

export type WorkflowSaveResult = { ok: true } | { ok: false; error: string };

const STORAGE_UNAVAILABLE = 'El almacenamiento local no está disponible; la transición no se guardó.';
const STORAGE_WRITE_FAILED = 'No se pudo escribir en el almacenamiento local; la transición no se guardó.';
const PROBE_KEY = `${WORKFLOW_STORAGE_PREFIX}:probe`;

const emptyLoad = (): WorkflowLoadResult => ({ records: {}, discarded: [], documentCorrupted: false });

@Injectable({ providedIn: 'root' })
export class WorkflowStorageService {
  private readonly storage = inject(WORKFLOW_STORAGE);

  keyFor(groupId: string, walletId: string): string {
    return `${WORKFLOW_STORAGE_PREFIX}:${groupId}:${walletId}`;
  }

  isAvailable(): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(PROBE_KEY, '1');
      this.storage.removeItem(PROBE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  load(groupId: string, walletId: string): WorkflowLoadResult {
    if (!this.storage) return emptyLoad();
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.keyFor(groupId, walletId));
    } catch {
      return emptyLoad();
    }
    if (raw === null) return emptyLoad();
    return this.parse(raw);
  }

  save(groupId: string, walletId: string, incidentId: string, record: WorkflowRecord): WorkflowSaveResult {
    if (!this.storage || !this.isAvailable()) return { ok: false, error: STORAGE_UNAVAILABLE };
    const current = this.load(groupId, walletId);
    const document = {
      version: WORKFLOW_SCHEMA_VERSION,
      records: { ...current.records, [incidentId]: record }
    };
    try {
      this.storage.setItem(this.keyFor(groupId, walletId), JSON.stringify(document));
      return { ok: true };
    } catch {
      return { ok: false, error: STORAGE_WRITE_FAILED };
    }
  }

  // Un registro dañado se descarta solo para esa incidencia; el resto sigue disponible.
  private parse(raw: string): WorkflowLoadResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...emptyLoad(), documentCorrupted: true };
    }
    const document = parsed as { version?: number; records?: unknown } | null;
    if (!document || document.version !== WORKFLOW_SCHEMA_VERSION || !document.records || typeof document.records !== 'object') {
      return { ...emptyLoad(), documentCorrupted: true };
    }
    const result = emptyLoad();
    for (const [incidentId, value] of Object.entries(document.records)) {
      if (isWorkflowRecord(value)) result.records[incidentId] = value;
      else result.discarded.push(incidentId);
    }
    return result;
  }
}
