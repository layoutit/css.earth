import type { Linter } from "eslint";
import typescriptParser from '@typescript-eslint/parser';
import { headerCommentFirst } from './.github/scripts/checks/module-style/index.mts';

export const packageLineLimit = 600;
// The contract forbids runtime canvas and WebGL (AGENTS.md); WWT's engine is WebGL. Build-time preparation may rasterize.
const noCanvas = 'The CSS runtime uses no canvas or WebGL (AGENTS.md).';

export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts,jsx}'],
    languageOptions: { parser: typescriptParser },
    plugins: { module: { rules: { 'header-comment-first': headerCommentFirst } } },
    rules: {
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
      'module/header-comment-first': 'error',
      'eol-last': ['error', 'always'],
      'no-multiple-empty-lines': ['error', { max: 10000, maxEOF: 0 }],
    },
  },
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.cache/**', 'coverage/**',
    // Generated output and the open-ended registries. `src/platform/solar-geometry.mts` alone is
    // 26,968 generated lines; `src/objects` is 586 authored body packages, not modules.
    '**/prepared/**', '**/generated/**', 'src/objects/**/*', '!src/objects/**/', '!src/objects/**/*.test.mts', 'src/sources/**/*', '!src/sources/**/*.test.mts',
    'src/platform/solar-geometry.mts', 'site/prepared/prepared-context-objects.mts',
    // The Worker's bundle, written by deploy/cloudflare/bundle-worker.mts.
    'deploy/cloudflare/bundled/**'] },
  {
    // `src` and `site` (and once `tools`) — roughly 232,000 authored lines — had no ESLint at all, so the
    // size and boundary rules below governed only the two smallest trees. Warnings, not errors:
    // the debt is pre-existing and this is meant to make it visible, not to block work on it.
    files: ['.github/scripts/**/*.{ts,mts}', 'labs/experiments/**/*.{ts,mts}', 'labs/investigations/**/*.{ts,mts}', 'labs/performance/**/*.{ts,mts}', 'labs/nebula/application-isolation*.ts', 'integration/**/*.{ts,mts}', 'src/**/*.{ts,mts}', 'site/**/*.{ts,mts}', 'deploy/**/*.{ts,mts}'],
    languageOptions: { parser: typescriptParser },
    rules: {
      'max-lines': ['warn', { max: packageLineLimit, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ['integration/**/*.{ts,mts}', 'packages/**/*.{js,mjs,cjs,ts,tsx,mts}', 'labs/nebula/packages/**/*.{ts,tsx,mts}'],
    languageOptions: { parser: typescriptParser },
    rules: {
      'max-lines': ['error', { max: packageLineLimit, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ['packages/{core,engine,fits,objects,telescope}/src/**/*.ts', 'packages/core/src/**/*.mts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'HTMLElement', 'DOMMatrix', 'DOMMatrixReadOnly', 'Image', 'CSSStyleDeclaration', 'requestAnimationFrame'],
      'no-restricted-syntax': ['error', {
        selector: 'TSAnyKeyword', message: 'Use an owned type or validate unknown input at the boundary.',
      }],
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', 'node:*', '@layoutit/polycss', '**/renderers/**', '@cssearth/renderer', '@cssearth/renderer/*'],
          message: 'Runtime packages must not depend on the application, legacy sources, or Node tooling.' }],
      }],
    },
  },
  {
    // `@cssearth/core/node`, `@cssearth/fits/node`, `@cssearth/objects/node`, `@cssearth/spice/node` and `@cssearth/telescope/node` are the Node-only entries: they may
    // use Node built-ins, and nothing else in their package may import them.
    files: ['packages/{core,fits,objects,spice,telescope}/src/node/**/*.ts', 'packages/core/src/node/**/*.mts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', '@layoutit/polycss', '**/renderers/**', '@cssearth/renderer', '@cssearth/renderer/*'],
          message: 'Runtime packages must not depend on the application or legacy sources.' }],
      }],
    },
  },
  {
    files: ['packages/{core,fits,objects,spice,telescope}/src/**/*.ts'],
    ignores: ['**/*.test.ts', 'packages/{core,fits,objects,spice,telescope}/src/node/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', 'node:*', '@layoutit/polycss', '**/renderers/**', '@cssearth/renderer', '@cssearth/renderer/*', './node', './node/*', '../node', '../node/*'],
          message: 'The main entries of @cssearth/core, @cssearth/fits, @cssearth/objects, @cssearth/spice and @cssearth/telescope stay browser-safe: no Node built-ins and no import of the node entry.' }],
      }],
    },
  },
  {
    // `@cssearth/bake` is build-time code: no application imports, and no `any`.
    files: ['packages/bake/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'TSAnyKeyword', message: 'Use an owned type or validate unknown input at the boundary.',
      }],
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', '@layoutit/polycss', '**/renderers/**', '@cssearth/renderer', '@cssearth/renderer/*', '@cssearth/bake', '@cssearth/bake/*'],
          message: 'Bake topics import packages and their own topic only, never the application or another topic.' }],
      }],
    },
  },
  {
    // The raster lane reads prepared-asset constants the renderer owns (`@cssearth/renderer/rendering/*`); build-time code may
    // import the runtime package, never the reverse. Other topics stay on the rule above.
    files: ['packages/bake/src/raster/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', '@layoutit/polycss', '**/renderers/**', '@cssearth/bake', '@cssearth/bake/*'],
          message: 'Bake topics import packages and their own topic only, never the application or another topic.' }],
      }],
    },
  },
  {
    // The scene and presentation compilers read the renderer's prepared types, validators and silhouette steps, and the scene
    // projects leaves with PolyCSS, which the runtime uses to draw them.
    // The world frame's presentation and Sun directions name the renderer's vector types and its view-direction conversion.
    // The default view derives what the default camera shows with the renderer's own world-camera math.
    // The prepared-presentation passes rewrite the renderer's prepared tree, depth order and interior disc, and the object
    // runtime contract reads the renderer's prepared resources and object controls.
    // The object-content contract names the renderer's object contract types, and surface features index the renderer's label banks.
    // Navigation preparation validates marker presentation with the renderer's marker rules, and the deploy check parses the
    // published world summary and system views with the shared prepared world-context parsers.
    // Catalogue bank codecs and point-field format contracts belong to @cssearth/objects.
    files: ['packages/bake/src/volume/node/**/*.ts', 'packages/bake/src/scene/**/*.ts', 'packages/bake/src/presentation/**/*.ts', 'packages/bake/src/nebula/**/*.ts', 'packages/bake/src/world-context/**/*.ts', 'packages/bake/src/cluster-catalog/**/*.ts', 'packages/bake/src/galaxy-catalog/**/*.ts', 'packages/bake/src/environment/**/*.ts', 'packages/bake/src/image-layers/**/*.ts', 'packages/bake/src/density/**/*.ts', 'packages/bake/src/sky/**/*.ts', 'packages/bake/src/shell/**/*.ts', 'packages/bake/src/stars/**/*.ts', 'packages/bake/src/volume-leaves/**/*.ts', 'packages/bake/src/objects/layers/**/*.ts',
      'packages/bake/src/objects/scene/**/*.ts', 'packages/bake/src/objects/default-view/**/*.ts', 'packages/bake/src/prepared-presentation/**/*.ts',
      'packages/bake/src/contract/**/*.ts', 'packages/bake/src/objects/content/**/*.ts', 'packages/bake/src/objects/surface-features/**/*.ts',
      'packages/bake/src/navigation/**/*.ts', 'packages/bake/src/asset-publication/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', '**/renderers/**', '@cssearth/bake', '@cssearth/bake/*'],
          message: 'Bake topics import packages and their own topic only, never the application or another topic.' }],
      }],
    },
  },
  {
    // `@cssearth/bake/volume` stays host-neutral (the nebula lab's browser viewer imports it); only `volume/node` may use
    // Node built-ins and sharp, and nothing else imports it.
    files: ['packages/bake/src/volume/**/*.ts'],
    ignores: ['**/*.test.ts', 'packages/bake/src/volume/node/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', 'node:*', 'sharp', 'react', 'react/*', 'react-dom', 'react-dom/*', 'vite',
          '@layoutit/polycss', '**/renderers/**', '@cssearth/renderer', '@cssearth/renderer/*', '@cssearth/bake', '@cssearth/bake/*', './node', './node/*', '../node', '../node/*', '../../node/*', '../../node'],
          message: 'The main entry of @cssearth/bake/volume stays host-neutral: no Node built-ins, native codecs or UI libraries, and no import of the node entry.' }],
      }],
    },
  },
  {
    // `@cssearth/renderer` is the browser runtime. It reads prepared data through its own validators and never imports the
    // application, preparation code (`@cssearth/bake`) or Node built-ins; tests may.
    files: ['packages/renderer/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      // The browser normalizes these values, so a value read back never equals the one written and the guard rewrites it
      // on every frame (`translate(1px,2px)` reads `translate(1px, 2px)`, `0.30000000000000004` reads `0.3`).
      'no-restricted-syntax': ['error', {
        selector: 'BinaryExpression[operator=/^[!=]==?$/] > MemberExpression[property.name=/^(transform|opacity|width|height|translate)$/][object.type="MemberExpression"][object.property.name="style"]',
        message: 'Do not compare with a style value read back from the page. Write it with writeStyle (rendering/dom/retained-write.ts), which remembers what it wrote.',
      }],
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', '**/labs/**', '**/renderers/**',
          'node:*', '@cssearth/bake', '@cssearth/bake/*', '@cssearth/renderer', '@cssearth/renderer/*'],
          message: 'The renderer runtime imports packages and its own modules only, never the application, preparation code or Node built-ins.' },
        { group: ['@wwtelescope/*'], message: noCanvas }],
      }],
    },
  },
  {
    // The site's browser runtime (not its build steps or tests) and the renderer draw with retained DOM and CSS only.
    files: ['site/**/*.{ts,mts}', 'packages/renderer/src/**/*.ts'],
    ignores: ['site/build/**', '**/*.test.{ts,mts}'],
    rules: {
      'no-restricted-globals': ['error', ...['OffscreenCanvas', 'WebGLRenderingContext', 'WebGL2RenderingContext'].map(name => ({ name, message: noCanvas }))],
      'no-restricted-properties': ['error', { property: 'getContext', message: noCanvas }],
    },
  },
  {
    files: ['site/**/*.{ts,mts}'],
    ignores: ['site/build/**', '**/*.test.{ts,mts}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@wwtelescope/*'], message: noCanvas }] }] },
  },
  {
    // Modules over the line limit that are not split yet.
    files: [
      'packages/renderer/src/universe/prepared-world-context.ts',
      'site/world/prepared-world-context.test.ts',
      'packages/renderer/src/universe/world-context/world-context-planner.test.ts',
      'packages/renderer/src/sky/prepared-sky-runtime.test.ts',
      'packages/telescope-cli/src/archives/interferometry/alma-disc-selfcal.mts',
      'packages/telescope-cli/src/new-object/new-object.test.mts',
      'packages/bake/authoring/betelgeuse-shell/author.mts',
      'packages/telescope-cli/authoring/circumstellar/author.mts',
      'packages/bake/src/objects/layers/material-composition/layered-oblate.ts',
      'packages/bake/src/objects/layers/material-composition/cutaway-materials.ts',
      'packages/bake/src/navigation/prepare-navigation.ts',
      'packages/bake/src/objects/layers/paged-ellipsoid/assets.ts',
    ],
    rules: { 'max-lines': 'off' },
  },
  {
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', 'node:*', '@layoutit/polycss', '**/renderers/**', '@cssearth/renderer', '@cssearth/renderer/*', '@cssearth/objects', '@cssearth/objects/*'],
          message: 'The engine accepts object data and application policy through its public interfaces.' }],
      }],
    },
  },
] satisfies Linter.Config[];
