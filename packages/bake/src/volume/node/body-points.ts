// A catalogue point bank centred on a body: published positions relative to a host body (a planet's moons, from an
// ephemeris), placed in the world at the host's own prepared position. The sky-table preparer
// (packages/bake/cli/prepare-catalogue-points.mts) centres its banks on the Sun and reads sky coordinates; this one reads
// Cartesian rows in the host's frame and writes the same bank the app draws.
import { CATALOGUE_POINTS_SCHEMA } from '@cssearth/objects';

export const BODY_POINTS_SOURCE_SCHEMA = 'cssearth-body-points-source@1';
/** The packed bank stores each axis as a whole number of 1e-4 units in 32 bits (catalogue-bank-binary.ts), so a unit reaches
 * 214,748 of itself. A megametre (1,000 km) keeps 100 m and reaches 215 million km, past any planet's moons; a gigametre
 * keeps 100 km and reaches 1,435 au, past the bodies that orbit the Sun. A bank takes the smallest unit its rows fit. */
const UNITS = [{ name: 'megametres', kmPerUnit: 1e3, rounding: '100 m' }, { name: 'gigametres', kmPerUnit: 1e6, rounding: '100 km' }] as const;
const UNIT_REACH = 0x7fffffff / 1e4;

/** The host's prepared world frame (`properties.worldFrame` of its descriptor). */
export interface BodyPointsHostFrame { readonly referenceFrame: string; readonly epochJdTt: number; readonly originM: readonly number[] }
export interface BodyPointsRecipe {
  readonly id: string; readonly host: string; readonly source: string; readonly meaning: string;
  readonly table: { readonly path: string; readonly origin: string; readonly generator: string };
  readonly frame: { readonly input: 'host-centred-icrf-km'; readonly output: string; readonly epochJdTt: number };
  readonly appearance: { readonly colorCss: string; readonly radiusPx: number; readonly opacity: number };
}

/** The recipe at `path`, refusing anything the bank is not built from. */
export function parseBodyPointsRecipe(value: unknown, path: string): BodyPointsRecipe {
  const at = (key: string) => `${path}: ${key}`;
  const record = (input: unknown, key: string, fields: readonly string[]) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`${at(key)} must be an object, got ${JSON.stringify(input)}.`);
    const unknown = Object.keys(input).filter(field => !fields.includes(field));
    if (unknown.length) throw new TypeError(`${at(key)} has unknown ${unknown.join(', ')}; it holds ${fields.join(', ')}.`);
    return input as Record<string, unknown>;
  };
  const text = (input: unknown, key: string) => { if (typeof input !== 'string' || !input) throw new TypeError(`${at(key)} must be text, got ${JSON.stringify(input)}.`); return input; };
  const positive = (input: unknown, key: string) => { if (typeof input !== 'number' || !(input > 0) || !Number.isFinite(input)) throw new TypeError(`${at(key)} must be a positive number, got ${JSON.stringify(input)}.`); return input; };
  const recipe = record(value, 'recipe', ['schema', 'id', 'published', 'host', 'source', 'meaning', 'table', 'frame', 'appearance']);
  if (recipe.schema !== BODY_POINTS_SOURCE_SCHEMA) throw new TypeError(`${at('schema')} must be ${BODY_POINTS_SOURCE_SCHEMA}, got ${JSON.stringify(recipe.schema)}.`);
  const id = text(recipe.id, 'id'), host = text(recipe.host, 'host');
  if (![id, host].every(name => /^[a-z][a-z0-9-]*$/u.test(name))) throw new TypeError(`${at('id and host')} must be object ids, got ${JSON.stringify([id, host])}.`);
  const table = record(recipe.table, 'table', ['path', 'origin', 'generator']);
  const frame = record(recipe.frame, 'frame', ['input', 'output', 'epochJdTt']);
  if (frame.input !== 'host-centred-icrf-km') throw new TypeError(`${at('frame.input')} must be host-centred-icrf-km, got ${JSON.stringify(frame.input)}.`);
  if (typeof frame.epochJdTt !== 'number' || !Number.isFinite(frame.epochJdTt)) throw new TypeError(`${at('frame.epochJdTt')} must be a finite Julian date, got ${JSON.stringify(frame.epochJdTt)}.`);
  const appearance = record(recipe.appearance, 'appearance', ['colorCss', 'radiusPx', 'opacity']);
  const colorCss = text(appearance.colorCss, 'appearance.colorCss');
  if (!/^#[0-9a-f]{6}$/u.test(colorCss)) throw new TypeError(`${at('appearance.colorCss')} must be #rrggbb, got ${JSON.stringify(colorCss)}.`);
  const opacity = positive(appearance.opacity, 'appearance.opacity');
  if (opacity > 1) throw new TypeError(`${at('appearance.opacity')} must be at most 1, got ${opacity}.`);
  return Object.freeze({ id, host, source: text(recipe.source, 'source'), meaning: text(recipe.meaning, 'meaning'),
    table: Object.freeze({ path: text(table.path, 'table.path'), origin: text(table.origin, 'table.origin'), generator: text(table.generator, 'table.generator') }),
    frame: Object.freeze({ input: 'host-centred-icrf-km' as const, output: text(frame.output, 'frame.output'), epochJdTt: frame.epochJdTt }),
    appearance: Object.freeze({ colorCss, radiusPx: positive(appearance.radiusPx, 'appearance.radiusPx'), opacity }) });
}

/** The rows of a `name,xKm,yKm,zKm` table: one named position each, relative to the host. */
export function parseBodyPointsTable(text: string, path: string): readonly { readonly name: string; readonly positionKm: readonly [number, number, number] }[] {
  const [header, ...lines] = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (header !== 'name,xKm,yKm,zKm') throw new TypeError(`${path}: the header must be name,xKm,yKm,zKm, got ${JSON.stringify(header)}.`);
  const names = new Set<string>();
  return lines.map((line, index) => {
    const fields = line.split(','), [name, ...axes] = fields, positionKm = axes.map(Number);
    if (fields.length !== 4 || !name || axes.some(axis => !axis.trim()) || !positionKm.every(Number.isFinite)) throw new TypeError(`${path} row ${index + 1}: expected a name and three finite kilometres, got ${JSON.stringify(line)}.`);
    if (names.has(name)) throw new TypeError(`${path} row ${index + 1}: ${name} is listed twice.`);
    names.add(name);
    return { name, positionKm: positionKm as [number, number, number] };
  });
}

/** The bank the app draws: every row a point from the host in the smallest unit that reaches the farthest, the frame's origin at the host's world position. */
export function bodyCentredBank({ recipe, rows, hostFrame }: {
  recipe: BodyPointsRecipe; rows: ReturnType<typeof parseBodyPointsTable>; hostFrame: BodyPointsHostFrame;
}) {
  if (hostFrame.referenceFrame !== recipe.frame.output || hostFrame.epochJdTt !== recipe.frame.epochJdTt) {
    throw new TypeError(`${recipe.id}: its rows are in ${recipe.frame.output} at JD ${recipe.frame.epochJdTt} TT, but ${recipe.host} is prepared in ${hostFrame.referenceFrame} at JD ${hostFrame.epochJdTt} TT; ` +
      `fetch the rows again at the host's epoch.`);
  }
  if (hostFrame.originM.length !== 3 || !hostFrame.originM.every(Number.isFinite)) throw new TypeError(`${recipe.id}: ${recipe.host} has no finite world position, got ${JSON.stringify(hostFrame.originM)}.`);
  if (!rows.length) throw new TypeError(`${recipe.id}: ${recipe.table.path} holds no rows.`);
  const farthestKm = Math.max(...rows.map(row => Math.hypot(...row.positionKm)));
  const unit = UNITS.find(candidate => farthestKm / candidate.kmPerUnit < UNIT_REACH);
  if (!unit) {
    const farthest = rows.find(row => Math.hypot(...row.positionKm) === farthestKm)!;
    throw new TypeError(`${recipe.id}: ${farthest.name} in ${recipe.table.path} is ${farthestKm} km from ${recipe.host}, past the ${UNIT_REACH * UNITS.at(-1)!.kmPerUnit} km a bank in ${UNITS.at(-1)!.name} reaches.`);
  }
  const toUnits = (km: number) => Math.round(km / unit.kmPerUnit * 1e4) / 1e4, reach = Math.ceil(farthestKm / unit.kmPerUnit);
  return { schema: CATALOGUE_POINTS_SCHEMA, id: recipe.id, source: recipe.source, meaning: recipe.meaning,
    frame: { referenceFrame: recipe.frame.output, epochJdTt: recipe.frame.epochJdTt, originM: [...hostFrame.originM], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: unit.kmPerUnit * 1000, boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } },
    appearance: { ...recipe.appearance },
    host: recipe.host, counts: { rows: rows.length, points: rows.length },
    conversion: `Positions relative to ${recipe.host} (${recipe.frame.output} axes, JD ${recipe.frame.epochJdTt} TT) from the table's kilometres, in ${unit.name} rounded to ${unit.rounding}; the frame's origin is ${recipe.host}'s prepared world position.`,
    points: rows.map(row => row.positionKm.map(toUnits)) };
}
