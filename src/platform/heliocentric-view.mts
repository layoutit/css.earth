import { isArray } from './is-array.mts';
import type { Vector2, Vector3, Matrix3, Matrix3dLike, VisibleRect } from "../renderers/css/solar-system/types.ts";
import type { PreparedPlanetPoint, PlanetOrbitLabelPolicy } from "@cssearth/engine";
export interface TrailSpans {solidTurns:number;fadeTurns:number;}
export interface PreparedOrbit {normal:Vector3;perihelionDirection:Vector3;semiMajorAxisUnits:number;maximumExtentUnits:number;vertices:readonly Vector3[];vertexCount:number;trail:readonly number[];chordBehindTurns:readonly number[];trailSpans:TrailSpans|null;closed?:boolean;bodyVertexIndex?:number;eccentricity?:number;displayExtentAu?:number;}
export interface PreparedIllumination {phaseAngleDegrees:number;illuminatedFraction:number;lightViewZ:number;markerOpacity:number;}
export interface PreparedSystemBody {id:string;position:Vector3;semiMajorAxisUnits:number;radiusUnits:number;pointPresentation:PreparedPlanetPoint;orbit:Omit<PreparedOrbit,"semiMajorAxisUnits"|"maximumExtentUnits"> & {labelPresentation:PlanetOrbitLabelPolicy} | null;eccentricity?:number;illumination:PreparedIllumination;}
export interface PreparedPlanetarySystem {schema:string;observer:string;sun:{position:Vector3};maximumExtentUnits:number;bodies:readonly PreparedSystemBody[];runtimeGeometryDerivation:boolean;epochJdTt?:number;}
export interface HeliocentricViewPlan {schema:string;bodyId:string;units:{kilometersPerUnit:number;bodyRadiusUnits:number};sun:{direction:Vector3;position:Vector3;distanceUnits:number;radiusUnits:number;sprite:{worldDiameterUnits:number;imagePixels:number}};orbit:PreparedOrbit;system?:PreparedPlanetarySystem;runtimeGeometryDerivation:boolean;}
export interface HeliocentricProjectionInput {rotation:Matrix3;distance:number;bodyCenter?:Vector3;focal:number;viewportWidth:number;viewportHeight:number;principalOffset?:Vector2;visibleRect?:VisibleRect|null;frustumPadding?:number;nearShare?:number;system?:boolean;systemOrbits?:boolean;trailWeights?:Readonly<Record<string,readonly number[]>>|null;}
export interface SilhouetteEllipse {radialSemiAxis:number;tangentialSemiAxis:number;radial:Vector2;centre:Vector2;}
export interface BodyProjection {distance:number;depth:number;offAxisDegrees:number;silhouetteRadius:number;silhouetteDiameter:number;silhouette:SilhouetteEllipse|null;orthographicRadius:number;translate:Vector3;}
export interface SunProjection {visible:boolean;classification:'behind-camera'|'outside-viewport'|'behind-body'|'fully-visible'|'partially-visible';depth:number;centerNdc:Vector2|null;eye?:Vector3;screen?:Vector2;spriteDiameter?:number;discDiameter?:number;spriteScale?:number;}
export interface PointProjection {visible:boolean;classification:'behind-camera'|'outside-viewport'|'behind-body'|'visible'|'intersects-camera-plane';depth:number;screen:Vector2|null;}
export interface SystemBodyProjection {id:string;marker:PointProjection & {diameterPx:number;alpha:number;magnitude:number;labelPriority:number;physicalDiameterPx:number;photometricRadiusPx:number};orbitSegments:readonly OrbitSegment[];}
export type OrbitSegment = readonly number[];
export interface HeliocentricProjection {focal:number;distance:number;near:number;viewportWidth:number;viewportHeight:number;principalOffset:Vector2;body:BodyProjection;sun:SunProjection;orbitSegments:readonly OrbitSegment[];system:{sun:PointProjection;bodies:readonly SystemBodyProjection[]}|null;}
// A body's heliocentric neighbourhood as real geometry around the body: the
// Sun at its observed distance and the body's orbit as a true ellipse, both in
// the body-centred presentation frame the retained scene is prepared in, plus
// the camera-relative projection that puts them on screen. A plan may carry
// the rest of the planetary system (`plan.system`, prepared by
// prepare-planetary-system.mjs): the other planets' orbits as the same kind
// of vertex ring and their epoch positions as billboard markers, projected
// through the same camera on request.
//
// Preparation (`prepareHeliocentricView`, prepare-heliocentric-view.mjs) runs
// in the object's prepare tools and only transports orbital facts from the
// checked-in solar geometry into the scene frame; the vertex ring is static
// geometry prepared there. This module is runtime-only: it carries no solar
// geometry, so the shared runtime closure stays free of per-body catalogues.
// Projection (`projectHeliocentricView`) runs per camera publication: it
// resolves every position relative to the camera in float64, clips the orbit
// against the near plane and a padded frustum, hides the parts of the orbit
// behind the body, and returns small numbers only. The scene's perspective
// camera (a CSS `perspective` on the camera root, eye on the root's axis) is
// the same camera this module projects with, so the body, the Sun and the
// orbit share one projection by construction.
//
// Frames and units. "World" is the CSS scene frame of the object: +x right,
// +y down, +z toward the viewer at identity rotation, body centre at the
// origin, one unit = one CSS pixel of the unscaled scene (the body radius is
// the prepared leaf radius). The camera rotation is the retained scene matrix
// (`Rx(pitch) Ry(yaw)`); the camera looks down -z from `(0, 0, distance)`
// world units in front of the body's centre after that rotation.

import { planetPointPresentation, planetOrbitLabelPriority, validPreparedPlanetPoint } from "./planet-point-presentation.mts";
import { screenFactor } from "./star-photometry.mts";

export const PREPARED_HELIOCENTRIC_VIEW_SCHEMA =
  "cssearth-prepared-heliocentric-view@1";

// IAU 2015 resolution B3 nominal solar radius.
export const NOMINAL_SOLAR_RADIUS_KILOMETERS = 695700;

export function validatePreparedHeliocentricView(plan: HeliocentricViewPlan) {
  const bodyVertexIndex = plan.orbit?.closed === false ? plan.orbit.bodyVertexIndex ?? -1 : 0;
  if (plan?.schema !== PREPARED_HELIOCENTRIC_VIEW_SCHEMA ||
      !positive(plan.units?.kilometersPerUnit) ||
      !positive(plan.units?.bodyRadiusUnits) ||
      !unit(plan.sun?.direction) || !positive(plan.sun?.distanceUnits) ||
      !positive(plan.sun?.radiusUnits) ||
      !positive(plan.sun?.sprite?.worldDiameterUnits) ||
      !Number.isSafeInteger(plan.sun?.sprite?.imagePixels) ||
      !vector(plan.sun?.position) ||
      !unit(plan.orbit?.normal) || !unit(plan.orbit?.perihelionDirection) ||
      !(plan.orbit?.closed === false ? Number.isFinite(plan.orbit.semiMajorAxisUnits) &&
        plan.orbit.semiMajorAxisUnits < 0 : positive(plan.orbit?.semiMajorAxisUnits)) ||
      !positive(plan.orbit?.maximumExtentUnits) ||
      !isArray(plan.orbit?.vertices) || plan.orbit.vertices.length < 8 ||
      plan.orbit.vertexCount !== plan.orbit.vertices.length ||
      !plan.orbit.vertices.every(vector) ||
      !Number.isSafeInteger(bodyVertexIndex) || bodyVertexIndex < 0 || bodyVertexIndex >= plan.orbit.vertexCount ||
      plan.orbit.vertices[bodyVertexIndex].some((component) => component !== 0) ||
      (plan.orbit.closed === false
        ? !((plan.orbit.eccentricity ?? 0) > 1) || !positive(plan.orbit.displayExtentAu) ||
          plan.orbit.trailSpans !== null || !Array.isArray(plan.orbit.chordBehindTurns) || plan.orbit.chordBehindTurns.length !== 0 ||
          !Array.isArray(plan.orbit.trail) || plan.orbit.trail.length !== plan.orbit.vertexCount - 1 ||
          !plan.orbit.trail.every(weight => weight === 1)
        : (plan.orbit.closed !== undefined && plan.orbit.closed !== true) ||
          !validTrail(plan.orbit.trail, plan.orbit.vertexCount) ||
          !validBehindTurns(plan.orbit.chordBehindTurns, plan.orbit.vertexCount) ||
          !validTrailSpans(plan.orbit.trailSpans)) ||
      plan.runtimeGeometryDerivation !== false) {
    throw new TypeError("Prepared heliocentric view is incompatible.");
  }
  if (plan.system !== undefined) validatePreparedPlanetarySystem(plan.system, plan);
  return plan;
}

// The trail: a ring is drawn as the path just travelled, solid for
// `solidTurns` of an orbit behind the body, fading linearly to nothing over
// the following `fadeTurns`, never drawn beyond. Each chord carries the
// share of a turn it lies behind the body (prepared, from the ring's
// eccentric-anomaly offsets); its weight for a pair of spans follows from
// that alone, so a session may re-weight the prepared rings without any
// geometry. The plan carries the spans that ship as `orbit.trailSpans` and
// the weights they produce as `orbit.trail`.
export const ORBIT_TRAIL_MODEL = "trailing-orbit-solid-then-linear-fade";

export function validTrailSpans(spans: TrailSpans | null | undefined): spans is TrailSpans {
  return spans != null && Number.isFinite(spans.solidTurns) && spans.solidTurns >= 0 &&
    Number.isFinite(spans.fadeTurns) && spans.fadeTurns > 0 &&
    spans.solidTurns + spans.fadeTurns < 1;
}

export function trailWeightsForSpans(chordBehindTurns: readonly number[], spans: TrailSpans) {
  if (!validTrailSpans(spans)) {
    throw new TypeError("Orbit trail spans must leave part of the orbit undrawn.");
  }
  return Object.freeze(chordBehindTurns.map((behind) => {
    const weight = behind <= spans.solidTurns
      ? 1
      : Math.max(0, 1 - (behind - spans.solidTurns) / spans.fadeTurns);
    return Number(weight.toFixed(6));
  }));
}

export const PREPARED_PLANETARY_SYSTEM_SCHEMA =
  "cssearth-prepared-planetary-system@1";

export function validatePreparedPlanetarySystem(system: PreparedPlanetarySystem, plan: HeliocentricViewPlan) {
  if (system?.schema !== PREPARED_PLANETARY_SYSTEM_SCHEMA ||
      system.observer !== plan.bodyId ||
      !vector(system.sun?.position) ||
      system.sun.position.some((component, index) =>
        Math.abs(component - plan.sun.position[index]) >
          Math.max(1e-3, 8 * Number.EPSILON * Math.hypot(...plan.sun.position))) ||
      !positive(system.maximumExtentUnits) ||
      !(system.maximumExtentUnits >= plan.orbit.maximumExtentUnits) ||
      !isArray(system.bodies) || system.bodies.length === 0 ||
      system.bodies.some((body) =>
        !/^[a-z][a-z0-9-]*$/u.test(body?.id ?? "") || body.id === plan.bodyId ||
        !vector(body.position) || !(body.orbit === null
          ? Number.isFinite(body.semiMajorAxisUnits) && body.semiMajorAxisUnits < 0 && (body.eccentricity ?? 0) > 1
          : positive(body.semiMajorAxisUnits)) ||
        !positive(body.radiusUnits) || !validPreparedPlanetPoint(body.pointPresentation) ||
        !validIllumination(body.illumination) ||
        (body.orbit !== null && (!positive(body.orbit?.labelPresentation?.radiusUnits) ||
        !positive(body.orbit.labelPresentation.angularFadeInRadians) ||
        !(body.orbit.labelPresentation.angularFullRadians > body.orbit.labelPresentation.angularFadeInRadians) ||
        !positive(body.orbit.labelPresentation.nearDistanceUnits) ||
        !(body.orbit.labelPresentation.farDistanceUnits > body.orbit.labelPresentation.nearDistanceUnits) ||
        !positive(body.orbit.labelPresentation.minimumEligibility) ||
        !unit(body.orbit?.normal) || !unit(body.orbit?.perihelionDirection) ||
        !isArray(body.orbit.vertices) || body.orbit.vertices.length < 8 ||
        body.orbit.vertexCount !== body.orbit.vertices.length ||
        !body.orbit.vertices.every(vector) ||
        !validTrail(body.orbit.trail, body.orbit.vertexCount) ||
        !validBehindTurns(body.orbit.chordBehindTurns, body.orbit.vertexCount) ||
        body.orbit.vertices[0].some((component, index) => component !== body.position[index])))) ||
      new Set(system.bodies.map((body) => body.id)).size !== system.bodies.length ||
      system.runtimeGeometryDerivation !== false) {
    throw new TypeError("Prepared planetary system is incompatible.");
  }
  return system;
}

// The camera: a CSS perspective camera whose eye sits `focal` pixels in front
// of the principal point and looks down -z. The principal point (the CSS
// perspective-origin, the vanishing point of the view axis) may be offset
// from the camera root's centre by `principalOffset`: the shell lays the body
// out beside its chrome while the sky keeps its vanishing point at the stage
// centre, so one eye serves both by looking at the body slightly off-axis.
// The body's centre is always placed so it projects to the root's centre,
// `distance` from the eye. A world point P is at eye-space
// `rotation * P + C` where C is the body centre in eye space; its depth is the
// negated eye-space z and it lands on screen at
// `principalOffset + focal * xy / depth`, offset from the root's centre in
// CSS pixels (+y down).
export function projectHeliocentricView(plan: HeliocentricViewPlan, {
  rotation,
  distance,
  focal,
  viewportWidth,
  viewportHeight,
  principalOffset = [0, 0],
  // The part of the root on screen, relative to the root's centre (the shell
  // may lay the root out partly beyond the viewport); markers and captions
  // count as inside only there. Default: the whole root.
  visibleRect = null,
  frustumPadding = 1.25,
  nearShare = 0.01,
  system = false,
  // Celestial points remain visible in a near-body sky; their rings only
  // need projection once the orbit presentation actually draws them.
  systemOrbits = true,
  // Per-ring chord weights overriding the prepared trails (a session's
  // spans); keyed "own" and by body id.
  trailWeights = null,
}: HeliocentricProjectionInput): HeliocentricProjection {
  if (!isArray(rotation) || rotation.length !== 9 ||
      rotation.some((value) => !Number.isFinite(value)) ||
      !positive(distance) || !positive(focal) ||
      !positive(viewportWidth) || !positive(viewportHeight) ||
      !isArray(principalOffset) || principalOffset.length !== 2 ||
      principalOffset.some((value) => !Number.isFinite(value)) ||
      (visibleRect !== null && !validVisibleRect(visibleRect))) {
    throw new TypeError("Heliocentric projection arguments are invalid.");
  }
  const bodyRadius = plan.units.bodyRadiusUnits;
  if (distance <= bodyRadius) {
    throw new RangeError("The camera is inside the body.");
  }
  const near = Math.max(1e-6, distance * nearShare);
  const halfWidth = viewportWidth / 2;
  const halfHeight = viewportHeight / 2;
  const visible = visibleRect ?? { left: -halfWidth, top: -halfHeight, right: halfWidth, bottom: halfHeight };
  const clipX = halfWidth * frustumPadding;
  const clipY = halfHeight * frustumPadding;
  const [ox, oy] = principalOffset;
  const axis = offAxisFrame(focal, principalOffset);
  // The body's centre in eye space: `distance` along the off-axis direction
  // that projects to the root's centre.
  const bodyCenter = [
    distance * axis.sinTheta * axis.radial[0],
    distance * axis.sinTheta * axis.radial[1],
    -distance * axis.cosTheta,
  ];
  const toEye = (point: Vector3) => [
    rotation[0] * point[0] + rotation[1] * point[1] + rotation[2] * point[2] +
      bodyCenter[0],
    rotation[3] * point[0] + rotation[4] * point[1] + rotation[5] * point[2] +
      bodyCenter[1],
    rotation[6] * point[0] + rotation[7] * point[1] + rotation[8] * point[2] +
      bodyCenter[2],
  ];
  const depthOf = (eye: Vector3) => -eye[2];
  const project = (eye: Vector3) => {
    const depth = depthOf(eye);
    return [ox + focal * eye[0] / depth, oy + focal * eye[1] / depth, depth];
  };

  // The body: its silhouette is the tangent cone cut by the image plane, an
  // ellipse a little wider than the orthographic disc and, off-axis, pushed
  // outward from where the centre projects. The material overlay and the drag
  // trackball follow it.
  const silhouette: SilhouetteEllipse | null = silhouetteEllipse(bodyRadius, focal, distance, axis);
  const body = Object.freeze({
    distance,
    depth: distance * axis.cosTheta,
    offAxisDegrees: Math.asin(axis.sinTheta) * 180 / Math.PI,
    silhouetteRadius: silhouette.tangentialSemiAxis,
    silhouetteDiameter: 2 * silhouette.tangentialSemiAxis,
    silhouette,
    orthographicRadius: focal * bodyRadius / distance,
    // Camera-root coordinates of the body's centre: the eye sits at the
    // principal point, +focal.
    translate: Object.freeze([
      ox + bodyCenter[0],
      oy + bodyCenter[1],
      focal + bodyCenter[2],
    ]),
  });

  // The Sun: a billboard at its true position, sized from its true radius.
  const sunEye = toEye(plan.sun.position);
  const sunDepth = depthOf(sunEye);
  let sun: SunProjection;
  if (sunDepth <= near) {
    sun = Object.freeze({
      visible: false,
      classification: "behind-camera",
      depth: sunDepth,
      centerNdc: null,
    });
  } else {
    const [x, y] = project(sunEye);
    const spriteDiameter = plan.sun.sprite.worldDiameterUnits * focal /
      sunDepth;
    const centerNdc = Object.freeze([x / halfWidth, -y / halfHeight]);
    const halfSprite = spriteDiameter / 2;
    const intersects = x + halfSprite >= visible.left && x - halfSprite <= visible.right &&
      y + halfSprite >= visible.top && y - halfSprite <= visible.bottom;
    const fullyVisible = x - halfSprite >= visible.left && x + halfSprite <= visible.right &&
      y - halfSprite >= visible.top && y + halfSprite <= visible.bottom;
    // The body hides the Sun when the Sun's centre is behind the disc.
    const occluded = rayHitsSphereBefore(sunEye, bodyCenter, bodyRadius);
    sun = Object.freeze({
      visible: intersects && !occluded,
      classification: !intersects
        ? "outside-viewport"
        : occluded
          ? "behind-body"
          : fullyVisible ? "fully-visible" : "partially-visible",
      depth: sunDepth,
      eye: Object.freeze(sunEye),
      screen: Object.freeze([x, y]),
      centerNdc,
      spriteDiameter,
      discDiameter: 2 * plan.sun.radiusUnits * focal / sunDepth,
      // Billboard scale from the sprite raster to world units.
      spriteScale: plan.sun.sprite.worldDiameterUnits /
        plan.sun.sprite.imagePixels,
    });
  }

  // The orbit: each chord of the prepared ring, near-clipped, frustum-clipped
  // and cut where the body hides it, as screen-space segments.
  const hidden = (eye: Vector3) => rayHitsSphereBefore(eye, bodyCenter, bodyRadius);
  // Only the trailing chords (weight above zero) are projected; each segment
  // carries its chord's trail weight as its opacity, so the line fades
  // backwards from the body and the leading half of the orbit is never drawn.
  const projectRing = (vertices: readonly Vector3[], trail: readonly number[], closed = true) => {
    const eyes = vertices.map(toEye);
    const segments = [];
    for (let index = 0; index < eyes.length - (closed ? 0 : 1); index += 1) {
      const weight = trail[index];
      if (!(weight > 0)) continue;
      let start = eyes[index];
      let end = eyes[(index + 1) % eyes.length];
      let startDepth = depthOf(start);
      let endDepth = depthOf(end);
      if (startDepth <= near && endDepth <= near) continue;
      if (startDepth <= near) {
        start = lerp(start, end, (near - startDepth) / (endDepth - startDepth));
        startDepth = near;
      } else if (endDepth <= near) {
        end = lerp(start, end, (near - startDepth) / (endDepth - startDepth));
        endDepth = near;
      }
      const startScreen = project(start);
      const endScreen = project(end);
      const window = clipSegmentToRectangle(
        startScreen,
        endScreen,
        clipX,
        clipY,
      );
      if (window === null) continue;
      // Screen fractions back to eye-space fractions (perspective-correct).
      const t0 = eyeFraction(window[0], startDepth, endDepth);
      const t1 = eyeFraction(window[1], startDepth, endDepth);
      const visibleStart = lerp(start, end, t0);
      const visibleEnd = lerp(start, end, t1);
      for (const [pieceStart, pieceEnd] of splitVisible(
        visibleStart,
        visibleEnd,
        hidden,
      )) {
        const [x0, y0] = project(pieceStart);
        const [x1, y1] = project(pieceEnd);
        if (!Number.isFinite(x0) || !Number.isFinite(y0) ||
            !Number.isFinite(x1) || !Number.isFinite(y1)) continue;
        if (Math.hypot(x1 - x0, y1 - y0) < 0.05) continue;
        segments.push(Object.freeze([x0, y0, x1, y1, weight]));
      }
    }
    return Object.freeze(segments);
  };
  const segments = projectRing(plan.orbit.vertices, plan.orbit.closed === false ? plan.orbit.trail : trailWeights?.own ?? plan.orbit.trail, plan.orbit.closed !== false);

  // A point in the scene as a screen-space billboard: where it lands, and
  // whether it is in front of the camera, inside the viewport and not behind
  // the body.
  const projectPoint = (point: Vector3): PointProjection => {
    const eye = toEye(point);
    const depth = depthOf(eye);
    if (depth <= near) {
      return Object.freeze({ visible: false, classification: "behind-camera", depth, screen: null });
    }
    const [x, y] = project(eye);
    const inside = x >= visible.left && x <= visible.right && y >= visible.top && y <= visible.bottom;
    const occluded = rayHitsSphereBefore(eye, bodyCenter, bodyRadius);
    return Object.freeze({
      visible: inside && !occluded,
      classification: !inside ? "outside-viewport" : occluded ? "behind-body" : "visible",
      depth,
      screen: Object.freeze([x, y]),
    });
  };

  // The rest of the planetary system, only when asked for: below the fade-in
  // distance nothing is projected, so a near view costs what it did.
  let systemProjection: HeliocentricProjection["system"] = null;
  if (system && plan.system) {
    const factor = screenFactor(viewportWidth, viewportHeight);
    const radiansPerPixel = 2 * Math.atan(viewportHeight / (2 * focal)) / viewportHeight;
    const projectBody = (body: PreparedSystemBody) => {
      const marker = projectPoint(body.position);
      const eye = toEye(body.position);
      const centreDistance = magnitude(eye);
      const light = sunEye.map((component, index) => component - eye[index]);
      const cosinePhase = -dot(light, eye) / (magnitude(light) * centreDistance);
      const appearance = planetPointPresentation(body.pointPresentation, centreDistance,
        Math.acos(Math.max(-1, Math.min(1, cosinePhase))), factor);
      const trueAngle = centreDistance > body.radiusUnits ? 2 * Math.asin(body.radiusUnits / centreDistance) : Math.PI;
      const physicalDiameterPx = trueAngle / radiansPerPixel;
      return Object.freeze({
        ...marker,
        // A planet's disc follows its physical angular diameter. Brightness
        // changes opacity, never the body's size; only unresolved discs get
        // the common 1.2px visibility floor.
        diameterPx: Math.max(physicalDiameterPx, 2 * body.pointPresentation.policy.minimumRadiusPx),
        alpha: appearance.alpha,
        magnitude: appearance.magnitude,
        labelPriority: body.orbit === null ? 0 : planetOrbitLabelPriority(body.orbit.labelPresentation, magnitude(sunEye), centreDistance, appearance.magnitude),
        physicalDiameterPx,
        photometricRadiusPx: appearance.radiusPx,
      });
    };
    systemProjection = Object.freeze({
      sun: projectPoint(plan.system.sun.position),
      bodies: Object.freeze(plan.system.bodies.map((body) => Object.freeze({
        id: body.id,
        marker: projectBody(body),
        orbitSegments: systemOrbits && body.orbit !== null ? projectRing(body.orbit.vertices, trailWeights?.[body.id] ?? body.orbit.trail) : Object.freeze([]),
      }))),
    });
  }

  return Object.freeze({
    focal,
    distance,
    near,
    viewportWidth,
    viewportHeight,
    principalOffset: Object.freeze([ox, oy]),
    body,
    sun,
    orbitSegments: segments,
    system: systemProjection,
  });
}

// Distance at which the body's silhouette has the given on-screen radius
// across the off-axis direction (the tangential semi-axis).
export function distanceForSilhouetteRadius(
  bodyRadius: number,
  focal: number,
  screenRadius: number,
  principalOffset: Vector2 = [0, 0],
) {
  if (!positive(bodyRadius) || !positive(focal) || !positive(screenRadius)) {
    throw new TypeError("Silhouette framing arguments are invalid.");
  }
  const { cosTheta } = offAxisFrame(focal, principalOffset);
  const k = screenRadius / focal;
  const sinAlpha = k * cosTheta / Math.sqrt(1 + k * k);
  return bodyRadius / sinAlpha;
}

export function silhouetteRadiusAtDistance(
  bodyRadius: number,
  focal: number,
  distance: number,
  principalOffset: Vector2 = [0, 0],
) {
  return silhouetteEllipse(
    bodyRadius,
    focal,
    distance,
    offAxisFrame(focal, principalOffset),
  ).tangentialSemiAxis;
}

// The direction from the eye to the root's centre, `theta` off the view axis,
// and the unit screen direction from the principal point toward it.
function offAxisFrame(focal: number, [ox, oy]: Vector2) {
  const offset = Math.hypot(ox, oy);
  const hypotenuse = Math.hypot(offset, focal);
  return Object.freeze({
    radial: offset > 1e-9 ? [-ox / offset, -oy / offset] : [0, 0],
    sinTheta: offset / hypotenuse,
    cosTheta: focal / hypotenuse,
    tanTheta: offset / focal,
  });
}

// The silhouette of a sphere `distance` from the eye, `theta` off the view
// axis, on the image plane `focal` away: semi-axes along and across the
// radial direction and the centre's outward shift from where the sphere's
// centre projects, all in CSS pixels.
function silhouetteEllipse(bodyRadius: number, focal: number, distance: number, axis: ReturnType<typeof offAxisFrame>) {
  const sinAlpha = bodyRadius / distance;
  const sin2Alpha = 2 * sinAlpha * Math.sqrt(1 - sinAlpha * sinAlpha);
  const sin2Theta = 2 * axis.sinTheta * axis.cosTheta;
  const denominator = axis.cosTheta * axis.cosTheta - sinAlpha * sinAlpha;
  if (!(denominator > 0)) {
    throw new RangeError("The body's silhouette leaves the image plane.");
  }
  const radialSemiAxis = focal * sin2Alpha / (2 * denominator);
  const tangentialSemiAxis = focal * sinAlpha / Math.sqrt(denominator);
  const centreShift = focal * sin2Theta / (2 * denominator) -
    focal * axis.tanTheta;
  return Object.freeze({
    radialSemiAxis,
    tangentialSemiAxis,
    // Unit screen direction of the radial axis (from the principal point).
    radial: Object.freeze([...axis.radial]),
    // Ellipse centre relative to the root's centre.
    centre: Object.freeze([
      centreShift * axis.radial[0],
      centreShift * axis.radial[1],
    ]),
  });
}

// Row-major 3x3 rotation from a CSS matrix3d (column-major m11.. m33): the
// linear part that maps a scene-frame direction into camera-root CSS space.
export function rotationFromMatrix3d(matrix: Matrix3dLike) {
  return Object.freeze([
    matrix.m11, matrix.m21, matrix.m31,
    matrix.m12, matrix.m22, matrix.m32,
    matrix.m13, matrix.m23, matrix.m33,
  ]);
}

// True when the ray from the eye to `eye` (eye-space point) enters the sphere
// at `center` before reaching the point.
function rayHitsSphereBefore(eye: Vector3, center: Vector3, radius: number) {
  const a = dot(eye, eye);
  if (!(a > 0)) return false;
  const b = dot(eye, center);
  const c = dot(center, center) - radius * radius;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return false;
  const t = (b - Math.sqrt(discriminant)) / a;
  return t > 0 && t < 1;
}

// Cuts a segment into the pieces the sphere does not hide, by sampling and
// bisecting each visibility change.
function splitVisible(start: Vector3, end: Vector3, hidden: (point: Vector3) => boolean): [Vector3, Vector3][] {
  const samples = 16;
  const flags = [];
  for (let index = 0; index <= samples; index += 1) {
    flags.push(hidden(lerp(start, end, index / samples)));
  }
  if (flags.every((flag) => !flag)) return [[start, end]];
  if (flags.every(Boolean)) return [];
  const pieces: [Vector3, Vector3][] = [];
  let openAt = flags[0] ? null : 0;
  for (let index = 0; index < samples; index += 1) {
    if (flags[index] === flags[index + 1]) continue;
    let low = index / samples;
    let high = (index + 1) / samples;
    for (let step = 0; step < 20; step += 1) {
      const middle = (low + high) / 2;
      if (hidden(lerp(start, end, middle)) === flags[index]) {
        low = middle;
      } else {
        high = middle;
      }
    }
    const boundary = (low + high) / 2;
    if (flags[index]) {
      openAt = boundary;
    } else {
      pieces.push([lerp(start, end, openAt!), lerp(start, end, boundary)]);
      openAt = null;
    }
  }
  if (openAt !== null) pieces.push([lerp(start, end, openAt!), end]);
  return pieces;
}

function validVisibleRect(rect: VisibleRect) {
  return rect !== null && typeof rect === "object" &&
    [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite) &&
    rect.right > rect.left && rect.bottom > rect.top;
}

// Liang-Barsky against |x| <= clipX, |y| <= clipY; returns the screen-space
// parameter window or null.
function clipSegmentToRectangle(start: Vector3, end: Vector3, clipX: number, clipY: number) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, start[0] + clipX],
    [dx, clipX - start[0]],
    [-dy, start[1] + clipY],
    [dy, clipY - start[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [t0, t1];
}

// A fraction along the projected segment corresponds to this fraction along
// the eye-space segment.
function eyeFraction(screenFraction: number, startDepth: number, endDepth: number) {
  if (screenFraction <= 0) return 0;
  if (screenFraction >= 1) return 1;
  return screenFraction * startDepth /
    (endDepth + screenFraction * (startDepth - endDepth));
}

function lerp(a: Vector3, b: Vector3, t: number) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function determinant(basis: readonly Vector3[]) {
  const [a, b, c] = basis;
  return dot(a, cross(b, c));
}

export function dot(a: Vector3, b: Vector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vector3, b: Vector3): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function add(a: Vector3, b: Vector3): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(vector: Vector3, factor: number): [number, number, number] {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

export function magnitude(vector: Vector3) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalize(vector: Vector3) {
  const length = magnitude(vector);
  if (!(length > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze([vector[0] / length, vector[1] / length, vector[2] / length]);
}

export function round(value: number) {
  return Number(value.toFixed(6));
}

export function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function vector(value: unknown): value is Vector3 {
  return isArray(value) && value.length === 3 &&
    value.every(Number.isFinite);
}

// Prepared illumination from the observer's vantage: a phase, the light's
// view depth for the lighting atlas, and the marker's brightness as opacity.
function validIllumination(illumination: PreparedIllumination) {
  return Number.isFinite(illumination?.phaseAngleDegrees) &&
    illumination.phaseAngleDegrees >= 0 && illumination.phaseAngleDegrees <= 180 &&
    Number.isFinite(illumination.illuminatedFraction) &&
    illumination.illuminatedFraction >= 0 && illumination.illuminatedFraction <= 1 &&
    Number.isFinite(illumination.lightViewZ) && Math.abs(illumination.lightViewZ) <= 1 &&
    positive(illumination.markerOpacity) && illumination.markerOpacity <= 1;
}

function validBehindTurns(turns: readonly number[], vertexCount: number) {
  return isArray(turns) && turns.length === vertexCount &&
    turns.every((turn) => Number.isFinite(turn) && turn >= 0 && turn < 1) &&
    turns[turns.length - 1] < turns[0];
}

// One weight per chord, each in [0, 1], the last chord (the one returning
// to the body) at full strength and at least one chord weightless: a trail,
// never a closed loop.
function validTrail(trail: readonly number[], vertexCount: number) {
  return isArray(trail) && trail.length === vertexCount &&
    trail.every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 1) &&
    trail[trail.length - 1] > 0.9 && trail.some((weight) => weight === 0);
}

function unit(value: unknown): value is Vector3 {
  return vector(value) && Math.abs(Math.hypot(...value) - 1) < 1e-9;
}
