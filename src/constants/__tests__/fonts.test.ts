import { FONT_IDS, FONT_LIBRARY, availableWeights, fontAssets, isFontId, resolveFontFace } from '../fonts';

describe('font library', () => {
  it('only references faces that are actually loaded', () => {
    for (const id of FONT_IDS) {
      for (const face of Object.values(FONT_LIBRARY[id].faces)) {
        expect(fontAssets).toHaveProperty(face);
      }
    }
  });

  it('has a face for every default weight', () => {
    for (const id of FONT_IDS) {
      expect(availableWeights(id)).toContain(FONT_LIBRARY[id].defaultWeight);
    }
  });

  it('resolves the closest available weight', () => {
    expect(resolveFontFace('modern', 600)).toBe('Inter_600SemiBold');
    expect(resolveFontFace('modern', 800)).toBe('Inter_700Bold');
    expect(resolveFontFace('classic', 500)).toBe('LibreBaskerville_400Regular');
    expect(resolveFontFace('editorial', 700)).toBe('DMSerifDisplay_400Regular');
  });

  it('guards font ids from untrusted data', () => {
    expect(isFontId('editorial')).toBe(true);
    expect(isFontId('comic-sans')).toBe(false);
  });
});
