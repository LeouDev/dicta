import { parseQuoteDesign } from '../serialize';
import { applyTemplate, createDesign, suggestedFontSize } from '../templates';
import { DESIGN_LIMITS, TEMPLATE_IDS } from '../types';

const roundTrip = (value: unknown) => parseQuoteDesign(JSON.parse(JSON.stringify(value)));

describe('parseQuoteDesign', () => {
  it.each(TEMPLATE_IDS)('round-trips the %s template unchanged', (id) => {
    const design = createDesign(id);
    expect(roundTrip(design)).toEqual(design);
  });

  it('turns garbage into the editorial defaults', () => {
    for (const input of [null, undefined, 42, 'x', [], { template: 'nope' }]) {
      expect(parseQuoteDesign(input)).toEqual(createDesign('editorial'));
    }
  });

  it('clamps numbers to the editor ranges', () => {
    const d = parseQuoteDesign({ ...createDesign('minimal'), fontSize: 9999, padding: -5, curve: 3, lineHeight: 0 });
    expect(d.fontSize).toBe(DESIGN_LIMITS.fontSize.max);
    expect(d.padding).toBe(DESIGN_LIMITS.padding.min);
    expect(d.curve).toBe(DESIGN_LIMITS.curve.max);
    expect(d.lineHeight).toBe(DESIGN_LIMITS.lineHeight.min);
  });

  it('rejects invalid colors and normalizes case', () => {
    const d = parseQuoteDesign({ ...createDesign('editorial'), textColor: 'red', metaColor: '#abcdef' });
    expect(d.textColor).toBe(createDesign('editorial').textColor);
    expect(d.metaColor).toBe('#ABCDEF');
  });

  it('falls back on unknown fonts and snaps unavailable weights', () => {
    const unknownFont = parseQuoteDesign({ ...createDesign('midnight'), fontFamily: 'comic-sans' });
    expect(unknownFont.fontFamily).toBe('elegant');
    const badWeight = parseQuoteDesign({ ...createDesign('editorial'), fontFamily: 'modern', fontWeight: 300 });
    expect(badWeight.fontWeight).toBe(600);
  });

  it('validates backgrounds', () => {
    const base = createDesign('editorial');
    expect(parseQuoteDesign({ ...base, background: { type: 'gradient', colors: ['#FFFFFF'] } }).background).toEqual({
      type: 'gradient',
      colors: ['#FBD3C1', '#E4C8F2'],
      angle: 135,
    });
    const image = parseQuoteDesign({ ...base, background: { type: 'image', uri: 'javascript:alert(1)', dim: 5 } }).background;
    expect(image).toEqual({ type: 'image', uri: null, path: undefined, dim: DESIGN_LIMITS.dim.max });
    expect(parseQuoteDesign({ ...base, background: { type: 'video' } }).background).toEqual(base.background);
  });

  it('caps the signature length', () => {
    expect(parseQuoteDesign({ ...createDesign('journal'), signature: 'x'.repeat(200) }).signature).toHaveLength(60);
  });
});

describe('templates', () => {
  it('applyTemplate resets style but keeps format, signature and photo', () => {
    const photo = { ...createDesign('photograph'), background: { type: 'image' as const, uri: 'file:///p.jpg', dim: 0.3 } };
    const custom = { ...photo, format: 'story' as const, signature: '— Leou', fontSize: 40 };

    const editorial = applyTemplate(custom, 'editorial');
    expect(editorial).toEqual({ ...createDesign('editorial'), format: 'story', signature: '— Leou' });

    const backToPhoto = applyTemplate(custom, 'photograph');
    expect(backToPhoto.background).toMatchObject({ type: 'image', uri: 'file:///p.jpg' });
  });

  it('suggests smaller type for longer text', () => {
    const sizes = [10, 80, 150, 240, 360, 480].map((n) => suggestedFontSize('editorial', n));
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    expect(sizes[0]).toBeGreaterThan(sizes.at(-1)!);
  });
});
