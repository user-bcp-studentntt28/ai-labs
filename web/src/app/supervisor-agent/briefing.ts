import { WorkflowAction } from '../tracking/workflow';

export type BriefingEvent = 'STARTED' | 'SUBMITTED';
export type BriefingPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type BriefingSource = 'llm' | 'fallback';

export interface Briefing {
  incidentId: string;
  event: BriefingEvent;
  priority: BriefingPriority;
  headline: string;
  problem: string;
  evidence: string[];
  recommendation: string;
  source: BriefingSource;
  model: string | null;
  generatedAt: string;
}

export interface BriefingRequest {
  incidentId: string;
  paymentId: string;
  reason: string;
  walletId: string;
  event: BriefingEvent;
  analystNote: string | null;
  workflowState: string;
}

export const BRIEFING_EVENT_BY_ACTION: Partial<Record<WorkflowAction, BriefingEvent>> = {
  start: 'STARTED',
  submit: 'SUBMITTED'
};

export const PRIORITY_LABELS: Record<BriefingPriority, string> = {
  HIGH: 'Prioridad alta',
  MEDIUM: 'Prioridad media',
  LOW: 'Prioridad baja'
};

export const EVENT_LABELS: Record<BriefingEvent, string> = {
  STARTED: 'Al iniciar la atención',
  SUBMITTED: 'Al enviar a revisión'
};

const EVENTS: BriefingEvent[] = ['STARTED', 'SUBMITTED'];
const PRIORITIES: BriefingPriority[] = ['HIGH', 'MEDIUM', 'LOW'];
const SOURCES: BriefingSource[] = ['llm', 'fallback'];

export function isBriefing(value: unknown): value is Briefing {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Briefing>;
  return (
    typeof candidate.incidentId === 'string' &&
    EVENTS.includes(candidate.event as BriefingEvent) &&
    PRIORITIES.includes(candidate.priority as BriefingPriority) &&
    typeof candidate.headline === 'string' &&
    typeof candidate.problem === 'string' &&
    Array.isArray(candidate.evidence) &&
    candidate.evidence.every(item => typeof item === 'string') &&
    typeof candidate.recommendation === 'string' &&
    SOURCES.includes(candidate.source as BriefingSource) &&
    (candidate.model === null || typeof candidate.model === 'string') &&
    typeof candidate.generatedAt === 'string'
  );
}
