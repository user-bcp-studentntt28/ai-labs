import { MAX_SCENARIO_AMOUNT_CENTS, MIN_SCENARIO_AMOUNT_CENTS } from '../core/config';
import { ControlMode } from '../core/models';
import { formatCents } from '../core/money';

export const CONTROL_MODES: { value: ControlMode; label: string }[] = [
  { value: 'AMOUNT', label: 'AMOUNT · monto distinto' },
  { value: 'MISSING', label: 'MISSING · falta en reporte' },
  { value: 'DUPLICATE', label: 'DUPLICATE · duplicado' },
  { value: 'CLEAR', label: 'CLEAR · restaurar' },
  { value: 'ORPHAN', label: 'ORPHAN · pago solo proveedor' }
];

export interface ControlInput {
  mode: ControlMode;
  paymentId: string;
  orphanId: string;
  amountCents: string;
}

export interface ControlBody {
  paymentId: string;
  mode: ControlMode;
  amountCents?: number;
}

export type ValidationResult = { valid: true; body: ControlBody } | { valid: false; error: string };

export function modeRequiresAmount(mode: ControlMode): boolean {
  return mode === 'AMOUNT' || mode === 'ORPHAN';
}

const AMOUNT_RANGE_ERROR =
  `El monto debe ser un entero entre ${MIN_SCENARIO_AMOUNT_CENTS} y ${MAX_SCENARIO_AMOUNT_CENTS} céntimos ` +
  `(menor a ${formatCents(MAX_SCENARIO_AMOUNT_CENTS + 1)}).`;

function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  return amount >= MIN_SCENARIO_AMOUNT_CENTS && amount <= MAX_SCENARIO_AMOUNT_CENTS ? amount : null;
}

export function validateControlInput(input: ControlInput): ValidationResult {
  const paymentId = (input.mode === 'ORPHAN' ? input.orphanId : input.paymentId).trim();
  if (!paymentId) {
    return {
      valid: false,
      error: input.mode === 'ORPHAN' ? 'Ingresa un ID nuevo para el pago huérfano.' : 'Selecciona un pago obtenido del API.'
    };
  }
  if (!modeRequiresAmount(input.mode)) {
    return { valid: true, body: { paymentId, mode: input.mode } };
  }
  const amountCents = parseAmount(input.amountCents);
  if (amountCents === null) return { valid: false, error: AMOUNT_RANGE_ERROR };
  return { valid: true, body: { paymentId, mode: input.mode, amountCents } };
}
