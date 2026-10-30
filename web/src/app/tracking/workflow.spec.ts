import { describe, expect, it } from 'vitest';
import { WorkflowAction, WorkflowRecord, WorkflowState, applyTransition, availableActions, emptyRecord, isWorkflowRecord } from './workflow';

const NOW = new Date('2026-10-30T12:00:00Z');
const at = (state: WorkflowState): WorkflowRecord => ({ state, history: [] });

describe('applyTransition: transiciones válidas', () => {
  it('Iniciar atención: Sin atender -> En atención', () => {
    const result = applyTransition(emptyRecord(), 'start', 'ANALYST', '', NOW);
    expect(result.ok && result.record.state).toBe('En atención');
  });

  it('Iniciar atención: Devuelta -> En atención', () => {
    const result = applyTransition(at('Devuelta'), 'start', 'ANALYST', '', NOW);
    expect(result.ok && result.record.state).toBe('En atención');
  });

  it('Enviar a revisión: En atención -> En revisión con nota opcional', () => {
    const result = applyTransition(at('En atención'), 'submit', 'ANALYST', '', NOW);
    expect(result.ok && result.record.state).toBe('En revisión');
  });

  it('Aprobar cierre local: En revisión -> Cerrada localmente con nota', () => {
    const result = applyTransition(at('En revisión'), 'approve', 'SUPERVISOR', 'Evidencia revisada', NOW);
    expect(result.ok && result.record.state).toBe('Cerrada localmente');
  });

  it('Devolver: En revisión -> Devuelta y registra el historial', () => {
    const result = applyTransition(at('En revisión'), 'return', 'SUPERVISOR', 'Falta evidencia', NOW);
    expect(result.ok && result.record.state).toBe('Devuelta');
    expect(result.ok && result.record.history).toEqual([
      {
        role: 'SUPERVISOR',
        action: 'Devolver',
        from: 'En revisión',
        to: 'Devuelta',
        at: NOW.toISOString(),
        note: 'Falta evidencia'
      }
    ]);
  });
});

describe('applyTransition: rechazos', () => {
  it.each<[WorkflowAction, WorkflowState]>([
    ['approve', 'En revisión'],
    ['return', 'En revisión']
  ])('%s rechaza nota vacía o de solo espacios y no cambia el registro', (action, state) => {
    for (const note of ['', '   ']) {
      const result = applyTransition(at(state), action, 'SUPERVISOR', note, NOW);
      expect(result.ok).toBe(false);
    }
  });

  it('rechaza transiciones desde un estado inválido', () => {
    expect(applyTransition(emptyRecord(), 'submit', 'ANALYST', '', NOW).ok).toBe(false);
    expect(applyTransition(at('Cerrada localmente'), 'start', 'ANALYST', '', NOW).ok).toBe(false);
    expect(applyTransition(at('En atención'), 'approve', 'SUPERVISOR', 'x', NOW).ok).toBe(false);
  });

  it('rechaza una acción del otro rol', () => {
    expect(applyTransition(emptyRecord(), 'start', 'SUPERVISOR', '', NOW).ok).toBe(false);
    expect(applyTransition(at('En revisión'), 'approve', 'ANALYST', 'x', NOW).ok).toBe(false);
  });
});

describe('historial y acciones disponibles', () => {
  it('cada transición agrega una entrada con rol, acción, fecha y nota', () => {
    const first = applyTransition(emptyRecord(), 'start', 'ANALYST', ' Revisando ', NOW);
    if (!first.ok) throw new Error('esperado ok');
    const second = applyTransition(first.record, 'submit', 'ANALYST', '', NOW);
    if (!second.ok) throw new Error('esperado ok');
    expect(second.record.history.map(entry => entry.action)).toEqual(['Iniciar atención', 'Enviar a revisión']);
    expect(second.record.history[0].note).toBe('Revisando');
    expect(second.record.history[1].note).toBeUndefined();
  });

  it('lista las acciones según estado y rol', () => {
    expect(availableActions('Sin atender', 'ANALYST')).toEqual(['start']);
    expect(availableActions('Sin atender', 'SUPERVISOR')).toEqual([]);
    expect(availableActions('En revisión', 'SUPERVISOR')).toEqual(['approve', 'return']);
    expect(availableActions('Devuelta', 'ANALYST')).toEqual(['start']);
    expect(availableActions('Cerrada localmente', 'ANALYST')).toEqual([]);
  });

  it('valida la forma de un registro guardado', () => {
    expect(isWorkflowRecord(emptyRecord())).toBe(true);
    expect(isWorkflowRecord({ state: 'Otra', history: [] })).toBe(false);
    expect(isWorkflowRecord({ state: 'Devuelta', history: [{ role: 'X' }] })).toBe(false);
    expect(isWorkflowRecord(null)).toBe(false);
  });
});
