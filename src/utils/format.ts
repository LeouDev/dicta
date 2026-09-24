/** 999 → "999", 1248 → "1.2K", 1_000_000 → "1M". Hand-rolled: Hermes' compact notation isn't reliable. */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const value = n / size;
      const rounded = value >= 100 ? Math.floor(value) : Math.floor(value * 10) / 10;
      return `${rounded}${suffix}`.replace('.0', '');
    }
  }
  return String(n);
}
