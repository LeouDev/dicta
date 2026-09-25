/**
 * The website's card renderer: the app's own layout engine and Skia canvas
 * (src/features/quote-card) running on CanvasKit in Node, so a post's image on
 * the web is drawn by the same code as the card in the app. build.mjs bundles
 * this file, with CanvasKit and the fonts, into dist/render.mjs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { NotoColorEmoji_400Regular } from '@expo-google-fonts/noto-color-emoji/400Regular';
import { NotoSans_400Regular } from '@expo-google-fonts/noto-sans/400Regular';
import { NotoSansArabic_400Regular } from '@expo-google-fonts/noto-sans-arabic/400Regular';
import { NotoSansJP_400Regular } from '@expo-google-fonts/noto-sans-jp/400Regular';
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr/400Regular';
import { NotoSansSC_400Regular } from '@expo-google-fonts/noto-sans-sc/400Regular';
import { ImageFormat, Skia, type SkImage, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { drawOffscreen, makeOffscreenSurface } from '@shopify/react-native-skia/lib/module/headless';
import type { ReactElement } from 'react';

import { fontAssets } from '@/constants/fonts';
import { showsAvatar } from '@/features/quote-card/geometry';
import { layoutCard, setFallbackFamilies, type CardLayout } from '@/features/quote-card/layout';
import { LinkPreview, PREVIEW_SIZE, previewCardSize } from '@/features/quote-card/link-preview';
import { QuoteCanvas } from '@/features/quote-card/quote-canvas';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import type { Format, QuoteDesign } from '@/features/quote-card/types';
import { toAuthor } from '@/services/author';

export { PREVIEW_SIZE };

/** Same width as the app's exports. */
export const CARD_WIDTH = 1080;

/**
 * Faces for characters a card's own face lacks. iOS falls back to its system
 * fonts; here Noto stands in, loaded only when a card needs it (the Chinese,
 * Japanese and Korean faces are 5–10 MB each). A face is never replaced where
 * it has the glyph: these are only tried for missing ones.
 */
const HAN_KANA = /[\u3000-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]|[\u{20000}-\u{3134F}]/u;
const FALLBACK_FACES = [
  { family: 'NotoSans', asset: NotoSans_400Regular, needed: () => true },
  { family: 'NotoSansArabic', asset: NotoSansArabic_400Regular, needed: (t: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(t) },
  { family: 'NotoSansSC', asset: NotoSansSC_400Regular, needed: (t: string) => HAN_KANA.test(t) },
  { family: 'NotoSansJP', asset: NotoSansJP_400Regular, needed: (t: string) => HAN_KANA.test(t) },
  { family: 'NotoSansKR', asset: NotoSansKR_400Regular, needed: (t: string) => /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(t) },
  { family: 'NotoColorEmoji', asset: NotoColorEmoji_400Regular, needed: (t: string) => /\p{Extended_Pictographic}/u.test(t) },
];
// The order to try them in, by paragraph language (Chinese and Japanese share characters but not glyph shapes).
const FALLBACK_ORDER = {
  default: ['NotoSans', 'NotoSansArabic', 'NotoSansSC', 'NotoSansJP', 'NotoSansKR', 'NotoColorEmoji'],
  zh: ['NotoSans', 'NotoSansSC', 'NotoSansJP', 'NotoSansKR', 'NotoColorEmoji'],
  ja: ['NotoSans', 'NotoSansJP', 'NotoSansSC', 'NotoSansKR', 'NotoColorEmoji'],
  ko: ['NotoSans', 'NotoSansKR', 'NotoSansSC', 'NotoSansJP', 'NotoColorEmoji'],
  ar: ['NotoSansArabic', 'NotoSans', 'NotoColorEmoji'],
};

/** A post as the database stores it (see web/lib/supabase.js). */
export interface PostRow {
  text: string;
  /** post_designs.design: version 1 or 2, possibly incomplete. */
  design: unknown;
  /** The author's profiles row. */
  author: Record<string, unknown>;
}

/** Encoded photos the card draws; null draws without (initials instead of a profile photo). */
export interface CardImages {
  avatar: Uint8Array | null;
  photo: Uint8Array | null;
}

/** The photos a post's card draws (profile photo, photo background), for the caller to fetch. */
export function cardImageUrls(post: PostRow): { avatar: string | null; photo: string | null } {
  const design = parseQuoteDesign(post.design);
  return {
    avatar: showsAvatar(design) ? toAuthor(post.author).avatarUrl : null,
    photo: design.background.type === 'image' ? design.background.image : null,
  };
}

/** The card as the app shows it (square corners, like exports), as JPEG. */
export async function renderCard(post: PostRow, images: CardImages, { format = 'original', width = CARD_WIDTH }: { format?: Format; width?: number } = {}) {
  const design = parseQuoteDesign(post.design);
  return withCard(post, design, images, format, width, (card, layout) => ({
    bytes: card.encodeToBytes(ImageFormat.JPEG, 90),
    width: layout.width,
    height: layout.height,
  }));
}

/** The card and its link preview from one drawing, as the app stores them when it publishes. */
export async function renderCardAndPreview(post: PostRow, images: CardImages) {
  const design = parseQuoteDesign(post.design);
  return withCard(post, design, images, 'original', CARD_WIDTH, async (card) => ({
    card: card.encodeToBytes(ImageFormat.JPEG, 90),
    preview: await previewOf(card, design),
  }));
}

/**
 * Just the link preview, fast: the card is laid out at the preview's size, a
 * small copy of the same composition, so even the slowest textures take seconds.
 */
export async function renderLinkPreview(post: PostRow, images: CardImages): Promise<Uint8Array> {
  const design = parseQuoteDesign(post.design);
  return withCard(post, design, images, 'original', previewCardSize(design.canvas).width, (card) => previewOf(card, design));
}

/** The link preview made from a stored card image, without drawing the card again. */
export async function previewFromCard(post: PostRow, cardJpeg: Uint8Array): Promise<Uint8Array> {
  const card = decode(cardJpeg);
  if (!card) throw new Error('Couldn’t read the stored card image.');
  try {
    return await previewOf(card, parseQuoteDesign(post.design));
  } finally {
    card.dispose();
  }
}

/**
 * Characters no font could draw (they'd show as boxes), across every paragraph
 * of the card: words, header, signature. Empty when everything resolved.
 */
export function missingGlyphs(post: PostRow, width = 540): string[] {
  const design = parseQuoteDesign(post.design);
  const layout = layoutCard({ text: post.text, design, author: toAuthor(post.author), width, fonts: loadFonts(JSON.stringify(post)) });
  const missing = new Set<string>();
  const visit = (value: unknown, seen = new Set<object>()) => {
    if (typeof value !== 'object' || value === null || seen.has(value)) return;
    seen.add(value);
    const paragraph = value as { __typename__?: string; ref?: { unresolvedCodepoints?: () => number[] } };
    if (paragraph.__typename__ === 'Paragraph') {
      for (const code of paragraph.ref?.unresolvedCodepoints?.() ?? []) missing.add(String.fromCodePoint(code));
      return;
    }
    for (const child of Object.values(value)) visit(child, seen);
  };
  visit(layout);
  disposeParagraphs(layout);
  return [...missing];
}

async function previewOf(card: SkImage, design: QuoteDesign) {
  const preview = await draw(PREVIEW_SIZE.width, PREVIEW_SIZE.height, <LinkPreview card={card} canvas={design.canvas} radius={design.radius} />);
  try {
    return preview.encodeToBytes(ImageFormat.JPEG, 86);
  } finally {
    preview.dispose();
  }
}

async function withCard<T>(
  post: PostRow,
  design: QuoteDesign,
  images: CardImages,
  format: Format,
  width: number,
  use: (card: SkImage, layout: CardLayout) => T | Promise<T>,
): Promise<T> {
  const avatar = decode(images.avatar);
  const photo = decode(images.photo);
  const layout = layoutCard({ text: post.text, design, author: toAuthor(post.author), width, format, fonts: loadFonts(JSON.stringify(post)) });
  let card: SkImage | null = null;
  try {
    card = await draw(layout.width, layout.height, <QuoteCanvas layout={layout} avatar={avatar} backgroundImage={photo} />);
    return await use(card, layout);
  } finally {
    // CanvasKit memory is never garbage-collected, and function instances are reused.
    for (const image of [card, avatar, photo]) image?.dispose();
    disposeParagraphs(layout);
  }
}

let fonts: SkTypefaceFontProvider | null = null;
const loadedFallbacks = new Set<string>();

// esbuild's file loader turns each font import into a path next to this bundle.
const typefaceOf = (name: string, asset: unknown) => {
  const bytes = new Uint8Array(readFileSync(fileURLToPath(new URL(String(asset), import.meta.url))));
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes));
  if (!typeface) throw new Error(`Couldn't load the font ${name}.`);
  return typeface;
};

/** Every face the app bundles, under the same names, plus the fallbacks `text` needs. */
function loadFonts(text: string): SkTypefaceFontProvider {
  if (!fonts) {
    fonts = Skia.TypefaceFontProvider.Make();
    for (const [name, asset] of Object.entries(fontAssets)) fonts.registerFont(typefaceOf(name, asset), name);
    setFallbackFamilies(FALLBACK_ORDER);
  }
  for (const face of FALLBACK_FACES) {
    if (loadedFallbacks.has(face.family) || !face.needed(text)) continue;
    fonts.registerFont(typefaceOf(face.family, face.asset), face.family);
    loadedFallbacks.add(face.family);
  }
  return fonts;
}

// A photo that can't be decoded is left out, as the app does with one that fails to load.
const decode = (bytes: Uint8Array | null) => (bytes ? Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes)) : null);

async function draw(width: number, height: number, element: ReactElement): Promise<SkImage> {
  const surface = makeOffscreenSurface(width, height);
  try {
    return await drawOffscreen(surface, element);
  } finally {
    surface.dispose();
  }
}

/** Frees every paragraph a layout holds (words, header, signature…). */
function disposeParagraphs(value: unknown, seen = new Set<object>()) {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  if ((value as { __typename__?: string }).__typename__ === 'Paragraph') return void (value as { dispose(): void }).dispose();
  for (const child of Object.values(value)) disposeParagraphs(child, seen);
}
