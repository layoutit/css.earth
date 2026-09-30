import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { auditOwnership } from './typescript-ownership.mts';

function fixture(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'typescript-ownership-'));
  const manifest = { schemaVersion: 1, legacyAuthored: [], exceptions: {} };
  for (const [path, text] of Object.entries({ '.github/scripts/checks/typescript-ownership.json': JSON.stringify(manifest), ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('a runtime owner may not import a test helper, whether the specifier is quoted or a no-expression template literal', () => {
  const root = fixture({
    'tests/helper.ts': 'export const helper = 1;\n',
    'src/quoted.ts': "export const quoted = () => import('../tests/helper.ts');\n",
    'src/template.ts': 'export const template = () => import(`../tests/helper.ts`);\n',
    'src/computed.ts': "const name = '../tests/helper.ts';\nexport const computed = () => import(`${name}`);\n",
    'site/Page.astro': '---\nconst late = await import(`../tests/helper.ts`);\n---\n<div />\n',
  });
  try {
    assert.deepEqual(auditOwnership(root).violations, [
      'site/Page.astro: source imports test module tests/helper.ts; move shared behavior into an authored owner.',
      'src/quoted.ts: source imports test module tests/helper.ts; move shared behavior into an authored owner.',
      'src/template.ts: source imports test module tests/helper.ts; move shared behavior into an authored owner.',
    ], 'a computed specifier is out of reach of the static guard');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('relocated oracle gates retain their evidence role while ordinary CLI and check scripts cannot import fixtures', () => {
  const root = fixture({
    'packages/bake/src/fixtures/pin.mts': 'export const pin = 1;\n',
    'packages/bake/cli/test-sbmt.mts': "import '../src/fixtures/pin.mts';\n",
    'packages/bake/cli/prepare.mts': "import '../src/fixtures/pin.mts';\n",
    '.github/scripts/checks/fixtures/pin.mts': 'export const pin = 1;\n',
    '.github/scripts/checks/test-fits.mts': "import './fixtures/pin.mts';\n",
    '.github/scripts/checks/plain.mts': "import './fixtures/pin.mts';\n",
  });
  try {
    assert.deepEqual(auditOwnership(root).violations, [
      '.github/scripts/checks/plain.mts: source imports test module .github/scripts/checks/fixtures/pin.mts; move shared behavior into an authored owner.',
      'packages/bake/cli/prepare.mts: source imports test module packages/bake/src/fixtures/pin.mts; move shared behavior into an authored owner.',
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
