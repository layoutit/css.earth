import { expect, test } from 'vitest';
import { bindWorldBodyColumns, createWorldBodyColumns, packWorldBodies, unpackWorldBodies } from './world-context-view-transport.js';
import type { WorldBodyPresentation } from './world-context-planner.js';

test('packed body presentation round-trips exactly, including absent optional flags', () => {
  const bodies: WorldBodyPresentation[] = [
    { hovered: true, orbitHidden: false, labelHidden: true, labelSize: { width: 57, height: 18 }, labelShown: true,
      labelPlacement: 3, indicatorShown: false, indicatorRadius: 8.25, orbitAppearance: { width: 1, opacity: 0.6499999999999999 } },
    { hovered: false, bodyHidden: false, orbitHidden: true, labelHidden: false, labelSuppressed: true, indicatorHidden: false, highlighted: true,
      labelSize: { width: Number.NaN, height: 0 }, labelShown: false, labelPlacement: 0, indicatorShown: true,
      indicatorRadius: 10, orbitAppearance: { width: 1.5, opacity: 1e-12 } },
  ];
  const packed = packWorldBodies(bodies);
  expect(packed.length).toBe(30);
  expect(unpackWorldBodies(packed)).toEqual(bodies);
  expect(Object.keys(unpackWorldBodies(packed)[0]!)).not.toContain('bodyHidden');
  expect(Object.keys(unpackWorldBodies(packed)[0]!)).not.toContain('highlighted');
  bodies[1]!.highlighted = false;
  expect(unpackWorldBodies(packWorldBodies(bodies))).toEqual(bodies);
  expect(() => unpackWorldBodies(new Float64Array(13))).toThrow(/malformed/);
});

test('bound columns hold exactly what packing the entries gives, after any writes', () => {
  const entry = (hovered: boolean): WorldBodyPresentation & { name: string } => ({ hovered, orbitHidden: false, labelHidden: false,
    labelSize: { width: 0, height: 0 }, labelShown: false, labelPlacement: 0, indicatorShown: false, indicatorRadius: 8,
    orbitAppearance: { width: 1, opacity: 1 }, name: 'kept' });
  const entries = [entry(false), entry(true), entry(false)];
  const columns = createWorldBodyColumns(entries.length);
  entries.forEach((body, index) => bindWorldBodyColumns(body, columns, index));
  expect(columns).toEqual(packWorldBodies(entries));
  entries[0]!.hovered = true; entries[0]!.bodyHidden = true; entries[1]!.labelSuppressed = false; entries[2]!.highlighted = true;
  entries[1]!.labelSize = { width: 42, height: 14 }; entries[2]!.labelSize = { ...entries[2]!.labelSize, width: 0 };
  entries[0]!.labelShown = true; entries[0]!.labelPlacement = 2; entries[1]!.indicatorShown = true; entries[1]!.indicatorRadius = 10;
  entries[2]!.orbitAppearance = { width: 1.5, opacity: .4 }; entries[0]!.bodyHidden = undefined;
  expect(columns, 'every write lands in its row').toEqual(packWorldBodies(entries));
  expect(entries[1]!.labelSize).toEqual({ width: 42, height: 14 });
  expect(entries[0]!.name, 'other fields are untouched').toBe('kept');
});
