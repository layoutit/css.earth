/** Real V8 fixtures verify observable optional continuations and unobservable initializer limits. */
import assert from 'node:assert/strict';
import { Session } from 'node:inspector/promises';
import { runInThisContext } from 'node:vm';
import test from 'node:test';
import { sourceUnits } from './units.mts';
import { directIntervals } from './convert.mts';
import { parseFunctions } from './raw.mts';

async function probe(source: string) {
  const session = new Session(); session.connect();
  try {
    await session.post('Profiler.enable');
    await session.post('Profiler.startPreciseCoverage', { detailed: true, callCount: true });
    runInThisContext(source, { filename: 'coverage-units-probe.js' });
    const result = await session.post('Profiler.takePreciseCoverage');
    const script = result.result.find(s => s.url === 'coverage-units-probe.js');
    assert.ok(script);
    return parseFunctions(script.functions);
  } finally { session.disconnect(); }
}
test('optional property, nested chain, call and element continuations map real zero and hit ranges', async () => {
  for (const [expression, argument] of [['a?.b?.c', '{b:{c:1}}'], ['a?.()', '()=>1'], ['a?.[0]', '[1]']]) {
    const source = `(function(){function f(a){return ${expression}} f(null)})();`;
    const units = sourceUnits('probe.js', source).units.filter(u => u.label === 'optional:continuation');
    assert.equal(units.length, expression === 'a?.b?.c' ? 2 : 1);
    const zero = directIntervals(await probe(source), source.length).intervals;
    for (const unit of units) assert.ok(zero.some(r => !r.covered && r.start <= unit.start && r.end >= unit.end));
    const hitSource = source.replace('f(null)', `f(${argument})`);
    const hit = directIntervals(await probe(hitSource), hitSource.length).intervals;
    for (const unit of units) assert.ok(hit.some(r => r.covered && r.start <= unit.start && r.end >= unit.end));
  }
});
test('defaults have no distinct range; static and instance initializers overlap', async () => {
  const source = '(function(){function f(a=7){return a} f(); class C {static s=1; field=2}})();';
  const functions = await probe(source);
  assert.equal(functions.find(f=>f.functionName==='f')!.ranges.length, 1);
  const fields = functions.filter(f=>f.functionName.includes('initializer'));
  assert.equal(fields.length, 2);
  assert.deepEqual(fields[0]!.ranges.map(r=>[r.startOffset,r.endOffset]), fields[1]!.ranges.map(r=>[r.startOffset,r.endOffset]));
  const result = sourceUnits('probe.js',source);
  assert.ok(result.limits.some(l=>l.includes('default initializer')));
  assert.ok(result.limits.some(l=>l.includes('static field')));
  assert.ok(!result.units.some(u=>u.label==='parameter:default'));
});
test('static fields have no executable-line denominator while instance fields remain visible', () => {
  const result = sourceUnits('fields.mts', 'class C {\n static s = 1;\n field = 2;\n}\n');
  assert.deepEqual(result.units.filter(u=>u.kind==='lines').map(u=>u.line),[1,3]);
});
