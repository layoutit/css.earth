/** Qualify the style gate and the semantics-preserving import codemod. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import { cleanModule } from './codemod.mts';

const eslint = new ESLint({ overrideConfigFile: new URL('../../../../eslint.config.mts', import.meta.url).pathname });
const probe = 'packages/module-style-probe.test.ts';
const lint = async (code: string) => (await eslint.lintText(code, { filePath: probe }))[0]!.messages;
const rules = ['no-duplicate-imports', 'module/header-comment-first', 'eol-last'];

test('real config applies error gates to package extensions and excludes site and src', async () => {
  for (const extension of ['ts', 'mts', 'cts', 'jsx']) {
    const config = await eslint.calculateConfigForFile(`packages/module-style-probe.test.${extension}`);
    for (const rule of rules) assert.equal(config.rules[rule][0], 2, rule);
  }
  for (const filePath of ['site/x.mts', 'src/x.mts']) {
    const config = await eslint.calculateConfigForFile(filePath);
    for (const rule of rules) assert.ok(!config.rules[rule] || config.rules[rule][0] === 0, rule);
  }
  const messages = await lint("import { a } from 'x';\nimport { b } from 'x';\n/** Module purpose. */\n\nexport { a, b };");
  for (const rule of rules) assert.ok(messages.some(message => message.ruleId === rule && message.severity === 2), rule);
});

test('vitest and jsx directives stay attached and pass the real gate', async () => {
  for (const directive of ['@vitest-environment jsdom', '@jsx h']) {
    const code = `import { a } from 'x';\n/** ${directive} */\n\nexport { a };\n`;
    assert.equal(cleanModule(code, 'fixture.ts'), code);
    assert.deepEqual(await lint(code), []);
  }
});

test('duplicates, displaced headers and missing final newline fail the gate', async () => {
  for (const code of ["import { a } from 'x';\nimport { b } from 'x';\n", "import { a } from 'x';\n/** Module purpose. */\n\nexport { a };\n", 'export const a = 1;']) {
    assert.ok((await lint(code)).some(message => message.severity === 2));
    assert.deepEqual(await lint(cleanModule(code, 'fixture.ts')), []);
  }
});

test('codemod retains side-effect order, directives and separate type imports', async () => {
  const before = "import 'first';\nimport { a } from 'x';\nimport 'second';\nimport type { T } from 'x';\nimport { type U, b } from 'x';\n/** Purpose. */\n\nexport { a, b };\n";
  const after = cleanModule(before, 'fixture.ts');
  assert.ok(after.startsWith('/** Purpose. */\n'));
  assert.ok(after.indexOf("import 'first'") < after.indexOf("import 'second'"));
  assert.match(after, /import type \{ T \} from 'x'/u);
  assert.match(after, /import \{ a, type U, b \} from 'x'/u);
  assert.deepEqual(await lint(after), []);
  const documented = "import { a } from 'x';\n/** API docs. */\nexport function f() { return a; }\n";
  assert.equal(cleanModule(documented, 'fixture.ts'), documented);
  assert.deepEqual(await lint(documented), []);
  assert.equal(cleanModule(after, 'fixture.ts'), after);
  assert.equal(cleanModule("import { a } from 'x';\n/* @ts-expect-error rationale */\nexport const a = 0;\n", 'fixture.ts'), "import { a } from 'x';\n/* @ts-expect-error rationale */\nexport const a = 0;\n");
});

test('type-only default plus named imports use legal named default syntax', async () => {
  const after = cleanModule("import type Default from 'x';\nimport type { Named } from 'x';\n", 'fixture.ts');
  assert.equal(after, "import type { default as Default, Named } from 'x';\n");
  assert.deepEqual(await lint(after), []);
});
