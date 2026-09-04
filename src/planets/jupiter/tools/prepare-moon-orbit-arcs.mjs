import { resolve } from "node:path";

import { preparePlanetOrbitGuides } from "../../../platform/prepared-orbit-guides.mjs";
import { PREPARED_JUPITER_MOONS } from "../runtime/preparedMoons.mjs";
import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await ensureJupiterPreparationDirectories();

await preparePlanetOrbitGuides({
  planetId: "jupiter",
  bodies: PREPARED_JUPITER_MOONS.moons,
  source: "same-prepared-Galilean-mean-circular-orbit-containers",
  asset: Object.freeze({
    url: "/scenes/jupiter/jupiter-moon-orbit-arcs.svg",
    url2x: "/scenes/jupiter/jupiter-moon-orbit-arcs@2x.svg",
    path: resolve(JUPITER_PUBLIC_ROOT, "jupiter-moon-orbit-arcs.svg"),
    path2x: resolve(JUPITER_PUBLIC_ROOT, "jupiter-moon-orbit-arcs@2x.svg"),
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
