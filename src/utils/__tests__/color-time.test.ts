import { hexToHsv, hsvToHex } from '../color';
import { timeAgo } from '../time';

describe('color conversion', () => {
  it.each(['#9B1B1E', '#FFFFFF', '#000000', '#1E2A4A', '#F6F2EA', '#00FF7F'])('round-trips %s', (hex) => {
    expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });

  it('maps primaries to hues', () => {
    expect(hexToHsv('#FF0000').h).toBe(0);
    expect(hexToHsv('#00FF00').h).toBe(120);
    expect(hexToHsv('#0000FF').h).toBe(240);
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-09-25T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it.each([
    [10_000, 'now'],
    [5 * 60_000, '5m'],
    [3 * 3_600_000, '3h'],
    [4 * 86_400_000, '4d'],
  ])('%dms ago → %s', (ms, label) => {
    expect(timeAgo(ago(ms), now)).toBe(label);
  });

  it('uses dates after a week', () => {
    expect(timeAgo('2026-09-01T12:00:00Z', now)).toBe('Sep 1');
    expect(timeAgo('2025-03-14T12:00:00Z', now)).toBe('Mar 14, 2025');
  });
});
