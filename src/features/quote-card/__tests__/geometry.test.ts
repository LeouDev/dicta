import {
  alignBlock,
  cardSize,
  contentInsets,
  fitSize,
  formatRatio,
  gradientPoints,
  initials,
  overlayStops,
  parseLinearGradient,
  tornStrip,
  unitScale,
  wave,
  withAlpha,
} from '../geometry';

describe('card geometry', () => {
  it('re-lays out formats instead of stretching', () => {
    expect(cardSize('original', '4:5', 1080)).toEqual({ width: 1080, height: 1350 });
    expect(cardSize('original', '9:16', 1080)).toEqual({ width: 1080, height: 1920 });
    expect(cardSize('story', '1:1', 1080)).toEqual({ width: 1080, height: 1920 });
    expect(cardSize('post', '9:16', 1080)).toEqual({ width: 1080, height: 1350 });
    expect(cardSize('square', '4:5', 1080)).toEqual({ width: 1080, height: 1080 });
    expect(formatRatio('original', '1:1')).toBe(1);
    expect(unitScale(540)).toBe(0.5);
  });

  const insets = (o: Partial<Parameters<typeof contentInsets>[0]> = {}) =>
    contentInsets({ format: 'original', frame: 'none', size: { width: 1080, height: 1920 }, scale: 1, padding: 100, topOffset: 0, ...o });

  it('pads by the design, trimming the top and adding the offset', () => {
    expect(insets()).toEqual({ left: 100, right: 100, top: 85, bottom: 100 });
    expect(insets({ topOffset: 0.15 }).top).toBeCloseTo(85 + 1920 * 0.15);
    expect(insets({ scale: 0.5 }).left).toBe(50);
  });

  it('keeps stories clear of the top and bottom UI, except device frames', () => {
    const story = insets({ format: 'story' });
    expect(story.top).toBeCloseTo(85 + 192);
    expect(story.bottom).toBeCloseTo(100 + 1920 * 0.13);
    expect(insets({ format: 'story', frame: 'pager' })).toEqual(insets({ frame: 'pager' }));
  });

  it('puts device-frame text on the screen', () => {
    const pager = insets({ frame: 'pager', size: { width: 1000, height: 1250 } });
    expect(pager.top).toBeCloseTo(0.2 * 1250 + 0.14 * 1000);
    expect(pager.left).toBeCloseTo(145);
    expect(pager.bottom).toBeCloseTo(0.3 * 1250 + 50);
    const lcd = insets({ frame: 'lcd', size: { width: 1000, height: 1250 } });
    expect(lcd.top).toBeCloseTo(0.33 * 1250 + 70);
    expect(lcd.left).toBeCloseTo(100);
    expect(lcd.right).toBeCloseTo(140);
  });

  it('aligns blocks vertically', () => {
    expect(alignBlock('top', 100, 1000, 400)).toBe(100);
    expect(alignBlock('bottom', 100, 1000, 400)).toBe(700);
    expect(alignBlock('center', 100, 1000, 400)).toBe(400);
  });
});

describe('fitSize', () => {
  it('uses the full size when it fits', () => {
    expect(fitSize(100, () => true)).toBe(100);
    expect(fitSize(100, () => true, 1.15)).toBeCloseTo(115);
  });

  it('binary-searches down to within the window', () => {
    const size = fitSize(100, (s) => s <= 73.3);
    expect(size).toBeLessThanOrEqual(73.3);
    expect(size).toBeGreaterThan(73.3 - 0.6);
  });

  it('bottoms out at 20% of the base', () => {
    expect(fitSize(100, () => false)).toBe(20);
  });
});

describe('editorial wave', () => {
  it('follows the spec formula per word', () => {
    expect(wave(0, 1).rotate).toBeCloseTo(5 * Math.sin(1.1));
    expect(wave(3, 0.6).dy).toBeCloseTo(0.6 * 0.08 * Math.cos(3 * 1.7));
    expect(wave(7, 0)).toEqual({ rotate: expect.closeTo(0), dy: expect.closeTo(0) });
  });

  it('stays within ±5° and ±0.08em at full curve', () => {
    for (let i = 0; i < 50; i++) {
      expect(Math.abs(wave(i, 1).rotate)).toBeLessThanOrEqual(5);
      expect(Math.abs(wave(i, 1).dy)).toBeLessThanOrEqual(0.08);
    }
  });
});

describe('backgrounds', () => {
  it('builds the photo overlay, reversed for top text and denser when strong', () => {
    expect(overlayStops('off', 'bottom', false)).toBeNull();
    expect(overlayStops('auto', 'bottom', false)!.colors).toEqual(['#0000001a', '#00000042', '#0000009e']);
    expect(overlayStops('auto', 'top', false)!.colors[0]).toBe('#0000009e');
    expect(overlayStops('strong', 'bottom', true)!.colors).toEqual([withAlpha('#FFFFFF', 0.14), withAlpha('#FFFFFF', 0.364), withAlpha('#FFFFFF', 0.868)]);
  });

  it('computes gradient endpoints like CSS angles', () => {
    const right = gradientPoints(90, { width: 100, height: 50 });
    expect(right.start).toEqual({ x: expect.closeTo(0), y: expect.closeTo(25) });
    expect(right.end).toEqual({ x: expect.closeTo(100), y: expect.closeTo(25) });
    const down = gradientPoints(180, { width: 100, height: 50 }, { x: 10, y: 10 });
    expect(down.start.y).toBeCloseTo(10);
    expect(down.end.y).toBeCloseTo(60);
  });

  it('parses hex linear gradients only', () => {
    expect(parseLinearGradient('linear-gradient(90deg, #111 0%, #8e8e8e 28%, #FFFFFF 100%)')).toEqual({
      angle: 90,
      colors: ['#111111', '#8E8E8E', '#FFFFFF'],
      positions: [0, 0.28, 1],
    });
    expect(parseLinearGradient('linear-gradient(90deg, red 0%, blue 100%)')).toBeNull();
    expect(parseLinearGradient('url(evil)')).toBeNull();
  });

  it('tears a 6%-wide strip down the middle with 60 points per edge', () => {
    const strip = tornStrip({ width: 1000, height: 1250 });
    expect(strip).toHaveLength(120);
    expect(strip[0].y).toBe(0);
    expect(strip[59].y).toBe(1250);
    for (const p of strip.slice(0, 60)) expect(p.x).toBeGreaterThan(470 - 16);
    const meanGap = strip.slice(0, 60).reduce((sum, p, i) => sum + strip[119 - i].x - p.x, 0) / 60;
    expect(meanGap).toBeCloseTo(60, -1);
  });
});

describe('helpers', () => {
  it('adds alpha and initials', () => {
    expect(withAlpha('#1A1714', 0.5)).toBe('#1A171480');
    expect(withAlpha('#abc', 1)).toBe('#AABBCCff');
    expect(initials('Mara Vell')).toBe('MV');
    expect(initials('  ')).toBe('·');
  });
});
