import { resolve } from "node:path";

import { preparePlanetOrbitGuides } from "../../../platform/prepared-orbit-guides.mjs";
import { PREPARED_URANUS_SCENE } from "../runtime/preparedScene.mjs";
import {
  ensureUranusPreparationDirectories,
  URANUS_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await ensureUranusPreparationDirectories();

const majorMoons = PREPARED_URANUS_SCENE.moons.moons
  .filter(({ major }) => major)
  .map((moon) => Object.freeze({
    id: moon.id,
    displayOrbitRadius: moon.displayOrbitRadius,
    inclinationDeg: moon.inclinationDeg,
    nodeDeg: moon.nodeDeg,
  }));

await preparePlanetOrbitGuides({
  planetId: "uranus",
  bodies: majorMoons,
  source:
    "JPL epoch-bound major-moon mean-orbit containers from the prepared Uranus scene",
  asset: Object.freeze({
    url: "/scenes/uranus/uranus-moon-orbit-arcs.svg",
    url2x: "/scenes/uranus/uranus-moon-orbit-arcs@2x.svg",
    path: resolve(URANUS_PUBLIC_ROOT, "uranus-moon-orbit-arcs.svg"),
    path2x: resolve(URANUS_PUBLIC_ROOT, "uranus-moon-orbit-arcs@2x.svg"),
    size: 514,
    center: 257,
    referenceRadius: 256,
    transparentPaddingPixels: 1,
    strokeColor: "#a7c4c8",
    strokeWidth: 0.75,
    strokeWidth2x: 0.5,
  }),
  presentation: Object.freeze({ baseOpacity: 0.2, hoverOpacity: 0.65 }),
  hitTest: Object.freeze({
    thresholdPixels: 6,
    touchTapMaxDurationMilliseconds: 350,
    touchTapMaxMovementPixels: 12,
  }),
  outputModulePath: resolve(
    import.meta.dirname,
    "../runtime/preparedMoonOrbitArcs.mjs",
  ),
});
