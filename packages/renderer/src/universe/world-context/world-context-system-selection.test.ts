import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedWorldContext } from '../../prepared-data/world-context.js';
import { createWorldContextPlanner, type WorldContextView } from './world-context-planner.js';
import { createContextSelectionPolicy } from '../context-presentation-policy.js';

const plan = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));

test('a selected satellite overview retains its host emphasis and family dimming', () => {
  const host = plan.bodies.find(body => body.id === 'jupiter')!;
  const positionM = [host.positionM[0], host.positionM[1], host.positionM[2] + 1e10] as const;
  const view: WorldContextView = {
    world: { referenceFrame: plan.frame.referenceFrame, epochJdTt: plan.frame.epochJdTt,
      pose: { positionM, orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 1727, widthPixels: 1995, heightPixels: 1236, principalOffsetPixels: [170, 0] },
    selectedId: host.id, overview: true, overviewSelection: true, navigationInFlight: false, anchorOnly: false,
    bodies: [plan.focus, ...plan.bodies].map(body => ({ hovered: false, orbitHidden: false, labelHidden: false,
      labelSize: { width: body.name.length * 6, height: 14 }, labelShown: false, labelPlacement: 0,
      indicatorShown: false, indicatorRadius: 8, orbitAppearance: { width: 1, opacity: 1 } })),
  };
  const calculate = createWorldContextPlanner(plan);
  const selected = calculate(view);
  expect(selected.emphasizedId).toBe('jupiter');
  const policy = createContextSelectionPolicy(plan), strength = policy.strengthAt(selected.emphasizedId, positionM);
  expect(policy.opacity('io', selected.emphasizedId, false, strength)).toBe(1);
  expect(policy.opacity('earth', selected.emphasizedId, false, strength)).toBe(.25);
  const widePosition = [host.positionM[0], host.positionM[1], host.positionM[2] + 30 * 149597870700] as const;
  expect(policy.strengthAt(selected.emphasizedId, widePosition)).toBe(0);
  expect(policy.strengthAt(selected.emphasizedId, widePosition, true)).toBe(1);
  expect(calculate({ ...view, overviewSelection: false }).emphasizedId).toBeNull();
  expect(calculate({ ...view, overview: false, overviewSelection: false }).emphasizedId).toBe('jupiter');
});
