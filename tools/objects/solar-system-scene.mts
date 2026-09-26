import type {BodyId} from '@cssearth/astronomy';
import type {PreparedCubicSkyPlan} from '../../src/platform/cubic-sky-contract.mts';
import {requireFiniteNumber} from '@cssearth/core';
import { parsePreparedWorldContext } from '@cssearth/renderer';
interface SolarCameraOptions {bodyRadiusUnits:number;defaultZoom:number;skyProjection:{horizontalFovDegrees:number;focalLengthOverViewportWidth:number;cssPerspective:string};geometryScale?:number;initialScenePitchDegrees:number;defaultControlYawDegrees:number;}
interface SolarSceneOptions extends Omit<SolarCameraOptions,'skyProjection'|'initialScenePitchDegrees'|'defaultControlYawDegrees'> {bodyId:BodyId;bodyRadiusKilometers:number;starfield:PreparedCubicSkyPlan;
  /** What lights the body's map: the Sun, the body itself (a placed star) or its host star (a planet of another star). */
  light?:'sun'|'self'|'host';}
// Shared preparation of the physical camera and its sky/body reference frame.
// Geometry stays in the existing preparers; object facts enter through config.
import { buildPolyCameraSceneTransform } from "@layoutit/polycss";
import { prepareEclipticPresentationFrame } from "../../src/platform/solar-presentation-frame.mts";
import { LIT_DEFAULT_VIEW, prepareDefaultCameraAngles, refuseAuthoredCameraAngles } from "../../src/platform/default-camera.mts";
import { prepareAstrometricSkySceneRegistration } from "../../src/platform/astrometric-sky-registration.mts";
import { prepareSunReferenceViewDirection } from "../../src/platform/prepare-sun-view-direction.mts";
import type { Vector3 } from "@cssearth/renderer/solar-system/types.ts";
import { DIRECTIONAL_SUN_PRESENTATION_STANDARD } from "../../src/platform/directional-sun-contract.mts";
import {
  ASTRONOMICAL_UNIT_KILOMETERS, SOLAR_GEOMETRY_EPOCH_JD_TT,
  SOLAR_GEOMETRY_EPOCH_LABEL, bodyFixedStarDirection, requireBodyFixedSunDirection,
  requireBodyFixedToIcrf, requireBodyOrbit,
} from "../../src/platform/solar-geometry.mts";

const RESPONSIVE_FIT = Object.freeze({
  model: "continuous-aspect-smoothstep", portraitBaseWidthShare: 0.34,
  narrowPortraitWidthShareGain: 0.08, landscapeWidthShareGain: 0.02,
  narrowPortraitAspectRatio: 0.46, portraitAspectRatio: 0.75,
  squareAspectRatio: 1, maximumHeightShare: 0.61,
  maximumMobilePreviewShare: 0.925, minimumZoom: 0.42, maximumZoom: 2,
});

export function prepareSolarSystemCamera({
  bodyRadiusUnits, defaultZoom, skyProjection, geometryScale = 1,
  initialScenePitchDegrees, defaultControlYawDegrees,
}:SolarCameraOptions) {
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
      minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 4, zoomIsSilhouetteFraming: true }),
    orbitLineFade: Object.freeze({ visibleBelowDiscHeightShare: 0.12, hiddenAboveDiscHeightShare: 0.3 }),
    levelOfDetail: Object.freeze({ model: "silhouette-diameter-crossfade", billboardFadeStartDiscPixels: 20,
      billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 }),
    drag: Object.freeze({ model: "screen-axis-tumble" }),
    runtimeGeometryDerivation: false,
  });
}

// The clean-room Sun raster is already generic. This supplies its observed
// phase/orientation using exactly the frame shared by scene and sky preparation.
export function prepareSolarSystemSunPresentation(source:{bodyId:string;displayName:string}) {
  refuseAuthoredCameraAngles(source);
  const { bodyId, displayName } = source;
  if (typeof displayName !== "string" || !displayName.trim()) throw new TypeError("Sun presentation needs the observer's display name.");
  const frame = prepareEclipticPresentationFrame(bodyId);
  // A planet of another star is lit by that star, whose direction its synchronous rotation holds at longitude 0. Every body
  // the Sun lights keeps the Sun's own direction; the presentation frame itself is unchanged either way.
  const star = bodyFixedStarDirection(bodyId);
  const bodyFixedDirection = star ?? requireBodyFixedSunDirection(bodyId);
  const localDirection = star ? unitVector(frame.toPresentation(star as Vector3)) : frame.sunDirection;
  return Object.freeze({
    ...DIRECTIONAL_SUN_PRESENTATION_STANDARD,
    source: star
      ? "Transit-fitted hosted orbit with the synchronous rotation it implies"
      : "VSOP87A heliocentric positions with IAU/WGCCRE rotation elements",
    sourcePath: "src/platform/solar-geometry.mts",
    qualification: star
      ? `Direction to ${displayName}'s own star at ${SOLAR_GEOMETRY_EPOCH_LABEL}, from its transit-fitted orbit, ` +
        "expressed in the presentation frame and in view space at the default camera pose. Assumed synchronous rotation " +
        "holds that direction at longitude 0."
      : `Observed ${displayName} Sun direction at ${SOLAR_GEOMETRY_EPOCH_LABEL}, ` +
        "expressed in the ecliptic presentation frame (north up, Sun left at " +
        "zero yaw) and in view space at the default camera pose.",
    bodyFixedDirection,
    presentationFrame: frame.model, localDirection,
    referenceViewDirection: prepareSunReferenceViewDirection({ bodyId,
      ...prepareDefaultCameraAngles(bodyId, { light: star ? 'host' : 'sun' }), sceneDirection: localDirection }),
  });
}

function unitVector(direction: readonly number[]): Vector3 {
  const length = Math.hypot(...direction);
  if (!(length > 0)) throw new TypeError("A light direction must be a nonzero vector.");
  return Object.freeze(direction.map(component => component / length)) as unknown as Vector3;
}

export async function prepareSolarSystemScene(options:SolarSceneOptions) {
  refuseAuthoredCameraAngles(options);
  const { bodyId, bodyRadiusUnits, bodyRadiusKilometers, defaultZoom, starfield, geometryScale = 1, light = 'sun' } = options;
  const frame = prepareEclipticPresentationFrame(bodyId);
  const { initialScenePitchDegrees, defaultControlYawDegrees } = prepareDefaultCameraAngles(bodyId, { light });
  const registration = prepareAstrometricSkySceneRegistration(bodyId);
  if(!starfield.projection)throw new TypeError("Physical sky requires its prepared projection.");
  const camera = prepareSolarSystemCamera({ bodyRadiusUnits, defaultZoom, geometryScale,
    initialScenePitchDegrees, defaultControlYawDegrees, skyProjection: {...starfield.projection,focalLengthOverViewportWidth:requireFiniteNumber(starfield.projection.focalLengthOverViewportWidth)} });
  return Object.freeze({
    camera, systemTransform: frame.cssTransform,
    presentationFrame: Object.freeze({ model: frame.model, sunDirection: frame.sunDirection,
      poleDirection: frame.poleDirection, sunEclipticLatitudeDegrees: frame.sunEclipticLatitudeDegrees,
      poleTiltDegrees: frame.poleTiltDegrees }),
    starfield: Object.freeze({ ...starfield, cameraContract: "scene-locked-unbounded-accumulated-matrix3d",
      sceneRegistration: registration.cssTransform, sceneRegistrationModel: registration.model,
      sceneRegistrationChain: registration.chain, sceneRegistrationEpoch: registration.epoch }),
    // The mesh is drawn at geometryScale times its source radius; the world frame measures what is drawn.
    worldFrame: prepareWorldFrame(bodyId, frame, bodyRadiusUnits * geometryScale, bodyRadiusKilometers),
  });
}

/** A star at the origin of the heliocentric frame: no ephemeris pole, Sun direction, orbit or planetary system.
 * The presentation axis is authored (`star`) and the camera, sky registration and world frame come from the authored
 * world context, exactly as the retired static lane merged them; nothing here claims an ephemeris-derived frame. */
export function prepareStarCentredScene(options:Omit<SolarSceneOptions,'starfield'|'bodyId'|'light'> & {bodyId:string;starfield:PreparedCubicSkyPlan;
  star:{model:string;systemTransform:string;axialTiltDegrees:number};context:unknown}) {
  refuseAuthoredCameraAngles(options);
  const { bodyId, bodyRadiusUnits, bodyRadiusKilometers, defaultZoom, starfield, star, context, geometryScale = 1 } = options;
  // No ephemeris places the scene's own star relative to a light or an observer, so it opens on the design pose.
  const { initialScenePitchDegrees, defaultControlYawDegrees } = LIT_DEFAULT_VIEW;
  const checked = parsePreparedWorldContext(context);
  if (checked.focus.id !== bodyId || checked.frame.bodyRadiusM !== bodyRadiusKilometers * 1000) throw new TypeError("Star-centred scene context identity differs.");
  if (!starfield.projection) throw new TypeError("Physical sky requires its prepared projection.");
  if (!Number.isFinite(star.axialTiltDegrees) || !star.systemTransform.trim() || !star.model.trim()) throw new TypeError("Star-centred scene needs its authored axis presentation.");
  const base = prepareSolarSystemCamera({ bodyRadiusUnits, defaultZoom, geometryScale, initialScenePitchDegrees, defaultControlYawDegrees,
    skyProjection: { ...starfield.projection, focalLengthOverViewportWidth: requireFiniteNumber(starfield.projection.focalLengthOverViewportWidth) } });
  // The authored context owns projection, dolly, level of detail, orbit fade and drag.
  const camera = Object.freeze({ ...base, ...checked.camera.presentation });
  return Object.freeze({
    camera, systemTransform: star.systemTransform,
    presentationFrame: Object.freeze({ model: star.model, poleTiltDegrees: star.axialTiltDegrees, sunDirection: null, poleDirection: Object.freeze([0, 0, 1]) }),
    starfield: Object.freeze({ ...starfield, cameraContract: "scene-locked-unbounded-accumulated-matrix3d",
      sceneRegistration: checked.sky.sceneRegistration, sceneRegistrationModel: "world-context-sky-baseline" }),
    worldFrame: checked.frame,
  });
}

function prepareWorldFrame(bodyId:string, frame:ReturnType<typeof prepareEclipticPresentationFrame>, bodyRadiusUnits:number, bodyRadiusKilometers:number) {
  const bodyToIcrf = requireBodyFixedToIcrf(bodyId), sun = requireBodyFixedSunDirection(bodyId);
  const distanceM = requireBodyOrbit(bodyId).heliocentricDistanceAu * ASTRONOMICAL_UNIT_KILOMETERS * 1000;
  const multiply = (vector:readonly number[]) => [0, 1, 2].map(row => bodyToIcrf[row * 3] * vector[0] +
    bodyToIcrf[row * 3 + 1] * vector[1] + bodyToIcrf[row * 3 + 2] * vector[2]);
  // Interim until the world-navigation stage derives the frame from the body as drawn: the authored rotation composed with
  // PolyCSS's own X/Y swap, a reflection like every map into CSS 3D space.
  const columns = frame.basis.map(axis => multiply([axis[1], axis[0], axis[2]]));
  return Object.freeze({ referenceFrame: "sun-icrf", epochJdTt: SOLAR_GEOMETRY_EPOCH_JD_TT,
    originM: Object.freeze(multiply(sun).map(value => -value * distanceM)),
    presentationToReference: Object.freeze([0, 1, 2].flatMap(row => columns.map(column => column[row]))),
    orbitUpReference: Object.freeze(multiply(frame.basis[1]).map(value => -value)),
    metersPerUnit: bodyRadiusKilometers * 1000 / bodyRadiusUnits,
    bodyRadiusM: bodyRadiusKilometers * 1000 });
}

