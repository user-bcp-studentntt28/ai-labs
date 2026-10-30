import { describe, expect, it } from 'vitest';
import { formatCents } from './money';

describe('formatCents', () => {
  it('muestra 1500 céntimos como S/ 15.00', () => {
    expect(formatCents(1500)).toBe('S/ 15.00');
  });

  it('cubre 0 y 1 céntimo', () => {
    expect(formatCents(0)).toBe('S/ 0.00');
    expect(formatCents(1)).toBe('S/ 0.01');
  });
});
