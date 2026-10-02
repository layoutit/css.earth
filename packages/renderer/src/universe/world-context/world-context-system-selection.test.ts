import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parsePreparedWorldContext } from '../../prepared-data/world-context.js';
import { createWorldContextPlanner, type WorldContextView } from './world-context-planner.js';

const plan = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));

test('a selected satellite overview retains its selected host locator', () => {
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
  assert.equal(selected.emphasizedId, 'jupiter');
  assert.equal(calculate({ ...view, overviewSelection: false }).emphasizedId, null);
  assert.equal(calculate({ ...view, overview: false, overviewSelection: false }).emphasizedId, 'jupiter');
  // Orbits outside the selected family, the host's own included, are dim context; a hovered one is not.
  // The planner retains its outputs, so each frame's values are read before the next is planned.
  const index = (id: string) => 1 + plan.bodies.findIndex(body => body.id === id);
  const moons = plan.bodies.filter(body => body.orbit?.centerBodyId === 'jupiter').map(body => body.id);
  const ids = ['saturn', 'jupiter', ...moons];
  const orbits = (next: WorldContextView) => { const frame = calculate(next); return new Map(ids.map(id => [id, frame.projectedBodies[index(id)]!.orbitVisibility])); };
  // The moons' paths fill the close view; the planets' reach the screen from a hundred times further out.
  const wide = { ...view, world: { ...view.world, pose: { ...view.world.pose, positionM: [positionM[0], positionM[1], host.positionM[2] + 1e12] as const } } };
  const close = orbits(view), closePlain = orbits({ ...view, overviewSelection: false });
  const dimmed = orbits(wide), plain = orbits({ ...wide, overviewSelection: false });
  const hovered = orbits({ ...wide, bodies: wide.bodies.map((body, at) => at === index('saturn') ? { ...body, hovered: true } : body) });
  for (const id of ['saturn', 'jupiter']) assert.deepEqual([dimmed.get(id), plain.get(id), hovered.get(id)], [.25, 1, id === 'saturn' ? 1 : .25], id);
  // On the host's own page its path is the subject's and stays whole; the other planets' paths are still context.
  const page = orbits({ ...wide, overview: false, overviewSelection: false });
  assert.equal(page.get('jupiter'), 1);
  assert.ok(page.get('saturn')! >= .25 && page.get('saturn')! < 1);
  assert.ok(moons.some(id => close.get(id) === 1));
  for (const id of moons) assert.equal(close.get(id), closePlain.get(id), id);
});
