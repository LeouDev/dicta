/**
 * Renders real cards with Skia (CanvasKit/WASM) through the same layout engine
 * and canvas the app uses, and checks every template fits every export format.
 * `npm run render:cards` also writes the PNGs to .renders/ for visual review.
 */
import fs from 'fs';
import path from 'path';

import type { SkImage, SkTypefaceFontProvider } from '@shopify/react-native-skia';

import { contentInsets } from '../geometry';
import type * as Layout from '../layout';
import type * as Canvas from '../quote-canvas';
import { createDesign } from '../templates';
import { FORMATS, TEMPLATE_IDS, type CardAuthor } from '../types';

// Skia's web build, backed by the CanvasKit instance this file loads below.
jest.mock('@shopify/react-native-skia', () => {
  const { Mock } = jest.requireActual('@shopify/react-native-skia/lib/module/mock');
  return Mock((globalThis as unknown as { CanvasKit: unknown }).CanvasKit);
});

const PACKAGES: Record<string, string> = {
  Archivo: 'archivo',
  Caveat: 'caveat',
  CaveatBrush: 'caveat-brush',
  CormorantGaramond: 'cormorant-garamond',
  CourierPrime: 'courier-prime',
  DMSerifDisplay: 'dm-serif-display',
  InstrumentSans: 'instrument-sans',
  Nunito: 'nunito',
  PatrickHand: 'patrick-hand',
  PlayfairDisplay: 'playfair-display',
  ShareTechMono: 'share-tech-mono',
  SourceSerif4: 'source-serif-4',
  VT323: 'vt323',
};

const TEXTS = {
  short: 'Stay soft. It’s a strength.',
  long:
    'Whenever you feel overwhelmed by what the future holds, remember that today is one of those unknown ' +
    'tomorrows that you used to worry and yet you’re here tirelessly making it through.\n\n' +
    'Keep finding the light, one breath at a time, the unknown will never define who you are.',
};

const author: CardAuthor = { displayName: 'Leou', username: 'galileouuu', avatarUrl: null, isVerified: true };
const outDir = process.env.RENDER_OUT;
// RENDER_ONLY=editorial,journal limits which templates are rendered while iterating.
const only = process.env.RENDER_ONLY?.split(',');
const templates = TEMPLATE_IDS.filter((t) => !only || only.includes(t));

let fonts: SkTypefaceFontProvider;
let avatar: SkImage | null = null;
let photo: SkImage | null = null;
let layoutCard: typeof Layout.layoutCard;
let QuoteCanvas: typeof Canvas.QuoteCanvas;
let draw: (width: number, height: number, element: React.ReactElement) => Promise<SkImage>;

beforeAll(async () => {
  // CanvasKit must live in this test's realm: it type-checks arrays with instanceof.
  // It also needs a UTF-16 TextDecoder; jest-expo installs Expo's UTF-8-only one.
  globalThis.TextDecoder = jest.requireActual('util').TextDecoder;
  const init = jest.requireActual('canvaskit-wasm/bin/full/canvaskit');
  const wasmDir = path.dirname(require.resolve('canvaskit-wasm/bin/full/canvaskit.js'));
  (globalThis as unknown as { CanvasKit: unknown }).CanvasKit = await init({ locateFile: (file: string) => path.join(wasmDir, file) });

  // Import the renderer only now, so module-level Skia calls see CanvasKit.
  /* eslint-disable @typescript-eslint/no-require-imports -- deferred until CanvasKit exists */
  const { Skia } = require('@shopify/react-native-skia');
  const headless = require('@shopify/react-native-skia/lib/module/headless');
  ({ layoutCard } = require('../layout'));
  ({ QuoteCanvas } = require('../quote-canvas'));
  const { fontAssets } = require('@/constants/fonts');
  /* eslint-enable @typescript-eslint/no-require-imports */

  fonts = Skia.TypefaceFontProvider.Make();
  for (const face of Object.keys(fontAssets)) {
    const [family, ...style] = face.split('_');
    const file = path.join(process.cwd(), 'node_modules/@expo-google-fonts', PACKAGES[family], style.join('_'), `${face}.ttf`);
    fonts.registerFont(Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(file)))), face);
  }

  const image = (file: string | undefined) =>
    file ? Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(file)))) : null;
  avatar = image(process.env.RENDER_AVATAR);
  photo = image(process.env.RENDER_PHOTO);
  draw = (width, height, element) => headless.drawOffscreen(headless.makeOffscreenSurface(width, height), element);
  if (outDir) fs.mkdirSync(outDir, { recursive: true });
});

describe.each(Object.entries(TEXTS))('%s text', (label, text) => {
  // Rendering PNGs on the CPU takes seconds per card; layout checks alone are instant.
  it.each(templates)(
    '%s stays inside every export format',
    async (template) => {
      const design = createDesign(template);

      for (const format of FORMATS) {
        const layout = layoutCard({ text, design, author, width: 1080, format, fonts, watermark: format === 'story' });
        expect(layout.words.length).toBe(text.split(/\s+/).length);

        const inset = contentInsets({ format, frame: design.frame, size: layout, scale: layout.scale, padding: design.padding, topOffset: design.topOffset });
        for (const word of layout.words) {
          // The editorial wave tilts and bobs words a little past their boxes.
          const lean = word.paragraph.getHeight() * 0.15 + 2;
          expect(word.x).toBeGreaterThanOrEqual(inset.left - lean);
          expect(word.x + word.paragraph.getLongestLine()).toBeLessThanOrEqual(layout.width - inset.right + lean);
          expect(word.y + word.dy).toBeGreaterThanOrEqual(inset.top - lean);
          expect(word.y + word.dy + word.paragraph.getHeight()).toBeLessThanOrEqual(layout.height - inset.bottom + lean);
        }

        if (outDir) {
          const background = design.background.type === 'image' ? photo : null;
          const image = await draw(layout.width, layout.height, <QuoteCanvas layout={layout} avatar={avatar} backgroundImage={background} />);
          fs.writeFileSync(path.join(outDir, `${template}-${format}-${label}.png`), image.encodeToBytes());
        }
      }
    },
    outDir ? 600_000 : 30_000,
  );
});
