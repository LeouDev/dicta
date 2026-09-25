import { Skia, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { fontAssets } from '@/constants/fonts';

let provider: SkTypefaceFontProvider | null = null;
let loading: Promise<SkTypefaceFontProvider> | null = null;

/**
 * Loads every bundled face into one Skia font provider, once per app run.
 * Each face is registered under its expo-font key (e.g. "InstrumentSans_600SemiBold"),
 * so the renderer and app UI share exactly one font naming scheme.
 */
export function loadCardFonts(): Promise<SkTypefaceFontProvider> {
  if (provider) return Promise.resolve(provider);
  loading ??= Promise.all(
    Object.entries(fontAssets).map(async ([name, asset]) => {
      const data = await Skia.Data.fromURI(Image.resolveAssetSource(asset).uri);
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (!typeface) throw new Error(`Couldn't load font ${name}`);
      return [name, typeface] as const;
    }),
  ).then(
    (faces) => {
      const fonts = Skia.TypefaceFontProvider.Make();
      for (const [name, typeface] of faces) fonts.registerFont(typeface, name);
      provider = fonts;
      return fonts;
    },
    (error: unknown) => {
      loading = null; // allow a retry on the next render
      throw error;
    },
  );
  return loading;
}

export function useCardFonts(): SkTypefaceFontProvider | null {
  const [fonts, setFonts] = useState(provider);
  useEffect(() => {
    if (fonts) return;
    let alive = true;
    loadCardFonts().then(
      (loaded) => alive && setFonts(loaded),
      (error: unknown) => console.warn('Card fonts failed to load', error),
    );
    return () => {
      alive = false;
    };
  }, [fonts]);
  return fonts;
}
