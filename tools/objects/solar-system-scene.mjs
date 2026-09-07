// Shared preparation of the physical camera and its sky/body reference frame.
// Geometry stays in the existing preparers; object facts enter through config.
import { buildPolyCameraSceneTransform } from "@layoutit/polycss";
import { prepareEclipticPresentationFrame } from "../../src/platform/solar-presentation-frame.mjs";
import { prepareAstrometricSkySceneRegistration } from "../../src/platform/astrometric-sky-registration.mjs";
import { prepareHeliocentricView } from "../../src/platform/prepare-heliocentric-view.mjs";
import { preparePlanetarySystem } from "../../src/platform/prepare-planetary-system.mjs";
import { prepareSunReferenceViewDirection } from "../../src/platform/prepare-sun-view-direction.mjs";
import { DIRECTIONAL_SUN_PRESENTATION_STANDARD } from "../../src/platform/directional-sun-contract.mjs";
import {
  ASTRONOMICAL_UNIT_KILOMETERS, SOLAR_GEOMETRY_EPOCH_JD_TT,
  SOLAR_GEOMETRY_EPOCH_LABEL, requireBodyFixedSunDirection,
  requireBodyFixedToIcrf, requireBodyOrbit,
} from "../../src/platform/solar-geometry.mjs";

const RESPONSIVE_FIT = Object.freeze({
  model: "continuous-aspect-smoothstep", portraitBaseWidthShare: 0.34,
  narrowPortraitWidthShareGain: 0.08, landscapeWidthShareGain: 0.02,
  narrowPortraitAspectRatio: 0.46, portraitAspectRatio: 0.75,
  squareAspectRatio: 1, maximumHeightShare: 0.61,
  maximumMobilePreviewShare: 0.925, minimumZoom: 0.42, maximumZoom: 2,
});

export function prepareSolarSystemCamera({
  bodyRadiusUnits, defaultZoom, skyProjection, geometryScale = 1,
  initialScenePitchDegrees = 40, defaultControlYawDegrees = 0,
}) {
  if (!(bodyRadiusUnits > 0) || !Number.isFinite(bodyRadiusUnits) ||
      !(defaultZoom > 0) || !Number.isFinite(defaultZoom) ||
      !(geometryScale > 0) || !Number.isFinite(geometryScale) ||
      !Number.isFinite(initialScenePitchDegrees) || !Number.isFinite(defaultControlYawDegrees) ||
      !(skyProjection?.horizontalFovDegrees > 0 && skyProjection.horizontalFovDegrees < 180) ||
      !(skyProjection.focalLengthOverViewportWidth > 0) || typeof skyProjection.cssPerspective !== "string") {
    throw new TypeError("Physical camera needs a body radius, framing, and prepared sky projection.");
  }
  const maximumControlPitchDegrees = 89, maximumScenePitchDegrees = 65;
  const defaultControlPitchDegrees = maximumControlPitchDegrees *
    (1 - initialScenePitchDegrees / maximumScenePitchDegrees);
  return Object.freeze({
    state: Object.freeze({ target: Object.freeze([0, 0, 0]), rotX: defaultControlPitchDegrees,
      rotY: defaultControlYawDegrees, zoom: defaultZoom, distance: 0 }),
    minimumControlPitchDegrees: 0, maximumControlPitchDegrees, defaultControlPitchDegrees,
    defaultControlYawDegrees, initialScenePitchDegrees, maximumScenePitchDegrees,
    minimumZoom: 0.42, maximumZoom: 4, defaultZoom,
    logicalBodyDiameter: bodyRadiusUnits * 2, responsiveFit: RESPONSIVE_FIT,
    sceneScale: geometryScale / 50, horizontalOrbit: true, pitchBounded: false,
    yawBounded: false, cameraModel: "accumulated-matrix3d",
    defaultTransform: buildPolyCameraSceneTransform({ target: [0, 0, 0],
      rotX: initialScenePitchDegrees, rotY: defaultControlYawDegrees, zoom: geometryScale, distance: 0 }),
    projection: Object.freeze({ model: "css-perspective-shared-with-sky",
      horizontalFovDegrees: skyProjection.horizontalFovDegrees,
      focalLengthOverViewportWidth: skyProjection.focalLengthOverViewportWidth,
      cssPerspective: skyProjection.cssPerspective, eyeOnCameraRootAxis: true,
      nearPlaneClipping: "javascript-before-publication" }),
    dolly: Object.freeze({ model: "multiplicative-wheel-distance", wheelStepPerDelta: 0.006,
      minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 4,
      maximumDistanceOverSystemExtent: 3, zoomIsSilhouetteFraming: true }),
    orbitLineFade: Object.freeze({ visibleBelowDiscHeightShare: 0.12, hiddenAboveDiscHeightShare: 0.3 }),
    levelOfDetail: Object.freeze({ model: "silhouette-diameter-crossfade", billboardFadeStartDiscPixels: 20,
      billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 }),
    drag: Object.freeze({ model: "screen-axis-tumble" }),
    planetarySystem: Object.freeze({ model: "distance-over-orbit-extent-fade",
      hiddenBelowDistanceOverOrbitExtent: 1.5, visibleAboveDistanceOverOrbitExtent: 2.5 }),
    sunMarker: Object.freeze({ model: "sprite-diameter-crossfade", fadeStartSpritePixels: 16, fullSpritePixels: 8 }),
    runtimeGeometryDerivation: false,
  });
}

// The clean-room Sun raster is already generic. This supplies its observed
// phase/orientation using exactly the frame shared by scene and sky preparation.
export function prepareSolarSystemSunPresentation({
  bodyId, displayName, initialScenePitchDegrees = 40, defaultControlYawDegrees = 0,
}) {
  if (typeof displayName !== "string" || !displayName.trim()) throw new TypeError("Sun presentation needs the observer's display name.");
  const frame = prepareEclipticPresentationFrame(bodyId);
  return Object.freeze({
    ...DIRECTIONAL_SUN_PRESENTATION_STANDARD,
    source: "VSOP87A heliocentric positions with IAU/WGCCRE rotation elements",
    sourcePath: "src/platform/solar-geometry.mjs",
    qualification: `Observed ${displayName} Sun direction at ${SOLAR_GEOMETRY_EPOCH_LABEL}, ` +
      "expressed in the ecliptic presentation frame (north up, Sun left at " +
      "zero yaw) and in view space at the default camera pose.",
    bodyFixedDirection: requireBodyFixedSunDirection(bodyId),
    presentationFrame: frame.model, localDirection: frame.sunDirection,
    referenceViewDirection: prepareSunReferenceViewDirection({ bodyId,
      initialScenePitchDegrees, defaultControlYawDegrees, sceneDirection: frame.sunDirection }),
  });
}

export async function prepareSolarSystemScene({
  bodyId, bodyRadiusUnits, bodyRadiusKilometers, defaultZoom, starfield, sun, geometryScale = 1,
  initialScenePitchDegrees = 40, defaultControlYawDegrees = 0, astronomy,
}) {
  const frame = prepareEclipticPresentationFrame(bodyId);
  const registration = prepareAstrometricSkySceneRegistration(bodyId);
  if (starfield?.astrometricRegistration?.cubeFrame !== registration.cubeFrame) {
    throw new TypeError("Physical sky must be prepared with astrometric cube sampling first.");
  }
  const camera = prepareSolarSystemCamera({ bodyRadiusUnits, defaultZoom, geometryScale,
    initialScenePitchDegrees, defaultControlYawDegrees, skyProjection: starfield.projection });
  const system = await preparePlanetarySystem({ bodyId, presentationFrame: frame,
    kilometersPerUnit: bodyRadiusKilometers / bodyRadiusUnits, astronomy });
  const heliocentricView = prepareHeliocentricView({ bodyId, presentationFrame: frame,
    bodyRadiusUnits, bodyRadiusKilometers,
    sunSprite: { imagePixels: sun?.asset?.density1?.width,
      opaqueCoreDiameterShare: sun?.distanceScaling?.spriteOpaqueCoreDiameterShare }, system });
  return Object.freeze({
    camera, systemTransform: frame.cssTransform,
    presentationFrame: Object.freeze({ model: frame.model, sunDirection: frame.sunDirection,
      poleDirection: frame.poleDirection, sunEclipticLatitudeDegrees: frame.sunEclipticLatitudeDegrees,
      poleTiltDegrees: frame.poleTiltDegrees }),
    heliocentricView,
    starfield: Object.freeze({ ...starfield, cameraContract: "scene-locked-unbounded-accumulated-matrix3d",
      sceneRegistration: registration.cssTransform, sceneRegistrationModel: registration.model,
      sceneRegistrationChain: registration.chain, sceneRegistrationEpoch: registration.epoch }),
    worldFrame: prepareWorldFrame(bodyId, frame, bodyRadiusUnits, bodyRadiusKilometers),
  });
}

function prepareWorldFrame(bodyId, frame, bodyRadiusUnits, bodyRadiusKilometers) {
  const bodyToIcrf = requireBodyFixedToIcrf(bodyId), sun = requireBodyFixedSunDirection(bodyId);
  const distanceM = requireBodyOrbit(bodyId).heliocentricDistanceAu * ASTRONOMICAL_UNIT_KILOMETERS * 1000;
  const multiply = vector => [0, 1, 2].map(row => bodyToIcrf[row * 3] * vector[0] +
    bodyToIcrf[row * 3 + 1] * vector[1] + bodyToIcrf[row * 3 + 2] * vector[2]);
  const columns = frame.basis.map(multiply);
  return Object.freeze({ referenceFrame: "sun-icrf", epochJdTt: SOLAR_GEOMETRY_EPOCH_JD_TT,
    originM: Object.freeze(multiply(sun).map(value => -value * distanceM)),
    presentationToReference: Object.freeze([0, 1, 2].flatMap(row => columns.map(column => column[row]))),
    orbitUpReference: Object.freeze(columns[1].map(value => -value)),
    metersPerUnit: bodyRadiusKilometers * 1000 / bodyRadiusUnits,
    bodyRadiusM: bodyRadiusKilometers * 1000 });
}
