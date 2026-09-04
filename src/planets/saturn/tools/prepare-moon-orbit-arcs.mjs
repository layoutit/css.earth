import { resolve } from "node:path";

import { preparePlanetOrbitGuides } from "../../../platform/prepared-orbit-guides.mjs";
import { PREPARED_SATURN_MOONS } from "../runtime/preparedMoons.mjs";
import {
  ensureSaturnPreparationDirectories,
  SATURN_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await ensureSaturnPreparationDirectories();

await preparePlanetOrbitGuides({
  planetId: "saturn",
  bodies: PREPARED_SATURN_MOONS.moons,
  source: "same-prepared-detailed-moon-mean-circular-orbit-containers",
  asset: Object.freeze({
    url: "/scenes/saturn/saturn-moon-orbit-arcs.svg",
    url2x: "/scenes/saturn/saturn-moon-orbit-arcs@2x.svg",
    path: resolve(SATURN_PUBLIC_ROOT, "saturn-moon-orbit-arcs.svg"),
    path2x: resolve(SATURN_PUBLIC_ROOT, "saturn-moon-orbit-arcs@2x.svg"),
    size: 514,
    center: 257,
    referenceRadius: 256,
    transparentPaddingPixels: 1,
    strokeColor: "#b8bbc4",
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
