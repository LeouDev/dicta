/**
 * Renders real cards with Skia (CanvasKit/WASM) through the same layout engine
 * and canvas the app uses, and checks every template fits every export format.
 * `npm run render:cards` also writes the PNGs to .renders/ for visual review.
 */
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import type { SkImage, SkTypefaceFontProvider } from '@shopify/react-native-skia';

import { ENGINE_VERSION } from '../card-key';
import { contentInsets } from '../geometry';
import type * as Layout from '../layout';
import type * as Canvas from '../quote-canvas';
import type * as Story from '../story';
import { createDesign } from '../templates';
import { FORMATS, TEMPLATE_IDS, type CardAuthor, type TemplateId } from '../types';

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

// The card engine is frozen. These drawings (every texture family, frames, blur,
// highlight, gradient text, the wave, and Chinese and Arabic flow) must not change
// unless ENGINE_VERSION does, because stored images are named by it: bumping it
// redraws every post. After a deliberate change, bump the version and record the
// fingerprint this test prints.
const FROZEN = { version: 1, fingerprint: 'df163e24edeabe6c' };
const REFERENCES: [TemplateId, string][] = [
  ['editorial', 'Stay soft. It’s a strength.'],
  ['diptych', 'still\n\nhere'],
  ['pager', 'call me when you land'],
  ['lcd', 'systems nominal'],
  ['notification', 'you made it through'],
  ['book', 'mark this line\n\nand keep reading'],
  ['headline', 'one more lap\n\nthen rest.'],
  ['ink', 'hand-pulled'],
  ['wall', 'concrete ideas'],
  ['dialogue', 'said / heard'],
  ['grain', 'every day is a beginning'],
  ['journal', 'lines on lines'],
  ['minimal', '每一天都是新的开始。\n\nكل يوم هو بداية جديدة.'],
];

test('the drawing is frozen at ENGINE_VERSION', async () => {
  const hash = createHash('sha256');
  for (const [template, text] of REFERENCES) {
    const layout = layoutCard({ text, design: createDesign(template), author, width: 216, format: 'original', fonts });
    const image = await draw(layout.width, layout.height, <QuoteCanvas layout={layout} avatar={null} backgroundImage={null} />);
    hash.update(template).update(image.readPixels() as Uint8Array);
  }
  const fingerprint = hash.digest('hex').slice(0, 16);
  if (fingerprint !== FROZEN.fingerprint) console.warn(`card engine fingerprint: ${fingerprint}`);
  expect({ version: ENGINE_VERSION, fingerprint }).toEqual(FROZEN);
}, 120_000);

test('stories get the card as a sticker with clear margins, over a blurred 9:16 copy', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred until CanvasKit exists
  const { STORY_SIZE, StoryBackground, StorySticker, stickerSize } = require('../story') as typeof Story;
  const alpha = (image: SkImage, x: number, y: number) => (image.readPixels() as Uint8Array)[(y * image.width() + x) * 4 + 3];

  // RENDER_OUT writes every template's story for review; the check itself needs one.
  for (const template of outDir ? templates : (['editorial'] as const)) {
    const design = createDesign(template);
    const layout = layoutCard({ text: TEXTS.short, design, author, width: 1080, format: 'original', fonts });
    const card = await draw(layout.width, layout.height, <QuoteCanvas layout={layout} avatar={avatar} backgroundImage={design.background.type === 'image' ? photo : null} />);
    const size = stickerSize(card);
    const sticker = await draw(size.width, size.height, <StorySticker card={card} radius={design.radius} />);
    const background = await draw(STORY_SIZE.width, STORY_SIZE.height, <StoryBackground card={card} />);

    expect(alpha(sticker, 0, 0)).toBe(0);
    expect(alpha(sticker, size.width / 2, size.height / 2)).toBe(255);
    expect(alpha(background, 0, 0)).toBe(255);
    if (outDir) {
      fs.writeFileSync(path.join(outDir, `${template}-story-sticker.png`), sticker.encodeToBytes());
      fs.writeFileSync(path.join(outDir, `${template}-story-background.png`), background.encodeToBytes());
    }
  }
}, 600_000);
