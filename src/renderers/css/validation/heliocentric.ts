import { array, direction, fail, finite, integer, numbers, positive, record, text, unique } from './guards.js';
import { requireExposure } from './sky.js';
import type { ObjectRuntimeDefinition } from '../runtime/object-runtime-types.js';
import type { HeliocentricViewPlan } from '../solar-system/heliocentric-view.js';
import { validatePreparedHeliocentricView } from '../solar-system/heliocentric-view.js';
import { DEFAULT_LABEL_POLICY } from '@cssearth/engine';

type Helio = NonNullable<ObjectRuntimeDefinition['heliocentricView']>;
export function requireHeliocentric(value: unknown, camera: ObjectRuntimeDefinition['camera'], hasSun: boolean, objectId: string): asserts value is Helio {
  const helio = record(value, 'heliocentric view', ['plan', 'bodyMarker', 'systemMarkers', 'labels']);
  requirePlan(helio.plan); validatePreparedHeliocentricView(helio.plan);
  if (helio.plan.bodyId !== objectId || !hasSun || camera.projection?.model !== 'css-perspective-shared-with-sky') fail('heliocentric view needs matching observer, Sun and perspective camera');
  sprite(helio.bodyMarker, true);
  const system = helio.plan.system;
  if (helio.systemMarkers !== undefined && helio.systemMarkers !== null || system !== undefined) {
    const markers = record(helio.systemMarkers, 'system markers'); text(markers.url, 'system marker URL'); sprite(markers.sun);
    const bodies = record(markers.bodies, 'body markers'); Object.values(bodies).forEach(value => sprite(value));
    for (const body of system?.bodies ?? []) sprite(bodies[body.id]);
    const phase = record(markers.phase, 'phase atlas'); text(phase.url, 'phase atlas URL');
    const count = integer(phase.frameCount, 'phase frames', 2), columns = integer(phase.columns, 'phase columns', 1), rows = integer(phase.rowCount, 'phase rows', 1);
    if (count > columns * rows || finite(phase.minimumLightViewZ, 'phase minimum') >= finite(phase.maximumLightViewZ, 'phase maximum')) fail('phase atlas dimensions are incompatible');
    finite(phase.baseLightAzimuthDegrees, 'phase light azimuth');
  }
  if (helio.labels !== undefined && helio.labels !== null) {
    const labels = record(helio.labels, 'captions'); labelPolicy(labels.policy, false);
    const names = record(labels.names, 'caption names'); Object.values(names).forEach(value => text(value, 'caption name'));
    for (const id of [objectId, ...(system ? ['sun', ...system.bodies.map(body => body.id)] : [])]) text(names[id], 'required caption name');
    if (labels.stars !== undefined) {
      const stars = record(labels.stars, 'star captions'); labelPolicy(stars.policy, true); requireExposure(stars.exposure);
      const ids = array(stars.records, 'named stars').map(input => {
        const star = record(input, 'named star'); text(star.name, 'proper star name'); direction(star.direction, 'caption star direction', 1e-5);
        finite(star.magnitude, 'caption star magnitude'); if (star.hip !== undefined) integer(star.hip, 'Hipparcos number');
        return text(star.id, 'caption star identity');
      });
      unique(ids, 'named stars');
    }
  }
}
function sprite(value: unknown, needsUrl = false): void {
  const marker = record(value, 'marker sprite');
  if (integer(marker.index, 'sprite index') >= integer(marker.count, 'sprite count', 1)) fail('sprite index is outside strip');
  positive(marker.size, 'sprite size'); if (needsUrl || marker.url !== undefined) text(marker.url, 'sprite URL');
}
function labelPolicy(value: unknown, star: boolean): void {
  const policy = record(value, 'caption policy');
  positive(policy.capPixels, 'caption cap');
  if (finite(policy.gapPixels, 'caption gap') < 0 || finite(policy.spacingPixels, 'caption spacing') < 0 ||
      positive(policy.boxHeightCaps, 'caption height') <= 1 || positive(policy.maxAlpha, 'caption alpha') > 1 ||
      positive(policy.capHeightEm, 'cap height') <= 0.5 || positive(policy.capHeightEm, 'cap height') >= 1) fail('caption metrics are invalid');
  positive(policy.maxAlphaStep, 'caption fade step'); const pool = integer(policy.poolSize, 'caption pool', 1);
  if (star) { if (pool !== 1) fail('ordinary star captions have one retained slot'); }
  else if (policy.model !== DEFAULT_LABEL_POLICY.model || integer(policy.candidateCapacity, 'caption capacity', 1) < pool) fail('caption policy is incompatible');
}
function requirePlan(value: unknown): asserts value is HeliocentricViewPlan {
  const plan = record(value, 'heliocentric plan');
  if (plan.schema !== 'cssearth-prepared-heliocentric-view@1' || plan.runtimeGeometryDerivation !== false) fail('heliocentric plan is incompatible');
  text(plan.bodyId, 'observer id'); const units = record(plan.units, 'heliocentric units');
  positive(units.kilometersPerUnit, 'kilometers per unit'); positive(units.bodyRadiusUnits, 'body radius');
  const sun = record(plan.sun, 'heliocentric Sun'); direction(sun.direction, 'observed Sun direction'); numbers(sun.position, 'Sun position', 3);
  positive(sun.distanceUnits, 'Sun distance'); positive(sun.radiusUnits, 'Sun radius');
  const image = record(sun.sprite, 'Sun sprite'); positive(image.worldDiameterUnits, 'Sun sprite world diameter'); integer(image.imagePixels, 'Sun sprite pixels', 1);
  orbit(plan.orbit, true);
  if (plan.system !== undefined) {
    const system = record(plan.system, 'planetary system');
    if (system.schema !== 'cssearth-prepared-planetary-system@1' || system.runtimeGeometryDerivation !== false) fail('planetary system is incompatible');
    text(system.observer, 'system observer'); numbers(record(system.sun, 'system Sun').position, 'system Sun position', 3); positive(system.maximumExtentUnits, 'system extent');
    if (system.epochJdTt !== undefined) finite(system.epochJdTt, 'prepared epoch');
    for (const input of array(system.bodies, 'system bodies')) {
      const body = record(input, 'system body'); text(body.id, 'system body id'); numbers(body.position, 'body position', 3);
      positive(body.radiusUnits, 'body radius'); positive(body.semiMajorAxisUnits, 'body semimajor axis');
      orbit(body.orbit, false); const label = record(record(body.orbit, 'body orbit').labelPresentation, 'orbit labels');
      for (const key of ['radiusUnits', 'angularFadeInRadians', 'angularFullRadians', 'nearDistanceUnits', 'farDistanceUnits', 'minimumEligibility']) positive(label[key], `orbit label ${key}`);
      const illumination = record(body.illumination, 'illumination');
      for (const key of ['phaseAngleDegrees', 'illuminatedFraction', 'lightViewZ', 'markerOpacity']) finite(illumination[key], `illumination ${key}`);
      point(body.pointPresentation);
    }
  }
}
function orbit(value: unknown, observer: boolean): void {
  const orbit = record(value, 'orbit'); direction(orbit.normal, 'orbit normal'); direction(orbit.perihelionDirection, 'perihelion direction');
  if (observer) { positive(orbit.semiMajorAxisUnits, 'semimajor axis'); positive(orbit.maximumExtentUnits, 'orbit extent'); }
  const vertices = array(orbit.vertices, 'orbit vertices'); vertices.forEach(value => numbers(value, 'orbit vertex', 3));
  if (vertices.length < 8 || integer(orbit.vertexCount, 'orbit vertex count') !== vertices.length) fail('orbit vertex count is incompatible');
  numbers(orbit.trail, 'orbit trail', vertices.length); numbers(orbit.chordBehindTurns, 'orbit chord turns', vertices.length);
  const spans = record(orbit.trailSpans, 'orbit spans');
  if (finite(spans.solidTurns, 'solid trail') < 0 || positive(spans.fadeTurns, 'fading trail') + finite(spans.solidTurns, 'solid trail') >= 1) fail('orbit spans must leave undrawn remainder');
}
function point(value: unknown): void {
  const point = record(value, 'point presentation');
  if (point.schema !== 'cssearth-prepared-planet-point@1') fail('point presentation is incompatible');
  finite(point.minimumLogDistance, 'minimum log distance'); positive(point.logDistanceStep, 'log distance step');
  const distances = integer(point.distanceCount, 'point distance count', 2), phases = integer(point.phaseCount, 'point phase count', 2);
  const samples = numbers(point.samples, 'point samples', distances * phases * 3);
  if (samples.some((value, index) => index % 3 !== 2 && value < 0)) fail('point radiance samples must be nonnegative');
  const policy = record(point.policy, 'point policy');
  for (const name of ['minimumRadiusPx', 'skipRadiusPx', 'maximumRadiusPx', 'minimumAlpha']) finite(policy[name], `point ${name}`);
}
