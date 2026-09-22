import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../tools/sources/source-values.mts';
import { loadRadialTerrain } from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { parseRadialSource } from '../../../tools/objects/terrestrial-layers/radial-source.mts';
import { parseSolidPreparationSource } from '../../../tools/objects/terrestrial-layers/profile-source.mts';

type LoadedRadialTerrain = NonNullable<Awaited<ReturnType<typeof loadRadialTerrain>>>;

export interface ClosedRadialSimplification {
  readonly sourceFaces: number;
  readonly removedOppositeFaces: number;
  readonly estimatedErrorMeters: number;
  readonly topology: { readonly components: number; readonly eulerCharacteristic: number };
}

export type ClosedRadialTerrain = LoadedRadialTerrain & {
  readonly simplification: ClosedRadialSimplification;
};

/**
 * These tests make claims about a source-preserving closed mesh. The preparer
 * permits other radial sources, so validate this narrower fixture contract at
 * the test boundary before reading its report fields.
 */
export function requireClosedRadialTerrain(value: Awaited<ReturnType<typeof loadRadialTerrain>>): ClosedRadialTerrain {
  if (value === null) throw new TypeError('Expected a prepared radial terrain.');
  const report = requireRecord(value.simplification, 'Prepared radial simplification report');
  const topology = requireRecord(report.topology, 'Prepared radial topology report');
  return {
    ...value,
    simplification: {
      sourceFaces: requireFiniteNumber(report.sourceFaces, 'Prepared radial source face count'),
      removedOppositeFaces: requireFiniteNumber(report.removedOppositeFaces, 'Prepared radial removed opposite face count'),
      estimatedErrorMeters: requireFiniteNumber(report.estimatedErrorMeters, 'Prepared radial estimated error'),
      topology: {
        eulerCharacteristic: requireFiniteNumber(topology.eulerCharacteristic, 'Prepared radial Euler characteristic'),
        components: requireFiniteNumber(topology.components, 'Prepared radial component count'),
      },
    },
  };
}

export function requireAcquisitionPlan(value: unknown): { readonly operations: readonly { readonly path: string }[] } {
  const record = requireRecord(value, 'Source acquisition plan');
  return {
    operations: requireArray(record.operations, 'Source acquisition operations').map((operation, index) => {
      const item = requireRecord(operation, `Source acquisition operation ${index}`);
      return { path: requireString(item.path, `Source acquisition operation ${index} path`) };
    }),
  };
}

export function requireRadialTestConfig(value: unknown) {
  const config = parseSolidPreparationSource(value);
  const terrain = parseRadialSource(config.geometry.radialTerrain);
  const scientific = config.raster.scientific;
  if (scientific === undefined || scientific.length === 0) throw new TypeError('Expected a source scientific lens.');
  const lens = scientific[0];
  const transform = requireRecord(lens.valueTransform, 'Source scientific value transform');
  return {
    config,
    terrain,
    lens: { ...lens, valueTransform: { ...(transform.scale === undefined ? {} : { scale: requireFiniteNumber(transform.scale, 'Source scientific value transform scale') }),
      offset: requireFiniteNumber(transform.offset, 'Source scientific value transform offset') } },
  };
}

export function requireRotation(value: unknown, fields: readonly string[]): Record<string, string | number> {
  const record = requireRecord(value, 'Source rotation');
  return Object.fromEntries(fields.map(field => {
    const fieldValue = record[field];
    if (typeof fieldValue !== 'string' && typeof fieldValue !== 'number') throw new TypeError(`Source rotation ${field} must be text or a number.`);
    return [field, fieldValue];
  }));
}

export function requireScalarAnchors(value: unknown) {
  const record = requireRecord(value, 'Scalar anchors');
  return requireArray(record.checks, 'Scalar anchor checks').map((entry, index) => {
    const check = requireRecord(entry, `Scalar anchor ${index}`);
    const query = requireArray(check.query, `Scalar anchor ${index} query`).map((part, axis) => requireFiniteNumber(part, `Scalar anchor ${index} query ${axis}`));
    const point = requireArray(check.point, `Scalar anchor ${index} point`).map((part, axis) => requireFiniteNumber(part, `Scalar anchor ${index} point ${axis}`));
    if (typeof check.accepted !== 'boolean') throw new TypeError(`Scalar anchor ${index} acceptance must be boolean.`);
    return { accepted: check.accepted, query, point, value: requireFiniteNumber(check.value, `Scalar anchor ${index} value`), distanceMeters: requireFiniteNumber(check.distanceMeters, `Scalar anchor ${index} distance`) };
  });
}

export function requireHistoricalContent(value: unknown) {
  const content = requireRecord(value, 'Historical body content');
  const settings = requireRecord(content.settings, 'Historical body settings');
  const controls = requireArray(settings.controls, 'Historical body controls').map((entry, index) => {
    const control = requireRecord(entry, `Historical body control ${index}`);
    if (typeof control.checked !== 'boolean') throw new TypeError(`Historical body control ${index} checked must be boolean.`);
    return { name: requireString(control.name, `Historical body control ${index} name`), checked: control.checked };
  });
  const panel = requireRecord(content.panel, 'Historical body panel');
  return { settings: { controls }, panel: { facts: requireArray(panel.facts, 'Historical body facts').map((entry, index) => { const fact=requireRecord(entry, `Historical body fact ${index}`); return {id:requireString(fact.id, `Historical body fact ${index} id`), label:requireString(fact.label, `Historical body fact ${index} label`)}; }) } };
}

export function requireObjectRotationReference(value: unknown): { readonly path: string } {
  const descriptor = requireRecord(value, 'Object descriptor');
  const properties = requireRecord(descriptor.properties, 'Object descriptor properties');
  const recipe = requireRecord(properties.recipe, 'Object descriptor recipe');
  const sources = requireArray(recipe.sources, 'Object descriptor recipe sources');
  const rotation = sources.find(source => requireRecord(source, 'Object descriptor recipe source').id === 'rotation');
  if (rotation === undefined) throw new TypeError('Expected an object descriptor rotation source.');
  const reference = requireRecord(rotation, 'Object descriptor rotation source');
  return { path: requireString(reference.path, 'Object descriptor rotation source path') };
}

export function requireMl14Content(value: unknown) {
  const content = requireRecord(value, '1998 ML14 content');
  const settings = requireRecord(content.settings, '1998 ML14 settings');
  const controls = requireArray(settings.controls, '1998 ML14 settings controls').map((entry, index) => {
    const control = requireRecord(entry, `1998 ML14 settings control ${index}`);
    if (typeof control.checked !== 'boolean') throw new TypeError(`1998 ML14 settings control ${index} checked must be boolean.`);
    return { name: requireString(control.name, `1998 ML14 settings control ${index} name`), checked: control.checked };
  });
  const panel = requireRecord(content.panel, '1998 ML14 panel');
  const facts = requireArray(panel.facts, '1998 ML14 facts').map((entry, index) => {
    const fact = requireRecord(entry, `1998 ML14 fact ${index}`);
    return { id: requireString(fact.id, `1998 ML14 fact ${index} id`), value: requireString(fact.value, `1998 ML14 fact ${index} value`) };
  });
  const lenses = requireRecord(content.lenses, '1998 ML14 lenses');
  const lensControls = requireArray(lenses.controls, '1998 ML14 lens controls').map((entry, index) => {
    const control = requireRecord(entry, `1998 ML14 lens control ${index}`);
    // Reader prose left the source tree for text.json; the source content keeps only lens identities.
    return { id: requireString(control.id, `1998 ML14 lens control ${index} id`) };
  });
  return { settings: { controls }, panel: { facts }, lenses: { controls: lensControls } };
}

export function requireShadowsContent(value: unknown) {
  const content = requireRecord(value, 'Body content');
  const settings = requireRecord(content.settings, 'Body settings');
  return {
    controls: requireArray(settings.controls, 'Body settings controls').map((entry, index) => {
      const control = requireRecord(entry, `Body settings control ${index}`);
      if (typeof control.checked !== 'boolean') throw new TypeError(`Body settings control ${index} checked must be boolean.`);
      return { name: requireString(control.name, `Body settings control ${index} name`), checked: control.checked };
    }),
  };
}

export function requireProjectionAnchors(value: unknown) {
  const source = requireRecord(value, 'Projection anchors');
  const checks = requireArray(source.checks, 'Projection anchor checks').map((entry, index) => {
    const check = requireRecord(entry, `Projection anchor ${index}`);
    const query = requireArray(check.query, `Projection anchor ${index} query`).map((part, axis) => requireFiniteNumber(part, `Projection anchor ${index} query ${axis}`));
    const point = requireArray(check.expectedPoint, `Projection anchor ${index} expected point`).map((part, axis) => requireFiniteNumber(part, `Projection anchor ${index} expected point ${axis}`));
    if (typeof check.withinTransferLimit !== 'boolean') throw new TypeError(`Projection anchor ${index} transfer limit must be boolean.`);
    return { query, point, withinTransferLimit: check.withinTransferLimit, kind: requireString(check.kind, `Projection anchor ${index} kind`), expectedValue: requireFiniteNumber(check.expectedValue, `Projection anchor ${index} expected value`), expectedRadiusMeters: requireFiniteNumber(check.expectedRadiusMeters, `Projection anchor ${index} expected radius`) };
  });
  return { checks };
}
