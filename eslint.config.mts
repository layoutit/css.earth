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
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', 'node:*', '@layoutit/polycss', '**/renderers/**'],
          message: 'Runtime packages must not depend on the application, legacy sources, or Node tooling.' }],
      }],
    },
  },
  {
    // `@cssearth/core/node`, `@cssearth/fits/node` and `@cssearth/telescope/node` are the Node-only entries: they may use Node built-ins, and nothing
    // else in their package may import them.
    files: ['packages/{core,fits,telescope}/src/node/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', '@layoutit/polycss', '**/renderers/**'],
          message: 'Runtime packages must not depend on the application or legacy sources.' }],
      }],
    },
  },
  {
    files: ['packages/{core,fits,telescope}/src/**/*.ts'],
    ignores: ['**/*.test.ts', 'packages/{core,fits,telescope}/src/node/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', 'node:*', '@layoutit/polycss', '**/renderers/**', './node', './node/*', '../node', '../node/*'],
          message: 'The main entries of @cssearth/core, @cssearth/fits and @cssearth/telescope stay browser-safe: no Node built-ins and no import of the node entry.' }],
      }],
    },
  },
  {
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/src/platform/**', '**/src/objects/**', '**/site/**', 'node:*', '@layoutit/polycss', '**/renderers/**', '@cssearth/objects', '@cssearth/objects/*'],
          message: 'The engine accepts object data and application policy through its public interfaces.' }],
      }],
    },
  },
] satisfies Linter.Config[];
