import { ENGINE_VERSION, cardImagePath, cardKey, previewImagePath, stableJson } from '../card-key';
import { createDesign } from '../templates';

const author = { displayName: 'Mara', username: 'mara', avatarUrl: null, isVerified: true };
const base = { text: 'Stay soft.', design: createDesign('editorial'), author };

describe('cardKey', () => {
  it('names a version with 14 hex characters, the same however the design’s keys are ordered', () => {
    const key = cardKey(base);
    expect(key).toMatch(/^[0-9a-f]{14}$/);
    const reordered = JSON.parse(JSON.stringify(base.design), (_, value) =>
      value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value,
    );
    expect(cardKey({ ...base, design: reordered })).toBe(key);
  });

  it('matches the design as the database returns it (undefined fields dropped)', () => {
    const withUndefined = { ...base.design, background: { ...base.design.background, path: undefined } };
    expect(cardKey({ ...base, design: withUndefined })).toBe(cardKey(base));
  });

  it('changes with anything the card draws', () => {
    const key = cardKey(base);
    for (const changed of [
      { text: 'Stay soft!' },
      { design: { ...base.design, align: 'right' as const } },
      { author: { ...author, displayName: 'Mara Vell' } },
      { author: { ...author, username: 'maravell' } },
      { author: { ...author, avatarUrl: 'https://x/avatar-2.jpg' } },
      { author: { ...author, isVerified: false } },
    ]) {
      expect(cardKey({ ...base, ...changed })).not.toBe(key);
    }
  });

  it('includes the engine version', () => {
    expect(stableJson([ENGINE_VERSION])).toBe(`[${ENGINE_VERSION}]`);
    expect(stableJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
  });

  it('keeps images in the author’s folder', () => {
    expect(cardImagePath('u1', 'p1', 'k')).toBe('u1/p1-k.jpg');
    expect(previewImagePath('u1', 'p1', 'k')).toBe('u1/p1-k-og.jpg');
  });
});
