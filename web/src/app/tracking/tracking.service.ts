import { Injectable, computed, inject, signal } from '@angular/core';
import { GROUP_ID } from '../core/config';
import { Role } from '../core/models';
import { SourcesService } from '../sources/sources.service';
import { WorkflowStorageService } from './workflow-storage.service';
import { WorkflowAction, WorkflowRecord, applyTransition, emptyRecord } from './workflow';

export type PerformResult = { ok: true } | { ok: false; error: string };

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly sources = inject(SourcesService);
  private readonly storage = inject(WorkflowStorageService);
  private readonly version = signal(0);

  readonly role = signal<Role>('ANALYST');

  private readonly loadResult = computed(() => {
    this.version();
    return this.storage.load(GROUP_ID, this.sources.activeWalletId());
  });

  readonly storageAvailable = computed(() => {
    this.version();
    return this.storage.isAvailable();
  });

  readonly discardNotice = computed(() => {
    const { discarded, documentCorrupted } = this.loadResult();
    if (documentCorrupted) return 'El seguimiento local guardado para esta wallet estaba dañado y se descartó.';
    if (discarded.length === 0) return null;
    return `Se descartaron ${discarded.length} registro(s) de seguimiento dañados: ${discarded.join(', ')}.`;
  });

  recordFor(incidentId: string): WorkflowRecord {
    return this.loadResult().records[incidentId] ?? emptyRecord();
  }

  perform(incidentId: string, action: WorkflowAction, note: string): PerformResult {
    const transition = applyTransition(this.recordFor(incidentId), action, this.role(), note, new Date());
    if (!transition.ok) return transition;

    const saved = this.storage.save(GROUP_ID, this.sources.activeWalletId(), incidentId, transition.record);
    if (!saved.ok) return saved;

    this.version.update(value => value + 1);
    return { ok: true };
  }
}
