// Preparation only. Akatsuki (Venus Climate Orbiter) UVI Level 3b: one exposure already map-projected
// by the mission's own `al3map` converter onto a 2880x1440 longitude-latitude grid at 0.125 degrees,
// delivered as NetCDF-4 (an HDF5 container). One exposure sees one hemisphere, so the lens keeps the
// unobserved side as a declared data gap; nothing is interpolated, extrapolated or filled.
import * as h5 from 'h5wasm/node';
import { number, object, parse, string } from '@cssearth/core/schema';

/** The grid the JAXA converter writes: `-z 2880x1440`, cell centres at 0.0625 + 0.125 k. */
export const UVI_L3B_GRID = Object.freeze({ width: 2880, height: 1440, cellDegrees: 0.125 });
/** The grid-derived sub-solar point must agree with the product's own header within half a cell plus a margin. */
export const UVI_L3B_SUBSOLAR_TOLERANCE_DEGREES = 0.15;

const profileSchema = object({
  /** The archive file's base name, without `.nc`. */
  productId: string,
  /** `FILTER`, e.g. `365 nm`. */
  filter: string,
  /** `DATE_OBS`, the middle of the exposure, UTC. */
  observationMiddle: string,
  /** The `hgid` of the L2/L3 converter that wrote the file. */
  converterId: string,
  /** Display transform, as on the mapped LROC photograph: value = (radiance * gain) ** (1 / gamma). */
  gain: number, gamma: number,
  /** The body radius the product states at the sub-spacecraft point, metres. */
  referenceRadiusMeters: number,
  /** East longitude at the left edge of the prepared atlas. */
  outputLongitudeOrigin: number,
});
export type AkatsukiUviProfile = ReturnType<typeof parseAkatsukiUviProfile>;

export function parseAkatsukiUviProfile(value: unknown) {
  const profile = parse(value, profileSchema, 'Akatsuki UVI L3b photograph');
  if (profile.gamma <= 0 || profile.gain <= 0 || profile.referenceRadiusMeters <= 0)
    throw new TypeError('Invalid Akatsuki display transform or reference surface.');
  if (!Number.isFinite(profile.outputLongitudeOrigin) || profile.outputLongitudeOrigin < -180 || profile.outputLongitudeOrigin >= 360)
    throw new TypeError('Invalid Akatsuki output longitude origin.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(profile.observationMiddle))
    throw new TypeError('Invalid Akatsuki observation time.');
  return profile;
}

function demand(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(`Akatsuki UVI L3b: ${message}`);
}
const scalar = (value: unknown): number => {
  const first = ArrayBuffer.isView(value) ? (value as unknown as ArrayLike<number>)[0] : Array.isArray(value) ? value[0] : value;
  demand(typeof first === 'number' && Number.isFinite(first), 'expected a finite scalar');
  return first;
};

function dataset(file: h5.Group, name: string): h5.Dataset {
  const value = file.get(name);
  demand(value instanceof h5.Dataset, `missing dataset ${name}`);
  return value;
}
const numericAttribute = (target: h5.Group | h5.Dataset, key: string): number => scalar(target.attrs[key]?.value);
function textAttribute(target: h5.Group | h5.Dataset, key: string): string {
  const value = target.attrs[key]?.value;
  demand(typeof value === 'string', `invalid text attribute ${key}`);
  return value;
}
/** The converter writes FITS header strings as fixed 1024-byte character datasets. */
function headerText(file: h5.Group, name: string): string {
  const value = dataset(file, name).value;
  if (typeof value === 'string') return value.replace(/\0+$/, '').trim();
  demand(ArrayBuffer.isView(value) || Array.isArray(value), `invalid header string ${name}`);
  return Array.from(value as ArrayLike<number | string>)
    .map(entry => (typeof entry === 'string' ? entry : String.fromCharCode(entry))).join('').replace(/\0+$/, '').trim();
}
function numericDataset(dataset: h5.Dataset): ArrayLike<number> {
  const value = dataset.value;
  demand(ArrayBuffer.isView(value) && !(value instanceof DataView), 'expected a numeric dataset');
  return value as unknown as ArrayLike<number>;
}

/** A packed geometry grid: `scale_factor`/`add_offset` in degrees, with its own fill value. */
function packedAngles(file: h5.Group, name: string) {
  const target = dataset(file, name);
  demand(textAttribute(target, 'units') === 'degrees', `${name} is not in degrees`);
  const raw = numericDataset(target), scale = numericAttribute(target, 'scale_factor');
  const offset = numericAttribute(target, 'add_offset'), fill = numericAttribute(target, '_FillValue');
  return { at: (index: number) => (raw[index] === fill ? Number.NaN : raw[index] * scale + offset) };
}

/** Source samples intersecting one output cell, as fractions of that cell. Centre +/- step/2, like the mapped PDS reader. */
function weights(centre: number, step: number) {
  const low = centre - step / 2, high = centre + step / 2, result: { sample: number; weight: number }[] = [];
  for (let i = Math.floor(low + 0.5); i < Math.ceil(high + 0.5); i++) {
    const weight = Math.min(high, i + 0.5) - Math.max(low, i - 0.5);
    if (weight > 1e-8) result.push({ sample: i, weight: weight / step });
  }
  return result;
}

/**
 * Decode one L3b exposure into the prepared atlas layout: east longitude growing from
 * `outputLongitudeOrigin` at the left edge, latitude falling from +90 at the top row.
 *
 * The product's own grid runs the other way in latitude (row 0 is the south pole) and starts at
 * longitude 0, so the reader rolls and flips it; both conventions are asserted against the file's
 * axis values rather than assumed. Every source sample contributing to an output cell must carry a
 * radiance, so the observed edge erodes by at most one output cell instead of bleeding outward.
 */
export async function prepareAkatsukiUviMap(input: string, value: unknown, width: number, height: number) {
  const profile = parseAkatsukiUviProfile(value);
  if (![width, height].every(size => Number.isSafeInteger(size) && size > 0) || width !== 2 * height)
    throw new TypeError('Akatsuki photographic output must be an equirectangular 2:1 grid.');
  await h5.ready;
  const file = new h5.File(input, 'r');
  try {
    const { width: sourceWidth, height: sourceHeight, cellDegrees } = UVI_L3B_GRID;
    demand(textAttribute(file, 'title') === 'Akatsuki Level 3', 'product title differs');
    demand(textAttribute(file, 'institute') === 'ISAS/JAXA', 'producing institute differs');
    demand(textAttribute(file, 'Conventions') === 'CF-1.7', 'grid conventions differ');
    demand(textAttribute(file, 'hgid') === profile.converterId, 'converter revision differs');
    demand(headerText(file, 'OBJECT') === 'VENUS' && headerText(file, 'SPCECRFT') === 'VCO' &&
      headerText(file, 'INSTRUME') === 'Ultra Violet Imager', 'instrument or target differs');
    demand(headerText(file, 'FILTER') === profile.filter, 'filter differs');
    demand(headerText(file, 'DATE_OBS') === profile.observationMiddle, 'observation time differs');
    demand(Math.abs(scalar(dataset(file, 'S_TGRADI').value) * 1000 - profile.referenceRadiusMeters) < 1,
      'target radius differs from the reference surface');

    const longitude = numericDataset(dataset(file, 'longitude')), latitude = numericDataset(dataset(file, 'latitude'));
    demand(textAttribute(dataset(file, 'longitude'), 'units') === 'degrees_east' &&
      textAttribute(dataset(file, 'latitude'), 'units') === 'degrees_north', 'axis units differ');
    demand(longitude.length === sourceWidth && latitude.length === sourceHeight, 'grid size differs');
    for (let i = 0; i < sourceWidth; i++)
      demand(Math.abs(longitude[i] - (i + 0.5) * cellDegrees) < 1e-3, 'east longitude axis differs');
    for (let i = 0; i < sourceHeight; i++)
      demand(Math.abs(latitude[i] - (-90 + (i + 0.5) * cellDegrees)) < 1e-3, 'south-to-north latitude axis differs');

    const radianceSet = dataset(file, 'radiance');
    demand(textAttribute(radianceSet, 'units') === 'W/m2/sr/m', 'radiance units differ');
    demand(JSON.stringify(radianceSet.metadata.shape) === JSON.stringify([1, sourceHeight, sourceWidth]), 'radiance shape differs');
    const radiance = numericDataset(radianceSet), radianceFill = numericAttribute(radianceSet, '_FillValue');
    const incidence = packedAngles(file, 'inangle');

    // Self-consistency: the grid's own least-incidence cell must sit where the product's header puts
    // the Sun. A rolled, mirrored or transposed grid fails here before anything is drawn.
    const headerSubSolar = { longitude: scalar(dataset(file, 'S_SOLLON').value), latitude: scalar(dataset(file, 'S_SOLLAT').value) };
    let leastIncidence = Number.POSITIVE_INFINITY, leastIndex = -1, observed = 0, lit = 0;
    let observedArea = 0, litArea = 0, totalArea = 0, minimum = Number.POSITIVE_INFINITY, maximum = Number.NEGATIVE_INFINITY;
    for (let row = 0; row < sourceHeight; row++) {
      const cosine = Math.cos(latitude[row] * Math.PI / 180), offset = row * sourceWidth;
      totalArea += cosine * sourceWidth;
      for (let column = 0; column < sourceWidth; column++) {
        const index = offset + column, value = radiance[index];
        if (value === radianceFill || !Number.isFinite(value)) continue;
        observed++; observedArea += cosine;
        if (value < minimum) minimum = value;
        if (value > maximum) maximum = value;
        const angle = incidence.at(index);
        if (!Number.isFinite(angle)) continue;
        if (angle < 90) { lit++; litArea += cosine; }
        if (angle < leastIncidence) { leastIncidence = angle; leastIndex = index; }
      }
    }
    demand(leastIndex >= 0 && observed > 0, 'the exposure carries no radiance');
    const gridSubSolar = { longitude: longitude[leastIndex % sourceWidth], latitude: latitude[Math.floor(leastIndex / sourceWidth)] };
    const separation = (Math.abs(((gridSubSolar.longitude - headerSubSolar.longitude + 540) % 360) - 180) * Math.cos(headerSubSolar.latitude * Math.PI / 180));
    demand(Math.hypot(separation, gridSubSolar.latitude - headerSubSolar.latitude) <= UVI_L3B_SUBSOLAR_TOLERANCE_DEGREES,
      `the grid's least-incidence cell is ${gridSubSolar.longitude}E ${gridSubSolar.latitude}N but the header puts the Sun at ${headerSubSolar.longitude}E ${headerSubSolar.latitude}N`);

    const rgb = new Uint8Array(width * height * 3), missing = new Uint8Array(width * height).fill(1);
    const stepX = 360 / width / cellDegrees, stepY = 180 / height / cellDegrees;
    const columns = Array.from({ length: width }, (_, x) => {
      const east = ((profile.outputLongitudeOrigin + (x + 0.5) * 360 / width) % 360 + 360) % 360;
      return { x, weights: weights(east / cellDegrees - 0.5, stepX).map(({ sample, weight }) => ({ sample: ((sample % sourceWidth) + sourceWidth) % sourceWidth, weight })) };
    });
    let painted = 0;
    for (let y = 0; y < height; y++) {
      // The product's row 0 is the south pole; the atlas row 0 is the north pole.
      const north = 90 - (y + 0.5) * 180 / height;
      const rows = weights((north + 90) / cellDegrees - 0.5, stepY).filter(({ sample }) => sample >= 0 && sample < sourceHeight);
      if (!rows.length) continue;
      for (const column of columns) {
        let total = 0, valid = true;
        for (const row of rows) {
          for (const pixel of column.weights) {
            const value = radiance[row.sample * sourceWidth + pixel.sample];
            if (value === radianceFill || !Number.isFinite(value) || value < 0) { valid = false; break; }
            total += value * row.weight * pixel.weight;
          }
          if (!valid) break;
        }
        if (!valid) continue;
        const index = y * width + column.x;
        rgb.fill(Math.round(255 * Math.min(1, (total * profile.gain) ** (1 / profile.gamma))), index * 3, index * 3 + 3);
        missing[index] = 0; painted++;
      }
    }
    demand(painted > 0, 'no output cell received a complete set of observed samples');
    const share = (area: number) => Number((100 * area / totalArea).toFixed(3));
    return {
      rgb, missing,
      report: {
        product: 'Akatsuki UVI Level 3b', productId: profile.productId, converterId: profile.converterId,
        filter: profile.filter, orbit: scalar(dataset(file, 'S_ORBITN').value),
        exposureSeconds: scalar(dataset(file, 'EXPOSURE').value),
        observationStart: headerText(file, 'DATE_BEG'), observationMiddle: headerText(file, 'DATE_OBS'),
        observationEnd: headerText(file, 'DATE_END'),
        sourceGrid: [sourceWidth, sourceHeight] as const, sourceCellDegrees: cellDegrees,
        outputGrid: [width, height] as const, outputLongitudeOrigin: profile.outputLongitudeOrigin,
        spacecraftDistanceKm: scalar(dataset(file, 'S_DISTAV').value),
        phaseAngleDegrees: scalar(dataset(file, 'S_SSCPHA').value),
        assumedCloudAltitudeKm: scalar(dataset(file, 'S_CLDALT').value),
        subSpacecraft: { longitude: scalar(dataset(file, 'S_SSCLON').value), latitude: scalar(dataset(file, 'S_SSCLAT').value) },
        subSolar: { header: headerSubSolar, grid: gridSubSolar, leastIncidenceDegrees: Number(leastIncidence.toFixed(4)) },
        observedCells: observed, litCells: lit, paintedCells: painted,
        observedShare: share(observedArea), litShare: share(litArea),
        paintedShare: Number((100 * painted / (width * height)).toFixed(3)),
        radianceUnits: 'W/m2/sr/m', radianceMinimum: minimum, radianceMaximum: maximum,
        gain: profile.gain, gamma: profile.gamma,
        whiteRadiance: Number((1 / profile.gain).toPrecision(6)),
        clipped: maximum * profile.gain > 1,
        illumination: 'As observed. No photometric normalisation, contrast enhancement or sharpening.',
      },
    };
  } finally { file.close(); }
}
