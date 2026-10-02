// Entry script: node packages/bake/authoring/milky-way/nuclear-cluster-sample.mts [central.tsv]
/**
 * The Milky Way's nuclear star cluster sample: the stars of the GALACTICNUCLEUS survey (Nogueras-Lara et al. 2019, A&A
 * 631, A20, central field) around Sagittarius A*, thinned to the cluster's own share of the star counts.
 *
 * Input: the survey's central catalogue within 6 arcminutes of Sgr A* and brighter than Ks 16, as VizieR serves it, by
 * default `output/sgr/gns6.tsv`, from
 * https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/A%2BA/631/A20/central&-c=266.4168166%20-29.0078250&-c.rm=6&-out=RAJ2000,DEJ2000,Jmag,Hmag,Ksmag&-out.max=999999&Ksmag=%3C16
 * Output: `src/objects/milky-way/source/nuclear-cluster/sample.csv.gz`. It prints what it kept.
 *
 * - A star is kept when it is redder than H - Ks 1.3: the survey's stars split there into the dust-reddened stars of the
 *   Galactic centre and the bluer stars in front of it (in this field 637 of the 25,661 stars brighter than Ks 14 are bluer
 *   than 0.7, 24,443 redder than 1.3, 581 between). A star without an H magnitude is left out.
 * - A star is kept when it is brighter than Ks 14. Fainter, the survey loses stars in the crowded centre: per square
 *   arcminute, the innermost half arcminute holds 7.9 times the stars of the 5 to 6 arcminute ring at Ks 13 to 14, as
 *   it does at Ks 12 to 13 (9.0), but only 4.0 times at Ks 14 to 15.
 * - The cluster is flattened along the Galactic plane (axis ratio 0.71: Gallego-Cano et al. 2020, A&A 634, A71), so a
 *   star's radius here is its elliptical one: its offset along the plane, and its offset across it over 0.71.
 * - The stars toward the cluster also belong to the nuclear stellar disc and the bulge around it, which no measurement
 *   tells apart star by star. Their density is taken from the ring between 5 and 6 arcminutes; nearer in, a star is kept
 *   with the chance that it is the cluster's: one minus that density over the density of its own half-arcminute ring.
 *   The draw is by the star's position, so it keeps the same stars on every run. The kept stars are written in a
 *   shuffled order, also by position: the survey lists them field by field, and the app draws a bank's first rows.
 * - The sample ends at two half-light radii (5.1 pc at 8277 pc: Gallego-Cano et al. 2020; GRAVITY Collaboration 2022),
 *   where the cluster's share is down to about a tenth.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const repository = resolve(import.meta.dirname, '../../../..');
const inputPath = resolve(process.argv[2] ?? resolve(repository, 'output/sgr/gns6.tsv'));
const outputPath = resolve(repository, 'src/objects/milky-way/source/nuclear-cluster/sample.csv.gz');
const CENTRE_RA_DEG = 266.4168166, CENTRE_DEC_DEG = -29.0078250, DISTANCE_PC = 8277, HALF_LIGHT_PC = 5.1, AXIS_RATIO = 0.71;
const MIN_H_KS = 1.3, MAX_KS = 14, RING_ARCMIN = 0.5, BACKGROUND_ARCMIN = [5, 6] as const, CUTOFF_HALF_LIGHT_RADII = 2;
// The north Galactic pole in ICRS (the IAU 1958 system as Astropy's Galactic frame defines it).
const POLE_RA_DEG = 192.85948, POLE_DEC_DEG = 27.12825;
const rad = Math.PI / 180;
/** The position angle of Galactic north at the centre, east of celestial north. */
const galacticNorthPaDeg = Math.atan2(Math.sin((POLE_RA_DEG - CENTRE_RA_DEG) * rad),
  Math.cos(CENTRE_DEC_DEG * rad) * Math.tan(POLE_DEC_DEG * rad) - Math.sin(CENTRE_DEC_DEG * rad) * Math.cos((POLE_RA_DEG - CENTRE_RA_DEG) * rad)) / rad;
const cutoffArcmin = CUTOFF_HALF_LIGHT_RADII * HALF_LIGHT_PC / DISTANCE_PC / rad * 60;
// A uniform share in [0, 1) from a star's row text: the same stars on every run.
const share = (id: string) => {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
  return hash / 2 ** 32;
};

const lines = (await readFile(inputPath, 'utf8')).split('\n').filter(line => /^\d/u.test(line));
let foreground = 0, withoutH = 0, faint = 0;
const stars = lines.flatMap(line => {
  const [raText = '', decText = '', , hText = '', ksText = ''] = line.split('\t').map(value => value.trim());
  const ra = Number(raText), dec = Number(decText), ks = Number(ksText);
  if (!raText || !decText || !ksText || ![ra, dec, ks].every(Number.isFinite)) throw new TypeError(`${inputPath}: malformed row ${JSON.stringify(line)}.`);
  if (!(ks < MAX_KS)) { faint++; return []; }
  if (!hText) { withoutH++; return []; }
  if (!(Number(hText) - ks > MIN_H_KS)) { foreground++; return []; }
  const east = (ra - CENTRE_RA_DEG) * Math.cos(CENTRE_DEC_DEG * rad) * 60, north = (dec - CENTRE_DEC_DEG) * 60;
  const across = east * Math.sin(galacticNorthPaDeg * rad) + north * Math.cos(galacticNorthPaDeg * rad);
  const along = east * Math.cos(galacticNorthPaDeg * rad) - north * Math.sin(galacticNorthPaDeg * rad);
  return [{ raText, decText, ksText, radius: Math.hypot(along, across / AXIS_RATIO) }];
});
// Stars per unit of elliptical ring area; the axis ratio scales every ring alike, so it drops out of the ratio.
const density = (from: number, to: number) => stars.filter(star => star.radius >= from && star.radius < to).length / (to * to - from * from);
const background = density(...BACKGROUND_ARCMIN);
if (!(background > 0)) throw new TypeError(`${inputPath}: no stars between ${BACKGROUND_ARCMIN.join(' and ')} arcminutes to measure the field around the cluster.`);
const rings = Array.from({ length: Math.ceil(cutoffArcmin / RING_ARCMIN) }, (_, index) => {
  const from = index * RING_ARCMIN, to = from + RING_ARCMIN;
  return { from, to, share: Math.max(0, 1 - background / density(from, to)) };
});
const kept = stars.flatMap(star => {
  if (!(star.radius < cutoffArcmin)) return [];
  const id = `${star.raText}${star.decText.startsWith('-') ? '' : '+'}${star.decText}`, drawn = share(id);
  return drawn < rings[Math.floor(star.radius / RING_ARCMIN)]!.share ? [{ order: share(`order:${id}`), row: `GNS ${id},${star.raText},${star.decText},${star.ksText}` }] : [];
// The app draws a bank's first rows when it thins it, so the rows are shuffled: any share of them covers the cluster.
}).sort((a, b) => a.order - b.order || (a.row < b.row ? -1 : 1)).map(star => star.row);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, gzipSync(['Name,RAJ2000,DEJ2000,Ksmag', ...kept].join('\n') + '\n', { level: 9 }));
console.log(JSON.stringify({ rows: lines.length, faint, withoutH, foreground, centreStars: stars.length, galacticNorthPaDeg: +galacticNorthPaDeg.toFixed(2),
  cutoffArcmin: +cutoffArcmin.toFixed(3), rings: rings.map(ring => `${ring.from}-${ring.to}: ${ring.share.toFixed(2)}`),
  kept: kept.length, bytes: (await readFile(outputPath)).length, output: outputPath }));
