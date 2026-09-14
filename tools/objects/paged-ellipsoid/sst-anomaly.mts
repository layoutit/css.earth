import {numericRaster} from '../terrestrial-layers/source-records.mts';
import type {CoraltempRecipe, AnomalyPalette} from './contracts.mts';
import * as h5 from 'h5wasm/node';

export const coraltempProductUrl = 'https://www.coralreefwatch.noaa.gov/product/5km/index_5km_ssta_clim19912020.php';
const attribute = (object: h5.Group | h5.Dataset, key: string): unknown => {
  const value = object.attrs[key]?.value;
  return ArrayBuffer.isView(value) ? numericRaster(value)[0] : value;
};
function demand(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`CoralTemp: ${message}`); };

function dataset(file: h5.Group, name: string): h5.Dataset {
  const value = file.get(name); demand(value instanceof h5.Dataset, `missing numeric dataset ${name}`); return value;
}
function textAttribute(object: h5.Group | h5.Dataset, key: string): string {
  const value = attribute(object, key); demand(typeof value === 'string', `invalid text attribute ${key}`); return value;
}

// Preparation only. NOAA's north-to-south, west-to-east grid already matches
// the Earth map convention. Keep the explicit water/land/ice/no-data mask.
export async function readCoraltempAnomaly(path: string, recipe: CoraltempRecipe) {
  await h5.ready;
  const file = new h5.File(path, 'r');
  try {
    const field = dataset(file, 'sea_surface_temperature_anomaly'), maskField = dataset(file, 'mask');
    const lat = numericRaster(dataset(file, 'lat').value), lon = numericRaster(dataset(file, 'lon').value);
    demand(JSON.stringify(field.metadata.shape) === '[1,3600,7200]' &&
      JSON.stringify(maskField.metadata.shape) === '[1,3600,7200]', 'unexpected anomaly grid');
    demand(lat.length === 3600 && lon.length === 7200 &&
      lat.every((v, i) => Math.abs(v - (89.975 - i * .05)) < .00002) &&
      lon.every((v, i) => Math.abs(v - (-179.975 + i * .05)) < .00002), 'unexpected coordinate axes');
    demand(attribute(field, 'units') === 'degree_Celsius', 'unexpected units');
    demand(attribute(file, 'id') === 'Satellite_Daily_Global_5km_SST_Anomaly' &&
      attribute(file, 'product_version') === '3.1', 'product identity differs');
    const stamp = textAttribute(file, 'time_coverage_start');
    demand(/^\d{8}T000000Z$/.test(stamp), 'invalid observation timestamp');
    const date = `${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}`;
    demand(date === recipe.date && recipe.filename === `ct5km_ssta_v3.1-clim19912020-v1_${stamp.slice(0,8)}.nc`, 'observation date differs');
    demand(/1991-2020/.test(textAttribute(file, 'title')) && /1991-2020/.test(textAttribute(file, 'history')) &&
      recipe.baseline === '1991–2020', 'climatology differs');
    const time = dataset(file, 'time');
    demand(attribute(time, 'units') === 'seconds since 1981-01-01 00:00:00' &&
      new Date(Date.UTC(1981,0,1) + numericRaster(time.value)[0] * 1000).toISOString().slice(0,10) === date, 'time coordinate differs');
    const scale = attribute(field, 'scale_factor'), offset = attribute(field, 'add_offset') ?? 0;
    const fill = attribute(field, '_FillValue'), validMin = attribute(field, 'valid_min'), validMax = attribute(field, 'valid_max');
    demand(scale === .01 && offset === 0 && fill === -32768 && validMin === -1500 && validMax === 1500 &&
      field.metadata.signed && field.metadata.size === 2, 'packing differs');
    demand(attribute(maskField, 'flag_meanings') === 'valid-water land missing ice' &&
      JSON.stringify([...numericRaster(maskField.attrs.flag_values?.value)]) === '[0,1,2,4]' && attribute(maskField, '_FillValue') === 251, 'mask definition differs');
    demand(recipe.minimum < recipe.maximum && recipe.palette.length >= 2 &&
      [...recipe.palette, recipe.missingColor].every(rgb => rgb.length === 3 &&
        rgb.every(v => Number.isInteger(v) && v >= 0 && v <= 255)), 'invalid color scale');
    const values = numericRaster(field.value), mask = numericRaster(maskField.value), data = Buffer.alloc(7200 * 3600 * 3);
    const colors = Array.from({ length: validMax - validMin + 1 }, (_, i) => anomalyColor((i + validMin) * scale, recipe));
    const maskCounts = { water: 0, land: 0, missing: 0, ice: 0, fill: 0 };
    const maskNames: Partial<Record<number, keyof typeof maskCounts>> = { 0: 'water', 1: 'land', 2: 'missing', 4: 'ice', 251: 'fill' };
    let valid = 0, missing = 0, saturated = 0, minimum = Infinity, maximum = -Infinity;
    for (let i = 0; i < values.length; i++) {
      const packed = values[i], flag = mask[i];
      const maskName = maskNames[flag];
      demand(maskName !== undefined, 'unknown mask flag');
      maskCounts[maskName]++;
      const invalid = flag !== 0 || packed === fill || packed < validMin || packed > validMax;
      let color = recipe.missingColor;
      if (invalid) missing++;
      else {
        const value = packed * scale;
        valid++; minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
        if (value < recipe.minimum || value > recipe.maximum) saturated++;
        color = colors[packed - validMin];
      }
      data.set(color, i * 3);
    }
    return { data, info: { width: 7200, height: 3600, channels: 3 as const },
      receipt: { product: 'NOAA CoralTemp v3.1 SST anomaly', version: '3.1-clim19912020-v1', filename: recipe.filename,
        date, issued: textAttribute(file, 'date_issued'), baseline: recipe.baseline, units: '°C',
        sourceGrid: [7200, 3600], sourceCellDegrees: .05,
        outputBounds: { west: -180, east: 180, north: 90, south: -90 },
        scale, offset, fill, valid, missing, maskCounts, saturated, minimum, maximum,
        palette: recipe.palette, displayRange: [recipe.minimum, recipe.maximum], missingColor: recipe.missingColor } };
  } finally { file.close(); }
}

export function anomalyColor(value: number, recipe: AnomalyPalette) {
  const position = Math.max(0, Math.min(1, (value - recipe.minimum) / (recipe.maximum - recipe.minimum))) * (recipe.palette.length - 1);
  const index = Math.floor(position), fraction = position - index;
  return recipe.palette[index].map((channel, c) => Math.round(channel +
    (recipe.palette[Math.min(index + 1, recipe.palette.length - 1)][c] - channel) * fraction));
}

/** The dated ENSO lens recipe; its reader text is ensoText's and its notes restate the product and date. */
export function ensoContent(recipe: CoraltempRecipe) {
  const date = new Date(`${recipe.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return { id: 'enso', label: 'ENSO',
    thumbnail: '/scenes/earth/earth-lens-enso.webp', falseColor: true,
    source: { id: 'noaa-coraltemp-anomaly', url: coraltempProductUrl },
    facts: [{ id: 'enso-status', label: 'NOAA status', value: recipe.advisory.status },
      { id: 'enso-advisory-date', label: 'Advisory issued', value: recipe.advisory.date },
      { id: 'enso-checked', label: 'Source checked', value: recipe.checked.slice(0, 10) }],
    legend: { kind: 'scale', title: 'Temperature anomaly · °C', sourceUrl: coraltempProductUrl,
      recipe: { palette: recipe.palette, labels: ['≤ −5', '0', '≥ +5'] } },
    legendNote: 'Anomaly map; the ENSO advisory describes the coupled ocean–atmosphere state.',
    notes: `NOAA CoralTemp · 5 km · ${date}. Nighttime sea-surface temperature departure from the ${recipe.baseline} average. Gray: land, ice, or unavailable data.` };
}

/** Earth's text.json entry for the ENSO dataset on the recipe's date. */
export function ensoText(recipe: CoraltempRecipe) {
  const day = (month: 'short' | 'long') => new Date(`${recipe.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });
  return { title: 'Sea-surface temperature anomaly', detail: day('short'),
    summary: `Nighttime sea-surface temperature compared with the ${recipe.baseline} average, on ${day('long')}. Gray covers land, ice and gaps.` };
}
