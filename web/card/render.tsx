/**
 * The website's card renderer: the app's own layout engine and Skia canvas
 * (src/features/quote-card) running on CanvasKit in Node, so a post's image on
 * the web is drawn by the same code as the card in the app. build.mjs bundles
 * this file, with CanvasKit and the fonts, into dist/render.mjs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { NotoColorEmoji_400Regular } from '@expo-google-fonts/noto-color-emoji/400Regular';
import { BlurMask, Fill, Group, Image, ImageFormat, RoundedRect, Skia, rect, rrect, type SkImage, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { drawOffscreen, makeOffscreenSurface } from '@shopify/react-native-skia/lib/module/headless';
import type { ReactElement } from 'react';

import { fontAssets } from '@/constants/fonts';
import { colors } from '@/constants/tokens';
import { cardSize, showsAvatar } from '@/features/quote-card/geometry';
import { layoutCard, setFallbackFamilies, type CardLayout } from '@/features/quote-card/layout';
import { QuoteCanvas } from '@/features/quote-card/quote-canvas';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import { DESIGN_WIDTH, type Format, type QuoteDesign } from '@/features/quote-card/types';
import { toAuthor } from '@/services/author';

/** Same width as the app's exports. */
export const CARD_WIDTH = 1080;
/** Link previews (Open Graph, X, iMessage) are 1.91:1. */
export const PREVIEW_SIZE = { width: 1200, height: 630 };
const PREVIEW_MARGIN = 48;

const EMOJI = 'NotoColorEmoji';

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

/**
 * The link-preview image: the card, laid out at the preview's height (a smaller
 * copy of the same composition, so it draws fast), with the feed's rounded
 * corners and shadow on the app's paper color.
 */
export async function renderLinkPreview(post: PostRow, images: CardImages): Promise<Uint8Array> {
  const design = parseQuoteDesign(post.design);
  const height = PREVIEW_SIZE.height - PREVIEW_MARGIN * 2;
  const width = Math.round(height * (DESIGN_WIDTH / cardSize('original', design.canvas, DESIGN_WIDTH).height));
  return withCard(post, design, images, 'original', width, async (card, layout) => {
    const preview = await draw(PREVIEW_SIZE.width, PREVIEW_SIZE.height, <LinkPreview card={card} radius={design.radius * layout.scale} />);
    try {
      return preview.encodeToBytes(ImageFormat.JPEG, 86);
    } finally {
      preview.dispose();
    }
  });
}

function LinkPreview({ card, radius }: { card: SkImage; radius: number }) {
  const width = card.width();
  const height = card.height();
  const x = Math.round((PREVIEW_SIZE.width - width) / 2);
  const y = Math.round((PREVIEW_SIZE.height - height) / 2);
  return (
    <Group>
      <Fill color={colors.light.background} />
      <RoundedRect x={x} y={y + 12} width={width} height={height} r={radius} color="rgba(26, 23, 20, 0.2)">
        <BlurMask blur={22} style="normal" />
      </RoundedRect>
      <Group clip={rrect(rect(x, y, width, height), radius, radius)}>
        <Image image={card} x={x} y={y} width={width} height={height} />
      </Group>
    </Group>
  );
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
  const layout = layoutCard({ text: post.text, design, author: toAuthor(post.author), width, format, fonts: loadFonts() });
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

/** Every face the app bundles, under the same names, plus a color emoji fallback. */
function loadFonts(): SkTypefaceFontProvider {
  if (fonts) return fonts;
  const provider = Skia.TypefaceFontProvider.Make();
  const faces: [string, unknown][] = [...Object.entries(fontAssets), [EMOJI, NotoColorEmoji_400Regular]];
  for (const [name, asset] of faces) {
    // esbuild's file loader turns each font import into a path next to this bundle.
    const bytes = new Uint8Array(readFileSync(fileURLToPath(new URL(String(asset), import.meta.url))));
    const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes));
    if (!typeface) throw new Error(`Couldn't load the font ${name}.`);
    provider.registerFont(typeface, name);
  }
  setFallbackFamilies([EMOJI]);
  fonts = provider;
  return provider;
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
