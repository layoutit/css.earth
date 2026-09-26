import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedWorldContextSummary } from '../../prepared-data/world-context.js';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';

const summary = parsePreparedWorldContextSummary(JSON.parse(await readFile(
  new URL('../../../../../src/objects/sun/prepared/world-context-summary.json', import.meta.url), 'utf8')));
const points = [summary.focus, ...summary.bodies];
const earth = summary.bodies.find(body => body.id === 'earth')!;

function earthDetail(): WorldContextView {
  return {
    world: { referenceFrame: summary.frame.referenceFrame, epochJdTt: summary.frame.epochJdTt,
      pose: { positionM: [earth.positionM[0], earth.positionM[1], earth.positionM[2] + 5 * earth.radiusM],
        orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 1727, widthPixels: 1995, heightPixels: 1236, principalOffsetPixels: [0, 0] },
    selectedId: 'earth', overview: false, navigationInFlight: false, anchorOnly: false,
    bodies: points.map(body => ({ hovered: false, orbitHidden: false, labelHidden: false,
      labelSize: { width: body.name.length * 6, height: 14 }, labelShown: false, labelPlacement: 0,
      indicatorShown: false, indicatorRadius: 8, orbitAppearance: { width: 1, opacity: 1 } })),
  };
}

test('close Earth detail requests its moon family, not unrelated solar or comet paths', () => {
  const planner = createWorldContextPlanner(summary), view = earthDetail();
  planner(view);
  const wanted = planner.takeWantedOrbits();
  expect(wanted).toContain('moon');
  expect(wanted.every(id => summary.bodies.find(body => body.id === id)?.orbit?.centerBodyId === 'earth')).toBe(true);

  // An explicit hover makes that path relevant even while the Earth fills the view.
  view.bodies[points.findIndex(body => body.id === 'comet-67p')]!.hovered = true;
  planner(view);
  expect(planner.takeWantedOrbits()).toContain('comet-67p');

  // The wider world resumes its normal orbit demand instead of dropping those paths permanently.
  view.selectedId = 'sun'; view.overview = true;
  view.world = { ...view.world, pose: { ...view.world.pose, positionM: [0, 0, 20 * 149_597_870_700] } };
  planner(view);
  expect(planner.takeWantedOrbits()).toContain('earth');
});
