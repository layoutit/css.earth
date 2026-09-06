#!/usr/bin/env node

// Mutation gate for the Mercury lighting and sky geometry browser suite and
// the planetary-system browser suite.
//
// The suites exist to catch renders that are self-consistent but wrong. This
// gate proves they can: each known perturbation is applied to the source, the
// affected preparation steps are re-run, the mutation's suite is run against
// a dev server, and the suite must go red on a check the mutation was
// expected to trip. Any mutation that survives fails the gate by name. Every
// file is restored afterwards, on success, failure, crash or interrupt.
//
// Usage: node src/planets/mercury/test/lighting-geometry-mutation-gate.mjs
//   [--only <id>[,<id>...]] [--port <port>] [--restore]
// The gate starts its own `astro dev` server (the suite needs the runtime's
// development diagnostics and sources served live) on --port (default 4219).
// --restore only restores a leftover backup from an interrupted run.

import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
// The suites a mutation may target; each reports its name in its last line.
const SUITES = Object.freeze({
  lighting: Object.freeze({
    script: resolve(projectRoot, "src/planets/mercury/test/lighting-geometry-browser.mjs"),
    name: "mercury-lighting-geometry",
  }),
  system: Object.freeze({
    script: resolve(projectRoot, "src/planets/mercury/test/planetary-system-browser.mjs"),
    name: "mercury-planetary-system",
  }),
  rotation: Object.freeze({
    script: resolve(projectRoot, "src/planets/mercury/test/rotation-limits-browser.mjs"),
    name: "mercury-rotation-limits",
  }),
  labels: Object.freeze({
    script: resolve(projectRoot, "src/planets/mercury/test/label-field-browser.mjs"),
    name: "mercury-label-field",
  }),
  stars: Object.freeze({
    script: resolve(projectRoot, "src/planets/mercury/test/catalogue-stars-browser.mjs"),
    name: "mercury-catalogue-stars",
  }),
});
const toolsDirectory = resolve(projectRoot, "src/planets/mercury/tools");
const backupRoot = resolve(projectRoot, "node_modules/.cache/mercury-geometry-mutation-gate");
const backupManifest = join(backupRoot, "manifest.json");

const arguments_ = process.argv.slice(2);
const only = readOption("--only")?.split(",") ?? null;
const port = Number(readOption("--port") ?? 4219);
const restoreOnly = arguments_.includes("--restore");

const SKY_PREPARE = ["prepare-starfield.mjs", "prepare-scene.mjs",
  "prepare-runtime-asset-manifest.mjs"];
const SUN_PREPARE = ["prepare-sky-sun.mjs", "prepare-scene.mjs",
  "prepare-runtime-asset-manifest.mjs"];
const SCENE_PREPARE = ["prepare-scene.mjs", "prepare-runtime-asset-manifest.mjs"];

// Files the preparation steps above rewrite; snapshotted once and restored
// after every prepare-time mutation.
const PREPARED_OUTPUTS = [
  "src/planets/mercury/runtime/preparedStarfield.mjs",
  "src/planets/mercury/runtime/preparedScene.mjs",
  "src/planets/mercury/runtime/preparedSkySun.mjs",
  "src/planets/mercury/runtime-assets.json",
  ...readdirSync(resolve(projectRoot, "public/scenes/mercury"))
    .filter((name) => /^mercury-(starfield|directional-sun)/u.test(name))
    .map((name) => `public/scenes/mercury/${name}`),
];

// Each mutation: the source edit (find must occur exactly once), the
// preparation steps it invalidates, how to confirm the mutated code is what
// the server serves, the checks it must trip, and the suite that must trip
// them (the lighting suite unless `suite: "system"`).
export const MUTATIONS = Object.freeze([
  {
    id: "negate-view-y",
    description: "cssDirectionToViewDirection keeps y (negates the correct flip)",
    file: "src/platform/solar-view-direction.mjs",
    find: "  return [x, -y, z];",
    replace: "  return [x, y, z]; /* MUTATION negate-view-y */",
    prepare: [],
    served: { url: "/src/platform/solar-view-direction.mjs", marker: "MUTATION negate-view-y" },
    expect: /lit-direction-matches-oracle|sun-sprite-position|subsolar-latitude|lit-side-faces/u,
  },
  {
    id: "negate-view-z",
    description: "cssDirectionToViewDirection negates z (Sun mirrored through the screen)",
    file: "src/platform/solar-view-direction.mjs",
    find: "  return [x, -y, z];",
    replace: "  return [x, -y, -z]; /* MUTATION negate-view-z */",
    prepare: [],
    served: { url: "/src/platform/solar-view-direction.mjs", marker: "MUTATION negate-view-z" },
    expect: /illuminated-fraction|sun-sprite-visibility|subsolar-latitude/u,
  },
  {
    id: "light-roll-180",
    description: "material light roll offset by 180 degrees",
    file: "src/platform/prepared-material.mjs",
    find: "        const base=rotation.reference===\"initial\"?Math.atan2(reference[1],reference[0])*180/Math.PI:rotation.baseDegrees;",
    replace: "        const base=rotation.reference===\"initial\"?Math.atan2(reference[1],reference[0])*180/Math.PI:rotation.baseDegrees+180; /* MUTATION light-roll-180 */",
    prepare: [],
    served: { url: "/src/platform/prepared-material.mjs", marker: "MUTATION light-roll-180" },
    expect: /lit-direction-matches-oracle|terminator|lit-side-faces/u,
  },
  // The sky rides the scene matrix through the prepared registration on every
  // camera path (reset, drag, flight), derived from the scene in one place:
  // a sky-only drag error (inverted yaw, scaled pitch) is impossible by
  // construction, so the mutations below attack the derivation itself.
  {
    id: "sky-legacy-presentation",
    description: "sky follows the legacy presentation path (inverted yaw, -1.7 pitch response) instead of riding the scene",
    file: "src/platform/camera-orientation.mjs",
    find: "  const currentSkyboxMatrix = () => skyRegistration\n    ? sceneMatrix.multiply(skyRegistration)\n    : skyboxMatrix;",
    replace: "  const currentSkyboxMatrix = () => skyboxMatrix; /* MUTATION sky-legacy-presentation */",
    prepare: [],
    served: { url: "/src/platform/camera-orientation.mjs", marker: "MUTATION sky-legacy-presentation" },
    expect: /drag-(right|left|down|up)-sky-moves-with-sun|sky-anchor|sky-.*band-angle/u,
  },
  {
    id: "sky-registration-order",
    description: "registration applied before the camera rotation instead of after it",
    file: "src/platform/camera-orientation.mjs",
    find: "    ? sceneMatrix.multiply(skyRegistration)",
    replace: "    ? skyRegistration.multiply(sceneMatrix) /* MUTATION sky-registration-order */",
    prepare: [],
    served: { url: "/src/platform/camera-orientation.mjs", marker: "MUTATION sky-registration-order" },
    expect: /sky-.*band-angle|sky-anchor|sky-bulge|drag-(right|left|down|up)-sky-moves-with-sun/u,
  },
  {
    id: "sky-registration-yaw-180",
    description: "prepared sky registration turned by 180 degrees about the scene's vertical",
    file: "src/platform/camera-orientation.mjs",
    find: "  const matrix = new DOMMatrix(registration);\n  if (!matrix.is2D",
    replace: "  const matrix = new DOMMatrix(registration).rotateAxisAngle(0, 1, 0, 180); /* MUTATION sky-registration-yaw-180 */\n  if (!matrix.is2D",
    prepare: [],
    served: { url: "/src/platform/camera-orientation.mjs", marker: "MUTATION sky-registration-yaw-180" },
    expect: /sky-.*band-angle|sky-anchor|sky-bulge/u,
  },
  {
    id: "mirror-panorama",
    description: "ESO panorama sampled with longitude increasing rightward (mirrored sky)",
    file: "src/platform/prepare-cubic-sky-source.mjs",
    find: "      const sourceX = (Math.PI - galacticLongitude) / (2 * Math.PI) *",
    replace: "      const sourceX = (Math.PI + galacticLongitude) / (2 * Math.PI) * /* MUTATION mirror-panorama */",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /sky-anchor|sky-.*band-angle/u,
  },
  {
    id: "galactic-pole-2deg",
    description: "north galactic pole declination perturbed by +2 degrees",
    file: "src/platform/galactic-frame.mjs",
    find: "  northPoleDecDegrees: 27.12825,",
    replace: "  northPoleDecDegrees: 29.12825, /* MUTATION galactic-pole-2deg */",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /sky-anchor/u,
  },
  {
    id: "drop-eso-correction",
    description: "fitted ESO panorama frame correction replaced by identity",
    file: "src/platform/eso-panorama-registration.mjs",
    find: "export const ESO_PANORAMA_REGISTRATION = fitPanoramaFrameRotation();",
    replace: "export const ESO_PANORAMA_REGISTRATION = Object.freeze({ ...fitPanoramaFrameRotation(), " +
      "matrix: Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]) }); /* MUTATION drop-eso-correction */",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /sky-anchor/u,
  },
  // The wheel dolly moves the eye along its axis and holds no surface
  // anchor; a controller that keeps the scale camera's anchor turns the
  // scene on every off-centre wheel event.
  {
    id: "wheel-dolly-holds-anchor",
    description: "the perspective dolly keeps the scale camera's surface anchor (off-centre wheel turns the scene)",
    file: "src/platform/prepared-wheel-zoom.mjs",
    find: "    anchor = dolly === null ? { x:event.clientX, y:event.clientY } : null;",
    replace: "    anchor = { x:event.clientX, y:event.clientY }; /* MUTATION wheel-dolly-holds-anchor */",
    prepare: [],
    served: { url: "/src/platform/prepared-wheel-zoom.mjs", marker: "MUTATION wheel-dolly-holds-anchor" },
    expect: /wheel-.*-holds-scene-rotation/u,
  },
  // The heliocentric preparation refuses a body-fixed Sun direction that
  // disagrees with the orbital facts, so the mirrored Sun is applied where
  // the lighting and the sprite take their direction from the frame.
  {
    id: "from-sun-direction",
    description: "prepared Sun direction negated (from-Sun instead of to-Sun) for the lighting and the sprite",
    file: "src/planets/mercury/tools/prepare-sky-sun.mjs",
    find: "const sceneDirection = MERCURY_PRESENTATION_FRAME.sunDirection;",
    replace: "const sceneDirection = Object.freeze(MERCURY_PRESENTATION_FRAME.sunDirection.map((value) => -value)); /* MUTATION from-sun-direction */",
    prepare: SUN_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedSkySun.mjs", changed: true },
    expect: /sky-anchor|band-angle|lit-direction-matches-oracle|sun-sprite-position/u,
  },
  // The planetary system. Its preparation self-checks every ring against the
  // frame-tree position of its body, so a prepare-time mutation must leave
  // vertex 0 alone to reach the screen; the suite then measures the rest.
  {
    id: "system-ring-scale-saturn",
    description: "Saturn's prepared ring scaled by 1.1 about the Sun (its marker stays put)",
    file: "src/platform/prepare-planetary-system.mjs",
    find: "      Object.freeze((index === 0 ? position : pointAt(bodyEccentricAnomaly + index * step)).map(Math.round))));",
    replace: "      Object.freeze((index === 0 ? position : (id === \"saturn\" ? add(sunPosition, scale(subtract(pointAt(bodyEccentricAnomaly + index * step), sunPosition), 1.1)) : pointAt(bodyEccentricAnomaly + index * step))).map(Math.round)))); /* MUTATION system-ring-scale-saturn */",
    prepare: SCENE_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedScene.mjs", changed: true },
    expect: /orbit-(shape|ratio|axis-backprojected)-saturn|marker-on-orbit-saturn/u,
    suite: "system",
  },
  {
    id: "system-swap-venus-earth",
    description: "Venus and Earth exchange identities in the prepared system (each marker and ring under the other's name)",
    file: "src/platform/prepare-planetary-system.mjs",
    find: "      id,\n      kind: orbit.kind,\n      orbitSource: orbit.source,",
    replace: "      id: id === \"venus\" ? \"earth\" : id === \"earth\" ? \"venus\" : id, /* MUTATION system-swap-venus-earth */\n      kind: orbit.kind,\n      orbitSource: orbit.source,",
    prepare: SCENE_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedScene.mjs", changed: true },
    expect: /marker-position-(venus|earth)|orbit-(shape|axis-backprojected)-(venus|earth)/u,
    suite: "system",
  },
  {
    id: "system-runtime-ring-scale-mars",
    description: "the runtime projects the third system ring (Mars) scaled by 1.15",
    file: "src/platform/heliocentric-view.mjs",
    find: "        orbitSegments: projectRing(body.orbit.vertices, trailWeights?.[body.id] ?? body.orbit.trail),",
    replace: "        orbitSegments: projectRing(plan.system.bodies.indexOf(body) === 2 ? body.orbit.vertices.map((vertex) => vertex.map((component) => component * 1.15)) : body.orbit.vertices, trailWeights?.[body.id] ?? body.orbit.trail), /* MUTATION system-runtime-ring-scale-mars */",
    prepare: [],
    served: { url: "/src/platform/heliocentric-view.mjs", marker: "MUTATION system-runtime-ring-scale-mars" },
    expect: /orbit-(shape|ratio|axis-backprojected)-mars|marker-on-orbit-mars/u,
    suite: "system",
  },
  {
    id: "system-runtime-marker-shift",
    description: "the runtime places every planet marker at the next planet's position",
    file: "src/platform/heliocentric-view.mjs",
    find: "        marker: projectPoint(body.position),",
    replace: "        marker: projectPoint(plan.system.bodies[(plan.system.bodies.indexOf(body) + 1) % plan.system.bodies.length].position), /* MUTATION system-runtime-marker-shift */",
    prepare: [],
    served: { url: "/src/platform/heliocentric-view.mjs", marker: "MUTATION system-runtime-marker-shift" },
    expect: /marker-(position|on-orbit)-/u,
    suite: "system",
  },
  // The trail. Its direction is prepared (the weights fade against the
  // direction of motion) and its extent is enforced at projection.
  // (A prepare-time inversion is refused by the trail validator before it
  // reaches the screen, so the direction is attacked at projection.)
  {
    id: "trail-inverted",
    description: "the runtime mirrors the trail weights so the line leads the body instead of trailing it",
    file: "src/platform/heliocentric-view.mjs",
    find: "      const weight = trail[index];\n      if (!(weight > 0)) continue;",
    replace: "      const weight = trail[trail.length - 1 - index]; /* MUTATION trail-inverted */\n      if (!(weight > 0)) continue;",
    prepare: [],
    served: { url: "/src/platform/heliocentric-view.mjs", marker: "MUTATION trail-inverted" },
    expect: /trail-(behind-body|absent-ahead)-/u,
    suite: "system",
  },
  {
    id: "trail-half-span",
    description: "trails prepared with no solid span (fade from the body, gone at a half turn)",
    file: "src/platform/prepare-heliocentric-view.mjs",
    find: "  solidTurns: 0.375,",
    replace: "  solidTurns: 0, /* MUTATION trail-half-span */",
    prepare: SCENE_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedScene.mjs", changed: true },
    expect: /trail-solid-behind-|trail-behind-body-/u,
    suite: "system",
  },
  {
    id: "trail-full-loop",
    description: "the runtime projects every chord at full strength (closed loops again)",
    file: "src/platform/heliocentric-view.mjs",
    find: "      const weight = trail[index];\n      if (!(weight > 0)) continue;",
    replace: "      const weight = 1; /* MUTATION trail-full-loop */",
    prepare: [],
    served: { url: "/src/platform/heliocentric-view.mjs", marker: "MUTATION trail-full-loop" },
    expect: /trail-absent-ahead-|trail-fades-backwards-/u,
    suite: "system",
  },
  // The dwarf planets: their orbits come from Keplerian elements, so the
  // orientation maths and the identity of each body are attacked.
  {
    id: "dwarf-orbit-flattened",
    description: "every dwarf planet's orbital plane replaced by the ICRF equator (Pluto loses its inclination)",
    file: "src/platform/prepare-planetary-system.mjs",
    find: "      normalIcrf: [sinO * sinI, -cosO * sinI, cosI],",
    replace: "      normalIcrf: [0, 0, 1], /* MUTATION dwarf-orbit-flattened */",
    prepare: SCENE_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedScene.mjs", changed: true },
    expect: /orbit-(shape|axis-backprojected)-(pluto|eris|haumea|makemake)-dwarf|marker-on-orbit-(pluto|eris)/u,
    suite: "system",
  },
  {
    id: "dwarf-swap-pluto-eris",
    description: "Pluto and Eris exchange identities in the prepared system",
    file: "src/platform/prepare-planetary-system.mjs",
    find: "      kind: orbit.kind,\n      orbitSource: orbit.source,\n      radiusKilometers: BODIES[id].meanRadiusKm,",
    replace: "      kind: orbit.kind,\n      orbitSource: orbit.source, radiusKilometers: BODIES[id].meanRadiusKm, id: id === \"pluto\" ? \"eris\" : id === \"eris\" ? \"pluto\" : id, /* MUTATION dwarf-swap-pluto-eris */",
    prepare: SCENE_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedScene.mjs", changed: true },
    expect: /marker-position-(pluto|eris)|orbit-(shape|axis-backprojected)-(pluto|eris)-dwarf/u,
    suite: "system",
  },
  // Catalogue stars: their placement, their photometry, the stamped bands
  // and the photograph's retreat to diffuse light.
  {
    id: "stars-mirrored",
    description: "retained stars placed at mirrored right ascension (x negated in the cube)",
    file: "src/platform/prepare-catalogue-stars.mjs",
    find: "  const yaw = Math.atan2(-x, -z) * 180 / Math.PI;",
    replace: "  x = -x; const yaw = Math.atan2(-x, -z) * 180 / Math.PI; /* MUTATION stars-mirrored */",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /star-.*-painted-at-oracle-/u,
    suite: "stars",
  },
  {
    id: "stars-uniform-intensity",
    description: "every retained star presented at the intensity ceiling (magnitude no longer reads as luminance)",
    file: "src/platform/star-photometry.mjs",
    find: "  let luminance = Math.min(exposure.intensityMax, Math.pow(Math.min(1, Math.max(0, ld)), 1 / DISPLAY_GAMMA));",
    replace: "  let luminance = exposure.intensityMax; /* MUTATION stars-uniform-intensity */",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /star-intensity-follows-magnitude-/u,
    suite: "stars",
  },
  {
    id: "stars-photograph-holes-skipped",
    description: "the photograph keeps its own images of the retained stars beside the catalogue points (stars drawn twice)",
    file: "src/platform/prepare-cubic-sky-source.mjs",
    find: "    if (star.presentation !== \"retained\") continue;\n    const { face, u, v } = cubeFaceOf(star.direction);",
    replace: "    if (star.presentation !== \"never\") continue; /* MUTATION stars-photograph-holes-skipped */\n    const { face, u, v } = cubeFaceOf(star.direction);",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /photograph-does-not-repaint-/u,
    suite: "stars",
  },
  // Captions: the declutter pass, the placement and the ranking.
  {
    id: "captions-no-declutter",
    description: "every caption candidate is accepted (overlapping captions drawn on top of one another)",
    file: "src/platform/label-field.mjs",
    find: "        candidate.accepted = !blocked;",
    replace: "        candidate.accepted = true; /* MUTATION captions-no-declutter */",
    prepare: [],
    served: { url: "/src/platform/label-field.mjs", marker: "MUTATION captions-no-declutter" },
    expect: /captions-do-not-overlap-/u,
    suite: "labels",
  },
  {
    id: "captions-below-markers",
    description: "captions placed below their markers instead of above",
    file: "src/platform/heliocentric-view-runtime.mjs",
    find: "          `${formatNumber(slot.anchor[1] - slot.bottomOffsetPx)}px) translate(-50%, -100%)`;",
    replace: "          `${formatNumber(slot.anchor[1] + slot.bottomOffsetPx)}px) translate(-50%, 0%)`; /* MUTATION captions-below-markers */",
    prepare: [],
    served: { url: "/src/platform/heliocentric-view-runtime.mjs", marker: "MUTATION captions-below-markers" },
    expect: /captions-above-markers-/u,
    suite: "labels",
  },
  {
    id: "captions-priority-inverted",
    description: "the faintest caption wins an overlap instead of the brightest",
    file: "src/platform/label-field.mjs",
    find: "      while (position > 0 && candidates[position - 1].priority < priority) position -= 1;",
    replace: "      while (position > 0 && candidates[position - 1].priority > priority) position -= 1; /* MUTATION captions-priority-inverted */",
    prepare: [],
    served: { url: "/src/platform/label-field.mjs", marker: "MUTATION captions-priority-inverted" },
    expect: /declutter-matches-reference-rule-/u,
    suite: "labels",
  },
  // Free rotation: the trackball twists again outside its disc.
  {
    id: "drag-trackball-twist",
    description: "the tumble-only trackball is switched off (off-centre drags twist about the view axis)",
    file: "src/platform/perspective-dolly.mjs",
    find: "        tumbleOnly: cameraPlan.drag?.model === \"screen-axis-tumble\",",
    replace: "        tumbleOnly: false, /* MUTATION drag-trackball-twist */",
    prepare: [],
    served: { url: "/src/platform/perspective-dolly.mjs", marker: "MUTATION drag-trackball-twist" },
    expect: /drag-(default|far)-(offcentre|corner)-.*-tumbles/u,
    suite: "rotation",
  },
  // Phase and brightness on the markers.
  {
    id: "phase-lit-away",
    description: "every marker's phase overlay is rolled 180 degrees (lit side away from the Sun)",
    file: "src/platform/heliocentric-view-runtime.mjs",
    find: "            180 / Math.PI - phaseAtlas.baseLightAzimuthDegrees) * 4) / 4;",
    replace: "            180 / Math.PI - phaseAtlas.baseLightAzimuthDegrees + 180) * 4) / 4; /* MUTATION phase-lit-away */",
    prepare: [],
    served: { url: "/src/platform/heliocentric-view-runtime.mjs", marker: "MUTATION phase-lit-away" },
    // At this epoch every planet is near full, so the darkening centroid is
    // dormant; the DOM roll check is what catches it (both are listed).
    expect: /phase-rolled-toward-sun-|phase-darkening-away-from-sun-/u,
    suite: "system",
  },
  {
    id: "phase-inverted-vantage",
    description: "phase angles prepared from the far side (Jupiter shows a crescent from Mercury)",
    file: "src/platform/prepare-planetary-system.mjs",
    find: "    const toObserver = scale(position, -1);",
    replace: "    const toObserver = position; /* MUTATION phase-inverted-vantage */",
    prepare: SCENE_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedScene.mjs", changed: true },
    expect: /no-crescent-beyond-venus|phase-fraction-matches-oracle-/u,
    suite: "system",
  },
  {
    id: "brightness-flat",
    description: "every marker prepared at full brightness (stickers of one intensity)",
    file: "src/platform/prepare-planetary-system.mjs",
    find: "        markerOpacity: markerOpacityForMagnitudes(magnitudesBelowBrightest),",
    replace: "        markerOpacity: 1, /* MUTATION brightness-flat */",
    prepare: SCENE_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedScene.mjs", changed: true },
    expect: /marker-brightness-follows-flux/u,
    suite: "system",
  },
  {
    id: "system-dolly-orbit-bound",
    description: "the dolly's far bound falls back to four Mercury orbit extents (the system never fits)",
    file: "src/platform/perspective-dolly.mjs",
    find: "    ? cameraPlan.dolly.maximumDistanceOverSystemExtent * system.maximumExtentUnits",
    replace: "    ? cameraPlan.dolly.maximumDistanceOverOrbitExtent * plan.orbit.maximumExtentUnits /* MUTATION system-dolly-orbit-bound */",
    prepare: [],
    served: { url: "/src/platform/perspective-dolly.mjs", marker: "MUTATION system-dolly-orbit-bound" },
    expect: /maximum-dolly-reaches-whole-system|outer-distance-honoured/u,
    suite: "system",
  },
  {
    id: "system-always-visible",
    description: "the system ignores its fade and is opaque at every distance",
    file: "src/platform/perspective-dolly.mjs",
    find: "          : planetarySystemOpacity(systemFade, distance / plan.orbit.maximumExtentUnits);",
    replace: "          : 1; /* MUTATION system-always-visible */",
    prepare: [],
    served: { url: "/src/platform/perspective-dolly.mjs", marker: "MUTATION system-always-visible" },
    expect: /system-hidden-at-default-framing|system-fades-in-with-distance/u,
    suite: "system",
  },
]);

if (restoreOnly) {
  restoreLeftovers();
  process.exit(0);
}
restoreLeftovers();

const selected = only
  ? MUTATIONS.filter(({ id }) => only.includes(id))
  : MUTATIONS;
if (only && selected.length !== only.length) {
  throw new Error(`Unknown mutation id in --only: ${only}`);
}

// Snapshot every file any mutation touches, plus the prepared outputs.
const backedUp = new Set();
rmSync(backupRoot, { recursive: true, force: true });
mkdirSync(backupRoot, { recursive: true });
for (const path of [...new Set([...MUTATIONS.map(({ file }) => file), ...PREPARED_OUTPUTS])]) {
  backup(path);
}
writeFileSync(backupManifest, JSON.stringify([...backedUp], null, 2));

let server = null;
let activeChild = null;
const results = [];
const restoreAll = () => {
  for (const path of backedUp) restore(path);
  if (existsSync(backupManifest)) unlinkSync(backupManifest);
};
const cleanup = () => {
  try {
    // A preparation step or suite still running would keep writing mutated
    // output after the sources are restored: stop it first and let the
    // kernel reap it before copying the originals back.
    if (activeChild !== null && activeChild.exitCode === null) {
      activeChild.kill("SIGKILL");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    }
    activeChild = null;
    restoreAll();
  } finally {
    server?.kill("SIGTERM");
    server = null;
  }
};
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    console.error(`\n${signal}: restoring sources.`);
    cleanup();
    process.exit(130);
  });
}
process.on("uncaughtException", (error) => {
  console.error(error);
  cleanup();
  process.exit(1);
});

try {
  server = await startDevServer(port);
  const baseUrl = server.baseUrl;
  console.log(`suite target: ${baseUrl}`);

  // The unmutated suites must be green, or the gate proves nothing.
  const suitesInPlay = [...new Set(selected.map(({ suite }) => suite ?? "lighting"))];
  for (const suite of suitesInPlay) {
    const baseline = await runSuite(baseUrl, suite);
    if (!baseline.ok) {
      throw new Error(`Baseline ${suite} suite is not green: ${baseline.failed.join(", ")}` +
        (baseline.crashed ? `\n${baseline.crashed}` : ""));
    }
    console.log(`baseline ${suite}: green (${baseline.checks.length} checks)`);
  }
  const baselineServed = {};
  for (const { served } of selected) {
    if (served.changed) baselineServed[served.url] ??= await fetchText(baseUrl + served.url);
  }

  for (const mutation of selected) {
    const started = Date.now();
    let outcome;
    try {
      applyMutation(mutation);
      let prepared = true;
      let preparationError = null;
      for (const step of mutation.prepare) {
        try {
          await runPreparation(step);
        } catch (error) {
          // A preparation that refuses the mutation never reaches the
          // screen: not a suite verdict, and not a gate crash either.
          prepared = false;
          preparationError = error.message;
          break;
        }
      }
      if (!prepared) {
        outcome = { id: mutation.id, status: "refused-by-preparation", failed: [], tripped: [],
          crashed: preparationError };
      } else {
        await waitForServed(baseUrl, mutation, baselineServed);
        const run = await runSuite(baseUrl, mutation.suite ?? "lighting");
        const tripped = run.failed.filter((id) => mutation.expect.test(id));
        const status = run.ok
          ? "SURVIVED"
          : tripped.length > 0 ? "caught" : "red-for-other-reasons";
        outcome = { id: mutation.id, status, failed: run.failed, tripped,
          crashed: run.crashed ?? null };
      }
    } finally {
      restore(mutation.file);
      if (mutation.prepare.length > 0) for (const path of PREPARED_OUTPUTS) restore(path);
    }
    outcome.seconds = Math.round((Date.now() - started) / 1000);
    results.push(outcome);
    console.log(`${outcome.status.padEnd(22)} ${mutation.id.padEnd(30)} ` +
      `${outcome.seconds}s  tripped: ${outcome.tripped.join(", ") || "-"}`);
  }

  // Sources are back: the suites must be green again.
  await waitForServed(baseUrl, null, baselineServed);
  for (const suite of suitesInPlay) {
    const final = await runSuite(baseUrl, suite);
    if (!final.ok) {
      throw new Error(`${suite} suite not green after restoring: ${final.failed.join(", ")}`);
    }
  }
} finally {
  cleanup();
}

const surviving = results.filter(({ status }) => status !== "caught");
console.log(JSON.stringify({
  ok: surviving.length === 0,
  gate: "mercury-lighting-geometry-mutations",
  results,
}));
if (surviving.length > 0) {
  console.error(`MUTATION GATE FAILED: ${surviving.map(({ id, status }) =>
    `${id} (${status})`).join(", ")}`);
  process.exit(1);
}

// -----------------------------------------------------------------------

function readOption(name) {
  const index = arguments_.indexOf(name);
  return index === -1 ? null : arguments_[index + 1];
}

function backup(path) {
  const target = join(backupRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(projectRoot, path), target);
  backedUp.add(path);
}

function restore(path) {
  const source = join(backupRoot, path);
  if (!existsSync(source)) return;
  copyFileSync(source, resolve(projectRoot, path));
}

function restoreLeftovers() {
  if (!existsSync(backupManifest)) return;
  const paths = JSON.parse(readFileSync(backupManifest, "utf8"));
  console.error(`Restoring ${paths.length} files from an interrupted gate run.`);
  for (const path of paths) restore(path);
  unlinkSync(backupManifest);
}

function applyMutation(mutation) {
  const path = resolve(projectRoot, mutation.file);
  const source = readFileSync(path, "utf8");
  const occurrences = source.split(mutation.find).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `${mutation.id}: anchor found ${occurrences} times in ${mutation.file}.`,
    );
  }
  writeFileSync(path, source.replace(mutation.find, mutation.replace));
}

function runPreparation(script) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(toolsDirectory, script)], {
      cwd: projectRoot,
      stdio: ["ignore", "ignore", "inherit"],
    });
    activeChild = child;
    child.once("error", reject);
    child.once("exit", (code) => {
      activeChild = null;
      if (code === 0) resolvePromise();
      else reject(new Error(`${script} exited with ${code}`));
    });
  });
}

function runSuite(baseUrl, suite) {
  const { script, name } = SUITES[suite];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, baseUrl], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild = child;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      activeChild = null;
      const lines = stdout.trim().split("\n");
      try {
        const report = JSON.parse(lines[lines.length - 1]);
        if (report.suite !== name) throw new Error("wrong suite");
        resolvePromise(report);
      } catch {
        // A crash is red too, but not a verdict: report it as such.
        resolvePromise({ ok: false, failed: [], checks: [], crashed:
          `exit ${code}: ${stderr.slice(-600)}` });
      }
    });
  });
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.text();
}

// Vite serves sources from disk; confirm the mutated (or restored) text is
// what a fresh page would load before trusting a suite result.
async function waitForServed(baseUrl, mutation, baselineServed) {
  const deadline = Date.now() + 20_000;
  const expectations = mutation
    ? [[mutation.served, false]]
    : Object.keys(baselineServed).map((url) => [{ url, changed: true }, true]);
  for (const [served, expectBaseline] of expectations) {
    for (;;) {
      const text = await fetchText(baseUrl + served.url);
      const satisfied = served.marker
        ? text.includes(served.marker)
        : expectBaseline
          ? text === baselineServed[served.url]
          : text !== baselineServed[served.url];
      if (satisfied) break;
      if (Date.now() > deadline) {
        throw new Error(`Served ${served.url} does not reflect ` +
          `${mutation ? mutation.id : "the restored sources"}.`);
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    }
  }
  // Give Vite's module graph a moment to settle after the file change.
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
}

async function startDevServer(devPort) {
  const child = spawn("pnpm", ["exec", "astro", "dev", "--host", "127.0.0.1",
    "--port", String(devPort)], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) {
      // Astro keeps one dev server per project; when one is already up it
      // tells us where, and that server serves the same live sources.
      const running = /Dev server already running at (http:\/\/[^\s"\\]+)/u
        .exec(output);
      if (running) {
        console.log(`using the running dev server at ${running[1]}`);
        return { baseUrl: running[1], kill() {} };
      }
      throw new Error(`astro dev exited early:\n${output.slice(-1000)}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${devPort}/mercury/`);
      if (response.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill("SIGTERM");
      throw new Error(`astro dev did not come up on ${devPort}:\n${output.slice(-1000)}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  return { baseUrl: `http://127.0.0.1:${devPort}`, kill: (signal) => child.kill(signal) };
}
