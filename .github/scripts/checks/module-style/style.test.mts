/** Qualify the style gate and the semantics-preserving import codemod. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';
import parser from '@typescript-eslint/parser';
import { headerCommentFirst } from './index.mts';
import { cleanModule } from './codemod.mts';

const lint = (code: string) => new Linter().verify(code, [{ files: ['**/*.ts'], languageOptions: { parser },
  plugins: { module: { rules: { 'header-first': headerCommentFirst } } }, rules: {
    'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
    'module/header-first': 'error', 'eol-last': ['error', 'always'], 'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 0 }],
  } }], { filename: 'fixture.ts' });

test('duplicates, displaced headers and missing final newline fail the gate', () => {
  for (const code of ["import { a } from 'x';\nimport { b } from 'x';\n", "import { a } from 'x';\n/** Module purpose. */\n\nexport { a };\n", 'export const a = 1;']) {
    assert.ok(lint(code).some(message => message.severity === 2));
    assert.deepEqual(lint(cleanModule(code, 'fixture.ts')), []);
  }
});

test('codemod retains side-effect order, directives and separate type imports', () => {
  const before = "import 'first';\nimport { a } from 'x';\nimport 'second';\nimport type { T } from 'x';\nimport { type U, b } from 'x';\n/** Purpose. */\n\nexport { a, b };\n";
  const after = cleanModule(before, 'fixture.ts');
  assert.ok(after.startsWith('/** Purpose. */\n'));
  assert.ok(after.indexOf("import 'first'") < after.indexOf("import 'second'"));
  assert.match(after, /import type \{ T \} from 'x'/u);
  assert.match(after, /import \{ a, type U, b \} from 'x'/u);
  assert.deepEqual(lint(after), []);
  const documented = "import { a } from 'x';\n/** API docs. */\nexport function f() { return a; }\n";
  assert.equal(cleanModule(documented, 'fixture.ts'), documented);
  assert.deepEqual(lint(documented), []);
  assert.equal(cleanModule(after, 'fixture.ts'), after);
  assert.equal(cleanModule("import { a } from 'x';\n/* @ts-expect-error rationale */\nexport const a = 0;\n", 'fixture.ts'), "import { a } from 'x';\n/* @ts-expect-error rationale */\nexport const a = 0;\n");
});

test('type-only default plus named imports use legal named default syntax', () => {
  const after = cleanModule("import type Default from 'x';\nimport type { Named } from 'x';\n", 'fixture.ts');
  assert.equal(after, "import type { default as Default, Named } from 'x';\n");
  assert.deepEqual(lint(after), []);
});
