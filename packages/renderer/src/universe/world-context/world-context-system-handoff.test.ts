import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedWorldContextSummary } from '../../prepared-data/world-context.js';
import { createWorldContextPlanner, type WorldContextView } from './world-context-planner.js';

const plan = parsePreparedWorldContextSummary(JSON.parse(await readFile(
  new URL('../../../../../src/objects/sun/prepared/world-context-summary.json', import.meta.url), 'utf8')));
const bodies = [plan.focus, ...plan.bodies];

for (const host of bodies.filter(body => body.systemView)) {
  test(`${host.id} keeps the same proxy demand when its system flight finishes`, () => {
    // The host's marker is the question, so each test plans the host's own system: planning the whole universe once per host
    // grew with systems times bodies, and ~1,000 exoplanet hosts (batch 1, 2026-09-29) ran past the job's 25 minutes.
    const members = new Set([host.id, ...host.systemView!.memberIds]);
    const system = { ...plan, bodies: plan.bodies.filter(body => members.has(body.id)) }, bodies = [system.focus, ...system.bodies];
    const calculate = createWorldContextPlanner(system);
    for (const diameter of [4, 45]) {
      const focalPixels = 1000;
      const input: WorldContextView = {
        world: { referenceFrame: plan.frame.referenceFrame, epochJdTt: plan.frame.epochJdTt,
          pose: { positionM: [host.positionM[0], host.positionM[1],
            host.positionM[2] + Math.hypot(host.radiusM, 2 * focalPixels * host.radiusM / diameter)],
          orientationXyzw: [0, 0, 0, 1] } },
        viewport: { focalPixels, widthPixels: 820, heightPixels: 1094, principalOffsetPixels: [0, 0] },
        selectedId: host.id, selectionPreview: host.id, overview: true,
        navigationInFlight: true, anchorOnly: false,
        bodies: bodies.map(body => ({ hovered: false, orbitHidden: false, labelHidden: false,
          labelSize: { width: body.name.length * 6, height: 14 }, labelShown: false, labelPlacement: 0,
          indicatorShown: false, indicatorRadius: 8, orbitAppearance: { width: 1, opacity: 1 } })),
      };
      const index = bodies.indexOf(host);
      const approaching = calculate(input).projectedBodies.find(body => body.index === index)!.markerOpacity;
      input.selectionPreview = undefined;
      input.navigationInFlight = false;
      const arrived = calculate(input).projectedBodies.find(body => body.index === index)!.markerOpacity;
      expect(arrived, `${diameter}px arrival must preserve the proxy/detail split`).toBe(approaching);
      expect(arrived).toBe(diameter < 14 ? 1 : 0);
    }
  });
}
