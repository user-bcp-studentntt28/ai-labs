import { describe, expect, it } from 'vitest';
import { ControlInput, modeRequiresAmount, validateControlInput } from './validation';

const base: ControlInput = { mode: 'AMOUNT', paymentId: 'pay_1', orphanId: '', amountCents: '1600' };

describe('validateControlInput', () => {
  it('AMOUNT válido envía paymentId, mode y amountCents', () => {
    expect(validateControlInput(base)).toEqual({
      valid: true,
      body: { paymentId: 'pay_1', mode: 'AMOUNT', amountCents: 1600 }
    });
  });

  it.each(['MISSING', 'DUPLICATE', 'CLEAR'] as const)('%s se envía sin amountCents', mode => {
    const result = validateControlInput({ ...base, mode, amountCents: '' });
    expect(result).toEqual({ valid: true, body: { paymentId: 'pay_1', mode } });
  });

  it('acepta los límites 1 y 49999', () => {
    expect(validateControlInput({ ...base, amountCents: '1' }).valid).toBe(true);
    expect(validateControlInput({ ...base, amountCents: '49999' }).valid).toBe(true);
  });

  it.each(['0', '-5', '50000', '100000000', '12.5', 'abc', ''])('rechaza amountCents %j', amountCents => {
    const result = validateControlInput({ ...base, amountCents });
    expect(result.valid).toBe(false);
    expect(!result.valid && result.error).toContain('49999');
  });

  it('rechaza si no hay pago seleccionado', () => {
    const result = validateControlInput({ ...base, paymentId: '  ' });
    expect(result.valid).toBe(false);
  });

  it('ORPHAN usa el ID nuevo y exige monto válido', () => {
    expect(validateControlInput({ mode: 'ORPHAN', paymentId: 'pay_1', orphanId: ' pay_new ', amountCents: '900' })).toEqual({
      valid: true,
      body: { paymentId: 'pay_new', mode: 'ORPHAN', amountCents: 900 }
    });
    expect(validateControlInput({ mode: 'ORPHAN', paymentId: 'pay_1', orphanId: '', amountCents: '900' }).valid).toBe(false);
    expect(validateControlInput({ mode: 'ORPHAN', paymentId: '', orphanId: 'pay_new', amountCents: '0' }).valid).toBe(false);
  });

  it('indica qué modos requieren monto', () => {
    expect(modeRequiresAmount('AMOUNT')).toBe(true);
    expect(modeRequiresAmount('ORPHAN')).toBe(true);
    expect(modeRequiresAmount('CLEAR')).toBe(false);
  });
});
