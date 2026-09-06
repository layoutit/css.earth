import { offAxisFrame, silhouetteEllipse, rayHitsSphereBefore, splitVisible, validVisibleRect, clipSegmentToRectangle, eyeFraction, lerp, positive, vector, unit, validTrail, validBehindTurns, validIllumination, dot, magnitude } from "./heliocentric-geometry.js";
import type { Vector2, Vector3, Matrix3, Matrix3dLike, VisibleRect } from './types.js';
import type { PreparedPlanetPoint, PlanetOrbitLabelPolicy } from "@cssearth/engine";
export interface TrailSpans {solidTurns:number;fadeTurns:number;}
export interface PreparedOrbit {normal:Vector3;perihelionDirection:Vector3;semiMajorAxisUnits:number;maximumExtentUnits:number;vertices:readonly Vector3[];vertexCount:number;trail:readonly number[];chordBehindTurns:readonly number[];trailSpans:TrailSpans;}
export interface PreparedIllumination {phaseAngleDegrees:number;illuminatedFraction:number;lightViewZ:number;markerOpacity:number;}
export interface PreparedSystemBody {id:string;position:Vector3;semiMajorAxisUnits:number;radiusUnits:number;pointPresentation:PreparedPlanetPoint;orbit:Omit<PreparedOrbit,"semiMajorAxisUnits"|"maximumExtentUnits"> & {labelPresentation:PlanetOrbitLabelPolicy};illumination:PreparedIllumination;}
export interface PreparedPlanetarySystem {schema:string;observer:string;sun:{position:Vector3};maximumExtentUnits:number;bodies:readonly PreparedSystemBody[];runtimeGeometryDerivation:boolean;epochJdTt?:number;}
export interface HeliocentricViewPlan {schema:string;bodyId:string;units:{kilometersPerUnit:number;bodyRadiusUnits:number};sun:{direction:Vector3;position:Vector3;distanceUnits:number;radiusUnits:number;sprite:{worldDiameterUnits:number;imagePixels:number}};orbit:PreparedOrbit;system?:PreparedPlanetarySystem;runtimeGeometryDerivation:boolean;}
export interface HeliocentricProjectionInput {rotation:Matrix3;distance:number;bodyCenter?:Vector3;focal:number;viewportWidth:number;viewportHeight:number;principalOffset?:Vector2;visibleRect?:VisibleRect|null;frustumPadding?:number;nearShare?:number;system?:boolean;systemOrbits?:boolean;trailWeights?:Readonly<Record<string,readonly number[]>>|null;}
export interface SilhouetteEllipse {radialSemiAxis:number;tangentialSemiAxis:number;radial:Vector2;centre:Vector2;}
export interface BodyProjection {distance:number;depth:number;visible:boolean;screen:Vector2|null;offAxisDegrees:number;silhouetteRadius:number;silhouetteDiameter:number;silhouette:SilhouetteEllipse|null;orthographicRadius:number;translate:Vector3;}
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

import { planetPointPresentation, planetOrbitLabelPriority, validPreparedPlanetPoint } from "@cssearth/engine";
import { screenFactor } from "@cssearth/engine";

export const PREPARED_HELIOCENTRIC_VIEW_SCHEMA =
  "cssearth-prepared-heliocentric-view@1";

// IAU 2015 resolution B3 nominal solar radius.
export const NOMINAL_SOLAR_RADIUS_KILOMETERS = 695700;

export function validatePreparedHeliocentricView(plan: HeliocentricViewPlan) {
  if (plan?.schema !== PREPARED_HELIOCENTRIC_VIEW_SCHEMA ||
      !positive(plan.units?.kilometersPerUnit) ||
      !positive(plan.units?.bodyRadiusUnits) ||
      !unit(plan.sun?.direction) || !positive(plan.sun?.distanceUnits) ||
      !positive(plan.sun?.radiusUnits) ||
      !positive(plan.sun?.sprite?.worldDiameterUnits) ||
      !Number.isSafeInteger(plan.sun?.sprite?.imagePixels) ||
      !vector(plan.sun?.position) ||
      !unit(plan.orbit?.normal) || !unit(plan.orbit?.perihelionDirection) ||
      !positive(plan.orbit?.semiMajorAxisUnits) ||
      !positive(plan.orbit?.maximumExtentUnits) ||
      !Array.isArray(plan.orbit?.vertices) || plan.orbit.vertices.length < 8 ||
      plan.orbit.vertexCount !== plan.orbit.vertices.length ||
      !plan.orbit.vertices.every(vector) ||
      plan.orbit.vertices[0].some((component) => component !== 0) ||
      !validTrail(plan.orbit.trail, plan.orbit.vertexCount) ||
      !validBehindTurns(plan.orbit.chordBehindTurns, plan.orbit.vertexCount) ||
      !validTrailSpans(plan.orbit.trailSpans) ||
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

export function trailWeightsForSpans(chordBehindTurns: readonly number[], spans:TrailSpans) {
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
        Math.abs(component - plan.sun.position[index]) > 1e-3) ||
      !positive(system.maximumExtentUnits) ||
      !(system.maximumExtentUnits >= plan.orbit.maximumExtentUnits) ||
      !Array.isArray(system.bodies) || system.bodies.length === 0 ||
      system.bodies.some((body) =>
        !/^[a-z][a-z0-9-]*$/u.test(body?.id ?? "") || body.id === plan.bodyId ||
        !vector(body.position) || !positive(body.semiMajorAxisUnits) ||
        !positive(body.radiusUnits) || !validPreparedPlanetPoint(body.pointPresentation) ||
        !positive(body.orbit?.labelPresentation?.radiusUnits) ||
        !positive(body.orbit.labelPresentation.angularFadeInRadians) ||
        !(body.orbit.labelPresentation.angularFullRadians > body.orbit.labelPresentation.angularFadeInRadians) ||
        !positive(body.orbit.labelPresentation.nearDistanceUnits) ||
        !(body.orbit.labelPresentation.farDistanceUnits > body.orbit.labelPresentation.nearDistanceUnits) ||
        !positive(body.orbit.labelPresentation.minimumEligibility) ||
        !unit(body.orbit?.normal) || !unit(body.orbit?.perihelionDirection) ||
        !Array.isArray(body.orbit.vertices) || body.orbit.vertices.length < 8 ||
        body.orbit.vertexCount !== body.orbit.vertices.length ||
        !body.orbit.vertices.every(vector) ||
        !validTrail(body.orbit.trail, body.orbit.vertexCount) ||
        !validBehindTurns(body.orbit.chordBehindTurns, body.orbit.vertexCount) ||
        !validIllumination(body.illumination) ||
        body.orbit.vertices[0].some((component:number, index:number) => component !== body.position[index])) ||
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
  bodyCenter: explicitBodyCenter,
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
  if (!Array.isArray(rotation) || rotation.length !== 9 ||
      rotation.some((value) => !Number.isFinite(value)) ||
      !positive(distance) || !positive(focal) ||
      !positive(viewportWidth) || !positive(viewportHeight) ||
      !Array.isArray(principalOffset) || principalOffset.length !== 2 ||
      principalOffset.some((value) => !Number.isFinite(value)) ||
      (visibleRect !== null && !validVisibleRect(visibleRect)) ||
      (explicitBodyCenter !== undefined && (!vector(explicitBodyCenter) ||
        Math.abs(magnitude(explicitBodyCenter) - distance) > 1e-9 * distance))) {
    throw new TypeError("Heliocentric projection arguments are invalid.");
  }
  const bodyRadius = plan.units.bodyRadiusUnits;
  if (distance <= bodyRadius) {
    throw new RangeError("The camera is inside the body.");
  }
  const cameraPlaneEpsilon = 1e-6;
  // Orbit chords need a depth bound before their perspective clipping. A
  // celestial body has its own finite disc; the distance to the mounted
  // object must never move that body's visibility plane towards the eye.
  const near = Math.max(cameraPlaneEpsilon, distance * nearShare);
  const halfWidth = viewportWidth / 2;
  const halfHeight = viewportHeight / 2;
  const visible = visibleRect ?? { left: -halfWidth, top: -halfHeight, right: halfWidth, bottom: halfHeight };
  const clipX = halfWidth * frustumPadding;
  const clipY = halfHeight * frustumPadding;
  const [ox, oy] = principalOffset;
  const axis = offAxisFrame(focal, principalOffset);
  // The body's centre in eye space: `distance` along the off-axis direction
  // that projects to the root's centre.
  const bodyCenter = explicitBodyCenter ?? [
    distance * axis.sinTheta * axis.radial[0],
    distance * axis.sinTheta * axis.radial[1],
    -distance * axis.cosTheta,
  ];
  const toEye = (point:Vector3) => [
    rotation[0] * point[0] + rotation[1] * point[1] + rotation[2] * point[2] +
      bodyCenter[0],
    rotation[3] * point[0] + rotation[4] * point[1] + rotation[5] * point[2] +
      bodyCenter[1],
    rotation[6] * point[0] + rotation[7] * point[1] + rotation[8] * point[2] +
      bodyCenter[2],
  ];
  const depthOf = (eye:Vector3) => -eye[2];
  const project = (eye:Vector3) => {
    const depth = depthOf(eye);
    return [ox + focal * eye[0] / depth, oy + focal * eye[1] / depth, depth];
  };

  // The body: its silhouette is the tangent cone cut by the image plane, an
  // ellipse a little wider than the orthographic disc and, off-axis, pushed
  // outward from where the centre projects. The material overlay and the drag
  // trackball follow it.
  const bodyDepth = explicitBodyCenter === undefined ? distance * axis.cosTheta : -bodyCenter[2];
  const bodyScreen = explicitBodyCenter === undefined ? [0, 0]
    : bodyDepth > 0 ? project(bodyCenter).slice(0, 2) : null;
  let silhouette: SilhouetteEllipse | null = null;
  if (explicitBodyCenter === undefined) silhouette = silhouetteEllipse(bodyRadius, focal, distance, axis);
  else if (bodyDepth > bodyRadius && bodyScreen !== null) {
    const radialLength = Math.hypot(bodyCenter[0], bodyCenter[1]);
    const ellipse = silhouetteEllipse(bodyRadius, focal, distance, {
      radial: radialLength > 0 ? [bodyCenter[0] / radialLength, bodyCenter[1] / radialLength] : [0, 0],
      sinTheta: radialLength / distance, cosTheta: bodyDepth / distance, tanTheta: radialLength / bodyDepth,
    });
    silhouette = Object.freeze({ ...ellipse,
      centre: [bodyScreen[0] + ellipse.centre[0], bodyScreen[1] + ellipse.centre[1]],
    });
  }
  const body = Object.freeze({
    distance,
    depth: bodyDepth,
    visible: silhouette !== null,
    screen: bodyScreen,
    offAxisDegrees: explicitBodyCenter === undefined ? Math.asin(axis.sinTheta) * 180 / Math.PI
      : Math.acos(Math.max(-1, Math.min(1, bodyDepth / distance))) * 180 / Math.PI,
    silhouetteRadius: silhouette?.tangentialSemiAxis ?? 0,
    silhouetteDiameter: 2 * (silhouette?.tangentialSemiAxis ?? 0),
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
  if (sunDepth <= cameraPlaneEpsilon) {
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
  const hidden = (eye:Vector3) => rayHitsSphereBefore(eye, bodyCenter, bodyRadius);
  // Only the trailing chords (weight above zero) are projected; each segment
  // carries its chord's trail weight as its opacity, so the line fades
  // backwards from the body and the leading half of the orbit is never drawn.
  const projectRing = (vertices:readonly Vector3[], trail:readonly number[]): readonly OrbitSegment[] => {
    const eyes = vertices.map(toEye);
    const segments = [];
    for (let index = 0; index < eyes.length; index += 1) {
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
  const segments = projectRing(plan.orbit.vertices, trailWeights?.own ?? plan.orbit.trail);

  // A point in the scene as a screen-space billboard: where it lands, and
  // whether it is in front of the camera, inside the viewport and not behind
  // the body.
  const projectPoint = (point:Vector3): PointProjection => {
    const eye = toEye(point);
    const depth = depthOf(eye);
    if (depth <= cameraPlaneEpsilon) {
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
    const projectBody = (body:PreparedSystemBody) => {
      const marker = projectPoint(body.position);
      const eye = toEye(body.position);
      const centreDistance = magnitude(eye);
      const light = sunEye.map((component, index) => component - eye[index]);
      const cosinePhase = -dot(light, eye) / (magnitude(light) * centreDistance);
      const appearance = planetPointPresentation(body.pointPresentation, centreDistance,
        Math.acos(Math.max(-1, Math.min(1, cosinePhase))), factor);
      // The same sphere tangent cone as focused geometry: a uniform angular
      // pixels-per-radian approximation changes size when focus transfers.
      const discInFront = marker.depth > body.radiusUnits;
      const physicalDiameterPx = discInFront
        ? 2 * focal * body.radiusUnits / Math.sqrt(marker.depth ** 2 - body.radiusUnits ** 2) : 0;
      return Object.freeze({
        ...marker,
        ...(!discInFront && marker.visible ? { visible: false, classification: 'intersects-camera-plane' as const } : {}),
        // A planet's disc follows its physical angular diameter. Brightness
        // changes opacity, never the body's size; only unresolved discs get
        // the common 1.2px visibility floor.
        diameterPx: Math.max(physicalDiameterPx, 2 * body.pointPresentation.policy.minimumRadiusPx),
        alpha: appearance.alpha,
        magnitude: appearance.magnitude,
        labelPriority: planetOrbitLabelPriority(body.orbit.labelPresentation, magnitude(sunEye), centreDistance, appearance.magnitude),
        physicalDiameterPx,
        photometricRadiusPx: appearance.radiusPx,
      });
    };
    systemProjection = Object.freeze({
      sun: projectPoint(plan.system.sun.position),
      bodies: Object.freeze(plan.system.bodies.map((body) => Object.freeze({
        id: body.id,
        marker: projectBody(body),
        orbitSegments: systemOrbits ? projectRing(body.orbit.vertices, trailWeights?.[body.id] ?? body.orbit.trail) : Object.freeze([]),
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

export { distanceForSilhouetteRadius, silhouetteRadiusAtDistance, rotationFromMatrix3d, determinant, dot, cross, add, scale, magnitude, normalize, round, positive } from "./heliocentric-geometry.js";
