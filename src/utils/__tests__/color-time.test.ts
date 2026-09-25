import { hexToHsv, hsvToHex } from '../color';
import { spokenTimeAgo, timeAgo } from '../time';

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
  // Local time, so "yesterday" is a calendar day wherever the tests run.
  const now = new Date(2026, 8, 25, 12, 0, 0).getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it.each([
    [10_000, 'just now'],
    [5 * 60_000, '5m'],
    [2 * 3_600_000, '2h'],
    [23 * 3_600_000 + 59 * 60_000, '23h'],
  ])('%dms ago → %s', (ms, label) => {
    expect(timeAgo(ago(ms), now)).toBe(label);
  });

  it('says Yesterday for the previous calendar day, then the date', () => {
    expect(timeAgo(new Date(2026, 8, 24, 9, 0).toISOString(), now)).toBe('Yesterday');
    expect(timeAgo(new Date(2026, 8, 23, 20, 0).toISOString(), now)).toBe('Sep 23');
    expect(timeAgo(new Date(2026, 8, 1, 12, 0).toISOString(), now)).toBe('Sep 1');
    expect(timeAgo(new Date(2025, 2, 14, 12, 0).toISOString(), now)).toBe('Mar 14, 2025');
  });

  it('has a spoken form for VoiceOver', () => {
    expect(spokenTimeAgo(ago(10_000), now)).toBe('just now');
    expect(spokenTimeAgo(ago(60_000), now)).toBe('1 minute ago');
    expect(spokenTimeAgo(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(spokenTimeAgo(ago(2 * 3_600_000), now)).toBe('2 hours ago');
    expect(spokenTimeAgo(new Date(2026, 8, 24, 9, 0).toISOString(), now)).toBe('yesterday');
    expect(spokenTimeAgo(new Date(2026, 8, 1, 12, 0).toISOString(), now)).toBe('on Sep 1');
  });
});
