const CENTS_PER_SOL = 100;

export function formatCents(cents: number): string {
  return `S/ ${(cents / CENTS_PER_SOL).toFixed(2)}`;
}
