import {
  alignBlock,
  cardSize,
  contentInsets,
  gradientPoints,
  hashString,
  initials,
  largestFittingScale,
  lineTilts,
  unitScale,
  withAlpha,
} from '../geometry';

describe('card geometry', () => {
  it('derives export sizes from the format', () => {
    expect(cardSize('story', 1080)).toEqual({ width: 1080, height: 1920 });
    expect(cardSize('portrait', 1080)).toEqual({ width: 1080, height: 1350 });
    expect(cardSize('square', 1080)).toEqual({ width: 1080, height: 1080 });
    expect(unitScale(1080)).toBeCloseTo(1.08);
  });

  it('keeps stories clear of Instagram UI', () => {
    const size = cardSize('story', 1080);
    const insets = contentInsets('story', size, 80);
    expect(insets.top).toBeGreaterThanOrEqual(1920 * 0.13);
    expect(insets.bottom).toBeGreaterThanOrEqual(1920 * 0.16);
    expect(contentInsets('square', cardSize('square', 1080), 80)).toEqual({ left: 80, right: 80, top: 80, bottom: 80 });
  });

  it('aligns blocks, centering slightly above middle', () => {
    expect(alignBlock('top', 100, 1000, 400)).toBe(100);
    expect(alignBlock('bottom', 100, 1000, 400)).toBe(700);
    const center = alignBlock('center', 100, 1000, 400);
    expect(center).toBeLessThan(400);
    expect(center).toBeGreaterThan(300);
  });
});

describe('lineTilts', () => {
  it('is deterministic per seed and alternates direction', () => {
    const a = lineTilts(6, 42, 1, 80, 900);
    expect(lineTilts(6, 42, 1, 80, 900)).toEqual(a);
    for (let i = 1; i < a.length; i++) expect(Math.sign(a[i].angle)).toBe(-Math.sign(a[i - 1].angle));
  });

  it('stays within a few degrees and vanishes without curve', () => {
    for (const t of lineTilts(20, hashString('x'), 1, 80, 900)) expect(Math.abs(t.angle)).toBeLessThanOrEqual((1.5 * Math.PI) / 180);
    for (const t of lineTilts(5, 1, 0, 80, 900)) expect(Math.abs(t.angle) + Math.abs(t.dx) + Math.abs(t.dy)).toBe(0);
  });
});

describe('largestFittingScale', () => {
  it('returns 1 when everything fits', () => {
    expect(largestFittingScale(() => true)).toBe(1);
  });

  it('finds the threshold within tolerance', () => {
    const scale = largestFittingScale((s) => s <= 0.73);
    expect(scale).toBeLessThanOrEqual(0.73);
    expect(scale).toBeGreaterThan(0.72);
  });

  it('bottoms out at the minimum', () => {
    expect(largestFittingScale(() => false, 0.4)).toBe(0.4);
  });
});

describe('helpers', () => {
  it('computes gradient endpoints like CSS angles', () => {
    const right = gradientPoints(90, { width: 100, height: 50 });
    expect(right.start.x).toBeCloseTo(0);
    expect(right.start.y).toBeCloseTo(25);
    expect(right.end.x).toBeCloseTo(100);
    expect(right.end.y).toBeCloseTo(25);
    const down = gradientPoints(180, { width: 100, height: 50 });
    expect(down.start.y).toBeCloseTo(0);
    expect(down.end.y).toBeCloseTo(50);
  });

  it('adds alpha and initials', () => {
    expect(withAlpha('#1A1714', 0.5)).toBe('#1A171480');
    expect(withAlpha('#1A1714CC', 1)).toBe('#1A1714ff');
    expect(initials('Mara Vell')).toBe('MV');
    expect(initials('  ')).toBe('·');
  });
});
