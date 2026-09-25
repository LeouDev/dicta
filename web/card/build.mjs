// Bundles the app's card renderer (src/features/quote-card) for the website's
// functions. Vercel runs this on every deploy (web/package.json "build"), so
// the website always draws with the renderer from the same commit as the app.
//
// dist/render.mjs   the Skia renderer, with CanvasKit and every font beside it
// dist/design.mjs   design parsing and card sizes, no Skia (for the post page)
// dist/version.mjs  a hash of everything that affects the pixels
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const dist = join(here, 'dist');
const canvaskit = join(root, 'node_modules/canvaskit-wasm/bin/full');

// CanvasKit has to exist before the bundled Skia modules evaluate.
const loadCanvasKit = `
import { createRequire as __createRequire } from 'node:module';
import { fileURLToPath as __fileURLToPath } from 'node:url';
const require = __createRequire(import.meta.url);
globalThis.CanvasKit ??= await require('./canvaskit.cjs')({ locateFile: (file) => __fileURLToPath(new URL(file, import.meta.url)) });
`;

/** The app imports '@shopify/react-native-skia'; here it means the package's CanvasKit build. */
const skiaForNode = {
  name: 'skia-for-node',
  setup(b) {
    b.onResolve({ filter: /^@shopify\/react-native-skia$/ }, () => ({ path: join(here, 'skia.ts') }));
    // Only referenced from code paths the renderer never takes (asset loading in React Native).
    b.onResolve({ filter: /^react-native(\/|$)/ }, (args) => ({ path: args.path, namespace: 'unused' }));
    b.onLoad({ filter: /.*/, namespace: 'unused' }, () => ({ contents: 'module.exports = {};' }));
  },
};

const common = {
  absWorkingDir: root,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outdir: dist,
  outExtension: { '.js': '.mjs' },
  jsx: 'automatic',
  loader: { '.ttf': 'file' },
  assetNames: 'fonts/[name]',
  // Prefer React Native Skia's web implementations (e.g. skia/Skia.web.js).
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.mjs', '.cjs', '.json'],
  define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false' },
  plugins: [skiaForNode],
  legalComments: 'none',
  logLevel: 'warning',
};

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
copyFileSync(join(canvaskit, 'canvaskit.js'), join(dist, 'canvaskit.cjs'));
copyFileSync(join(canvaskit, 'canvaskit.wasm'), join(dist, 'canvaskit.wasm'));

await build({ ...common, entryPoints: { render: join(here, 'render.tsx') }, banner: { js: loadCanvasKit } });
await build({ ...common, entryPoints: { design: join(here, 'design.ts') } });

// Stored images are named by this, so a renderer change redraws every card.
const hash = createHash('sha256');
for (const file of ['render.mjs', 'canvaskit.wasm']) hash.update(readFileSync(join(dist, file)));
for (const font of readdirSync(join(dist, 'fonts')).sort()) hash.update(font).update(readFileSync(join(dist, 'fonts', font)));
const version = hash.digest('hex').slice(0, 12);
writeFileSync(join(dist, 'version.mjs'), `export const RENDERER_VERSION = '${version}';\n`);
console.log(`card renderer ${version} → ${dist}`);
