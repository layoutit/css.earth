import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedWorldContext } from './prepared-world-context.js';
import { createSystemFade, createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';
import { packWorldBodies, unpackWorldBodies } from './world-context-view-transport.js';
import { createContextSelectionPolicy } from './context-presentation-policy.js';
import { labelImportance } from '../labels/universe-label-policy.js';

const plan = parsePreparedWorldContext(JSON.parse(await readFile(
  new URL('../../../objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
// Tests move the observer in place; the planner itself receives the readonly view.
type World = WorldContextView['world'];
type TestView = Omit<WorldContextView, 'world'> & { world: Omit<World, 'pose'> & { pose: Omit<World['pose'], 'positionM'> & { positionM: [number, number, number] } } };
function view(): TestView {
  return { world: { referenceFrame: plan.frame.referenceFrame, epochJdTt: plan.frame.epochJdTt,
    pose: { positionM: [0, 0, 20 * 149597870700], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 1727, widthPixels: 1995, heightPixels: 1236, principalOffsetPixels: [170, 0] },
    selectedId: plan.focus.id, overview: true, navigationInFlight: false, anchorOnly: false,
    bodies: [plan.focus, ...plan.bodies].map(body => ({ hovered: false, orbitHidden: false, labelHidden: false,
      labelSize: { width: body.name.length * 6, height: 14 }, labelShown: false, labelPlacement: 0,
      indicatorShown: false, indicatorRadius: 8, orbitAppearance: { width: 1, opacity: 1 } })) };
}

test('shell occlusion excludes admitted body labels and repeated committed frames keep their placements', () => {
  const current = view(), planner = createWorldContextPlanner(plan);
  const publish = () => {
    const frame = planner(current);
    for (const body of frame.projectedBodies) Object.assign(current.bodies[body.index], {
      labelShown: body.labelShown, labelPlacement: body.labelPlacement, indicatorShown: body.indicatorShown,
    });
    return frame.projectedBodies.filter(body => body.labelShown).map(body => ({ index: body.index, placement: body.labelPlacement, point: [...body.labelPosition!] }));
  };
  publish();
  const settled = publish();
  expect(publish()).toEqual(settled);
  expect(settled.length).toBeGreaterThan(0);
  const first = settled[0], size = current.bodies[first.index].labelSize;
  const [x, y] = first.point;
  current.labelBlockers = [{ left: x - 2, top: y - 2, right: x + size.width + 2, bottom: y + size.height + 2 }];
  const next = publish();
  for (const label of next) {
    const [lx, ly] = label.point, labelSize = current.bodies[label.index].labelSize, blocked = current.labelBlockers[0];
    expect(lx < blocked.right && lx + labelSize.width > blocked.left && ly < blocked.bottom && ly + labelSize.height > blocked.top).toBe(false);
  }
});

test('complete context frames cross a structured-clone boundary without mutating the input owner', () => {
  const calculate = createWorldContextPlanner(freeze(plan));
  const input = freeze(view());
  const savedInput = structuredClone(input);
  const first = structuredClone(calculate(input));
  const savedFirst = structuredClone(first);
  expect(first.projectedBodies.some(body => body.segments.length > 0)).toBe(true);
  for (const distance of [5, 50, 5000, 20]) {
    const next = structuredClone(input);
    Object.assign(next.world.pose, { positionM: [next.world.pose.positionM[0], next.world.pose.positionM[1], distance * 149597870700] });
    next.selectedId = 'saturn'; next.overview = false;
    next.bodies[0].hovered = true;
    const packet = structuredClone(calculate(freeze(next)));
    expect(packet.emphasizedId).toBe('saturn');
    for (const body of packet.projectedBodies) {
      expect(body).not.toHaveProperty('transforms');
      expect(body.segments.every(segment => segment.length === 5 && segment.every(Number.isFinite))).toBe(true);
    }
  }
  expect(input).toEqual(savedInput);
  expect(first).toEqual(savedFirst);
  // Replaying the same committed inputs is independent of requests that ran
  // in between: rejected/superseded frames cannot own decluttering history.
  expect(structuredClone(calculate(input))).toEqual(first);
});

test('retired and incompatible frame requests respect prepared identity and measured optics', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.anchorOnly = true;
  // The anchor and every placed orbitless body (Betelgeuse) remain as galactic locators.
  const locators = [plan.focus, ...plan.bodies].flatMap((body, index) => index === 0 || !('orbit' in body && body.orbit) ? [index] : []);
  expect(locators.length).toBeGreaterThan(1);
  expect(calculate(input).projectedBodies.map(body => body.index)).toEqual(locators);
  expect(() => calculate({ ...input, selectedId: 'missing' })).toThrow('unavailable');
  expect(() => calculate({ ...input, bodies: [] })).toThrow('matching frame');
  expect(() => calculate({ ...input, viewport: { ...input.viewport, widthPixels: undefined } })).toThrow('measured viewport');
  expect(() => calculate({ ...input, world: { ...input.world, epochJdTt: input.world.epochJdTt + 1 } })).toThrow('matching frame');
});

test('overview uses its prepared billboard even when the retained surface is large', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.world.pose.positionM = [0, 0, plan.focus.radiusM * 20];
  const marker = (overview: boolean) => calculate({ ...input, overview }).projectedBodies.find(body => body.index === 0)!;
  expect(marker(true).markerOpacity).toBe(1);
  expect(marker(false).markerOpacity).toBe(0);
});

test('a departed focus outside the view cannot blank the surrounding orbit field', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.overview = false; input.navigationInFlight = true; input.selectionPreview = 'arrokoth';
  for (const z of [0, -149597870700, 149597870]) {
    input.world.pose.positionM = [20 * 149597870700, 0, z];
    const packet = calculate(input);
    expect(packet.projectedBodies.some(body => body.orbitVisibility > 0 && body.segments.length > 0),
      `orbit field remains visible while the departed Sun crosses the eye plane at ${z}`).toBe(true);
  }
  // Preserve the close-up fade when the selected disc really fills the view:
  // context lines soften to the shared close-detail floor.
  input.world.pose.positionM = [0, 0, plan.focus.radiusM * 5];
  expect(Math.max(...calculate(input).projectedBodies.map(body => body.orbitVisibility))).toBeLessThanOrEqual(.3);
});

test('zoom jitter does not repeatedly reverse annotation visibility at its exit threshold', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.anchorOnly = true; input.overview = false;
  const sample = (diameter: number) => {
    const radius = plan.focus.radiusM;
    input.world.pose.positionM[2] = Math.hypot(radius, 2 * input.viewport.focalPixels * radius / diameter);
    const body = calculate(input).projectedBodies[0];
    Object.assign(input.bodies[0], { labelShown: body.labelShown, indicatorShown: body.indicatorShown,
      labelPlacement: body.labelPlacement });
    return body;
  };
  // The label leaves at the authored 50% billboard alpha and does not flicker
  // back on when wheel/camera samples straddle that same boundary.
  expect(sample(16).labelShown).toBe(true);
  expect(sample(17.06).labelShown).toBe(false);
  for (const diameter of [16.94, 17.06, 16.94, 17.06]) expect(sample(diameter).labelShown).toBe(false);
  expect(sample(16.64).labelShown).toBe(true);
  expect(sample(16.94).labelShown).toBe(true);
  // Ring eligibility uses the same committed-state rule at the 8px boundary.
  expect(sample(7.7).indicatorShown).toBe(true);
  expect(sample(8.01).indicatorShown).toBe(false);
  for (const diameter of [7.99, 8.01, 7.99]) expect(sample(diameter).indicatorShown).toBe(false);
  expect(sample(7.7).indicatorShown).toBe(true);
});

test('a flight destination keeps its caption and its side across the preview fade', () => {
  for (const overview of [false, true]) {
  const calculate = createWorldContextPlanner(plan), input = view();
  const target = plan.bodies.find(body => body.id === 'mercury')!;
  const index = 1 + plan.bodies.indexOf(target);
  // The shell can still own the source overview while destination detail activates.
  input.selectedId = overview ? plan.focus.id : target.id;
  input.selectionPreview = target.id; input.overview = overview; input.navigationInFlight = true;
  for (const diameter of [4, 8, 13, 14, 17, 21, 50, 150, 300]) {
    input.world.pose.positionM = [target.positionM[0], target.positionM[1],
      target.positionM[2] + Math.hypot(target.radiusM, 2 * input.viewport.focalPixels * target.radiusM / diameter)];
    const body = calculate(input).projectedBodies.find(body => body.index === index)!;
    expect(body.labelShown, `${diameter}px destination must remain named`).toBe(true);
    expect(body.labelPlacement).toBe(0);
    expect(body.indicatorShown, `${diameter}px circle follows the preview handoff`).toBe(diameter < 20);
    if (diameter >= 20) expect(body.markerOpacity).toBe(0);
    Object.assign(input.bodies[index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
      indicatorShown: body.indicatorShown });
  }
  input.navigationInFlight = false; input.overview = false; input.selectedId = target.id;
  expect(calculate(input).projectedBodies.find(body => body.index === index)!.labelShown).toBe(false);
  }
});

test('orbit settings do not change admitted names or label placement', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const labels = () => calculate(input).projectedBodies.filter(body => body.labelShown)
    .map(body => ({ index: body.index, position: body.labelPosition }));
  const before = structuredClone(labels());
  expect(before.length).toBeGreaterThan(0);
  input.bodies.forEach(body => { body.orbitHidden = true; });
  expect(labels()).toEqual(before);
});

test('hidden planetary annotations remove labels, circles and their orbit paths', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies];
  const planets = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  input.world.pose.positionM = [0, 0, 40 * 149597870700];
  input.bodies.forEach((body, index) => { body.labelHidden = planets.has(points[index]!.id); });
  const bodies = calculate(input).projectedBodies;
  const outer = bodies.filter(body => ['jupiter', 'saturn', 'uranus', 'neptune'].includes(points[body.index]!.id));
  expect(outer.every(body => !body.labelShown && !body.indicatorShown)).toBe(true);
  expect(outer.every(body => body.orbitVisibility === 0 && body.segments.length === 0)).toBe(true);
});

test('highlighted moons remain identifiable when their orbits are too small to draw', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const bodies = [plan.focus, ...plan.bodies];
  const moons = new Set(['moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea', 'triton', 'charon']);
  input.bodies.forEach((body, index) => {
    body.highlighted = moons.has(bodies[index].id);
    body.orbitHidden = true;
  });
  for (const distance of [50, 100, 205]) {
    input.world.pose.positionM = [0, 0, distance * 149597870700];
    const frame = calculate({ ...input, bodies: unpackWorldBodies(packWorldBodies(input.bodies)) });
    const admitted = frame.projectedBodies.filter(body => moons.has(bodies[body.index].id) && body.labelShown);
    expect(admitted.length).toBeGreaterThan(0);
    for (const body of admitted) {
      expect(body.indicatorShown).toBe(true);
      expect(body.markerOpacity).toBeGreaterThan(.5);
      expect(body.segments).toHaveLength(0);
    }
  }
  input.bodies.forEach(body => { body.highlighted = false; });
  expect(calculate({ ...input, bodies: unpackWorldBodies(packWorldBodies(input.bodies)) })
    .projectedBodies.filter(body => moons.has(bodies[body.index].id) && body.labelShown)).toHaveLength(0);
});

test('system zoom and rotation never publish a context circle without its caption', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  let paths = 0, crowded = 0;
  for (const distance of [20, 75, 205, 75, 20]) for (const angle of [0, .3, .7, .3, 0]) {
    input.world.pose.positionM = [0, 0, distance * 149597870700];
    Object.assign(input.world.pose, { orientationXyzw: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] });
    const frame = calculate(input);
    for (const body of frame.projectedBodies) {
      if (body.indicatorShown) expect(body.labelShown).toBe(true);
      if (body.segments.length) expect(body.labelShown).toBe(true);
      if (body.segments.length && body.visible && body.labelShown) paths++;
      if (!body.labelShown && body.visible) crowded++;
      Object.assign(input.bodies[body.index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  expect(paths).toBeGreaterThan(0);
  expect(crowded).toBeGreaterThan(0);
});

test('a body too faint for this camera to name draws no ring beside the named ones', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies], index = points.findIndex(body => body.id === 'ceres');
  input.world.pose.positionM = [0, 0, 205 * 149597870700];
  const far = calculate(input).projectedBodies.find(body => body.index === index)!;
  expect(far.visible, 'Ceres is on screen at whole-system range').toBe(true);
  expect(far.labelShown).toBe(false);
  expect(far.indicatorShown).toBe(false);
  expect(far.segments, 'an unnamed body on screen draws no path').toHaveLength(0);
  input.world.pose.positionM = [0, 0, 8 * 149597870700];
  const near = calculate(input).projectedBodies.find(body => body.index === index)!;
  expect(near.labelShown, 'the same body is named once the camera resolves it').toBe(true);
  expect(near.segments.length).toBeGreaterThan(0);
});

test('turning the view never leaves an orbit without its admitted annotation', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies];
  const captions = new Map<string, boolean>();
  let captionFlips = 0, paths = 0;
  // A drag tumbles the camera around the focus. Bodies cross the viewport edge and lose
  // their annotations; no unidentified context path may survive that final admission.
  for (let step = 0; step < 90; step++) {
    const angle = step * .5 * Math.PI / 180, distance = 8 * 149597870700;
    Object.assign(input.world.pose, { orientationXyzw: [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)] });
    input.world.pose.positionM = [0, -distance * Math.sin(angle), distance * Math.cos(angle)];
    for (const body of calculate(input).projectedBodies) {
      const id = points[body.index]!.id;
      if (captions.get(id) !== undefined && captions.get(id) !== body.labelShown) captionFlips++;
      if (body.segments.length) {
        paths++;
        expect(body.labelShown, `${id}'s path must retain its annotation`).toBe(true);
      }
      captions.set(id, body.labelShown);
      Object.assign(input.bodies[body.index]!, { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  expect(captionFlips, 'captions come and go as their bodies cross the edge').toBeGreaterThan(0);
  expect(paths, 'admitted bodies still draw their paths').toBeGreaterThan(0);
});

test('an off-screen body retires its otherwise visible orbit path', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  // Closing in on the Sun takes body after body out of the frame while their projected
  // rings can still sweep the viewport. Those unidentified paths retire with the body.
  let offScreenBodies = 0;
  for (const distance of [1.2, 1.6, 2.2, 3, 4.5]) {
    input.world.pose.positionM = [0, 0, distance * 149597870700];
    for (const body of calculate(input).projectedBodies) {
      if (body.visible || !plan.bodies[body.index - 1]?.orbit) continue;
      offScreenBodies++;
      expect(body.labelShown).toBe(false);
      expect(body.orbitVisibility, 'an off-screen body publishes no unidentified ring').toBe(0);
      expect(body.segments).toHaveLength(0);
      Object.assign(input.bodies[body.index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  expect(offScreenBodies, 'the fixture moves orbiting bodies outside the frame').toBeGreaterThan(0);
});

test('Earth priority keeps its ordinary scale fade and leaves the Sun at outer-space distance', () => {
  const input = view(), points = [plan.focus, ...plan.bodies];
  input.bodies.forEach((body, index) => { body.bodyHidden = !['sun', 'earth'].includes(points[index].id); });
  const calculate = createWorldContextPlanner(plan, {
    sun: labelImportance('star', true, 5), earth: labelImportance('planet', true, 4),
  });
  input.world.pose.positionM = [0, 0, 5 * 149597870700];
  expect(calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index].id)).toContain('earth');
  input.world.pose.positionM = [0, 0, plan.system.hiddenDistanceM * 2];
  expect(calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index].id)).toEqual(['sun']);
});

test('a blocked caption retires context paths but preserves the selected path', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const index = [plan.focus, ...plan.bodies].findIndex(body => body.id === 'saturn');
  const saturn = plan.bodies[index - 1]!;
  input.selectedId = 'saturn'; input.overview = false;
  input.world.pose.positionM = [saturn.positionM[0], saturn.positionM[1], saturn.positionM[2] + saturn.radiusM * 8];
  const clear = calculate(input).projectedBodies.filter(body => body.segments.length).map(body => body.index);
  input.labelBlockers = [{ left: -1000, right: 1000, top: -1000, bottom: 1000 }];
  const frame = calculate(input);
  expect(frame.projectedBodies.every(body => !body.labelShown && !body.indicatorShown)).toBe(true);
  expect(frame.projectedBodies[index].segments.length).toBeGreaterThan(0);
  expect(clear.length).toBeGreaterThan(1);
  expect(frame.projectedBodies.filter(body => body.segments.length).map(body => body.index)).toEqual([index]);
});

test.each(['ryugu', 'bennu'])('%s remains identifiable when its category is hidden, then retires on deselection', id => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies], index = points.findIndex(body => body.id === id);
  const selected = points[index]!;
  input.selectedId = id; input.overview = false;
  input.world.pose.positionM = [selected.positionM[0], selected.positionM[1], selected.positionM[2] + 3.8e10];
  // The shell leaves the selected asteroid's orbit enabled. Hidden bodies,
  // circles and captions still carry the user's category preferences.
  input.bodies.forEach(body => Object.assign(body, { bodyHidden: true, indicatorHidden: true, labelHidden: true }));
  const shown = calculate(input).projectedBodies.find(body => body.index === index)!;
  expect(shown.visible).toBe(true);
  expect(shown.indicatorShown).toBe(true);
  expect(shown.labelShown).toBe(true);
  expect(shown.orbitVisibility).toBeGreaterThan(0);
  expect(shown.segments.length).toBeGreaterThan(0);
  expect(calculate(input).projectedBodies.filter(body => body.visible)).toHaveLength(1);
  input.selectedId = plan.focus.id; input.overview = true;
  const hidden = calculate(input).projectedBodies.find(body => body.index === index)!;
  expect(hidden.visible).toBe(false);
  expect(hidden.indicatorShown).toBe(false);
  expect(hidden.labelShown).toBe(false);
  expect(hidden.segments).toHaveLength(0);
});

test('planet views label their own moon family, with a bounded total', () => {
  const points = [plan.focus, ...plan.bodies];
  const calculate = createWorldContextPlanner(plan), input = view();
  const saturn = points.find(body => body.id === 'saturn')!;
  input.selectedId = 'saturn'; input.overview = false;
  input.world.pose.positionM = [saturn.positionM[0], saturn.positionM[1], saturn.positionM[2] + 4e10];
  const names = calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index]!);
  expect(names.length).toBeLessThanOrEqual(24);
  expect(names.some(body => body.id === 'saturn')).toBe(true);
  expect(names.filter(body => 'orbit' in body && body.orbit && body.orbit.centerBodyId !== plan.focus.id)
    .every(body => 'orbit' in body && body.orbit?.centerBodyId === 'saturn')).toBe(true);
});

test.each(['ryugu', 'saturn'])('%s selection dimming relaxes at system scale, independently of camera angle', id => {
  const policy = createContextSelectionPolicy(plan), selected = plan.bodies.find(body => body.id === id)!;
  const scale = selected.orbit!.lod!.bounds.radiusM;
  for (const axis of [0, 1, 2]) {
    const values = [.25, .5, 1, 2, 4].map(factor => {
      const position: [number, number, number] = [...selected.positionM];
      position[axis] += scale * factor;
      const strength = policy.strengthAt(id, position);
      expect(policy.opacity(id, id, false, strength)).toBe(1);
      expect(policy.opacity('earth', id, true, strength)).toBe(1);
      if (id === 'saturn') {
        expect(policy.strengthAt('titan', position)).toBe(strength);
        expect(policy.opacity('titan', id, false, strength)).toBe(1);
      }
      return policy.opacity('earth', id, false, strength);
    });
    expect(values).toEqual([.25, .25, .625, 1, 1]);
  }
});

test.each(['saturn', 'jupiter', 'uranus'])('%s retains projected orbit paths past the close-detail fade threshold', id => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const index = [plan.focus, ...plan.bodies].findIndex(body => body.id === id);
  const selected = plan.bodies[index - 1]!;
  input.selectedId = id; input.overview = false;
  for (const discHeightShare of [.1, .2, .3, .6]) {
    const distance = Math.hypot(selected.radiusM,
      2 * input.viewport.focalPixels * selected.radiusM / (1236 * discHeightShare));
    input.world.pose.positionM = [selected.positionM[0], selected.positionM[1], selected.positionM[2] + distance];
    const frame = calculate(input);
    const orbit = frame.projectedBodies.find(body => body.index === index)!;
    expect(orbit.segments.length, `${discHeightShare} viewport height`).toBeGreaterThan(0);
    expect(orbit.orbitVisibility).toBeGreaterThan(.29);
    expect(orbit.segments.every(segment => segment.every(Number.isFinite))).toBe(true);
    if (discHeightShare >= .3) expect(orbit.orbitVisibility).toBeCloseTo(.3, 2);
  }
  input.bodies[index]!.orbitHidden = true;
  expect(calculate(input).projectedBodies.find(body => body.index === index)!.orbitVisibility).toBe(0);
});

test('a placed orbitless body keeps its marker beyond the system fade, like the anchor', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const star = plan.bodies.findIndex(body => !body.orbit) + 1;
  expect(star).toBeGreaterThan(0);
  // 300 pc above the Sun-Betelgeuse midpoint, looking down -z: both locators are in frame and the
  // system fade has run its course (opacity 0), so only locators publish.
  const placedM = plan.bodies[star - 1]!.positionM;
  input.anchorOnly = true; input.world.pose.positionM = [placedM[0] / 2, placedM[1] / 2, placedM[2] / 2 + 300 * 3.085677581491367e16];
  const packet = calculate(input);
  const anchor = packet.projectedBodies.find(body => body.index === 0)!, placed = packet.projectedBodies.find(body => body.index === star)!;
  expect(placed.markerOpacity).toBe(1);
  expect(placed.lineWidth).toBe(anchor.lineWidth);
  expect(placed.indicatorShown).toBe(true);
  expect(placed.labelShown).toBe(true);
});

test('each planetary system fades with the camera distance from its own star', () => {
  const fade = createSystemFade(plan);
  const index = (id: string) => [plan.focus, ...plan.bodies].findIndex(point => point.id === id);
  const wasp = plan.bodies.find(body => body.id === 'wasp-43')!;
  expect(fade.isSystemStar('sun')).toBe(true);
  expect(fade.isSystemStar('wasp-43')).toBe(true);
  expect(fade.isSystemStar('jupiter')).toBe(false);
  expect(fade.isSystemStar('betelgeuse')).toBe(false);
  // Beside WASP-43, 87 pc from the Sun: its planet's orbit shows while the Solar System has retired.
  expect(fade.update([wasp.positionM[0], wasp.positionM[1], wasp.positionM[2] + 1e11])).toBe(1);
  expect(fade.of(index('wasp-43b'))).toBe(1);
  expect(fade.of(index('earth'))).toBe(0);
  expect(fade.of(index('moon'))).toBe(0);
  expect(fade.of(index('betelgeuse')), 'a star outside every system is never faded').toBe(1);
  expect(fade.update([0, 0, 1e11])).toBe(1);
  expect(fade.of(index('earth'))).toBe(1);
  expect(fade.of(index('wasp-43b'))).toBe(0);
  expect(fade.update([0, 0, 1e18]), 'between the stars every system has retired').toBe(0);
});
