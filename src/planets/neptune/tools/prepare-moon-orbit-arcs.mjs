import { resolve } from "node:path";

import { preparePlanetOrbitGuides } from "../../../platform/prepared-orbit-guides.mjs";
import { PREPARED_NEPTUNE_MOONS } from "../runtime/preparedMoons.mjs";

const publicRoot = resolve(
  import.meta.dirname,
  "../../../../public/scenes/neptune",
);

await preparePlanetOrbitGuides({
  planetId: "neptune",
  bodies: PREPARED_NEPTUNE_MOONS.moons
    .filter(({ group }) => group === "major")
    .map((moon) => Object.freeze({
      id: moon.id,
      displayOrbitRadius: moon.displayOrbitRadius,
      inclinationDeg: moon.inclinationDegrees,
      nodeDeg: moon.nodeDegrees,
    })),
  source: "same-prepared-JPL-mean-orbit-containers",
  asset: Object.freeze({
    url: "/scenes/neptune/neptune-moon-orbit-arcs.svg",
    url2x: "/scenes/neptune/neptune-moon-orbit-arcs@2x.svg",
    path: resolve(publicRoot, "neptune-moon-orbit-arcs.svg"),
    path2x: resolve(publicRoot, "neptune-moon-orbit-arcs@2x.svg"),
    size: 514,
    center: 257,
    referenceRadius: 256,
    transparentPaddingPixels: 1,
    strokeColor: "#8caeca",
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
