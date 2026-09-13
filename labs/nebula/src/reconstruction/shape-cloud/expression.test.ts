import test from 'node:test';
import assert from 'node:assert/strict';
import type { ShapeCloudSettings } from './types.js';
import { formatShapeExpression, parseShapeExpression } from './expression.js';

function settings(): ShapeCloudSettings {
  return { exposure: .7, components: [0, 1, 2].map(index => ({ id: `shape-${index + 1}`, label: `Component ${index + 1}`,
    groupId: 'group', memberIds: [`ellipse-${index + 1}`], shape: index === 0 ? 'shell' : index === 1 ? 'ring' : 'ellipsoid',
    operation: index === 1 ? 'subtract' : 'add', x: 12 + index, y: 24 + index, radiusX: 30 + index, radiusY: 18 + index,
    rotationDegrees: 35, weight: index === 1 ? .75 : index + 1, thickness: .1, softness: .04, depth: .8, enabled: true })) };
}

test('canonical expression roundtrips signed weights without changing geometry, grouping or exposure', () => {
  const source = settings(), before = structuredClone(source);
  const expression = formatShapeExpression(source);
  assert.equal(expression, '1 * S1 - 0.75 * S2 + 3 * S3');
  assert.deepEqual(parseShapeExpression(expression, source), source);
  assert.deepEqual(source, before, 'Formatting and parsing must not mutate the current settings.');
  const changed = parseShapeExpression('2 * S1 - .4*S2 + S1', source);
  assert.deepEqual(changed.components.map(component => [component.weight, component.operation, component.enabled]),
    [[3, 'add', true], [.4, 'subtract', true], [0, 'add', false]]);
  changed.components.forEach((component, index) => {
    const original = source.components[index]!;
    const { weight: _weight, operation: _operation, enabled: _enabled, ...geometry } = component;
    const { weight: _oldWeight, operation: _oldOperation, enabled: _oldEnabled, ...originalGeometry } = original;
    assert.deepEqual(geometry, originalGeometry);
  });
  assert.equal(changed.exposure, source.exposure);
});

test('aliases stay stable across disabled shapes, zero clears all, and a negative first term is valid', () => {
  const source = settings(); source.components[0]!.enabled = false;
  assert.equal(formatShapeExpression(source), '- 0.75 * S2 + 3 * S3');
  const parsed = parseShapeExpression('-S2 + 0*S3', source);
  assert.equal(parsed.components[1]!.operation, 'subtract'); assert.equal(parsed.components[1]!.weight, 1);
  assert.deepEqual(parsed.components.map(component => component.enabled), [false, true, false]);
  const cleared = parseShapeExpression(' 0 ', source);
  assert.equal(formatShapeExpression(cleared), '0');
  assert.ok(cleared.components.every(component => !component.enabled && component.weight === 0));
  assert.equal(cleared.components[1]!.operation, 'subtract');
  assert.equal(formatShapeExpression({ exposure: 1, components: [] }), '0');
});

test('duplicate aliases combine before net bounds are checked, cancellation disables, small finite coefficients survive', () => {
  const source = settings();
  const combined = parseShapeExpression('5*S1 + 5*S1 - 5*S1 + S2 - S2 - 1e-7*S3', source);
  assert.deepEqual(combined.components.map(component => [component.weight, component.enabled, component.operation]),
    [[5, true, 'add'], [0, false, 'subtract'], [1e-7, true, 'subtract']]);
  assert.deepEqual(parseShapeExpression(formatShapeExpression(combined), source), combined);
  assert.equal(parseShapeExpression('.1*S1 + .2*S1 - .3*S1', source).components[0]!.enabled, false, 'Decimal cancellation must not leave a floating-point emission ghost.');
  assert.equal(parseShapeExpression('1e-20*S1', source).components[0]!.weight, 1e-20, 'A genuinely small term must survive cancellation cleanup.');
  assert.throws(() => parseShapeExpression('4*S1 + 2*S1', source), /combined coefficient/);
  assert.throws(() => parseShapeExpression('-4*S1 - 2*S1', source), /combined coefficient/);
});

test('unknown aliases, malformed expressions, executable text and nonfinite/out-of-range coefficients are rejected', () => {
  const source = settings();
  for (const text of ['S4', 'S999999999999999999999']) assert.throws(() => parseShapeExpression(text, source), /Unknown shape/);
  for (const text of ['', 'S0', 'S01', 'S1 S2', 'S1 +', '--S1', 'S1+-S2', '0.5S1', 'S1/2', '(S1)', 'S1**2',
    'S1; globalThis.changed = true', 'Math.sin(S1)', 'NaN*S1', 'Infinity*S1', '1e999*S1', '6*S1', '-6*S1', 'S1 + 0', 'x'.repeat(4097)]) {
    assert.throws(() => parseShapeExpression(text, source), TypeError, text);
  }
});
