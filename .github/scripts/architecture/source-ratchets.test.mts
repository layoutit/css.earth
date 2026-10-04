import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkSourceRatchets, ceilingFindings, parseRatchet, RATCHET_PATH, sourceRatchetSignals } from './source-ratchets.mts';

test('new math, partitioning and cwd calls are ratcheted; comments and tests are excluded', () => {
  assert.deepEqual(sourceRatchetSignals('packages/objects/src/new.ts', 'Math.sqrt(3); values.sort((a,b)=>a-b)'), ['objects']);
  assert.deepEqual(sourceRatchetSignals('packages/bake/src/new.ts', 'resolve(process.cwd(), "src")'), ['cwd']);
  assert.deepEqual(sourceRatchetSignals('packages/objects/src/new.test.ts', 'Math.sqrt(3); process.cwd()'), []);
  assert.deepEqual(sourceRatchetSignals('packages/bake/src/new.ts', '// process.cwd()'), []);
  assert.equal(ceilingFindings(0, 1, 'test').length, 1);
  assert.deepEqual(ceilingFindings(1, 0, 'test'), []);
  assert.throws(() => parseRatchet({ 'new.ts': '' }), /requires a reason/u);
});
test('real-tree budget is current and new source mutations fail then clear', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'packages', '.github/scripts/architecture/source-ratchets.json']).toString().trim().split('\n');
  assert.deepEqual(checkSourceRatchets(process.cwd(), files), []);
  const root = mkdtempSync(resolve(tmpdir(), 'source-ratchets-'));
  const write = (path: string, text: string) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text); };
  try {
    write(RATCHET_PATH, '{"objects":{"ceiling":0,"entries":{}},"cwd":{"ceiling":0,"entries":{}}}');
    const object = 'packages/objects/src/new.ts', command = 'packages/bake/src/new.ts';
    write(object, 'export const x = Math.sqrt(4);'); write(command, 'export const root = process.cwd();');
    assert.equal(checkSourceRatchets(root, [object, command]).length, 2, 'mutation red');
    rmSync(resolve(root, RATCHET_PATH));
    assert.match(checkSourceRatchets(root, [object, command])[0]!, /missing source ratchet budget/u, 'deleting the budget must not disable the rule');
    write(RATCHET_PATH, '{"objects":{"ceiling":0,"entries":{}},"cwd":{"ceiling":0,"entries":{}}}');
    assert.equal(checkSourceRatchets(root, [object, command]).length, 2, 'restoring the budget enforces the same allowances');
    write(object, 'export const x = 4;'); write(command, 'export const root = import.meta.dirname;');
    assert.deepEqual(checkSourceRatchets(root, [object, command]), [], 'mutation green');
    rmSync(resolve(root, RATCHET_PATH));
    assert.match(checkSourceRatchets(root, [object, command])[0]!, /missing source ratchet budget/u, 'even an empty source tree requires the committed budget');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('each committed ceiling equals its current allowance count', () => {
  const budgets = JSON.parse(readFileSync(new URL('./source-ratchets.json', import.meta.url), 'utf8'));
  for (const budget of Object.values(budgets)) {
    assert.ok(budget && typeof budget === 'object' && 'ceiling' in budget && 'entries' in budget);
    assert.ok(budget.entries && typeof budget.entries === 'object');
    assert.equal(budget.ceiling, Object.keys(budget.entries).length);
  }
});
test('expanded numeric syntax is red, removing it is green', () => {
  for (const name of ['sqrt', 'exp', 'log', 'log2', 'log10', 'acos', 'asin', 'atan', 'tan', 'cbrt', 'expm1', 'log1p', 'sinh', 'cosh', 'tanh']) {
    for (const text of [`Math.${name}(1)`, `Math['${name}'](1)`, `const { ${name} } = Math; ${name}(1)`, `const { ${name}: numeric } = Math; numeric(1)`])
      assert.deepEqual(sourceRatchetSignals('packages/objects/src/new.ts', text), ['objects'], text);
  }
  assert.deepEqual(sourceRatchetSignals('packages/bake/src/new.ts', "process['cwd']()"), ['cwd']);
  assert.deepEqual(sourceRatchetSignals('packages/objects/src/new.ts', 'const value = 1;'), []);
});
test('adding a justified allowance without raising its ceiling is red without git history', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ceiling-no-refs-'));
  try {
    mkdirSync(resolve(root, '.github/scripts/architecture'), { recursive: true });
    mkdirSync(resolve(root, 'packages/objects/src'), { recursive: true });
    const file = 'packages/objects/src/new.ts';
    writeFileSync(resolve(root, file), 'Math.exp(1)');
    const budget = { objects: { ceiling: 0, entries: { [file]: 'Fixture exponential admission.' } }, cwd: { ceiling: 0, entries: {} } };
    writeFileSync(resolve(root, RATCHET_PATH), JSON.stringify(budget));
    assert.match(checkSourceRatchets(root, [file]).join('\n'), /exceed committed ceiling/u);
    budget.objects.ceiling = 1;
    writeFileSync(resolve(root, RATCHET_PATH), JSON.stringify(budget));
    assert.deepEqual(checkSourceRatchets(root, [file]), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
