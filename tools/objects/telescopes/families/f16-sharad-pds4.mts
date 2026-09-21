/** Narrow native reader for the PDS4 MRO SHARAD three-dimensional radargram products. */
import { open, stat } from 'node:fs/promises';
import { parsePlanetaryGridQualification, type PlanetaryGridQualification } from './f16-planetary-depth.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../../source-values.mts';

export const SHARAD_PDS4_PROFILE = 'mro-sharad-3d-array@1' as const;
export const SHARAD_PRODUCT_RECORD_SCHEMA = 'cssearth-bounded-archive-product@1' as const;
export type SharadAxis = 'projected-x' | 'projected-y' | 'delay';
export type SharadAxisName = 'X' | 'Y' | 'DELAY_TIME';

export interface SharadAxisSampling {
  readonly role: SharadAxis; readonly axisName: SharadAxisName; readonly unit: 'm' | 'us';
  readonly elements: number; readonly start: number; readonly increment: number;
}
/** Label cartography, carried verbatim. `pixelSpacingMetres` is the label's sampling interval and is never a resolution. */
export interface SharadCartography {
  readonly projection: 'Transverse Mercator'; readonly scaleFactorAtCentralMeridian: number;
  readonly centralMeridianDegrees: number; readonly projectionOriginLatitudeDegrees: number;
  readonly pixelSpacingMetres: readonly [number, number]; readonly upperLeftCornerMetres: readonly [number, number];
  readonly latitudeType: 'Planetocentric'; readonly longitudeDirection: 'Positive East'; readonly spheroidName: string;
  readonly radiiKm: readonly [number, number, number];
  readonly boundingDegrees: { readonly west: number; readonly east: number; readonly north: number; readonly south: number };
}
export interface SharadStatistics { readonly quantity: string; readonly minimum: number; readonly maximum: number }
export interface SharadPds4Label {
  readonly profile: typeof SHARAD_PDS4_PROFILE;
  readonly lidvid: string; readonly title: string;
  readonly dataFile: string; readonly supplementalFile?: string; readonly dataOffset: number;
  /** Native PDS Array_3D axis order; delay is the last/fastest axis. */
  readonly shape: readonly [number, number, number];
  readonly axes: readonly [SharadAxisSampling, SharadAxisSampling, SharadAxisSampling];
  readonly arrayDescription: string; readonly statistics: SharadStatistics;
  readonly cartography: SharadCartography;
  readonly startIso: string; readonly stopIso: string;
}

export interface SharadByteRange { readonly position: number; readonly length: number }
export interface SharadReadCost { readonly reads: number; readonly bytes: number }
export interface SharadReadLimits { readonly maximumBytes: number; readonly maximumReads: number }
/** One contiguous X plane of the published volumes is 20,448,000 bytes; a constant-delay plane is not a bounded read. */
export const SHARAD_DEFAULT_LIMITS: SharadReadLimits = { maximumBytes: 33_554_432, maximumReads: 4_096 };

export interface SharadByteSource {
  readonly identity: string; readonly size: number;
  read(position: number, length: number): Promise<Buffer>;
  close(): Promise<void>;
}
export interface SharadPds4Volume { readonly source: SharadByteSource; readonly label: SharadPds4Label }
export interface SharadPlane { readonly axis: SharadAxis; readonly index: number; readonly shape: readonly [number, number]; readonly axes: readonly SharadAxis[]; readonly cost: SharadReadCost; readonly values: readonly (number | null)[] }
export interface SharadDelayFrame { readonly x: number; readonly y: number; readonly range: SharadByteRange; readonly delayStartMicroseconds: number; readonly delayIncrementMicroseconds: number; readonly values: readonly (number | null)[] }

const text = (xml: string, name: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = [...xml.matchAll(new RegExp(`<${escaped}(?:\\s[^>]*)?>([^<]*)</${escaped}>`, 'g'))].map(hit => hit[1]!.trim());
  if (hits.length !== 1) throw new TypeError(`SHARAD PDS4 label needs exactly one ${name}.`);
  return hits[0]!;
};
const blocks = (xml: string, name: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...xml.matchAll(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, 'g'))].map(hit => hit[1]!);
};
const one = (xml: string, name: string, label: string) => {
  const found = blocks(xml, name);
  if (found.length !== 1) throw new TypeError(`SHARAD ${label} needs exactly one ${name}.`);
  return found[0]!;
};
const number = (value: string, name: string, minimum = -Infinity) => {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value)) throw new TypeError(`SHARAD ${name} is not a decimal number.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) throw new TypeError(`SHARAD ${name} is outside its supported range.`);
  return parsed;
};
const integer = (value: string, name: string, minimum = 1) => {
  const parsed = number(value, name, minimum);
  if (!Number.isSafeInteger(parsed)) throw new TypeError(`SHARAD ${name} must be an integer.`);
  return parsed;
};
const instant = (value: string, name: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) || !Number.isFinite(Date.parse(value))) throw new TypeError(`SHARAD ${name} is not a UTC instant.`);
  return new Date(value).toISOString();
};
const axisRole: Record<string, SharadAxis> = { X: 'projected-x', Y: 'projected-y', DELAY_TIME: 'delay' };
const AXIS_NAMES: readonly SharadAxisName[] = ['X', 'Y', 'DELAY_TIME'];
const AXIS_INDEX = { 'projected-x': 0, 'projected-y': 1, delay: 2 } as const;

function parseCartography(xml: string): SharadCartography {
  const cartography = one(xml, 'cart:Cartography', 'label cartography');
  const projection = text(cartography, 'cart:map_projection_name'), transverse = one(cartography, 'cart:Transverse_Mercator', 'map projection');
  if (projection !== 'Transverse Mercator') throw new TypeError(`SHARAD reader only qualifies Transverse Mercator products, not ${projection}.`);
  const model = one(cartography, 'cart:Geodetic_Model', 'geodetic model'), latitudeType = text(model, 'cart:latitude_type'), longitudeDirection = text(model, 'cart:longitude_direction');
  if (latitudeType !== 'Planetocentric' || longitudeDirection !== 'Positive East') throw new TypeError('SHARAD reader requires planetocentric, positive-east cartography.');
  const representation = one(cartography, 'cart:Coordinate_Representation', 'planar coordinates'), transform = one(cartography, 'cart:Geo_Transformation', 'planar coordinates');
  const bounds = one(cartography, 'cart:Bounding_Coordinates', 'spatial domain');
  return {
    projection, scaleFactorAtCentralMeridian: number(text(transverse, 'cart:scale_factor_at_central_meridian'), 'projection scale factor', Number.MIN_VALUE),
    centralMeridianDegrees: number(text(transverse, 'cart:longitude_of_central_meridian'), 'central meridian'),
    projectionOriginLatitudeDegrees: number(text(transverse, 'cart:latitude_of_projection_origin'), 'projection origin latitude'),
    pixelSpacingMetres: [number(text(representation, 'cart:pixel_resolution_x'), 'X pixel spacing', Number.MIN_VALUE), number(text(representation, 'cart:pixel_resolution_y'), 'Y pixel spacing', Number.MIN_VALUE)],
    upperLeftCornerMetres: [number(text(transform, 'cart:upperleft_corner_x'), 'upper-left corner x'), number(text(transform, 'cart:upperleft_corner_y'), 'upper-left corner y')],
    latitudeType, longitudeDirection, spheroidName: text(model, 'cart:spheroid_name'),
    radiiKm: [number(text(model, 'cart:a_axis_radius'), 'a-axis radius', Number.MIN_VALUE), number(text(model, 'cart:b_axis_radius'), 'b-axis radius', Number.MIN_VALUE), number(text(model, 'cart:c_axis_radius'), 'c-axis radius', Number.MIN_VALUE)],
    boundingDegrees: { west: number(text(bounds, 'cart:west_bounding_coordinate'), 'west bound'), east: number(text(bounds, 'cart:east_bounding_coordinate'), 'east bound'), north: number(text(bounds, 'cart:north_bounding_coordinate'), 'north bound'), south: number(text(bounds, 'cart:south_bounding_coordinate'), 'south bound') },
  };
}

/** Parse only the documented SHARAD `Array_3D` product shape; this is not a generic PDS reader. */
export function parseSharadPds4Label(xml: string): SharadPds4Label {
  if (text(xml, 'product_class') !== 'Product_Observational') throw new TypeError('SHARAD product is not PDS4 Product_Observational.');
  const identification = one(xml, 'Identification_Area', 'label identity'), history = blocks(identification, 'Modification_History');
  if (history.length > 1) throw new TypeError('SHARAD label declares more than one modification history.');
  // The product version is the identity area's own version_id, not the one repeated inside each modification detail.
  const identity = history.length ? identification.replace(history[0]!, '') : identification;
  const lid = text(identity, 'logical_identifier'), version = text(identity, 'version_id');
  if (!/^urn:nasa:pds:mro_sharad_3d:data:[a-z0-9_]+$/u.test(lid) || !/^\d+(?:\.\d+)*$/u.test(version)) throw new TypeError('Label is not an MRO SHARAD 3-D data product.');
  if (!xml.includes('urn:nasa:pds:context:instrument:sharad.mro') || !xml.includes('urn:nasa:pds:context:target:planet.mars')) throw new TypeError('Label does not reference the SHARAD instrument observing Mars.');
  const times = one(xml, 'Time_Coordinates', 'observation area');
  const area = blocks(xml, 'File_Area_Observational');
  if (area.length !== 1) throw new TypeError('SHARAD product needs one observational file area.');
  const dataFile = text(area[0]!, 'file_name');
  if (!/^[a-z0-9_]+\.dat$/u.test(dataFile)) throw new TypeError('SHARAD science member must be a .dat file.');
  if (blocks(area[0]!, 'Array_3D').length !== 1 || blocks(area[0]!, 'Array_2D_Image').length || blocks(area[0]!, 'Array_3D_Image').length) throw new TypeError('SHARAD product must contain exactly one native Array_3D.');
  const array = blocks(area[0]!, 'Array_3D')[0]!, statisticsBlock = one(array, 'Object_Statistics', 'array statistics'), arrayOnly = array.replace(statisticsBlock, '');
  if (text(array, 'axis_index_order') !== 'Last Index Fastest' || text(array, 'data_type') !== 'IEEE754LSBSingle') throw new TypeError('SHARAD reader requires last-index-fastest IEEE754 little-endian float32 samples.');
  if (integer(text(array, 'axes'), 'declared axis count', 3) !== 3) throw new TypeError('SHARAD reader requires a three-axis array.');
  const dataOffset = integer(text(array, 'offset'), 'array byte offset', 0);
  if (blocks(array, 'scaling_factor').length || blocks(array, 'value_offset').length) throw new TypeError('SHARAD reader refuses unqualified array scaling.');
  const declaredAxes = blocks(array, 'Axis_Array');
  if (declaredAxes.length !== 3) throw new TypeError('SHARAD Array_3D needs X, Y, and DELAY_TIME axes.');
  const elements = declaredAxes.map((axis, index) => {
    if (integer(text(axis, 'sequence_number'), `axis ${index + 1} sequence`) !== index + 1) throw new TypeError('SHARAD axes must be declared in native X, Y, DELAY_TIME order.');
    const name = text(axis, 'axis_name');
    if (name !== AXIS_NAMES[index]) throw new TypeError('SHARAD axes must be X, Y, DELAY_TIME.');
    return integer(text(axis, 'elements'), `${name} elements`);
  }) as [number, number, number];
  const sampled = blocks(xml, 'mro:Array_Sampled');
  if (sampled.length !== 3) throw new TypeError('SHARAD label needs sampling for all three axes.');
  const axes = sampled.map((entry, index) => {
    const name = text(entry, 'mro:name'), expected = AXIS_NAMES[index]!;
    if (name !== expected || text(entry, 'mro:array_scale') !== 'Linear') throw new TypeError('SHARAD sampling must be linear X, Y, DELAY_TIME metadata.');
    const unit = text(entry, 'mro:array_unit');
    if (unit !== (index === 2 ? 'MICROSECOND' : 'METER')) throw new TypeError(`SHARAD ${expected} has an unexpected unit.`);
    const start = number(text(entry, 'mro:array_first_value'), `${expected} start`), increment = number(text(entry, 'mro:array_interval'), `${expected} interval`, Number.MIN_VALUE);
    return { role: axisRole[name]!, axisName: expected, unit: index === 2 ? 'us' as const : 'm' as const, elements: elements[index]!, start, increment };
  }) as unknown as SharadPds4Label['axes'];
  const arrayDescription = text(arrayOnly, 'description').replace(/\s+/gu, ' ').trim(), upper = arrayDescription.toUpperCase();
  if (!upper.includes('BACKSCATTER STRENGTH') || !upper.includes('DELAY_TIME') || !upper.includes('AREOID')) throw new TypeError('SHARAD array does not retain the required radar-strength, delay and areoid-reference semantics.');
  const quantity = text(statisticsBlock, 'description').replace(/\s+/gu, ' ').trim();
  if (!quantity.toUpperCase().includes('BACKSCATTER STRENGTH')) throw new TypeError('SHARAD array statistics do not name a backscatter-strength quantity.');
  const minimum = number(text(statisticsBlock, 'minimum'), 'array minimum'), maximum = number(text(statisticsBlock, 'maximum'), 'array maximum');
  if (!(maximum > minimum)) throw new TypeError('SHARAD array statistics are not an increasing interval.');
  const supplemental = blocks(xml, 'File_Area_Observational_Supplemental');
  if (supplemental.length > 1) throw new TypeError('SHARAD product declares more than one supplemental file area.');
  const supplementalFile = supplemental.length ? text(supplemental[0]!, 'file_name') : undefined;
  const startIso = instant(text(times, 'start_date_time'), 'observation start'), stopIso = instant(text(times, 'stop_date_time'), 'observation stop');
  if (stopIso < startIso) throw new TypeError('SHARAD observation interval is reversed.');
  return { profile: SHARAD_PDS4_PROFILE, lidvid: `${lid}::${version}`, title: text(identity, 'title'), dataFile, ...(supplementalFile ? { supplementalFile } : {}),
    dataOffset, shape: elements, axes, arrayDescription, statistics: { quantity, minimum, maximum }, cartography: parseCartography(xml), startIso, stopIso };
}

const count = (label: SharadPds4Label) => label.shape.reduce((total, dimension) => total * dimension, 1);
/** One frame is every delay sample for a given X and Y, stored contiguously. */
export const sharadFrameBytes = (label: SharadPds4Label) => label.shape[2] * 4;
export const sharadExpectedBytes = (label: SharadPds4Label) => label.dataOffset + count(label) * 4;
const inBounds = (value: number, size: number, name: string) => {
  if (!Number.isSafeInteger(value) || value < 0 || value >= size) throw new RangeError(`SHARAD ${name} is outside the native grid.`);
};
const value = (buffer: Buffer, offset: number) => {
  const sample = buffer.readFloatLE(offset);
  return Number.isFinite(sample) ? sample : null;
};
const byteOffset = (label: SharadPds4Label, x: number, y: number, z: number) => label.dataOffset + (((x * label.shape[1] + y) * label.shape[2] + z) * 4);

/** The byte range of one contiguous delay frame. */
export function sharadFrameRange(label: SharadPds4Label, x: number, y: number): SharadByteRange {
  inBounds(x, label.shape[0], 'X'); inBounds(y, label.shape[1], 'Y');
  return { position: byteOffset(label, x, y, 0), length: sharadFrameBytes(label) };
}
/** Read cost is arithmetic from the label, so an unbounded request is refused before any byte is fetched. */
export function sharadPlaneCost(label: SharadPds4Label, axis: SharadAxis): SharadReadCost {
  const [xSize, ySize] = label.shape, frame = sharadFrameBytes(label);
  if (axis === 'projected-x') return { reads: 1, bytes: ySize * frame };
  if (axis === 'projected-y') return { reads: xSize, bytes: xSize * frame };
  return { reads: xSize * ySize, bytes: xSize * ySize * 4 };
}
const affordable = (cost: SharadReadCost, limits: SharadReadLimits, what: string) => {
  if (!Number.isSafeInteger(limits.maximumBytes) || limits.maximumBytes < 4 || !Number.isSafeInteger(limits.maximumReads) || limits.maximumReads < 1) throw new TypeError('SHARAD read limits must be whole positive bounds.');
  if (cost.bytes > limits.maximumBytes) throw new RangeError(`SHARAD ${what} needs ${cost.bytes} bytes, exceeding the bounded read limit of ${limits.maximumBytes}.`);
  if (cost.reads > limits.maximumReads) throw new RangeError(`SHARAD ${what} needs ${cost.reads} reads, exceeding the bounded read limit of ${limits.maximumReads}.`);
  return cost;
};

/** A file-backed byte source. The handle stays open for the whole bounded read instead of reopening per range. */
export async function sharadFileSource(path: string): Promise<SharadByteSource> {
  const size = (await stat(path)).size, handle = await open(path, 'r');
  return {
    identity: path, size,
    async read(position: number, length: number) {
      const buffer = Buffer.allocUnsafe(length), result = await handle.read(buffer, 0, length, position);
      if (result.bytesRead !== length) throw new Error('SHARAD bounded read ended before its declared data range.');
      return buffer;
    },
    close: () => handle.close(),
  };
}

/** Verify the member has exactly the byte length declared by its native PDS4 Array_3D label. */
export function openSharadPds4Volume(source: SharadByteSource, label: SharadPds4Label): SharadPds4Volume {
  const expected = sharadExpectedBytes(label);
  if (!Number.isSafeInteger(source.size) || source.size !== expected) throw new TypeError(`SHARAD data member length ${source.size} disagrees with label length ${expected}.`);
  return { source, label };
}

async function ranged(volume: SharadPds4Volume, range: SharadByteRange) {
  if (range.position < volume.label.dataOffset || range.position + range.length > volume.source.size) throw new RangeError('SHARAD bounded read leaves the labelled array.');
  const bytes = await volume.source.read(range.position, range.length);
  if (bytes.length !== range.length) throw new Error('SHARAD bounded read returned a different length than requested.');
  return bytes;
}

/**
 * Read exactly one native plane. A constant-X plane is one contiguous span of frames, a constant-Y plane is one
 * strided read per frame, and a constant-delay plane needs one read per frame, which the bounds refuse at archive size.
 */
export async function readSharadPlane(volume: SharadPds4Volume, axis: SharadAxis, index: number, limits: SharadReadLimits = SHARAD_DEFAULT_LIMITS): Promise<SharadPlane> {
  const { label } = volume, [xSize, ySize, zSize] = label.shape, frame = sharadFrameBytes(label);
  inBounds(index, label.shape[AXIS_INDEX[axis]], axis);
  const cost = affordable(sharadPlaneCost(label, axis), limits, `${axis} plane`), values: (number | null)[] = [];
  if (axis === 'projected-x') {
    const bytes = await ranged(volume, { position: byteOffset(label, index, 0, 0), length: cost.bytes });
    for (let sample = 0; sample < ySize * zSize; sample++) values.push(value(bytes, sample * 4));
  } else if (axis === 'projected-y') {
    for (let x = 0; x < xSize; x++) {
      const bytes = await ranged(volume, { position: byteOffset(label, x, index, 0), length: frame });
      for (let z = 0; z < zSize; z++) values.push(value(bytes, z * 4));
    }
  } else {
    for (let x = 0; x < xSize; x++) for (let y = 0; y < ySize; y++) values.push(value(await ranged(volume, { position: byteOffset(label, x, y, index), length: 4 }), 0));
  }
  const remaining = (['projected-x', 'projected-y', 'delay'] as const).filter(role => role !== axis);
  return { axis, index, shape: axis === 'projected-x' ? [ySize, zSize] : axis === 'projected-y' ? [xSize, zSize] : [xSize, ySize], axes: remaining, cost, values };
}

/** A vertical radar trace is one contiguous delay frame, never an inferred depth profile. */
export async function readSharadDelayFrame(volume: SharadPds4Volume, x: number, y: number, limits: SharadReadLimits = SHARAD_DEFAULT_LIMITS): Promise<SharadDelayFrame> {
  const { label } = volume, range = sharadFrameRange(label, x, y);
  affordable({ reads: 1, bytes: range.length }, limits, 'delay frame');
  const bytes = await ranged(volume, range);
  return { x, y, range, delayStartMicroseconds: label.axes[2].start, delayIncrementMicroseconds: label.axes[2].increment, values: Array.from({ length: label.shape[2] }, (_, z) => value(bytes, z * 4)) };
}

export interface SharadBoundedMember {
  readonly role: string; readonly origin: string; readonly advertisedBytes: number; readonly advertisedBytesCheckedOn: string;
  readonly digest: 'none-published'; readonly acquisition: string;
}
export interface SharadProductRecord {
  readonly id: string; readonly telescope: string; readonly mode: string; readonly lidvid: string; readonly reader: typeof SHARAD_PDS4_PROFILE;
  readonly boundedMember: SharadBoundedMember; readonly pinnedInputs: readonly { readonly input: string; readonly role: string }[];
  readonly units: string; readonly meaning: string; readonly citation: string; readonly license: string; readonly credit: string;
  readonly limitations: readonly string[];
}
export interface SharadProductRecords { readonly schema: typeof SHARAD_PRODUCT_RECORD_SCHEMA; readonly target: string; readonly products: readonly SharadProductRecord[] }

const date = (value: unknown, label: string) => {
  const parsed = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed) || !Number.isFinite(Date.parse(`${parsed}T00:00:00Z`))) throw new TypeError(`${label} must be a calendar date.`);
  return parsed;
};

/** The 26 GB science member is read by range, so the record states its advertised length and that no digest is published. */
export function parseSharadProductRecords(value: unknown): SharadProductRecords {
  const root = requireRecord(value, 'SHARAD product records');
  if (root.schema !== SHARAD_PRODUCT_RECORD_SCHEMA) throw new TypeError('Unsupported SHARAD product record schema.');
  const target = requireString(root.target, 'record target');
  if (!/^[a-z][a-z0-9-]*$/u.test(target)) throw new TypeError('SHARAD record target must be an object id.');
  const products = requireArray(root.products, 'SHARAD products').map(raw => {
    const row = requireRecord(raw, 'SHARAD product'), member = requireRecord(row.boundedMember, 'bounded member');
    if (row.reader !== SHARAD_PDS4_PROFILE) throw new TypeError('SHARAD record must name this reader profile.');
    const origin = requireString(member.origin, 'bounded member origin');
    if (new URL(origin).protocol !== 'https:') throw new TypeError('SHARAD bounded member needs an HTTPS archive origin.');
    if (member.digest !== 'none-published') throw new TypeError('SHARAD bounded member must state that the archive publishes no digest.');
    const advertisedBytes = requireFiniteNumber(member.advertisedBytes, 'bounded member advertised bytes');
    if (!Number.isSafeInteger(advertisedBytes) || advertisedBytes <= 0) throw new TypeError('SHARAD bounded member length must be a whole positive byte count.');
    const pinnedInputs = requireArray(row.pinnedInputs, 'pinned inputs').map(entry => {
      const pin = requireRecord(entry, 'pinned input');
      return { input: requireString(pin.input, 'pinned input id'), role: requireString(pin.role, 'pinned input role') };
    });
    if (!pinnedInputs.some(pin => pin.role === 'label')) throw new TypeError('SHARAD record needs its pinned PDS4 label.');
    const limitations = requireArray(row.limitations, 'limitations').map(entry => requireString(entry, 'limitation'));
    if (!limitations.length) throw new TypeError('SHARAD record must retain its published limitations.');
    return { id: requireString(row.id, 'product id'), telescope: requireString(row.telescope, 'telescope'), mode: requireString(row.mode, 'mode'),
      lidvid: requireString(row.lidvid, 'product LIDVID'), reader: SHARAD_PDS4_PROFILE,
      boundedMember: { role: requireString(member.role, 'bounded member role'), origin, advertisedBytes, advertisedBytesCheckedOn: date(member.advertisedBytesCheckedOn, 'bounded member check date'), digest: 'none-published' as const, acquisition: requireString(member.acquisition, 'bounded member acquisition') },
      pinnedInputs, units: requireString(row.units, 'units'), meaning: requireString(row.meaning, 'meaning'), citation: requireString(row.citation, 'citation'),
      license: requireString(row.license, 'license'), credit: requireString(row.credit, 'credit'), limitations };
  });
  if (!products.length) throw new TypeError('SHARAD product records are empty.');
  if (new Set(products.map(product => product.id)).size !== products.length) throw new TypeError('Duplicate SHARAD product id.');
  return { schema: SHARAD_PRODUCT_RECORD_SCHEMA, target, products };
}

/** The record and the label must agree on identity, member name, and length before any byte is read. */
export function assertSharadRecordMatchesLabel(product: SharadProductRecord, label: SharadPds4Label): void {
  if (product.lidvid !== label.lidvid) throw new TypeError(`SHARAD record LIDVID ${product.lidvid} disagrees with the label's ${label.lidvid}.`);
  if (!product.boundedMember.origin.endsWith(`/${label.dataFile}`)) throw new TypeError('SHARAD record origin does not name the labelled science member.');
  if (product.boundedMember.advertisedBytes !== sharadExpectedBytes(label)) throw new TypeError(`SHARAD advertised length ${product.boundedMember.advertisedBytes} disagrees with the label length ${sharadExpectedBytes(label)}.`);
}

export interface SharadQualificationMembers { readonly science: string; readonly coverage: string; readonly method: string }
const DEFAULT_MEMBERS: SharadQualificationMembers = { science: 'role:science', coverage: 'role:response', method: 'role:provenance' };

/**
 * Publish the F16 planetary-grid qualification straight from the label and the source record. Delay stays delay: the
 * archive supplies no dielectric model or datum for a metric depth, so the conversion is unavailable.
 */
export function sharadPlanetaryGridQualification(label: SharadPds4Label, product: SharadProductRecord, members: SharadQualificationMembers = DEFAULT_MEMBERS): PlanetaryGridQualification {
  assertSharadRecordMatchesLabel(product, label);
  const cartography = label.cartography, frame = `${cartography.projection} on the ${cartography.spheroidName} ${cartography.latitudeType.toLowerCase()} spheroid (a ${cartography.radiiKm[0]} km, b ${cartography.radiiKm[1]} km, c ${cartography.radiiKm[2]} km), central meridian ${cartography.centralMeridianDegrees} degrees east, projection origin latitude ${cartography.projectionOriginLatitudeDegrees} degrees`;
  const projected = `${cartography.projection} projected distance from the label's X and Y axis start values`;
  return parsePlanetaryGridQualification({
    schema: 'cssearth-planetary-grid-qualification@1',
    source: { archiveIdentity: label.lidvid, sourceUrl: product.boundedMember.origin, citation: product.citation, license: product.license },
    sourceClassification: { term: 'three-dimensional delay-time radargram', vocabulary: 'MRO SHARAD 3-D radargram bundle', version: label.lidvid.split('::')[1]!, status: 'source' },
    frame: { kind: 'projected-body-fixed', name: frame },
    quantity: { name: label.statistics.quantity, semantics: `${label.arrayDescription} The archive states no unit for the samples; the quantity is a ratio to the frame mean and is retained as dimensionless.`, unit: '1' },
    calibration: { state: 'reconstructed', basis: [`Archive-published three-dimensional reconstruction from ${product.telescope} ${product.mode} observations.`, product.citation] },
    uncertainty: { form: 'none-supplied', basis: 'The bundle supplies no per-sample uncertainty array for this product.' },
    axes: label.axes.map((axis, index) => ({ fitsAxis: index + 1, role: axis.role, physicalType: axis.role === 'delay' ? 'time' : 'length', unit: axis.unit,
      reference: axis.role === 'delay' ? label.arrayDescription : projected,
      derivation: { state: 'reconstruction-derived', assumptions: [`Native PDS4 Array_3D axis ${axis.axisName} at sequence ${index + 1}, ${axis.elements} elements from ${axis.start} by ${axis.increment} ${axis.unit}.`] } })),
    support: { class: 'published-reconstruction', domain: { kind: 'full-grid', description: `Every cell of the published ${label.shape.join(' by ')} volume, as delivered by the archive.`, memberIds: [members.science] }, unsupportedRegions: [] },
    depth: { coordinate: 'delay', positiveDirection: 'down', datum: label.arrayDescription, conversion: { state: 'unavailable', parameters: [], uncertainty: 'The archive supplies no dielectric model, so no metric depth conversion is qualified.' } },
    observability: { measurementOperator: 'radar-propagation', coverage: { kind: 'tracks', description: 'The bundle indexes the contributing SHARAD observations for this product in its own source-observation table.', memberIds: [members.coverage] }, localization: 'inversion-dependent' },
    resolution: { state: 'unknown', elements: [], basis: `The label states ${cartography.pixelSpacingMetres[0]} m and ${cartography.pixelSpacingMetres[1]} m grid sampling and a ${label.axes[2].increment} ${label.axes[2].unit} delay interval. Sampling is not resolution, and no achieved response width is transcribed here.`, memberIds: [] },
    inference: { kind: 'archive-published', method: `Archive-published synthetic-aperture three-dimensional reconstruction delivered as ${label.lidvid}.`, assumptions: product.limitations, validation: 'The reader validates the label contract and reads the archive bytes by label-defined range; the reconstruction itself is the archive\'s published result.', memberIds: [members.method] },
  });
}
