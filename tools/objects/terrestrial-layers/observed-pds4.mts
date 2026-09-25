import {parsePds4Policy,parseImageEntry} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { bandColorDisplay, bandColorByte, bandColorEvidence } from '../color-transfer.mts';
import { pds4Block, pds4Blocks, pds4Number } from '@cssearth/telescope';
import { checkKeys } from '../surface-observations/recipe.mts';

export function validatePds4ObservationPolicy(value: unknown) {
  // The wavelengths name the bands, so the policy declares one display range and nothing else about colour.
  checkKeys(value, ['kind', 'labelPath', 'lidvid', 'bands', 'wavelengthsNm', 'displayRange'], [], 'PDS4 color observation policy');
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
  const array = pds4Block(xml, 'Array_3D_Spectrum'), cart = pds4Block(xml, 'cart:Cartography');
  const identity = pds4Block(xml, 'Identification_Area').split('<Modification_History>')[0];
  const axes = pds4Blocks(array, 'Axis_Array'), sizes = axes.map(a => pds4Number(a, 'elements'));
  const bins = pds4Blocks(xml, 'sp:Bin_Wavelength'), wavelengthsNm = bins.map(b => pds4Number(b, 'sp:center_wavelength', 'nm'));
  const radius = pds4Number(cart, 'cart:a_axis_radius', 'm'), resolution = pds4Number(cart, 'cart:pixel_resolution_x', 'm/pixel');
  const missing = pds4Block(array, 'missing_constant'), centerLongitude = pds4Number(cart, 'cart:longitude_of_central_meridian', 'deg');
  if (pds4Block(array, 'axis_index_order') !== 'Last Index Fastest' || pds4Block(array, 'data_type') !== 'IEEE754LSBSingle' ||
      pds4Number(array, 'offset', 'byte') !== 0 || pds4Number(array, 'axes') !== 3 || axes.length !== 3 || /<(?:scaling_factor|value_offset)[ >]/.test(array) ||
      axes.some((a, i) => pds4Block(a, 'axis_name') !== ['Band', 'Line', 'Sample'][i] || pds4Number(a, 'sequence_number') !== i + 1) ||
      sizes.some(n => !Number.isSafeInteger(n) || n < 1) || sizes[0] !== bins.length || sizes[0] > 256 ||
      bins.some((b, i) => pds4Number(b, 'sp:bin_sequence_number') !== i + 1) || !/^0x[0-9A-Fa-f]{8}$/.test(missing) ||
      pds4Block(cart, 'cart:map_projection_name') !== 'Equirectangular' || pds4Block(cart, 'cart:latitude_type') !== 'Planetocentric' ||
      pds4Block(cart, 'cart:longitude_direction') !== 'Positive East' || pds4Number(cart, 'cart:latitude_of_projection_origin', 'deg') !== 0 ||
      pds4Number(cart, 'cart:standard_parallel_1', 'deg') !== 0 || radius <= 0 || resolution <= 0 ||
      pds4Number(cart, 'cart:b_axis_radius', 'm') !== radius || pds4Number(cart, 'cart:c_axis_radius', 'm') !== radius ||
      pds4Number(cart, 'cart:pixel_resolution_y', 'm/pixel') !== resolution ||
      Math.abs(pds4Number(cart, 'cart:pixel_scale_x', 'pixel/deg') - radius * Math.PI / 180 / resolution) > 1e-10 ||
      Math.abs(pds4Number(cart, 'cart:pixel_scale_y', 'pixel/deg') - radius * Math.PI / 180 / resolution) > 1e-10 ||
      pds4Block(xml, 'disp:horizontal_display_axis') !== 'Sample' || pds4Block(xml, 'disp:horizontal_display_direction') !== 'Left to Right' ||
      pds4Block(xml, 'disp:vertical_display_axis') !== 'Line' || pds4Block(xml, 'disp:vertical_display_direction') !== 'Top to Bottom') throw new Error('Unsupported PDS4 color layout or projection.');
  return { width: sizes[2], height: sizes[1], bandCount: sizes[0], wavelengthsNm, radius, resolution, centerLongitude,
    origin: [pds4Number(cart, 'cart:upperleft_corner_x', 'm'), pds4Number(cart, 'cart:upperleft_corner_y', 'm')],
    missingBits: Number.parseInt(missing.slice(2), 16), fileName: pds4Block(xml, 'file_name'),
    lidvid: `${pds4Block(identity, 'logical_identifier')}::${pds4Block(identity, 'version_id')}` };
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
  // The archive publishes derived band values at these wavelengths, not I/F or natural colour.
  const display=bandColorDisplay(policy.wavelengthsNm.map(n=>`${n} nm`),'derived-band-value',policy.displayRange);
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid output dimensions.');
  const { grid, values, selected, valid } = source, rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const scale = grid.radius * Math.PI / 180;
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
        rgb[i * 3 + channel] = bandColorByte(value,display);
      }
    }
  }
  return { rgb, missing, sourceMissingPixels: source.sourceMissingPixels, sourceGeoreference: grid,colorDisplay:bandColorEvidence(display) };
}

export async function preparePds4Observation(sourceDirectory: string, sourceEntry: unknown, value: unknown, width: number, height: number) {
  const entry=parseImageEntry(sourceEntry),policy=validatePds4ObservationPolicy(value);
  const [bytes, xml] = await Promise.all([readFile(resolve(sourceDirectory, entry.path)), readFile(resolve(sourceDirectory, policy.labelPath), 'utf8')]);
  return mapPds4Color(decodePds4Color(bytes, xml, entry, policy), policy, width, height);
}
