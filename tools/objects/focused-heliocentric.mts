import sharp from "sharp";
import type { BodyId } from "@cssearth/astronomy";
import type { PreparedCubicSkyPlan } from "../../src/platform/cubic-sky-contract.mts";
import type { PreparedDirectionalSunPlan } from "../../src/platform/directional-sun-contract.mts";
import type { PreparedAssets, PreparedResourceEntry } from "../../src/renderers/css/rendering/prepared-residency.ts";
import type { PreparedResourcePoolOptions } from "../../src/renderers/css/rendering/prepared-object-assets.ts";
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD } from "../../src/platform/cubic-sky-contract.mts";
import { DIRECTIONAL_SUN_SPRITE_PIXELS } from "../../src/platform/directional-sun-contract.mts";
import { loadAstronomyPackage } from "../../src/platform/astronomy-package.mts";
import { prepareCatalogueStars } from "../../src/platform/prepare-catalogue-stars.mts";
import { prepareEclipticPresentationFrame } from "../../src/platform/solar-presentation-frame.mts";
import { prepareHeliocentricView } from "../../src/platform/prepare-heliocentric-view.mts";
import { preparePlanetarySystem } from "../../src/platform/prepare-planetary-system.mts";
import { PREPARED_NAVIGATION_MARKERS } from "../../site/prepared-navigation-markers.mjs";
import { prepareSolarSystemPresentation } from "./solar-system-presentation.mts";
import { lambertAttenuationAtlas } from "./terrestrial-layers/solid-raster.mts";
import { preparedResourcePool } from "../../src/platform/prepared-object-assets.mts";

const MARKER_ATLAS_URL = "/navigation/planet-markers@2x.webp";
const PHASE_ATLAS = Object.freeze({
  columns: 4,
  rowCount: 8,
  frameCount: 32,
  minimumLightViewZ: -1,
  maximumLightViewZ: 1,
  baseLightAzimuthDegrees: 0,
});

type Presentation = {
  assets: PreparedAssets;
  [key: string]: unknown;
};

function skyFieldOfView(sky: PreparedCubicSkyPlan) {
  const catalogueFov = sky.catalogueStars?.exposure?.fovDegrees;
  if (Number.isFinite(catalogueFov) && catalogueFov! > 0) return catalogueFov!;
  const camera = sky.cameraContract;
  if (camera && typeof camera === "object" && Number.isFinite(camera.horizontalFovDegrees) && camera.horizontalFovDegrees > 0) {
    return camera.horizontalFovDegrees;
  }
  const projectionFov = sky.projection?.horizontalFovDegrees;
  return Number.isFinite(projectionFov) && projectionFov! > 0
    ? projectionFov!
    : CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees;
}

/** Prepare the shared Sun-centred layer used by every focused planet view. */
export async function prepareFocusedHeliocentricPresentation({
  bodyId,
  publicDirectory,
  publicBase,
  bodyRadiusUnits,
  bodyRadiusKilometers,
  sky,
  sun,
}: {
  bodyId: string;
  publicDirectory: string;
  publicBase: string;
  bodyRadiusUnits: number;
  bodyRadiusKilometers: number;
  sky: PreparedCubicSkyPlan;
  sun: PreparedDirectionalSunPlan;
}) {
  if (!/^[a-z][a-z0-9-]*$/u.test(bodyId) || !(bodyRadiusUnits > 0) || !(bodyRadiusKilometers > 0) ||
      typeof publicDirectory !== "string" || typeof publicBase !== "string" || !publicBase.startsWith("/scenes/")) {
    throw new TypeError("Focused heliocentric presentation inputs are invalid.");
  }
  const astronomy = await loadAstronomyPackage();
  if (!(bodyId in astronomy.BODIES)) throw new TypeError(`No prepared astronomy body for ${bodyId}.`);
  const id = bodyId as BodyId;
  const frame = prepareEclipticPresentationFrame(id);
  const system = await preparePlanetarySystem({ bodyId: id, presentationFrame: frame,
    kilometersPerUnit: bodyRadiusKilometers / bodyRadiusUnits });
  const plan = prepareHeliocentricView({ bodyId: id, presentationFrame: frame,
    bodyRadiusUnits, bodyRadiusKilometers,
    sunSprite: { imagePixels: DIRECTIONAL_SUN_SPRITE_PIXELS,
      opaqueCoreDiameterShare: sun.distanceScaling?.spriteOpaqueCoreDiameterShare }, system });
  const catalogue = await prepareCatalogueStars({ fovDegrees: skyFieldOfView(sky) });
  const horizontalFovDegrees = skyFieldOfView(sky);
  const focalLengthOverViewportWidth = 1 / (2 * Math.tan(horizontalFovDegrees * Math.PI / 360));
  const captionNames = Object.fromEntries(Object.entries(astronomy.BODIES).map(([key, value]) => [key, value.name]));
  const phase = lambertAttenuationAtlas({ frameSize: 32, columns: PHASE_ATLAS.columns,
    frameCount: PHASE_ATLAS.frameCount, terminatorWidth: .1, directionalAmbient: .05,
    fullPhaseAmbient: .35, fullPhaseDiffuse: .65, maximumOpacity: .95 });
  const phaseFilename = "marker-phase.webp";
  await sharp(phase.pixels, { raw: { width: phase.width, height: phase.height, channels: 4 } })
    .webp({ lossless: true }).toFile(`${publicDirectory}/${phaseFilename}`);
  const phaseUrl = `${publicBase}${phaseFilename}`;
  const presentation = prepareSolarSystemPresentation({ bodyId, plan,
    navigationMarkers: PREPARED_NAVIGATION_MARKERS, markerAtlasUrl: MARKER_ATLAS_URL,
    phaseAtlas: { ...PHASE_ATLAS, url: phaseUrl }, captionNames, catalogue });
  return Object.freeze({
    heliocentricView: presentation,
    cameraProjection: Object.freeze({ model: "css-perspective-shared-with-sky",
      horizontalFovDegrees, focalLengthOverViewportWidth, cssPerspective: "1000000px",
      eyeOnCameraRootAxis: true, nearPlaneClipping: "javascript-before-publication" }),
    phaseEntry: Object.freeze({ key: "marker-phase", url: phaseUrl, pool: "warm" }),
  });
}

/** Add the focus asset and definition without changing an object's own asset pools. */
export function appendFocusedHeliocentricPresentation<T extends Presentation>(
  presentation: T,
  focus: Awaited<ReturnType<typeof prepareFocusedHeliocentricPresentation>>,
): T & { heliocentricView: unknown } {
  const phasePool = presentation.assets.pools.some(pool => pool.id === "warm") ? "warm"
    : presentation.assets.pools.some(pool => pool.id === "mounted") ? "mounted"
    : presentation.assets.pools[0]?.id;
  if (!phasePool) throw new TypeError("The object has no prepared asset pool for its focused phase atlas.");
  const entry = { ...focus.phaseEntry, pool: phasePool } as PreparedResourceEntry;
  if (presentation.assets.entries.some(candidate => candidate.key === entry.key)) {
    throw new TypeError("The object already declares its focused phase asset.");
  }
  const entries = [...presentation.assets.entries, entry];
  const pools = presentation.assets.pools.map(pool => {
    const { id } = pool;
    const optionsRecord = { ...pool } as Record<string, unknown>;
    delete optionsRecord.id;
    const options = optionsRecord as PreparedResourcePoolOptions;
    if (id === entry.pool) {
      // Preserve the object's existing concurrency policy while making room
      // for the one additional startup atlas.
      options.capacity = pool.capacity + 1;
      options.concurrency = Math.min(pool.concurrency, options.capacity);
    }
    return preparedResourcePool(id, entries, options);
  });
  const startup = [...(presentation.assets.startup ?? []), entry.key];
  const sourceCamera = presentation.camera as Record<string, unknown>;
  const camera = sourceCamera.projection ? sourceCamera : {
    ...sourceCamera,
    projection: focus.cameraProjection,
    dolly: { model: "multiplicative-wheel-distance", wheelStepPerDelta: 0.006,
      minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 4,
      maximumDistanceOverSystemExtent: 3, zoomIsSilhouetteFraming: true },
    levelOfDetail: { model: "silhouette-diameter-crossfade", billboardFadeStartDiscPixels: 20,
      billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 },
    orbitLineFade: { visibleBelowDiscHeightShare: 0.12, hiddenAboveDiscHeightShare: 0.3 },
  };
  return {
    ...presentation,
    camera,
    assets: { ...presentation.assets, entries, pools, startup },
    heliocentricView: focus.heliocentricView,
  };
}
