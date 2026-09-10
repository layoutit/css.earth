import {parsePds4Policy,parseImageEntry} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export function validatePds4ObservationPolicy(value: unknown) {
  const p=parsePds4Policy(value);
  if (p.kind !== 'pds4-float-rgb' || typeof p.labelPath !== 'string' || !p.labelPath || p.labelPath.startsWith('/') ||
      p.labelPath.split(/[\\/]/).includes('..') || !/^urn:nasa:pds:.+::\d+\.\d+$/.test(p.lidvid) ||
      !Array.isArray(p.bands) || p.bands.length !== 3 || new Set(p.bands).size !== 3 || !p.bands.every(n => Number.isInteger(n) && n > 0) ||
      !Array.isArray(p.wavelengthsNm) || p.wavelengthsNm.length !== 3 || !p.wavelengthsNm.every(n => Number.isFinite(n) && n > 0) ||
      !Array.isArray(p.displayRange) || p.displayRange.length !== 2 || !p.displayRange.every(Number.isFinite) || !(p.displayRange[0] < p.displayRange[1])) {
    throw new TypeError('Invalid PDS4 color observation policy.');
  }
  return p;
}

// Narrow pinned PDS4 product family: no entity expansion, projection guessing or implicit scaling.
export function readPds4ColorLabel(xml: string) {
  if (typeof xml !== 'string' || /<!DOCTYPE|<!ENTITY/.test(xml)) throw new Error('Unsupported PDS4 XML.');
  const all = (text: string, tag: string) => [...text.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))];
  const field = (text: string, tag: string) => {
    const values = all(text, tag);
    if (values.length !== 1) throw new Error(`Missing or ambiguous PDS4 field: ${tag}`);
    return values[0][1].trim();
  };
  const number = (text: string, tag: string, unit?: string) => {
    const value = Number(field(text, tag));
    if (!Number.isFinite(value) || (unit && !all(text, tag)[0][0].startsWith(`<${tag} unit="${unit}">`))) throw new Error(`Invalid PDS4 number or unit: ${tag}`);
    return value;
  };
  const array = field(xml, 'Array_3D_Spectrum'), cart = field(xml, 'cart:Cartography');
  const identity = field(xml, 'Identification_Area').split('<Modification_History>')[0];
  const axes = all(array, 'Axis_Array'), sizes = axes.map(a => number(a[1], 'elements'));
  const bins = all(xml, 'sp:Bin_Wavelength'), wavelengthsNm = bins.map(b => number(b[1], 'sp:center_wavelength', 'nm'));
  const radius = number(cart, 'cart:a_axis_radius', 'm'), resolution = number(cart, 'cart:pixel_resolution_x', 'm/pixel');
  const missing = field(array, 'missing_constant'), centerLongitude = number(cart, 'cart:longitude_of_central_meridian', 'deg');
  if (field(array, 'axis_index_order') !== 'Last Index Fastest' || field(array, 'data_type') !== 'IEEE754LSBSingle' ||
      number(array, 'offset', 'byte') !== 0 || number(array, 'axes') !== 3 || axes.length !== 3 || /<(?:scaling_factor|value_offset)[ >]/.test(array) ||
      axes.some((a, i) => field(a[1], 'axis_name') !== ['Band', 'Line', 'Sample'][i] || number(a[1], 'sequence_number') !== i + 1) ||
      sizes.some(n => !Number.isSafeInteger(n) || n < 1) || sizes[0] !== bins.length || sizes[0] > 256 ||
      bins.some((b, i) => number(b[1], 'sp:bin_sequence_number') !== i + 1) || !/^0x[0-9A-Fa-f]{8}$/.test(missing) ||
      field(cart, 'cart:map_projection_name') !== 'Equirectangular' || field(cart, 'cart:latitude_type') !== 'Planetocentric' ||
      field(cart, 'cart:longitude_direction') !== 'Positive East' || number(cart, 'cart:latitude_of_projection_origin', 'deg') !== 0 ||
      number(cart, 'cart:standard_parallel_1', 'deg') !== 0 || radius <= 0 || resolution <= 0 ||
      number(cart, 'cart:b_axis_radius', 'm') !== radius || number(cart, 'cart:c_axis_radius', 'm') !== radius ||
      number(cart, 'cart:pixel_resolution_y', 'm/pixel') !== resolution ||
      Math.abs(number(cart, 'cart:pixel_scale_x', 'pixel/deg') - radius * Math.PI / 180 / resolution) > 1e-10 ||
      Math.abs(number(cart, 'cart:pixel_scale_y', 'pixel/deg') - radius * Math.PI / 180 / resolution) > 1e-10 ||
      field(xml, 'disp:horizontal_display_axis') !== 'Sample' || field(xml, 'disp:horizontal_display_direction') !== 'Left to Right' ||
      field(xml, 'disp:vertical_display_axis') !== 'Line' || field(xml, 'disp:vertical_display_direction') !== 'Top to Bottom') throw new Error('Unsupported PDS4 color layout or projection.');
  return { width: sizes[2], height: sizes[1], bandCount: sizes[0], wavelengthsNm, radius, resolution, centerLongitude,
    origin: [number(cart, 'cart:upperleft_corner_x', 'm'), number(cart, 'cart:upperleft_corner_y', 'm')],
    missingBits: Number.parseInt(missing.slice(2), 16), fileName: field(xml, 'file_name'),
    lidvid: `${field(identity, 'logical_identifier')}::${field(identity, 'version_id')}` };
}

export function decodePds4Color(bytes: Buffer, xml: string, sourceEntry: unknown, value: unknown) {
  const entry=parseImageEntry(sourceEntry),policy=validatePds4ObservationPolicy(value);
  const grid = readPds4ColorLabel(xml), count = grid.width * grid.height;
  if (grid.lidvid !== policy.lidvid || grid.fileName !== basename(entry.path) || grid.width !== entry.width || grid.height !== entry.height ||
      grid.radius !== entry.projection.referenceRadiusMeters || bytes.length !== count * grid.bandCount * 4 ||
      policy.bands.some((band, i) => grid.wavelengthsNm[band - 1] !== policy.wavelengthsNm[i])) throw new Error('PDS4 source identity, bands or byte length changed.');
  const values = new Float32Array(count * grid.bandCount), bits = new Uint32Array(values.buffer);
  for (let i = 0; i < values.length; i++) bits[i] = bytes.readUInt32LE(i * 4);
  const selected = policy.bands.map(b => (b - 1) * count), valid = new Uint8Array(count);
  let sourceMissingPixels = 0;
  for (let i = 0; i < count; i++) {
    valid[i] = selected.every(offset => bits[offset + i] !== grid.missingBits && Number.isFinite(values[offset + i])) ? 1 : 0;
    sourceMissingPixels += 1 - valid[i];
  }
  return { grid, values, selected, valid, sourceMissingPixels };
}

// Rounded map extents are not exactly 360 degrees. Preserve metric cell centers;
// clamp only within the outer half-cell and require a valid complete RGB footprint.
export function mapPds4Color(source: ReturnType<typeof decodePds4Color>, value: unknown, width: number, height: number) {
  const policy=validatePds4ObservationPolicy(value);
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid output dimensions.');
  const { grid, values, selected, valid } = source, rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const scale = grid.radius * Math.PI / 180, [low, high] = policy.displayRange;
  const x0 = new Int32Array(width), x1 = new Int32Array(width), dx = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    const lon = (((x + .5) * 360 / width - grid.centerLongitude + 180) % 360 + 360) % 360 - 180;
    const sx = (lon * scale - grid.origin[0]) / grid.resolution - .5;
    if (sx < -.5 || sx > grid.width - .5) { x0[x] = -1; continue; }
    const bounded = Math.max(0, Math.min(grid.width - 1, sx));
    x0[x] = Math.floor(bounded); x1[x] = Math.min(x0[x] + 1, grid.width - 1); dx[x] = bounded - x0[x];
  }
  for (let y = 0; y < height; y++) {
    const sy = (grid.origin[1] - (90 - (y + .5) * 180 / height) * scale) / grid.resolution - .5;
    if (sy < -.5 || sy > grid.height - .5) { missing.fill(1, y * width, (y + 1) * width); continue; }
    const bounded = Math.max(0, Math.min(grid.height - 1, sy)), y0 = Math.floor(bounded), y1 = Math.min(y0 + 1, grid.height - 1), dy = bounded - y0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, a = y0 * grid.width + x0[x], b = y0 * grid.width + x1[x], c = y1 * grid.width + x0[x], d = y1 * grid.width + x1[x];
      if (x0[x] < 0 || !valid[a] || !valid[b] || !valid[c] || !valid[d]) { missing[i] = 1; continue; }
      for (let channel = 0; channel < 3; channel++) {
        const offset = selected[channel], u = dx[x];
        const value = (values[offset + a] * (1 - u) + values[offset + b] * u) * (1 - dy) + (values[offset + c] * (1 - u) + values[offset + d] * u) * dy;
        rgb[i * 3 + channel] = Math.round(255 * Math.max(0, Math.min(1, (value - low) / (high - low))));
      }
    }
  }
  return { rgb, missing, sourceMissingPixels: source.sourceMissingPixels, sourceGeoreference: grid };
}

export async function preparePds4Observation(sourceDirectory: string, sourceEntry: unknown, value: unknown, width: number, height: number) {
  const entry=parseImageEntry(sourceEntry),policy=validatePds4ObservationPolicy(value);
  const [bytes, xml] = await Promise.all([readFile(resolve(sourceDirectory, entry.path)), readFile(resolve(sourceDirectory, policy.labelPath), 'utf8')]);
  return mapPds4Color(decodePds4Color(bytes, xml, entry, policy), policy, width, height);
}
