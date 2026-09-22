import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readOracleFixture } from '../../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '../../sources/source-values.mts';
import { eigencurveBasis } from './eigenmap-fit.mts';

const fixture = await readOracleFixture('eclipse-map/theresa-eigenbasis.json');
const harmonicCurves = {
  nondegenerate: [
    [0.5, -1, 2, 0.25, 1.5, -0.75, 0.2, 1.1, -0.4],
    [1.2, 0.3, -0.8, 2.1, -1.4, 0.9, 1.7, -0.2, 0.6],
    [-0.4, 1.8, 0.7, -1.1, 0.2, 2.3, -0.9, 0.5, 1.4],
    [2, -0.5, 1.1, 0.8, -0.3, -1.6, 0.4, 1.9, -1.2],
  ],
  'rank-deficient': [
    [1, 0, -1, 0, 1, -1, 0, 0],
    [2, 0, -2, 0, 2, -2, 0, 0],
    [0, 1, 0, -2, 0, 0.5, 1, -0.5],
    [1, 0.25, -1, -0.5, 1, -0.875, 0.25, -0.125],
  ],
} as const;
const oracleInputs: Record<string, readonly (readonly number[])[]> = {
  ...harmonicCurves,
  'small-scale': harmonicCurves.nondegenerate.map(row => row.map(value => value * 1e-10)),
  'large-scale': harmonicCurves.nondegenerate.map(row => row.map(value => value * 1e80)),
};

const numbers = (value: unknown) => requireArray(value).map(entry => requireFiniteNumber(entry));
function close(actual: number, expected: number, label: string) {
  const error = Math.abs(actual - expected), tolerance = 2e-10 * Math.max(1, Math.abs(expected));
  assert.ok(error <= tolerance, `${label}: ${actual} differs from ${expected} by ${error}`);
}
function projector(vector: Float64Array) {
  return Array.from({ length: vector.length * vector.length }, (_, index) => vector[Math.floor(index / vector.length)]! * vector[index % vector.length]!);
}

for (const [name, rows] of Object.entries(oracleInputs)) test(`NumPy/ThERESA eigencurve oracle: ${name}`, () => {
  const expected = requireRecord(fixture.cases[name]), input = rows.map(row => Float64Array.from(row));
  assert.equal(requireFiniteNumber(expected.harmonics), input.length);
  assert.equal(requireFiniteNumber(expected.samples), input[0]!.length);
  const actual = eigencurveBasis(input), components = requireArray(expected.components).map(entry => requireRecord(entry));
  assert.equal(actual.curves.length, components.length, 'retained rank');
  assert.equal(actual.harmonicCoefficients.length, components.length);
  assert.equal(actual.eigenvalues.length, components.length);
  components.forEach((component, k) => {
    close(actual.eigenvalues[k]!, requireFiniteNumber(component.squaredSingularValue), `component ${k} squared singular value`);
    const expectedCoefficients = numbers(component.coefficientProjector), actualCoefficients = projector(actual.harmonicCoefficients[k]!);
    const expectedCurve = numbers(component.curveProjector), actualCurve = projector(actual.curves[k]!);
    assert.equal(actualCoefficients.length, expectedCoefficients.length);
    assert.equal(actualCurve.length, expectedCurve.length);
    actualCoefficients.forEach((value, index) => close(value, expectedCoefficients[index]!, `component ${k} coefficient projector ${index}`));
    actualCurve.forEach((value, index) => close(value, expectedCurve[index]!, `component ${k} curve projector ${index}`));
  });
});

test('eigencurve decomposition rejects malformed harmonic matrices', () => {
  assert.throws(() => eigencurveBasis([]), /non-empty rectangular/u);
  assert.throws(() => eigencurveBasis([new Float64Array(0)]), /non-empty rectangular/u);
  assert.throws(() => eigencurveBasis([new Float64Array(2), new Float64Array(3)]), /non-empty rectangular/u);
  assert.throws(() => eigencurveBasis([Float64Array.from([1, NaN])]), /finite/u);
  assert.throws(() => eigencurveBasis([Float64Array.from([1e200, 1e200])]), /overflowed/u);
});
