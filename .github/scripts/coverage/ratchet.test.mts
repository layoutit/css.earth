/** Regression and mutation probes for monotone coverage floors and file identity. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { checkSummary, compareFloors, parseFloors, parseMap, parseSummary, readBaseFloors, updateFloors, minimumFloors, type Floors, type Summary } from './ratchet.mts';

function summary(pct = 90, file = 'site/a.mts'): Summary {
  const counts = { hit: pct, total: 100, pct };
  return { version: 1, qualified: true, scopeId: 'root', scope: [file], files: [{ file, loaded: true, exempt: false, lines: counts, branches: counts, functions: counts }], aggregate: { lines: counts, branches: counts, functions: counts } };
}
function floors(pct = 80): Floors { return { version: 1, scope: { id: 'root', files: ['site/a.mts'] }, aggregate: { lines: pct, branches: pct, functions: pct }, files: { 'site/a.mts': { lines: pct, branches: pct, functions: pct } } }; }

test('summary check rejects each aggregate and file metric below its floor', () => {
  for (const metric of ['lines', 'branches', 'functions'] as const) {
    const aggregate = summary(); aggregate.aggregate[metric] = { hit: 79, total: 100, pct: 79 };
    assert.ok(checkSummary(aggregate, floors()).some(f => f.startsWith(`aggregate ${metric}`)));
    const file = summary(); file.files[0]![metric] = { hit: 79, total: 100, pct: 79 };
    assert.ok(checkSummary(file, floors()).some(f => f.startsWith(`site/a.mts ${metric}`)));
  }
  assert.deepEqual(checkSummary(summary(), floors()), []);
});
test('summary check rejects missing and newly exempt floors', () => {
  const missing = summary(); missing.files = [];
  assert.match(checkSummary(missing, floors()).join(), /Missing/);
  const exempt = summary(); exempt.files[0]!.exempt = true;
  assert.match(checkSummary(exempt, floors()).join(), /exempt/);
});
test('update preserves higher existing aggregate and file floors', () => {
  const next = updateFloors(summary(79), floors(80));
  assert.equal(next.aggregate.lines, 80);
  assert.equal(next.files['site/a.mts']!.branches, 80);
  assert.notDeepEqual(checkSummary(summary(79), next), []);
});
test('initial baseline rounds down to one decimal and omits exemptions', () => {
  const input = summary();
  input.aggregate.lines = { hit: 8099, total: 10000, pct: 80.99 };
  input.files[0]!.lines = input.aggregate.lines;
  assert.equal(updateFloors(input).files['site/a.mts']!.lines, 80.9);
  input.files[0]!.exempt = true;
  assert.deepEqual(updateFloors(input).files, {});
});
test('disappearance requires explicit move or reasoned retirement', () => {
  assert.throws(() => updateFloors(summary(90, 'site/b.mts'), floors()), /Disappeared/);
  const next = updateFloors(summary(70, 'site/b.mts'), floors(), { 'site/a.mts': 'site/b.mts' });
  assert.equal(next.files['site/b.mts']!.lines, 80);
  assert.deepEqual(compareFloors(floors(), next, new Set(['site/b.mts'])), []);
  const retired = updateFloors(summary(90, 'site/b.mts'), floors(), {}, { 'site/a.mts': 'deleted' });
  assert.deepEqual(compareFloors(floors(), retired, new Set(['site/b.mts'])), []);
});
test('base check rejects lowered aggregate and file floors for every metric', () => {
  for (const metric of ['lines', 'branches', 'functions'] as const) {
    const next = floors(); next.aggregate[metric] = 79;
    assert.ok(compareFloors(floors(), next).includes(`Lowered aggregate ${metric}`));
    next.aggregate[metric] = 80; next.files['site/a.mts']![metric] = 79;
    assert.ok(compareFloors(floors(), next).includes(`Lowered site/a.mts ${metric}`));
  }
});
test('base check rejects deleted file floors and lowered moved floors', () => {
  const removed = floors(); removed.files = {};
  assert.match(compareFloors(floors(), removed).join(), /Deleted floor/);
  const moved = parseFloors({ ...floors(), files: { 'site/b.mts': { lines: 79, branches: 80, functions: 80 } }, moves: { 'site/a.mts': 'site/b.mts' } });
  assert.match(compareFloors(floors(), moved).join(), /Lowered site\/a.mts lines/);
});
test('identity history survives subsequent moves and cannot be rewritten', () => {
  const first = updateFloors(summary(90, 'site/b.mts'), floors(), { 'site/a.mts': 'site/b.mts' });
  const second = updateFloors(summary(95, 'site/c.mts'), first, { 'site/b.mts': 'site/c.mts' });
  assert.deepEqual(compareFloors(floors(), second, new Set(['site/c.mts'])), []);
  assert.deepEqual(compareFloors(first, second, new Set(['site/c.mts'])), []);
  const rewritten = { ...second, moves: { 'site/a.mts': 'site/c.mts', 'site/b.mts': 'site/c.mts' } };
  assert.match(compareFloors(first, rewritten).join(), /Changed move history/);
  const retired = updateFloors(summary(90, 'site/b.mts'), floors(), {}, { 'site/a.mts': 'deleted' });
  assert.match(compareFloors(retired, { ...retired, retired: {} }).join(), /Changed retirement history/);
});
test('runtime validation rejects invalid counts, paths, maps, and identity', { timeout: 5000 }, () => {
  assert.throws(() => parseSummary({ ...summary(), version: 2 }), /version/);
  assert.throws(() => parseSummary({ ...summary(), files: [summary().files[0], summary().files[0]] }), /Duplicate/);
  const bad = summary(); bad.aggregate.lines.pct = 20;
  assert.throws(() => parseSummary(bad), /disagrees/);
  assert.throws(() => parseFloors({ ...floors(), aggregate: { lines: -1, branches: 80, functions: 80 } }), /percentage/);
  assert.throws(() => parseMap({ '../escape': 'site/a.mts' }), /relative/);
  assert.throws(() => parseMap({ 'site/a.mts': ' ' }, true), /reason/);

  assert.throws(() => parseFloors({ ...floors(), moves: { 'site/b.mts': 'site/missing.mts' } }), /absent/);
  assert.throws(() => updateFloors(summary(), floors(), { 'site/unknown.mts': 'site/a.mts' }), /existing/);
  assert.deepEqual(parseSummary(summary()), summary());
});
test('summary scope equals its file set, including never-loaded files', () => {
  assert.throws(() => parseSummary({ ...summary(), scope: [] }), /Scope/);
  assert.throws(() => parseSummary({ ...summary(), scope: ['site/b.mts'] }), /Scope/);
  assert.throws(() => parseSummary({ ...summary(), scope: ['site/a.mts', 'site/a.mts'] }), /Scope/);
});
test('summary aggregate must sum nonexempt hit and total counts', () => {
  for (const metric of ['lines', 'branches', 'functions'] as const) {
    const input = summary(); input.aggregate = { ...input.aggregate, [metric]: { hit: 100, total: 100, pct: 100 } };
    assert.throws(() => parseSummary(input), /must sum/);
    const denominator = summary(); denominator.aggregate = { ...denominator.aggregate, [metric]: { hit: 180, total: 200, pct: 90 } };
    assert.throws(() => parseSummary(denominator), /must sum/);
  }
  const exempt = summary(); exempt.files[0]!.exempt = true;
  exempt.aggregate = { lines: { hit: 0, total: 0, pct: 100 }, branches: { hit: 0, total: 0, pct: 100 }, functions: { hit: 0, total: 0, pct: 100 } };
  assert.equal(parseSummary(exempt).aggregate.lines.total, 0);
});
test('base floors can be introduced only against a valid commit', () => {
  assert.equal(readBaseFloors('HEAD', 'output/coverage/never-committed-floors.json'), undefined);
  assert.throws(() => readBaseFloors('coverage-invalid-ref-does-not-exist', 'output/coverage/never-committed-floors.json'));
});

test('hand-edited retirement and missing new floors cannot evade the ratchet', () => {
  const attack = floors(); attack.files = {}; attack.retired = { 'site/a.mts': 'deleted' };
  assert.match(checkSummary(summary(), attack).join(), /Retired path still in scope/);
  assert.match(compareFloors(floors(), attack, new Set(['site/a.mts'])).join(), /exists at head/);
  assert.match(checkSummary(summary(0, 'site/new.mts'), floors()).join(), /Missing floor/);
});
test('scope id and file list must match independently of percentages', () => {
  assert.match(checkSummary({ ...summary(), scopeId: 'site' }, floors()).join(), /Stored scope/);
  const changed = floors(); changed.scope.files.push('site/b.mts');
  assert.match(checkSummary(summary(), changed).join(), /Stored scope/);
});
test('retirement reasons and move targets are checked', () => {
  for (const reason of ['split', 'anything', 'exempt:', 'merged-into:../bad']) assert.throws(() => parseMap({ 'site/a.mts': reason }, true));
  const retired = updateFloors(summary(90, 'site/b.mts'), floors(), {}, { 'site/a.mts': 'deleted' });
  assert.deepEqual(compareFloors(floors(), retired, new Set(['site/b.mts'])), []);
  const moved = updateFloors(summary(90, 'site/b.mts'), floors(), { 'site/a.mts': 'site/b.mts' });
  assert.match(compareFloors(floors(), moved, new Set()).join(), /target absent/);
  assert.deepEqual(compareFloors(floors(), moved, new Set(['site/b.mts'])), []);
});

test('failing test evidence can neither seed nor pass floors', () => {
  const failed = { ...summary(), qualified: false };
  assert.throws(()=>updateFloors(failed), /qualified/);
  assert.match(checkSummary(failed,floors()).join(), /Unqualified/);
});

test('repeated minima use every run and reject failing runs or scope changes', () => {
  const result = minimumFloors([summary(90),summary(85),summary(95)]);
  assert.equal(result.aggregate.lines,85);assert.equal(result.files['site/a.mts']!.branches,85);
  assert.throws(()=>minimumFloors([summary(),{...summary(),qualified:false},summary()]), /qualified/);
  assert.throws(()=>minimumFloors([summary(),{...summary(),scopeId:'site'},summary()]), /scopes/);
  assert.throws(()=>minimumFloors([summary(),summary()]), /three/);
});

test('move cycles fail fast in an isolated process', { timeout: 5000 }, () => {
  const input={...floors(),moves:{'site/b.mts':'site/c.mts','site/c.mts':'site/b.mts'}};
  const script=`import {parseFloors} from ${JSON.stringify(new URL('./ratchet.mts',import.meta.url).href)}; try {parseFloors(${JSON.stringify(input)});process.exitCode=1;} catch(error) {if(!/cycle/i.test(error.message)) throw error;console.log('CYCLE REJECTED');}`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:4000});
  assert.equal(result.status,0,`Cycle failed to terminate: ${result.error}`);
  assert.match(result.stdout,/CYCLE REJECTED/);
});

test('base comparison consults tracked head by default for the real hand-edit attack', () => {
  const file='site/object-browser.mts';
  const base={...floors(),files:{[file]:floors().aggregate}};
  const attack={...base,files:{},retired:{[file]:'deleted'}};
  assert.match(compareFloors(base,attack).join(),/Retired path exists at head/);
});
