import { pds4Blocks, pds4Elements, pds4Field } from '../pds-labels.mts';
import { readFitsHdu, type FitsHeader } from '@cssearth/fits';
import type { GeometryCubeDeclaration } from './source-records.mts';

/**
 * PDS4 observational products that store an image with its geometric
 * backplanes as one cube: a Product_Observational whose file area holds a FITS
 * header and Array_2D_Image planes. The recipe declares which label planes
 * carry the image, the body-fixed X/Y/Z surface intercepts and the
 * illumination angles, the archive identity and DSK to bind, and optional FITS
 * header expectations. The label is the authority for byte offsets, data
 * types, units and special constants; the header must agree with it. No
 * camera model is read: the controlled camera is recovered downstream from the
 * archived intercepts, and every displayed sample is re-derived on the
 * retained mesh.
 */
export const PDS4_GEOMETRY_CUBE_FORMAT = 'pds4-geometry-cube';
type Role = 'image' | 'x' | 'y' | 'z' | 'incidence' | 'emission' | 'phase';
const ROLES = ['image', 'x', 'y', 'z', 'incidence', 'emission', 'phase'] as const;
const ROLE_UNITS: Record<Role, readonly (string | null)[]> = { image: [null], x: ['km', 'm'], y: ['km', 'm'], z: ['km', 'm'], incidence: ['deg', 'rad'], emission: ['deg', 'rad'], phase: ['deg', 'rad'] };
/** PDS4 Special_Constants. Gap and range constants invalidate a pixel; saturation on the image plane keeps its geometry but fails quality. */
const GAP_CONSTANTS = new Set(['missing_constant', 'error_constant', 'invalid_constant', 'unknown_constant', 'not_applicable_constant']);
const SATURATION_CONSTANTS = new Set(['saturated_constant', 'high_instrument_saturation', 'low_instrument_saturation', 'high_representation_saturation', 'low_representation_saturation']);
const RANGE_CONSTANTS = new Set(['valid_minimum', 'valid_maximum']);
const DATA_TYPES: Record<string, { bytes: number; read: (buffer: Buffer, offset: number) => number }> = {
  IEEE754MSBSingle: { bytes: 4, read: (buffer, offset) => buffer.readFloatBE(offset) }, IEEE754LSBSingle: { bytes: 4, read: (buffer, offset) => buffer.readFloatLE(offset) },
  IEEE754MSBDouble: { bytes: 8, read: (buffer, offset) => buffer.readDoubleBE(offset) }, IEEE754LSBDouble: { bytes: 8, read: (buffer, offset) => buffer.readDoubleLE(offset) },
};

function labelNumber(xml: string, name: string) {
  const text = pds4Field(xml, name), value = Number(text);
  if (!text || !Number.isFinite(value)) throw new Error(`Invalid PDS4 numeric field: ${name}`);
  return value;
}

const headerText = (header: FitsHeader, key: string) => typeof header[key] === 'string' ? (header[key] as string).trim() : header[key] === undefined ? '' : String(header[key]);

interface LabelPlane { id: string; index: number; offset: number; width: number; height: number; dataType: string; unit: string | null; constants: Record<string, number> }

/** Every Array_2D_Image the label declares, in label order. Line-major planes only. */
function labelPlanes(xml: string): LabelPlane[] {
  return pds4Blocks(xml, 'Array_2D_Image').map((block, index) => {
    const id = pds4Field(block, 'local_identifier');
    const axes = pds4Blocks(block, 'Axis_Array').map(axis => ({ name: pds4Field(axis, 'axis_name'), elements: labelNumber(axis, 'elements'), sequence: labelNumber(axis, 'sequence_number') }));
    if (pds4Field(block, 'axes') !== '2' || pds4Field(block, 'axis_index_order') !== 'Last Index Fastest' || axes.length !== 2 ||
        axes[0].name !== 'Line' || axes[0].sequence !== 1 || axes[1].name !== 'Sample' || axes[1].sequence !== 2 ||
        !axes.every(axis => Number.isInteger(axis.elements) && axis.elements >= 2 && axis.elements <= 8192)) throw new Error(`Unsupported geometry cube plane axes: ${id}`);
    const elements = pds4Blocks(block, 'Element_Array');
    if (elements.length !== 1) throw new Error(`Geometry cube plane ${id} lacks its element definition.`);
    const dataType = pds4Field(elements[0], 'data_type');
    if (!DATA_TYPES[dataType]) throw new Error(`Unsupported geometry cube data type ${dataType} for ${id}.`);
    const unit = /<unit>/.test(elements[0]) ? pds4Field(elements[0], 'unit') : null;
    const sections = pds4Blocks(block, 'Special_Constants');
    if (sections.length > 1) throw new Error(`Geometry cube plane ${id} repeats its special constants.`);
    const constants: Record<string, number> = {};
    for (const match of sections[0]?.matchAll(/<([a-z_]+)>([^<]+)<\/([a-z_]+)>/g) ?? []) {
      const value = Number(match[2]);
      if (match[1] !== match[3] || !Number.isFinite(value) || !(GAP_CONSTANTS.has(match[1]) || SATURATION_CONSTANTS.has(match[1]) || RANGE_CONSTANTS.has(match[1]))) {
        throw new Error(`Unsupported geometry cube special constant ${match[1]} for ${id}.`);
      }
      constants[match[1]] = value;
    }
    const offset = labelNumber(block, 'offset');
    if (!Number.isInteger(offset) || offset < 0) throw new Error(`Invalid geometry cube plane offset: ${id}`);
    return { id, index, offset, width: axes[1].elements, height: axes[0].elements, dataType, unit, constants };
  });
}

function readPlane(bytes: Buffer, plane: LabelPlane) {
  const type = DATA_TYPES[plane.dataType], count = plane.width * plane.height;
  const values = type.bytes === 4 ? new Float32Array(count) : new Float64Array(count);
  for (let i = 0; i < count; i++) values[i] = type.read(bytes, plane.offset + i * type.bytes);
  return values;
}

export interface GeometryCubeOptions { fileName: string; cube: GeometryCubeDeclaration; filter: string }

export function decodePds4GeometryCube(bytes: Buffer, xml: string, { fileName, cube, filter }: GeometryCubeOptions) {
  if (!/^[A-Za-z0-9_.-]+\.[A-Za-z0-9]+$/u.test(fileName)) throw new Error('Unsupported geometry cube file name.');
  const lid = `${cube.collection}:${fileName.slice(0, fileName.lastIndexOf('.'))}`;
  if (pds4Field(xml, 'logical_identifier') !== lid || pds4Field(xml, 'product_class') !== 'Product_Observational' || pds4Field(xml, 'file_name') !== fileName) {
    throw new Error('Geometry cube label does not identify this product.');
  }
  const targets = pds4Blocks(xml, 'Target_Identification'), components = pds4Blocks(xml, 'Observing_System_Component');
  if (targets.length !== 1 || pds4Field(targets[0], 'name') !== cube.target ||
      components.map(block => `${pds4Field(block, 'name')}:${pds4Field(block, 'type')}`).join(',') !== cube.observingSystem.join(',')) {
    throw new Error('Geometry cube label names another target or observing system.');
  }
  const startTime = pds4Field(xml, 'start_date_time');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(startTime) || Number.isNaN(Date.parse(startTime))) throw new Error('Invalid geometry cube acquisition time.');
  // A filter is bound when the label states one; an unfiltered camera must say so in the recipe.
  const filters = pds4Elements(xml, 'img:filter_name').map(element => element.content.trim());
  if (filters.length ? filters.length !== 1 || filters[0] !== filter : filter !== 'unfiltered') throw new Error('Geometry cube filter differs from the recipe.');
  const kernels = pds4Elements(xml, 'geom:spice_kernel_file_name').map(element => element.content.trim());
  const shapeKernels = kernels.filter(kernel => kernel.endsWith('.bds'));
  if (shapeKernels.length !== 1 || (cube.shapeKernel !== undefined && shapeKernels[0] !== cube.shapeKernel)) throw new Error('Geometry cube label must name the declared DSK shape kernel.');

  const planes = labelPlanes(xml), byId = new Map(planes.map(plane => [plane.id, plane]));
  if (byId.size !== planes.length) throw new Error('Geometry cube label repeats a plane identifier.');
  const rolePlane = (name: Role) => {
    const id = cube.planes[name], plane = byId.get(id);
    if (!plane) throw new Error(`Geometry cube label lacks the ${name} plane ${id}.`);
    if (!ROLE_UNITS[name].includes(plane.unit)) throw new Error(`Unsupported ${name} plane unit ${plane.unit ?? 'none'} for ${id}.`);
    return plane;
  };
  const roles = Object.fromEntries(ROLES.map(name => [name, rolePlane(name)])) as Record<Role, LabelPlane>;
  const width = roles.image.width, height = roles.image.height, count = width * height;
  if (ROLES.some(name => roles[name].width !== width || roles[name].height !== height)) throw new Error('Geometry cube planes differ in size.');

  const headers = pds4Blocks(xml, 'Header'), hdu = readFitsHdu(bytes), { header, dataOffset } = hdu;
  if (headers.length !== 1 || labelNumber(headers[0], 'offset') !== 0 || labelNumber(headers[0], 'object_length') !== dataOffset ||
      !pds4Field(headers[0], 'parsing_standard_id').startsWith('FITS')) throw new Error('Geometry cube header disagrees with its label.');
  if (header.SIMPLE !== true || (header.BSCALE ?? 1) !== 1 || (header.BZERO ?? 0) !== 0 || header.NAXIS1 !== width || header.NAXIS2 !== height ||
      header.NAXIS !== 3 || header.NAXIS3 !== planes.length || hdu.nextOffset !== bytes.length) throw new Error('Unsupported geometry cube layout.');
  const ordered = [...planes].sort((a, b) => a.offset - b.offset);
  if (ROLES.reduce((total, role) => total + count * (DATA_TYPES[roles[role].dataType].bytes + 4), 0) > 512 * 1024 * 1024)
    throw new Error('Geometry cube decoded allocation exceeds budget.');
  for (const [i, plane] of ordered.entries()) {
    if (plane.dataType !== (hdu.bitpix === -32 ? 'IEEE754MSBSingle' : hdu.bitpix === -64 ? 'IEEE754MSBDouble' : null) ||
        plane.offset !== dataOffset + i * count * Math.abs(hdu.bitpix) / 8 || plane.width !== width || plane.height !== height)
      throw new Error('Geometry cube label disagrees with FITS storage.');
    const end = plane.offset + plane.width * plane.height * DATA_TYPES[plane.dataType].bytes;
    if (plane.offset < dataOffset || end > bytes.length) throw new Error(`Truncated geometry cube plane ${plane.id}.`);
    if (i > 0 && ordered[i - 1].offset + ordered[i - 1].width * ordered[i - 1].height * DATA_TYPES[ordered[i - 1].dataType].bytes > plane.offset) throw new Error('Geometry cube planes overlap.');
  }
  for (const [key, expected] of Object.entries(cube.header ?? {})) if (headerText(header, key) !== expected) throw new Error(`Geometry cube header ${key} differs from the recipe.`);
  if (cube.headerTime !== undefined) {
    const time = headerText(header, cube.headerTime);
    if (time !== startTime && `${time}Z` !== startTime) throw new Error('Geometry cube header time differs from the label.');
  }
  for (const [id, description] of Object.entries(cube.headerPlaneNames?.names ?? {})) {
    const plane = byId.get(id);
    if (!plane) throw new Error(`Geometry cube label lacks the named plane ${id}.`);
    const key = `${cube.headerPlaneNames?.prefix}${String(plane.index + 1).padStart(2, '0')}`;
    if (headerText(header, key) !== description) throw new Error(`Geometry cube header ${key} is not ${id}.`);
  }

  const raw = Object.fromEntries(ROLES.map(name => [name, readPlane(bytes, roles[name])])) as Record<Role, Float32Array | Float64Array>;
  const gaps = (plane: LabelPlane) => Object.entries(plane.constants).filter(([key]) => GAP_CONSTANTS.has(key)).map(([, value]) => value);
  const saturation = (plane: LabelPlane) => Object.entries(plane.constants).filter(([key]) => SATURATION_CONSTANTS.has(key)).map(([, value]) => value);
  const policy = Object.fromEntries(ROLES.map(name => [name, { gaps: gaps(roles[name]), saturation: saturation(roles[name]),
    minimum: roles[name].constants.valid_minimum, maximum: roles[name].constants.valid_maximum }])) as Record<Role, { gaps: number[]; saturation: number[]; minimum?: number; maximum?: number }>;
  const usable = (name: Role, value: number, allowSaturation: boolean) => {
    const rule = policy[name];
    return Number.isFinite(value) && !rule.gaps.includes(value) && (allowSaturation || !rule.saturation.includes(value)) &&
      (rule.minimum === undefined || value >= rule.minimum) && (rule.maximum === undefined || value <= rule.maximum);
  };
  const scale = (name: Role) => name === 'image' ? 1 : roles[name].unit === 'm' ? 1e-3 : roles[name].unit === 'deg' ? Math.PI / 180 : 1;
  const converted = (name: Role) => {
    const out = new Float32Array(count), source = raw[name], factor = scale(name), allowSaturation = name === 'image';
    for (let i = 0; i < count; i++) out[i] = usable(name, source[i], allowSaturation) ? source[i] * factor : NaN;
    return out;
  };
  const plane = Object.fromEntries(ROLES.map(name => [name, converted(name)])) as Record<Role, Float32Array>;
  // Some products include intercepts in more than one body's own frame. A
  // declared native geometry plane can separate them before camera fitting.
  // This never selects by image brightness or relaxes the later mesh checks.
  let selected: Uint8Array | undefined;
  const selection = cube.geometrySelection;
  if (selection) {
    const selector = byId.get(selection.plane);
    if (!selector || selector.id === roles.image.id || selector.unit !== selection.unit ||
        selector.width !== width || selector.height !== height || !selection.interpretation.trim() ||
        !Number.isFinite(selection.minimum) || !Number.isFinite(selection.maximum) || selection.minimum >= selection.maximum) {
      throw new Error('Invalid geometry cube selection plane, units or bounds.');
    }
    const values = readPlane(bytes, selector), exclude = [...gaps(selector), ...saturation(selector)];
    selected = Uint8Array.from(values, value => Number.isFinite(value) && !exclude.includes(value) &&
      (selector.constants.valid_minimum === undefined || value >= selector.constants.valid_minimum) &&
      (selector.constants.valid_maximum === undefined || value <= selector.constants.valid_maximum) &&
      value >= selection.minimum && value <= selection.maximum ? 1 : 0);
  }
  const xyz = (i: number) => [plane.x[i], plane.y[i], plane.z[i]];
  /** Geometry-backed footprint: every declared plane usable at the pixel. Image saturation keeps its geometry but fails quality. */
  const geometryValid = (i: number) => Number.isInteger(i) && i >= 0 && i < count && ROLES.every(name => Number.isFinite(plane[name][i]));
  const valid = (i: number) => geometryValid(i) && (selected === undefined || selected[i] === 1);
  const acceptPixel = (i: number) => !policy.image.saturation.includes(raw.image[i]);

  let geometryPixels = 0, saturatedPixels = 0, best = -1, excludedGeometryPixels = 0;
  const phases: number[] = [];
  if (selected) for (let i = 0; i < count; i++) if (geometryValid(i) && !valid(i)) excludedGeometryPixels++;
  for (let i = 0; i < count; i++) if (valid(i)) {
    geometryPixels++;
    if (!acceptPixel(i)) saturatedPixels++;
    phases.push(plane.phase[i]);
    if (best < 0 || plane.emission[i] < plane.emission[best]) best = i;
  }
  if (!geometryPixels) throw new Error('Geometry cube has no on-body pixels.');
  const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  // The true pixel footprint follows from adjacent archived intercepts around
  // the minimum-emission pixel; any archived pixel-scale planes are reported
  // against it rather than trusted.
  const steps: number[] = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const i = best + dy * width + dx;
    if (i % width === width - 1 || !valid(i) || !valid(i + 1)) continue;
    const a = xyz(i), b = xyz(i + 1);
    steps.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1000);
  }
  const nadirPixelFootprintMeters = steps.length ? median(steps) : undefined;
  const scales: number[] = [];
  for (const id of cube.planes.pixelScale ?? []) {
    const scalePlane = byId.get(id);
    if (!scalePlane || !['m', 'km'].includes(scalePlane.unit ?? '')) throw new Error(`Geometry cube pixel-scale plane ${id} is missing or not a length.`);
    const values = readPlane(bytes, scalePlane), factor = scalePlane.unit === 'km' ? 1000 : 1, exclude = [...gaps(scalePlane), ...saturation(scalePlane)];
    for (let i = 0; i < count; i++) if (valid(i) && Number.isFinite(values[i]) && !exclude.includes(values[i])) scales.push(values[i] * factor);
  }
  const archivedPixelScaleMedianMeters = scales.length ? median(scales) : undefined;
  const qualityReport = {
    units: cube.quantity, product: lid, target: cube.target, observingSystem: cube.observingSystem, filter, shapeKernel: shapeKernels[0], spiceKernels: kernels.length,
    planes: Object.fromEntries(ROLES.map(name => [name, roles[name].id])), planeUnits: Object.fromEntries(ROLES.map(name => [name, roles[name].unit])),
    specialConstants: Object.fromEntries(ROLES.map(name => [name, roles[name].constants])),
    flagDefinition: 'Geometry-backed pixels need finite intercepts, angles and image values outside every gap and range constant of their plane; image saturation constants keep geometry but are rejected as quality.',
    geometryPixels, saturatedPixels, medianPhaseDegrees: median(phases) * 180 / Math.PI,
    ...(selection ? { geometrySelection: { ...selection, excludedGeometryPixels } } : {}),
    minimumEmissionDegrees: plane.emission[best] * 180 / Math.PI, nadirPixelFootprintMeters, archivedPixelScaleMedianMeters,
    ...(archivedPixelScaleMedianMeters !== undefined && nadirPixelFootprintMeters ? { archivedPixelScaleRatio: archivedPixelScaleMedianMeters / nadirPixelFootprintMeters,
      archivedPixelScalePolicy: 'Not used for sampling or display; reported against the intercept-derived footprint.' } : {}),
    geometry: selection
      ? `Archived pixel-centre intercepts selected by ${selection.plane} in ${selection.unit}: ${selection.interpretation} The label lists ${shapeKernels[0]}; the selected target's model identity is bound separately by the recipe's FITS header checks. Camera holdouts and transfer to the retained source mesh remain required.`
      : `Archived pixel-centre surface intercepts on ${shapeKernels[0]} from the label's SPICE kernels; the controlled camera is recovered from those pairs and every displayed intersection is re-derived on the retained source mesh.`,
  };
  return { width, height, xyz, valid, acceptPixel, startTime, filter, lid, shapeKernel: shapeKernels[0], header, qualityReport,
    planes: { IMAGE: plane.image, COORDINATE_X_IMAGE: plane.x, COORDINATE_Y_IMAGE: plane.y, COORDINATE_Z_IMAGE: plane.z,
      INCIDENCE_ANGLE_IMAGE: plane.incidence, EMISSION_ANGLE_IMAGE: plane.emission, PHASE_ANGLE_IMAGE: plane.phase } };
}
