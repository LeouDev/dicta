import { FONT_KEYS, FONT_LIBRARY, UI_FACES, availableWeights, fontAssets, hasItalic, isFontKey, resolveFace } from '../fonts';

describe('font library', () => {
  it('only references faces that are actually loaded', () => {
    for (const key of FONT_KEYS) {
      const font = FONT_LIBRARY[key];
      const faces = [...Object.values(font.faces), ...Object.values('italics' in font ? font.italics : {})];
      for (const face of faces) expect(fontAssets).toHaveProperty(face);
    }
    for (const face of Object.values(UI_FACES)) expect(fontAssets).toHaveProperty(face);
  });

  it('has the 13 spec fonts, each with a face for its default weight', () => {
    expect(FONT_KEYS).toHaveLength(13);
    for (const key of FONT_KEYS) expect(availableWeights(key)).toContain(FONT_LIBRARY[key].defaultWeight);
  });

  it('uses monospace word gaps for mono faces', () => {
    expect(FONT_LIBRARY.typewriter.wordGap).toBe(0.6);
    expect(FONT_LIBRARY.lcd.wordGap).toBe(0.5);
    expect(FONT_LIBRARY.pixel.wordGap).toBe(0.5);
    expect(FONT_LIBRARY.editorial.wordGap).toBe(0.25);
  });

  it('resolves the closest available weight and italics', () => {
    expect(resolveFace('modern', 600)).toBe('InstrumentSans_600SemiBold');
    expect(resolveFace('modern', 900)).toBe('InstrumentSans_700Bold');
    expect(resolveFace('bold', 800, true)).toBe('Archivo_800ExtraBold_Italic');
    expect(resolveFace('editorial', 700, true)).toBe('SourceSerif4_400Regular_Italic');
    // No italic cut: falls back to upright.
    expect(hasItalic('rounded')).toBe(false);
    expect(resolveFace('rounded', 800, true)).toBe('Nunito_800ExtraBold');
  });

  it('guards font keys from untrusted data', () => {
    expect(isFontKey('editorial')).toBe(true);
    expect(isFontKey('comic-sans')).toBe(false);
    expect(isFontKey('constructor')).toBe(false);
  });
});
