import { parseQuoteDesign } from '../serialize';
import { TEMPLATES, applyTemplate, createDesign } from '../templates';
import { DESIGN_LIMITS, TEMPLATE_IDS } from '../types';

const roundTrip = (value: unknown) => parseQuoteDesign(JSON.parse(JSON.stringify(value)));

describe('parseQuoteDesign', () => {
  it.each(TEMPLATE_IDS)('round-trips the %s template unchanged', (id) => {
    const design = createDesign(id);
    expect(roundTrip(design)).toEqual(design);
  });

  it('turns garbage into the editorial defaults', () => {
    for (const input of [null, undefined, 42, 'x', [], { version: 2, template: 'nope' }, { font: 'constructor' }]) {
      expect(parseQuoteDesign(input)).toEqual(createDesign('editorial'));
    }
  });

  it('clamps numbers to the editor ranges', () => {
    const d = parseQuoteDesign({ ...createDesign('minimal'), size: 9999, padding: -5, curve: 3, lineHeight: 0, header: { scale: 99 } });
    expect(d.size).toBe(DESIGN_LIMITS.size.max);
    expect(d.padding).toBe(DESIGN_LIMITS.padding.min);
    expect(d.curve).toBe(DESIGN_LIMITS.curve.max);
    expect(d.lineHeight).toBe(DESIGN_LIMITS.lineHeight.min);
    expect(d.header.scale).toBe(DESIGN_LIMITS.headerScale.max);
    expect(parseQuoteDesign({ ...createDesign('editorial'), size: NaN }).size).toBe(createDesign('editorial').size);
  });

  it('rejects invalid colors and paints, normalizing case', () => {
    const base = createDesign('editorial');
    const d = parseQuoteDesign({ ...base, textColor: 'red', highlight: '#abcdef', kickerColor: 'url(x)' });
    expect(d.textColor).toBe(base.textColor);
    expect(d.highlight).toBe('#ABCDEF');
    expect(d.kickerColor).toBe(base.kickerColor);
    expect(parseQuoteDesign({ ...base, textFill: 'linear-gradient(90deg, #111 0%, #fff 100%)' }).textFill).toBe('linear-gradient(90deg, #111 0%, #fff 100%)');
    expect(parseQuoteDesign({ ...base, textFill: 'linear-gradient(90deg, url(x) 0%)' }).textFill).toBeNull();
    expect(parseQuoteDesign({ ...base, glow: 'rgba(255, 220, 150, .5)' }).glow).toBe('rgba(255, 220, 150, .5)');
    expect(parseQuoteDesign({ ...base, glow: 'expression(alert(1))' }).glow).toBeNull();
  });

  it('falls back on unknown fonts, snaps weights and drops italics the face lacks', () => {
    expect(parseQuoteDesign({ ...createDesign('midnight'), font: 'comic-sans' }).font).toBe('elegant');
    expect(parseQuoteDesign({ ...createDesign('editorial'), font: 'modern', weight: 300 }).weight).toBe(400);
    expect(parseQuoteDesign({ ...createDesign('editorial'), font: 'rounded', italic: true }).italic).toBe(false);
  });

  it('only renders http(s) and local photos', () => {
    const base = createDesign('photograph');
    expect(parseQuoteDesign({ ...base, background: { type: 'image', image: 'javascript:alert(1)' } }).background.image).toBeNull();
    expect(parseQuoteDesign({ ...base, background: { type: 'image', image: 'https://x.co/a.jpg' } }).background.image).toBe('https://x.co/a.jpg');
    expect(parseQuoteDesign({ ...base, background: { type: 'video' } }).background.type).toBe('image');
  });

  it('caps the signature length', () => {
    const d = parseQuoteDesign({ ...createDesign('journal'), signature: { show: true, text: 'x'.repeat(200) } });
    expect(d.signature.text).toHaveLength(60);
  });

  it('upgrades version 1 designs', () => {
    const v1 = {
      version: 1,
      template: 'editorial',
      format: 'story',
      fontFamily: 'editorial',
      fontSize: 84,
      fontWeight: 400,
      letterSpacing: -0.018,
      lineHeight: 1.02,
      textAlign: 'center',
      textColor: '#8A0F10',
      metaColor: '#141414',
      background: { type: 'image', uri: 'https://x.co/p.jpg', path: 'u/p.jpg', dim: 0.7 },
      texture: 'noise',
      textureIntensity: 0.45,
      verticalAlign: 'bottom',
      padding: 80,
      textWidth: 0.96,
      curve: 0.7,
      showProfile: true,
      showAvatar: false,
      showUsername: true,
      showVerifiedBadge: false,
      headerSize: 190 / 1.08,
      showSignature: true,
      signature: '— M',
    };
    const d = parseQuoteDesign(v1);
    expect(d).toMatchObject({
      version: 2,
      template: 'editorial',
      canvas: '9:16',
      font: 'display',
      weight: 400,
      size: expect.closeTo(84 * 1.08),
      padding: expect.closeTo(80 * 1.08),
      align: 'center',
      vAlign: 'bottom',
      textColor: '#8A0F10',
      curve: 0.7,
      texture: { type: 'grain', strength: 0.45 },
      background: { type: 'image', image: 'https://x.co/p.jpg', path: 'u/p.jpg', overlay: 'strong' },
      header: { show: true, avatar: false, username: true, verified: false, scale: expect.closeTo(1) },
      signature: { show: true, text: '— M' },
    });
    const gradient = parseQuoteDesign({ ...v1, background: { type: 'gradient', colors: ['#111111', '#222222', '#333333'], angle: 135 } });
    expect(gradient.background).toMatchObject({ type: 'gradient', color: '#111111', color2: '#333333', angle: 135 });
    expect(parseQuoteDesign({ ...v1, fontFamily: 'handwritten', format: 'square' })).toMatchObject({ font: 'hand', canvas: '1:1' });
  });
});

describe('templates', () => {
  it('has all 18 templates, each with a sample and a valid design', () => {
    expect(TEMPLATE_IDS).toHaveLength(18);
    for (const id of TEMPLATE_IDS) {
      expect(TEMPLATES[id].sample.length).toBeGreaterThan(0);
      expect(parseQuoteDesign(createDesign(id))).toEqual(createDesign(id));
    }
  });

  it('matches the spec values for a few templates', () => {
    expect(createDesign('editorial')).toMatchObject({ font: 'editorial', weight: 700, size: 92, curve: 0.6, textColor: '#9B1B1E', canvas: '4:5' });
    expect(createDesign('diptych').background).toMatchObject({ type: 'split', color: '#0D0D0D', color2: '#23439B' });
    expect(createDesign('pager').frame).toBe('pager');
    expect(createDesign('notification').frame).toBe('notification');
  });

  it('applyTemplate restyles but keeps header toggles, signature, canvas and photo', () => {
    const custom = {
      ...createDesign('photograph'),
      canvas: '9:16' as const,
      background: { ...createDesign('photograph').background, image: 'file:///p.jpg', path: 'u/p.jpg' },
      header: { ...createDesign('photograph').header, avatar: false, scale: 1.4 },
      signature: { show: true, text: '— Leou', style: 'caps' as const },
      size: 40,
    };

    const editorial = applyTemplate(custom, 'editorial');
    expect(editorial).toEqual({
      ...createDesign('editorial'),
      canvas: '9:16',
      header: { ...createDesign('editorial').header, avatar: false },
      signature: { ...createDesign('editorial').signature, show: true, text: '— Leou' },
    });

    expect(applyTemplate(custom, 'photograph').background).toMatchObject({ type: 'image', image: 'file:///p.jpg', path: 'u/p.jpg' });
  });
});
