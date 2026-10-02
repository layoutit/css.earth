import { CATALOGUE_POINTS_SCHEMA } from '@cssearth/objects';

const PARSEC_M = 3.0856775814913673e16;
/** A packed bank stores each axis as a whole number of 1e-4 units in 32 bits (catalogue-bank-binary.ts), so a unit reaches
 * 214,748 of itself: parsecs hold the galaxy and its halo, kiloparsecs the stars placed in other galaxies. */
const UNITS = [{ id: 'plain-stars', name: 'parsecs', metersPerUnit: PARSEC_M, rounding: '1e-4 pc' },
  { id: 'plain-stars-far', name: 'kiloparsecs', metersPerUnit: PARSEC_M * 1e3, rounding: '0.1 pc' }] as const;
const UNIT_REACH = 0x7fffffff / 1e4;
/** A plain dot's diameter as a body's marker drew it (site/application-world-resources.mts PLAIN_DOT_MINIMUM_PIXELS). */
const DOT_RADIUS_PX = 0.75;

export interface PlainStar { readonly id: string; readonly positionM: readonly [number, number, number]; readonly color: string }
export interface WorldFrame { readonly referenceFrame: string; readonly epochJdTt: number; readonly originM: readonly number[] }

/** The stars the map draws as plain dots, which nothing orbits and no click opens, as catalogue point banks
 * (cssearth-catalogue-points@1): one dot each at the star's prepared position, in the star's prepared color. A star takes
 * the smallest unit that reaches it, so the bank near the Sun keeps 1e-4 pc. Stars keep the world's order within a bank,
 * so a rerun writes the same file. */
export function plainStarDotBanks(stars: readonly PlainStar[], frame: WorldFrame) {
  const origin = frame.originM;
  const rows = stars.map(star => ({ star, offsetM: star.positionM.map((value, axis) => value - (origin[axis] ?? 0)) }));
  const unitOf = (offsetM: readonly number[]) => UNITS.find(unit => Math.max(...offsetM.map(Math.abs)) / unit.metersPerUnit < UNIT_REACH);
  return UNITS.flatMap(unit => {
    const members = rows.filter(row => {
      const fit = unitOf(row.offsetM);
      if (!fit) throw new RangeError(`${row.star.id} is ${Math.hypot(...row.offsetM) / PARSEC_M} pc from the world's origin, past the ${UNIT_REACH} ${UNITS.at(-1)!.name} a dot bank reaches.`);
      return fit === unit;
    });
    if (!members.length) return [];
    for (const { star } of members) if (!/^#[0-9a-f]{6}$/u.test(star.color)) throw new TypeError(`${star.id}: a plain dot's color is #rrggbb, got ${JSON.stringify(star.color)}.`);
    const palette = [...new Set(members.map(({ star }) => star.color))].sort();
    const toUnits = (meters: number) => Math.round(meters / unit.metersPerUnit * 1e4) / 1e4;
    const points = members.map(({ star, offsetM }) => [...offsetM.map(toUnits), palette.indexOf(star.color)]);
    const reach = Math.ceil(Math.max(...points.flatMap(point => point.slice(0, 3).map(Math.abs))));
    return [{ schema: CATALOGUE_POINTS_SCHEMA, id: unit.id,
      source: 'The world context of this bake (src/objects/sun/prepared/world-context.json): each star the catalogue places that has no imagery, is not featured and has nothing in orbit.',
      meaning: 'One dot per catalogued star the map does not label or open by click. Each star keeps its own page, reached by search.',
      frame: { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, originM: [...origin], localToReferenceXyzw: [0, 0, 0, 1],
        metersPerUnit: unit.metersPerUnit, boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } },
      // Every dot shows from anywhere inside the bank's reach: these are catalogued stars, never a sample to thin.
      appearance: { colorCss: palette[0]!, radiusPx: DOT_RADIUS_PX, opacity: 1, palette, fullDetailUnits: reach },
      counts: { rows: members.length, points: members.length },
      conversion: `Prepared positions relative to the world's origin (${frame.referenceFrame}, JD ${frame.epochJdTt} TT), in ${unit.name} rounded to ${unit.rounding}.`,
      points }];
  });
}
