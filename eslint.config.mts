import type { Linter } from "eslint";
import typescriptParser from '@typescript-eslint/parser';

export const packageLineLimit = 600;

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.cache/**', '**/coverage/**',
    // Generated output and the open-ended registries. `src/platform/solar-geometry.mts` alone is
    // 26,968 generated lines; `src/objects` is 586 authored body packages, not modules.
    '**/prepared/**', '**/generated/**', 'src/objects/**', 'src/sources/**',
    'src/platform/solar-geometry.mts', 'site/prepared-object-catalog.mts', 'site/prepared-context-objects.mts'] },
  {
    // `tools`, `src` and `site` — roughly 232,000 authored lines — had no ESLint at all, so the
    // size and boundary rules below governed only the two smallest trees. Warnings, not errors:
    // the debt is pre-existing and this is meant to make it visible, not to block work on it.
    files: ['tools/**/*.{ts,mts}', 'src/**/*.{ts,mts}', 'site/**/*.{ts,mts}'],
    languageOptions: { parser: typescriptParser },
    rules: {
      'max-lines': ['warn', { max: packageLineLimit, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ['packages/**/*.{js,mjs,cjs,ts,tsx,mts}', 'labs/nebula/packages/**/*.{ts,tsx,mts}'],
    languageOptions: { parser: typescriptParser },
    rules: {
      'max-lines': ['error', { max: packageLineLimit, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ['packages/{core,engine,fits,objects,telescope}/src/**/*.ts'],
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
    // `@cssearth/core/node`, `@cssearth/fits/node`, `@cssearth/spice/node` and `@cssearth/telescope/node` are the Node-only entries: they may use Node built-ins, and nothing
    // else in their package may import them.
    files: ['packages/{core,fits,spice,telescope}/src/node/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', '@layoutit/polycss', '**/renderers/**', '@cssearth/renderer', '@cssearth/renderer/*'],
          message: 'Runtime packages must not depend on the application or legacy sources.' }],
      }],
    },
  },
  {
    files: ['packages/{core,fits,spice,telescope}/src/**/*.ts'],
    ignores: ['**/*.test.ts', 'packages/{core,fits,spice,telescope}/src/node/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', 'node:*', '@layoutit/polycss', '**/renderers/**', '@cssearth/renderer', '@cssearth/renderer/*', './node', './node/*', '../node', '../node/*'],
          message: 'The main entries of @cssearth/core, @cssearth/fits, @cssearth/spice and @cssearth/telescope stay browser-safe: no Node built-ins and no import of the node entry.' }],
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
    files: ['packages/bake/src/scene/**/*.ts', 'packages/bake/src/presentation/**/*.ts', 'packages/bake/src/environment/**/*.ts', 'packages/bake/src/image-layers/**/*.ts', 'packages/bake/src/density/**/*.ts', 'packages/bake/src/sky/**/*.ts', 'packages/bake/src/shell/**/*.ts', 'packages/bake/src/stars/**/*.ts', 'packages/bake/src/volume-leaves/**/*.ts'],
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
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/src/preparation/**', '**/site/**', '**/tools/**', '**/labs/**', '**/renderers/**',
          'node:*', '@cssearth/bake', '@cssearth/bake/*', '@cssearth/renderer', '@cssearth/renderer/*'],
          message: 'The renderer runtime imports packages and its own modules only, never the application, preparation code or Node built-ins.' }],
      }],
    },
  },
  {
    // Moved unchanged from src/renderers/css, which had no line limit; splitting them is separate work. The site bundle's
    // bytes were held identical across the move, so the runtime module is not split here.
    files: ['packages/renderer/src/universe/prepared-world-context.ts', 'packages/renderer/src/universe/prepared-world-context.test.ts',
      'packages/renderer/src/universe/world-context/world-context-planner.test.ts', 'packages/renderer/src/sky/prepared-sky-runtime.test.ts'],
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
