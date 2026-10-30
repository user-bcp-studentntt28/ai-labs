import { Role } from '../core/models';

export type WorkflowState = 'Sin atender' | 'En atención' | 'En revisión' | 'Cerrada localmente' | 'Devuelta';
export type WorkflowAction = 'start' | 'submit' | 'approve' | 'return';

export interface HistoryEntry {
  role: Role;
  action: string;
  from: WorkflowState;
  to: WorkflowState;
  at: string;
  note?: string;
}

export interface WorkflowRecord {
  state: WorkflowState;
  history: HistoryEntry[];
}

interface ActionRule {
  label: string;
  from: WorkflowState[];
  to: WorkflowState;
  role: Role;
  noteRequired: boolean;
}

export const INITIAL_STATE: WorkflowState = 'Sin atender';

export const WORKFLOW_ACTIONS: Record<WorkflowAction, ActionRule> = {
  start: { label: 'Iniciar atención', from: ['Sin atender', 'Devuelta'], to: 'En atención', role: 'ANALYST', noteRequired: false },
  submit: { label: 'Enviar a revisión', from: ['En atención'], to: 'En revisión', role: 'ANALYST', noteRequired: false },
  approve: { label: 'Aprobar cierre local', from: ['En revisión'], to: 'Cerrada localmente', role: 'SUPERVISOR', noteRequired: true },
  return: { label: 'Devolver', from: ['En revisión'], to: 'Devuelta', role: 'SUPERVISOR', noteRequired: true }
};

export const WORKFLOW_STATES: WorkflowState[] = [
  'Sin atender',
  'En atención',
  'En revisión',
  'Cerrada localmente',
  'Devuelta'
];

export type TransitionResult = { ok: true; record: WorkflowRecord } | { ok: false; error: string };

export function emptyRecord(): WorkflowRecord {
  return { state: INITIAL_STATE, history: [] };
}

export function availableActions(state: WorkflowState, role: Role): WorkflowAction[] {
  return (Object.keys(WORKFLOW_ACTIONS) as WorkflowAction[]).filter(action => {
    const rule = WORKFLOW_ACTIONS[action];
    return rule.role === role && rule.from.includes(state);
  });
}

export function applyTransition(
  record: WorkflowRecord,
  action: WorkflowAction,
  role: Role,
  note: string,
  now: Date
): TransitionResult {
  const rule = WORKFLOW_ACTIONS[action];
  if (!rule.from.includes(record.state)) {
    return { ok: false, error: `No se puede «${rule.label}» desde el estado ${record.state}.` };
  }
  if (rule.role !== role) {
    return { ok: false, error: `«${rule.label}» corresponde al rol ${rule.role === 'ANALYST' ? 'Analista' : 'Supervisor'}.` };
  }
  const cleanNote = note.trim();
  if (rule.noteRequired && !cleanNote) {
    return { ok: false, error: `«${rule.label}» requiere una nota.` };
  }
  const entry: HistoryEntry = {
    role,
    action: rule.label,
    from: record.state,
    to: rule.to,
    at: now.toISOString(),
    ...(cleanNote ? { note: cleanNote } : {})
  };
  return { ok: true, record: { state: rule.to, history: [...record.history, entry] } };
}

export function isWorkflowRecord(value: unknown): value is WorkflowRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkflowRecord>;
  return (
    WORKFLOW_STATES.includes(candidate.state as WorkflowState) &&
    Array.isArray(candidate.history) &&
    candidate.history.every(
      entry =>
        entry &&
        typeof entry.action === 'string' &&
        typeof entry.at === 'string' &&
        (entry.role === 'ANALYST' || entry.role === 'SUPERVISOR')
    )
  );
}
