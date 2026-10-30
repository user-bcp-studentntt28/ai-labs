import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WORKFLOW_STORAGE, WorkflowStorageService } from './workflow-storage.service';
import { emptyRecord } from './workflow';

class ThrowingStorage implements Storage {
  length = 0;
  clear(): void {}
  getItem(): string | null { throw new Error('SecurityError'); }
  key(): string | null { return null; }
  removeItem(): void { throw new Error('SecurityError'); }
  setItem(): void { throw new Error('SecurityError'); }
}

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

function service(storage: Storage | null): WorkflowStorageService {
  TestBed.configureTestingModule({ providers: [{ provide: WORKFLOW_STORAGE, useValue: storage }] });
  return TestBed.inject(WorkflowStorageService);
}

describe('WorkflowStorageService', () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it('sin storage no está disponible, no carga y no guarda', () => {
    const svc = service(null);
    expect(svc.isAvailable()).toBe(false);
    expect(svc.load('3', 'w').records).toEqual({});
    expect(svc.save('3', 'w', 'inc', emptyRecord()).ok).toBe(false);
  });

  it('un storage que lanza excepciones se trata como no disponible', () => {
    const svc = service(new ThrowingStorage());
    expect(svc.isAvailable()).toBe(false);
    expect(svc.load('3', 'w')).toEqual({ records: {}, discarded: [], documentCorrupted: false });
    expect(svc.save('3', 'w', 'inc', emptyRecord()).ok).toBe(false);
  });

  it('guarda y recupera registros por incidencia', () => {
    const svc = service(memory);
    expect(svc.save('3', 'w', 'a', emptyRecord()).ok).toBe(true);
    expect(svc.save('3', 'w', 'b', { state: 'En atención', history: [] }).ok).toBe(true);
    expect(Object.keys(svc.load('3', 'w').records)).toEqual(['a', 'b']);
  });

  it('descarta un documento con versión distinta o forma inválida', () => {
    const svc = service(memory);
    memory.setItem(svc.keyFor('3', 'w'), JSON.stringify({ version: 99, records: {} }));
    expect(svc.load('3', 'w').documentCorrupted).toBe(true);
    memory.setItem(svc.keyFor('3', 'w'), 'null');
    expect(svc.load('3', 'w').documentCorrupted).toBe(true);
  });
});
