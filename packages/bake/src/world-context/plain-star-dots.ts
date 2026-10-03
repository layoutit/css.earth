import { CATALOGUE_POINTS_SCHEMA } from '@cssearth/objects';

const PARSEC_M = 3.0856775814913673e16;
/** A packed bank stores each axis as a whole number of 1e-4 units in 32 bits (catalogue-bank-binary.ts), so a unit reaches
 * 214,748 of itself: parsecs hold the galaxy and its halo, kiloparsecs the stars placed in other galaxies. */
const UNITS = [{ name: 'parsecs', metersPerUnit: PARSEC_M, rounding: '1e-4 pc' },
  { name: 'kiloparsecs', metersPerUnit: PARSEC_M * 1e3, rounding: '0.1 pc' }] as const;
const UNIT_REACH = 0x7fffffff / 1e4;
/** The bank's id, and its file in its owner's package (`prepared/plain-stars.bin`). */
export const PLAIN_STAR_DOT_BANK_ID = 'plain-stars';
/** A plain dot's diameter as a body's marker drew it (site/application-world-resources.mts PLAIN_DOT_MINIMUM_PIXELS). */
const DOT_RADIUS_PX = 0.75;

export interface PlainStar { readonly id: string; readonly positionM: readonly [number, number, number]; readonly color: string }
export interface WorldFrame { readonly referenceFrame: string; readonly epochJdTt: number; readonly originM: readonly number[] }

/** The stars of one object (a galaxy) that the map draws as plain dots, which nothing orbits and no click opens, as a
 * catalogue point bank (CATALOGUE_POINTS_SCHEMA): one dot each at the star's prepared position, in the star's prepared color,
 * in the world's frame. The bank takes the smallest unit that reaches all its stars, so one near the Sun keeps 1e-4 pc.
 * Stars keep the world's order, so a rerun writes the same file. Null without stars. */
export function plainStarDotBank(stars: readonly PlainStar[], frame: WorldFrame) {
  if (!stars.length) return null;
  const origin = frame.originM;
  const members = stars.map(star => ({ star, offsetM: star.positionM.map((value, axis) => value - (origin[axis] ?? 0)) }));
  const farthest = members.reduce((far, row) => Math.max(...row.offsetM.map(Math.abs)) > Math.max(...far.offsetM.map(Math.abs)) ? row : far);
  const unit = UNITS.find(candidate => Math.max(...farthest.offsetM.map(Math.abs)) / candidate.metersPerUnit < UNIT_REACH);
  if (!unit) throw new RangeError(`${farthest.star.id} is ${Math.hypot(...farthest.offsetM) / PARSEC_M} pc from the world's origin, past the ${UNIT_REACH} ${UNITS.at(-1)!.name} a dot bank reaches.`);
  for (const { star } of members) if (!/^#[0-9a-f]{6}$/u.test(star.color)) throw new TypeError(`${star.id}: a plain dot's color is #rrggbb, got ${JSON.stringify(star.color)}.`);
  const palette = [...new Set(members.map(({ star }) => star.color))].sort();
  const toUnits = (meters: number) => Math.round(meters / unit.metersPerUnit * 1e4) / 1e4;
  const points = members.map(({ star, offsetM }) => [...offsetM.map(toUnits), palette.indexOf(star.color)]);
  const reach = Math.ceil(Math.max(...points.flatMap(point => point.slice(0, 3).map(Math.abs))));
  return { schema: CATALOGUE_POINTS_SCHEMA, id: PLAIN_STAR_DOT_BANK_ID,
    source: 'The world context of this bake (src/objects/sun/prepared/world-context.json): each star of this object that the catalogue places, which has no imagery, is not featured and has nothing in orbit.',
    meaning: 'One dot per catalogued star the map does not label or open by click. Each star keeps its own page, reached by search.',
    frame: { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, originM: [...origin], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: unit.metersPerUnit, boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } },
    // Every dot shows from anywhere inside the bank's reach. From farther out a star leaves only once the bank's projected
    // shape holds less than a square pixel for each: these are catalogued stars, each with its own page, not a sample of a
    // population, so none is dropped while it has a pixel of its own.
    appearance: { colorCss: palette[0]!, radiusPx: DOT_RADIUS_PX, opacity: 1, palette, fullDetailUnits: reach, outsidePixelsPerDot: 1 },
    counts: { rows: members.length, points: members.length },
    conversion: `Prepared positions relative to the world's origin (${frame.referenceFrame}, JD ${frame.epochJdTt} TT), in ${unit.name} rounded to ${unit.rounding}.`,
    points };
}
