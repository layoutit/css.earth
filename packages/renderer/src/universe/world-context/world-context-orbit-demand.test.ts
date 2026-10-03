import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { extendWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldIndex, parsePreparedWorldSystem } from '@cssearth/objects';
import type { PreparedWorldContext } from '@cssearth/objects';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';

// Earth's page's world: the summary, the files every page reads and the Earth system's (site/world-context-plan.mts).
const objects = new URL('../../../../../src/objects/', import.meta.url);
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, objects), 'utf8'));
const index = parsePreparedWorldIndex(await json('sun/prepared/world-index.json'));
let summary: PreparedWorldContext = parsePreparedWorldContextSummary(await json('sun/prepared/world-context-summary.json'));
for (const id of index.files) {
  const file = await json(`${id}/prepared/members.json`) as { anywhere?: unknown };
  if (file.anywhere === true || id === 'earth-system') summary = extendWorldContext(summary, [parsePreparedWorldSystem(file, summary, id)]);
}
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

test('close Earth detail defers orbit banks until a system or targeted path needs them', () => {
  const planner = createWorldContextPlanner(summary), view = earthDetail();
  planner(view);
  const wanted = planner.takeWantedOrbits();
  assert.deepEqual(wanted, []);

  // An explicit hover makes that path relevant even while the Earth fills the view.
  view.bodies[points.findIndex(body => body.id === 'comet-67p')]!.hovered = true;
  planner(view);
  assert.ok(planner.takeWantedOrbits().includes('comet-67p'));

  // Opening the host's system makes its satellite orbit readable and requests its bank.
  view.bodies[points.findIndex(body => body.id === 'comet-67p')]!.hovered = false;
  view.overview = true;
  view.world = { ...view.world, pose: { ...view.world.pose,
    positionM: [earth.positionM[0], earth.positionM[1], earth.positionM[2] + 5e9] } };
  planner(view);
  assert.ok(planner.takeWantedOrbits().includes('moon'));

  // The wider world resumes its normal orbit demand instead of dropping those paths permanently.
  view.selectedId = 'sun'; view.overview = true;
  view.world = { ...view.world, pose: { ...view.world.pose, positionM: [0, 0, 20 * 149_597_870_700] } };
  planner(view);
  assert.ok(planner.takeWantedOrbits().includes('earth'));
});
