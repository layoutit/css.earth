import { CATALOGUE_POINTS_SCHEMA } from '@cssearth/objects';

const PARSEC_M = 3.0856775814913673e16;
/** A packed bank stores each axis as a whole number of 1e-4 units in 32 bits (catalogue-bank-binary.ts), so parsecs reach
 * 214,748 of them from the bank's origin: the stars placed in a galaxy, about that galaxy's centre, keep 1e-4 pc. */
const UNIT_REACH = 0x7fffffff / 1e4;
/** The bank's name in the package of the object its stars are inside (`prepared/plain-stars.bin`). */
export const PLAIN_STAR_DOT_BANK = 'plain-stars';
/** The bank the world wrote for the farthest stars while every plain star was a dot of the world's own two banks; a bake
 * removes it where it finds it. */
export const RETIRED_PLAIN_STAR_DOT_BANK = 'plain-stars-far';
/** A plain dot's diameter as a body's marker drew it (site/world/application-world-resources.mts PLAIN_DOT_MINIMUM_PIXELS). */
const DOT_RADIUS_PX = 0.75;

export interface PlainStar { readonly id: string; readonly positionM: readonly [number, number, number]; readonly color: string }
export interface WorldFrame { readonly referenceFrame: string; readonly epochJdTt: number; readonly originM: readonly number[] }

/** The stars inside one object (`holderId`: another galaxy, or the system of the star they are bound to) that the map draws as plain dots, which nothing orbits and no
 * click opens, as that object's catalogue point bank (CATALOGUE_POINTS_SCHEMA): one dot each at the star's prepared
 * position about the object's centre (`frame.originM`), in the star's prepared color. Stars keep the world's order, so a
 * rerun writes the same file. Null without stars. */
export function plainStarDotBank(holderId: string, stars: readonly PlainStar[], frame: WorldFrame) {
  if (!stars.length) return null;
  const origin = frame.originM;
  const toUnits = (meters: number) => Math.round(meters / PARSEC_M * 1e4) / 1e4;
  for (const star of stars) {
    const offsetM = star.positionM.map((value, axis) => value - (origin[axis] ?? 0));
    if (!(Math.max(...offsetM.map(Math.abs)) / PARSEC_M < UNIT_REACH)) {
      throw new RangeError(`${star.id} is ${Math.hypot(...offsetM) / PARSEC_M} pc from the centre of ${holderId}, the object it is inside, past the ${UNIT_REACH} parsecs a dot bank reaches.`);
    }
    if (!/^#[0-9a-f]{6}$/u.test(star.color)) throw new TypeError(`${star.id}: a plain dot's color is #rrggbb, got ${JSON.stringify(star.color)}.`);
  }
  const palette = [...new Set(stars.map(star => star.color))].sort();
  const points = stars.map(star => [...star.positionM.map((value, axis) => toUnits(value - (origin[axis] ?? 0))), palette.indexOf(star.color)]);
  const reach = Math.ceil(Math.max(...points.flatMap(point => point.slice(0, 3).map(Math.abs))));
  return { schema: CATALOGUE_POINTS_SCHEMA, id: PLAIN_STAR_DOT_BANK,
    source: `The world context of this bake (src/objects/sun/prepared/world-context.json): each star the catalogue places inside ${holderId} that has no imagery, is not featured and has nothing in orbit.`,
    meaning: 'One dot per catalogued star the map does not label or open by click. Each star keeps its own page, reached by search.',
    frame: { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, originM: [...origin], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: PARSEC_M, boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } },
    // Every dot shows from anywhere inside the bank's reach; from farther out the bank thins like any other.
    appearance: { colorCss: palette[0]!, radiusPx: DOT_RADIUS_PX, opacity: 1, palette, fullDetailUnits: reach },
    counts: { rows: stars.length, points: stars.length },
    conversion: `Prepared positions relative to the centre of ${holderId} (${frame.referenceFrame}, JD ${frame.epochJdTt} TT), in parsecs rounded to 1e-4 pc.`,
    points };
}
