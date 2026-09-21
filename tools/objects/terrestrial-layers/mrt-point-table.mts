import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {array,number,optional,shape,text} from './source-records.mts';

/** A published point catalogue in the AAS machine-readable table (MRT) layout: a byte-by-byte column description, then
 * fixed-width rows. Each row is drawn as one symbol whose class, size and colour follow a published figure legend.
 * Symbol sizes are that figure's display convention, not the physical size of the sources. */
const column = shape({label:text,bytes:array(number),format:text,units:text,explanation:text});
const pointClass = shape({category:text,minimum:optional(number),below:optional(number),diameterDegrees:number,outlineDegrees:optional(number)});
export const parsePointTableLens = shape({format:text,path:text,sampling:optional(text),
  grid:shape({title:text,expectedRows:number,rank:column,latitude:column,longitude:column,value:column,longitudeDirection:text}),
  classes:array(pointClass),outlineCategory:optional(text),
  categories:array(shape({value:text,label:text,color:text}))});
export type PointTableLens = ReturnType<typeof parsePointTableLens>;

export function validatePointTableProfile(value: unknown) {
  const lens = parsePointTableLens(value), grid = lens.grid;
  const categories = lens.categories.map(category => category.value);
  const bounded = lens.classes.every((entry, i) => (i === 0 ? entry.minimum === undefined : entry.minimum === lens.classes[i - 1].below) &&
    (i === lens.classes.length - 1 && entry.below === undefined || entry.below !== undefined && (entry.minimum ?? -Infinity) < entry.below));
  if (lens.format !== 'mrt-point-table' || lens.sampling !== 'nearest' || !['west-positive', 'east-positive'].includes(grid.longitudeDirection) ||
      !Number.isSafeInteger(grid.expectedRows) || grid.expectedRows < 1 || lens.classes.length < 1 || !bounded ||
      lens.classes.some(entry => !categories.includes(entry.category) || !(entry.diameterDegrees > 0) || !(entry.diameterDegrees < 90) ||
        (entry.outlineDegrees !== undefined && (!(entry.outlineDegrees > 0) || lens.outlineCategory === undefined))) ||
      (lens.outlineCategory !== undefined && (!categories.includes(lens.outlineCategory) || lens.classes.some(entry => entry.category === lens.outlineCategory))) ||
      new Set(categories).size !== categories.length || lens.categories.some(category => !/^#[0-9a-f]{6}$/i.test(category.color)) ||
      [grid.rank, grid.latitude, grid.longitude, grid.value].some(entry => entry.bytes.length !== 2 || !entry.bytes.every(Number.isSafeInteger) || entry.bytes[0] < 1 || entry.bytes[0] > entry.bytes[1])) {
    throw new TypeError('A point table declares its MRT columns, bounded consecutive classes with symbol sizes and nearest sampling.');
  }
  return lens;
}

/** Read the MRT header and rows. The header's own byte ranges, formats, units and explanations must equal the recipe's. */
export function parsePointTable(textValue: string, value: unknown) {
  const lens = validatePointTableProfile(value), grid = lens.grid;
  const lines = textValue.split(/\r?\n/u);
  if (!lines[0]?.startsWith('Title:') || !textValue.replace(/\s+/gu, ' ').includes(grid.title)) throw new Error('Point table title differs from the recipe.');
  const rules = lines.flatMap((line, index) => /^-{20,}$/u.test(line.trim()) ? [index] : []);
  const description = lines.findIndex(line => line.startsWith('Byte-by-byte Description'));
  if (description < 0 || rules.length < 3) throw new Error('Point table has no byte-by-byte description.');
  const specs = new Map<string, {bytes: number[]; format: string; units: string; explanation: string}>();
  for (const line of lines.slice(rules[1] + 1, rules[2])) {
    const match = /^\s*(\d+)-\s*(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/u.exec(line);
    if (match) specs.set(match[5], {bytes: [Number(match[1]), Number(match[2])], format: match[3], units: match[4], explanation: match[6].trim()});
  }
  for (const entry of [grid.rank, grid.latitude, grid.longitude, grid.value]) {
    const spec = specs.get(entry.label);
    if (!spec || spec.bytes.join() !== entry.bytes.join() || spec.format !== entry.format || spec.units !== entry.units || spec.explanation !== entry.explanation) {
      throw new Error(`Point table column ${entry.label} differs from the recipe.`);
    }
  }
  const field = (line: string, entry: typeof grid.rank) => {
    const raw = line.slice(entry.bytes[0] - 1, entry.bytes[1]).trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(raw)) throw new Error(`Point table ${entry.label} is not a number: ${JSON.stringify(raw)}`);
    return Number(raw);
  };
  const rows = lines.slice(rules.at(-1)! + 1).filter(line => line.trim()).map((line, index) => {
    const rank = field(line, grid.rank), latitude = field(line, grid.latitude), longitude = field(line, grid.longitude), power = field(line, grid.value);
    if (rank !== index + 1 || latitude < -90 || latitude > 90 || longitude < 0 || longitude > 360 || !(power > 0)) throw new Error(`Point table row ${index + 1} is out of order or range.`);
    return {rank, latitude, longitudeEast: grid.longitudeDirection === 'west-positive' ? (360 - longitude) % 360 : longitude % 360, value: power};
  });
  if (rows.length !== grid.expectedRows) throw new Error(`Point table has ${rows.length} rows, not ${grid.expectedRows}.`);
  return rows;
}

/** The class of a value: lower bounds are inclusive, upper bounds exclusive. */
export function pointClassIndex(value: number, classes: PointTableLens['classes']) {
  const index = classes.findIndex(entry => (entry.minimum === undefined || value >= entry.minimum) && (entry.below === undefined || value < entry.below));
  if (index < 0) throw new Error(`No point class holds ${value}.`);
  return index;
}

/** Symbols are spherical caps of the class's angular diameter, drawn in table order so later rows lie on top.
 * The sample is a category index; outside every symbol it is null, so the declared base shows through. */
export function createPointTableSampler(rows: ReturnType<typeof parsePointTable>, value: unknown) {
  const lens = validatePointTableProfile(value), radians = Math.PI / 180;
  const categoryIndex = new Map(lens.categories.map((category, index) => [category.value, index]));
  const outline = lens.outlineCategory === undefined ? -1 : categoryIndex.get(lens.outlineCategory)!;
  const symbols = rows.map(row => {
    const entry = lens.classes[pointClassIndex(row.value, lens.classes)];
    const fill = Math.cos(entry.diameterDegrees / 2 * radians), edge = Math.cos((entry.diameterDegrees / 2 + (entry.outlineDegrees ?? 0)) * radians);
    const lat = row.latitude * radians, lon = row.longitudeEast * radians;
    return {x: Math.cos(lat) * Math.cos(lon), y: Math.cos(lat) * Math.sin(lon), z: Math.sin(lat), fill, edge, category: categoryIndex.get(entry.category)!};
  });
  return {sample(longitude: number, latitude: number) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
    const lat = latitude * radians, lon = longitude * radians;
    const x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
    for (let i = symbols.length - 1; i >= 0; i--) {
      const symbol = symbols[i], cosine = symbol.x * x + symbol.y * y + symbol.z * z;
      if (cosine >= symbol.fill) return symbol.category;
      if (cosine >= symbol.edge) return outline;
    }
    return null;
  }};
}

export async function loadPointTable(root: string, value: unknown) {
  const lens = validatePointTableProfile(value);
  const rows = parsePointTable(await readFile(resolve(root, lens.path), 'utf8'), lens);
  const counts = Object.fromEntries(lens.classes.map(entry => [entry.category, 0]));
  for (const row of rows) counts[lens.classes[pointClassIndex(row.value, lens.classes)].category]++;
  return {...createPointTableSampler(rows, lens), rows, report: {kind: 'point-table', rows: rows.length, counts,
    longitudeDirection: lens.grid.longitudeDirection, symbols: 'Spherical caps of the published legend sizes, drawn in table order; not physical source sizes.'}};
}
