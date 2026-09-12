import { cardValue } from './encounter-fits.mts';

/**
 * DART DRACO calibrated I/F cubes with geometric backplanes, PDS4 collection
 * urn:nasa:pds:dart:data_dracoddp (Ernst et al. 2023, DOI 10.26007/QAAN-F992).
 * One FITS primary data unit stores sixteen square big-endian IEEE-754 planes.
 * The product's PDS4 label is the authority for plane identity, byte offsets,
 * units and special constants; the FITS header must agree with it, including
 * its own plane descriptions, acquisition identity and special values. The XYZ
 * planes are pixel-centre surface intercepts, in kilometres in the body-fixed
 * frame, on the DSK shape kernel the label names. No camera model is read:
 * the controlled camera is recovered from these archived pairs downstream.
 * The archived pixel-scale planes are decoded for the report only: in the
 * qualified product they are 180/pi times the intercept-derived footprint.
 */
export const DRACO_GEO_COLLECTION = 'urn:nasa:pds:dart:data_dracoddp';
export const DRACO_GEO_PLANES = ['ioverf', 'xcoord', 'ycoord', 'zcoord', 'latitude', 'longitude', 'radius', 'incidence', 'emission', 'phase',
  'horizpixscale', 'vertpixscale', 'slope', 'elevation', 'gravacc', 'gravpot'] as const;
type PlaneName = typeof DRACO_GEO_PLANES[number];
const PLANE_UNITS: Record<PlaneName, string | null> = { ioverf: null, xcoord: 'km', ycoord: 'km', zcoord: 'km', latitude: 'deg', longitude: 'deg', radius: 'km',
  incidence: 'deg', emission: 'deg', phase: 'deg', horizpixscale: 'm', vertpixscale: 'm', slope: 'deg', elevation: 'm', gravacc: 'm/s**2', gravpot: 'J/kg' };
/** PLANEnn descriptions the DART pipeline writes into the FITS header. */
export const DRACO_PLANE_DESCRIPTIONS: Record<PlaneName, string> = { ioverf: 'Pixel value', xcoord: 'X coordinate of pixel center', ycoord: 'Y coordinate of pixel center',
  zcoord: 'Z coordinate of pixel center', latitude: 'Planetocentric latitude of pixel center', longitude: 'Planetocentric East longitude of pixel center',
  radius: 'Radial distance from asteroid center to pixel center', incidence: 'Solar incidence angle', emission: 'Emission angle', phase: 'Solar phase angle',
  horizpixscale: 'Horizontal pixel scale', vertpixscale: 'Vertical pixel scale', slope: 'Slope', elevation: 'Elevation', gravacc: 'Gravitational acceleration', gravpot: 'Gravitational potential' };
/** Documented special values. The I/F plane and the geometry planes use different sets. */
export const DRACO_IMAGE_CONSTANTS = { missing_constant: 1e10, not_applicable_constant: -1e10, high_instrument_saturation: 1e9 };
export const DRACO_GEOMETRY_CONSTANTS = { invalid_constant: -999, not_applicable_constant: -1e10 };
const RECORD = 2880;
type FitsHeader = Record<string, string | number | boolean>;

const escapeName = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Exactly one text element with this name inside the fragment; attributes are allowed. */
export function labelField(xml: string, name: string) {
  const hits = [...xml.matchAll(new RegExp(`<${escapeName(name)}(?:\\s[^>]*)?>([^<]*)</${escapeName(name)}>`, 'g'))];
  if (hits.length !== 1) throw new Error(`Expected one PDS4 label field: ${name}`);
  return hits[0][1].trim();
}
export const labelBlocks = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<${escapeName(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeName(name)}>`, 'g'))].map(match => match[1]);
function labelNumber(xml: string, name: string) {
  const text = labelField(xml, name), value = Number(text);
  if (!text || !Number.isFinite(value)) throw new Error(`Invalid PDS4 numeric field: ${name}`);
  return value;
}
function specialConstants(block: string) {
  const sections = labelBlocks(block, 'Special_Constants');
  if (sections.length !== 1) throw new Error('DRACO backplane lacks its special constants.');
  return Object.fromEntries([...sections[0].matchAll(/<([a-z_]+)>([^<]+)<\/([a-z_]+)>/g)].map(match => {
    const value = Number(match[2]);
    if (match[1] !== match[3] || !Number.isFinite(value)) throw new Error(`Invalid DRACO special constant: ${match[1]}`);
    return [match[1], value];
  }));
}
const sameConstants = (actual: Record<string, number>, expected: Record<string, number>) =>
  JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort());

function readCubeHeader(bytes: Buffer) {
  const header: FitsHeader = {}; let end = -1;
  for (let offset = 0; offset + 80 <= bytes.length && offset < 131040; offset += 80) {
    const card = bytes.toString('ascii', offset, offset + 80), key = card.slice(0, 8).trim();
    if (key === 'END') { end = offset + 80; break; }
    if (card[8] !== '=') continue;
    if (Object.hasOwn(header, key)) throw new Error(`Duplicate FITS field: ${key}`);
    header[key] = cardValue(card);
  }
  if (end < 0) throw new Error('DRACO cube header has no END card.');
  return { header, dataOffset: Math.ceil(end / RECORD) * RECORD };
}
function headerText(header: FitsHeader, key: string) {
  const value = header[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing DRACO header field ${key}.`);
  return value.trim();
}
function headerNumber(header: FitsHeader, key: string) {
  const value = header[key], number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim().replace(/[dD]/g, 'E')) : NaN;
  if (!Number.isFinite(number)) throw new Error(`Missing or invalid DRACO header number ${key}.`);
  return number;
}
/** Body, ground sample distance and release of a DART shape-model file name, whatever its format suffix. */
function shapeModelIdentity(name: string) {
  const match = /^([a-z]+)_g_(\d+)mm_.*_v(\d{3})\.[a-z]+$/u.exec(name);
  if (!match) throw new Error(`Unrecognized DART shape model name: ${name}`);
  return `${match[1]} ${Number(match[2])} mm v${match[3]}`;
}

export interface DracoGeoOptions { fileName: string; target?: string }

export function decodeDracoGeo(bytes: Buffer, xml: string, { fileName, target = '(65803) Didymos I (Dimorphos)' }: DracoGeoOptions) {
  const met = /^dart_(\d{10})_(\d{5})_\d{2}_geo\.fits$/u.exec(fileName);
  if (!met) throw new Error('Unsupported DRACO geometry product name.');
  const lid = `${DRACO_GEO_COLLECTION}:${fileName.slice(0, -'.fits'.length)}`;
  if (labelField(xml, 'logical_identifier') !== lid || labelField(xml, 'product_class') !== 'Product_Observational' || labelField(xml, 'file_name') !== fileName) {
    throw new Error('DRACO geometry label does not identify this product.');
  }
  const targets = labelBlocks(xml, 'Target_Identification'), components = labelBlocks(xml, 'Observing_System_Component');
  if (targets.length !== 1 || labelField(targets[0], 'name') !== target ||
      components.map(block => `${labelField(block, 'name')}:${labelField(block, 'type')}`).join(',') !== 'DART:Host,DRACO:Instrument') {
    throw new Error('DRACO geometry label names another target or observing system.');
  }
  const startTime = labelField(xml, 'start_date_time');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/u.test(startTime) || Number.isNaN(Date.parse(startTime))) throw new Error('Invalid DRACO acquisition time.');
  const kernels = [...xml.matchAll(/<geom:spice_kernel_file_name>([^<]+)<\/geom:spice_kernel_file_name>/g)].map(match => match[1].trim());
  const shapeKernels = kernels.filter(kernel => kernel.endsWith('.bds'));
  if (shapeKernels.length !== 1) throw new Error('DRACO geometry label must name exactly one DSK shape kernel.');
  const attributes = labelBlocks(xml, 'dart:DRACO_Instrument_Attributes');
  if (attributes.length !== 1) throw new Error('DRACO geometry label lacks its instrument attributes.');

  const headers = labelBlocks(xml, 'Header'), arrays = labelBlocks(xml, 'Array_2D_Image');
  const { header, dataOffset } = readCubeHeader(bytes), size = header.NAXIS1;
  if (headers.length !== 1 || labelNumber(headers[0], 'offset') !== 0 || labelNumber(headers[0], 'object_length') !== dataOffset ||
      labelField(headers[0], 'parsing_standard_id') !== 'FITS 3.0') throw new Error('DRACO cube header disagrees with its label.');
  if (header.SIMPLE !== true || header.BITPIX !== -32 || header.NAXIS !== 3 || typeof size !== 'number' || !Number.isInteger(size) || size < 2 || size > 4096 ||
      header.NAXIS2 !== size || header.NAXIS3 !== DRACO_GEO_PLANES.length || (header.BSCALE ?? 1) !== 1 || (header.BZERO ?? 0) !== 0) {
    throw new Error('Unsupported DRACO cube layout.');
  }
  if (headerText(header, 'MISSION') !== 'DART' || headerText(header, 'INSTRUME') !== 'DRACO' || headerText(header, 'TARGET') !== target ||
      headerText(header, 'BADIMAGE') !== 'FALSE' || headerText(header, 'IOVERF') !== 'PERFORM' || headerText(header, 'RADIANCE') !== 'PERFORM' ||
      headerText(header, 'CALIB') !== 'ON' || headerText(header, 'BINNING') !== 'ON' ||
      headerText(header, 'IMGTMSEC').padStart(10, '0') !== met[1] || headerText(header, 'IMGTMSUB').padStart(5, '0') !== met[2] ||
      `${headerText(header, 'ACQ_UTC')}Z` !== startTime) {
    throw new Error('DRACO cube header does not identify this calibrated acquisition.');
  }
  if (headerNumber(header, 'MISPXVAL') !== DRACO_IMAGE_CONSTANTS.missing_constant || headerNumber(header, 'PXOUTWIN') !== DRACO_IMAGE_CONSTANTS.not_applicable_constant ||
      headerNumber(header, 'SATPXVAL') !== DRACO_IMAGE_CONSTANTS.high_instrument_saturation || headerNumber(header, 'GEOINVAL') !== DRACO_GEOMETRY_CONSTANTS.invalid_constant) {
    throw new Error('DRACO cube header special values differ from the label.');
  }
  const shapeReferences = ['SHAPREF1', 'SHAPREF2'].map(key => headerText(header, key));
  const body = shapeKernels[0].split('_g_')[0], matching = shapeReferences.filter(reference => reference.split('_g_')[0] === body);
  if (matching.length !== 1 || shapeModelIdentity(matching[0]) !== shapeModelIdentity(shapeKernels[0])) throw new Error('DRACO cube header shape reference differs from the label DSK.');
  DRACO_GEO_PLANES.forEach((name, index) => {
    if (headerText(header, `PLANE${String(index + 1).padStart(2, '0')}`) !== DRACO_PLANE_DESCRIPTIONS[name]) throw new Error(`DRACO cube header plane ${index + 1} is not ${name}.`);
  });

  const planeBytes = size * size * 4;
  if (bytes.length !== Math.ceil((dataOffset + planeBytes * DRACO_GEO_PLANES.length) / RECORD) * RECORD || arrays.length !== DRACO_GEO_PLANES.length) {
    throw new Error('Truncated or unexpected DRACO cube.');
  }
  const planes = {} as Record<PlaneName, Float32Array>;
  DRACO_GEO_PLANES.forEach((name, index) => {
    const block = arrays[index], unit = PLANE_UNITS[name];
    const axes = labelBlocks(block, 'Axis_Array').map(axis => `${labelField(axis, 'axis_name')} ${labelField(axis, 'elements')} ${labelField(axis, 'sequence_number')}`).join(',');
    if (labelField(block, 'local_identifier') !== name || labelNumber(block, 'offset') !== dataOffset + index * planeBytes || labelField(block, 'axes') !== '2' ||
        labelField(block, 'axis_index_order') !== 'Last Index Fastest' || axes !== `Line ${size} 1,Sample ${size} 2` || labelField(block, 'data_type') !== 'IEEE754MSBSingle' ||
        (unit === null ? /<unit>/.test(block) : labelField(block, 'unit') !== unit) ||
        !sameConstants(specialConstants(block), name === 'ioverf' ? DRACO_IMAGE_CONSTANTS : DRACO_GEOMETRY_CONSTANTS)) {
      throw new Error(`Unsupported DRACO backplane layout: ${name}`);
    }
    const values = new Float32Array(size * size), start = dataOffset + index * planeBytes;
    for (let i = 0; i < values.length; i++) values[i] = bytes.readFloatBE(start + i * 4);
    planes[name] = values;
  });

  const count = size * size;
  const geometryValue = (value: number) => Number.isFinite(value) && value !== DRACO_GEOMETRY_CONSTANTS.invalid_constant && value !== DRACO_GEOMETRY_CONSTANTS.not_applicable_constant;
  const imageValue = (value: number) => Number.isFinite(value) && value !== DRACO_IMAGE_CONSTANTS.missing_constant && value !== DRACO_IMAGE_CONSTANTS.not_applicable_constant;
  const radians = (name: PlaneName) => {
    const out = new Float32Array(count), source = planes[name];
    for (let i = 0; i < count; i++) out[i] = geometryValue(source[i]) ? source[i] * Math.PI / 180 : NaN;
    return out;
  };
  const xyz = (i: number) => [planes.xcoord[i], planes.ycoord[i], planes.zcoord[i]];
  /** Geometry-backed footprint: finite intercept, angles and I/F. Saturation keeps its geometry but fails quality. */
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < count && xyz(i).every(geometryValue) &&
    geometryValue(planes.incidence[i]) && geometryValue(planes.emission[i]) && geometryValue(planes.phase[i]) && imageValue(planes.ioverf[i]);
  const acceptPixel = (i: number) => planes.ioverf[i] !== DRACO_IMAGE_CONSTANTS.high_instrument_saturation;

  let geometryPixels = 0, saturatedPixels = 0, best = -1;
  const scales: number[] = [], phases: number[] = [];
  for (let i = 0; i < count; i++) if (valid(i)) {
    geometryPixels++;
    if (!acceptPixel(i)) saturatedPixels++;
    if (geometryValue(planes.horizpixscale[i])) scales.push(planes.horizpixscale[i]);
    phases.push(planes.phase[i]);
    if (best < 0 || planes.emission[i] < planes.emission[best]) best = i;
  }
  if (!geometryPixels) throw new Error('DRACO geometry product has no on-body pixels.');
  const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  // The true pixel footprint follows from adjacent archived intercepts around
  // the minimum-emission pixel; the archived pixel-scale planes are reported
  // against it rather than trusted.
  const steps: number[] = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const i = best + dy * size + dx;
    if (i % size === size - 1 || !valid(i) || !valid(i + 1)) continue;
    const a = xyz(i), b = xyz(i + 1);
    steps.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1000);
  }
  const nadirPixelFootprintMeters = steps.length ? median(steps) : undefined;
  const window = ['window2_x_start', 'window2_y_start', 'window2_x_end', 'window2_y_end'].map(key => labelNumber(attributes[0], `dart:${key}`));
  const qualityReport = {
    units: 'calibrated reflectance, I/F', product: lid, sourceCalibratedFile: headerText(header, 'SRCFILE'), shapeKernel: shapeKernels[0], shapeReferences,
    metakernel: headerText(header, 'METAKRNL'), spiceKernels: kernels.length,
    imagingMode: labelField(attributes[0], 'dart:imaging_mode'), observationType: labelField(attributes[0], 'dart:observation_type'),
    exposureSeconds: labelNumber(attributes[0], 'dart:exposure_time'), readoutWindow: { xStart: window[0], yStart: window[1], xEnd: window[2], yEnd: window[3] },
    specialConstants: { image: DRACO_IMAGE_CONSTANTS, geometry: DRACO_GEOMETRY_CONSTANTS },
    flagDefinition: 'Geometry-backed pixels need finite intercepts, angles and I/F; missing, not-applicable and invalid constants are excluded; saturated I/F keeps its geometry but is rejected as quality.',
    geometryPixels, saturatedPixels, medianPhaseDegrees: median(phases),
    sourceRangeKm: headerNumber(header, 'PSCRNG'), sourceIfovMicroradians: headerNumber(header, 'PXMRAD'),
    sourceSubSpacecraftLatitudeDegrees: headerNumber(header, 'PSUBLAT'), sourceSubSpacecraftLongitudeDegrees: headerNumber(header, 'PSUBLON'),
    minimumEmissionDegrees: planes.emission[best], minimumEmissionLatitudeDegrees: planes.latitude[best], minimumEmissionLongitudeDegrees: planes.longitude[best],
    nadirPixelFootprintMeters, archivedPixelScaleMedianMeters: scales.length ? median(scales) : undefined,
    archivedPixelScalePolicy: 'Not used for sampling or display: the archived horizontal and vertical pixel-scale planes exceed the intercept-derived footprint by the ratio reported here.',
    archivedPixelScaleRatio: nadirPixelFootprintMeters && scales.length ? median(scales) / nadirPixelFootprintMeters : undefined,
    geometry: `Archived pixel-centre surface intercepts on ${shapeKernels[0]} from the label's SPICE kernels; the controlled camera is recovered from those pairs and every displayed intersection is re-derived on the retained source mesh.`,
  };
  return { width: size, height: size, xyz, valid, acceptPixel, startTime, filter: 'unfiltered', target, lid, fileName, shapeKernel: shapeKernels[0], header, qualityReport,
    planes: { IMAGE: planes.ioverf, COORDINATE_X_IMAGE: planes.xcoord, COORDINATE_Y_IMAGE: planes.ycoord, COORDINATE_Z_IMAGE: planes.zcoord,
      INCIDENCE_ANGLE_IMAGE: radians('incidence'), EMISSION_ANGLE_IMAGE: radians('emission'), PHASE_ANGLE_IMAGE: radians('phase') } };
}
