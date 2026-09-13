import type { Linter } from "eslint";
import typescriptParser from '@typescript-eslint/parser';

export const packageLineLimit = 600;

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.cache/**', '**/coverage/**'] },
  {
    files: ['packages/**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: { parser: typescriptParser },
    rules: {
      'max-lines': ['error', { max: packageLineLimit, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ['packages/{engine,objects}/src/**/*.ts'],
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
