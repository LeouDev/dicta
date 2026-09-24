import { compactNumber } from '../format';

describe('compactNumber', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1K'],
    [1248, '1.2K'],
    [1299, '1.2K'],
    [82_400, '82.4K'],
    [999_999, '999K'],
    [1_000_000, '1M'],
    [2_550_000_000, '2.5B'],
  ])('%d → %s', (n, expected) => {
    expect(compactNumber(n)).toBe(expected);
  });
});
