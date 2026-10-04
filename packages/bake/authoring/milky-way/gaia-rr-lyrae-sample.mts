import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// Entry script: node packages/bake/authoring/milky-way/gaia-rr-lyrae-sample.mts [table5.dat.gz]
/**
 * The Milky Way's Gaia RR Lyrae sample: the Gaia DR3 RR Lyrae stars Li et al. (2023, ApJ 944, 88, table 5) place beyond
 * 3 kpc of the Galactic centre, so the bulge's old stars give the galaxy's drawing the height its flat disc tracers lack,
 * and thin out into the disc. Nearer the centre the OGLE bulge sample (source/bulge-rr-lyrae) already draws them, deeper than
 * Gaia sees there. Past 3 kpc a star is kept with a chance that falls exponentially with its distance from the centre, on the
 * disc's scale length (2.6 kpc: Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529), so the bulge fades out the way the disc's
 * light does. Farther out the sample holds mostly the stars near the Sun, where Gaia finds them best through the disc's
 * dust, a bubble around the Sun rather than a structure of the galaxy; at the Sun's 8.3 kpc the chance is down to 13%.
 * The draw is by Gaia DR3 id, so it keeps the same stars on every run.
 *
 * Input: CDS's table 5, by default `output/rrlyrae/table5.dat.gz`, from https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/88/table5.dat.gz
 * (byte columns from its ReadMe). Output: `src/objects/milky-way-volume/source/gaia-rr-lyrae/sample.csv.gz`. It prints what it kept.
 *
 * - A star keeps its photometric distance when that distance's uncertainty is at most a quarter of it.
 * - Stars of the Magellanic Clouds and of the Sagittarius dwarf galaxy's core are left out: they belong to those galaxies.
 *   A Cloud's star lies within 12 degrees of the LMC's centre beyond 35 kpc or within 8 degrees of the SMC's beyond 45 kpc; a
 *   core star within 10 degrees of Sagittarius's centre (RA 283.764, Dec -30.480) between 18 and 35 kpc (it lies at 26.5).
 * - The Galactic centre is the Milky Way's own: its volume frame's origin (`object.json` properties.volume.originM), where
 *   its drawing and the merge's `withinPcOfCentre` put it.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const repository = checkoutProjectRoot(import.meta.url);
const inputPath = resolve(process.argv[2] ?? resolve(repository, 'output/rrlyrae/table5.dat.gz'));
const outputPath = resolve(repository, 'src/objects/milky-way-volume/source/gaia-rr-lyrae/sample.csv.gz');
const descriptorPath = resolve(repository, 'src/objects/milky-way-volume/object.json');
const INNER_KPC = 3, OUTER_KPC = 30, SCALE_LENGTH_KPC = 2.6, MAX_RELATIVE_ERROR = 0.25, KPC_M = 3.0856775814913673e19;
const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8')) as { properties?: { volume?: { referenceFrame?: unknown; originM?: unknown } } };
const volume = descriptor.properties?.volume, originM = volume?.originM;
if (volume?.referenceFrame !== 'sun-icrf' || !Array.isArray(originM) || originM.length !== 3 || !originM.every(Number.isFinite)) {
  throw new TypeError(`${descriptorPath}: properties.volume needs a sun-icrf originM, got ${JSON.stringify(volume)}.`);
}
const centreKpc = (originM as number[]).map(value => value / KPC_M);
// A uniform share in [0, 1) from a Gaia DR3 id: the same stars on every run, spread evenly across the sky.
const share = (id: string) => {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
  return hash / 2 ** 32;
};
const separation = (ra1: number, dec1: number, ra2: number, dec2: number) => {
  const [a, b, c, d] = [ra1, dec1, ra2, dec2].map(value => value * Math.PI / 180) as [number, number, number, number];
  return Math.acos(Math.max(-1, Math.min(1, Math.sin(b) * Math.sin(d) + Math.cos(b) * Math.cos(d) * Math.cos(a - c)))) * 180 / Math.PI;
};

// Table 5 byte columns (ReadMe): 1-19 GaiaDR3, 21-31 RAdeg, 33-43 DEdeg, 82-87 Dist-Phot, 89-94 e_Dist-Phot, 96-99 Type.
const lines = gunzipSync(await readFile(inputPath)).toString('utf8').split('\n').filter(line => line.trim());
if (lines.length !== 135873) throw new TypeError(`${inputPath}: table 5 has 135,873 rows, not ${lines.length}.`);
let uncertain = 0, magellanic = 0, sagittarius = 0, outside = 0, tapered = 0;
const kept = lines.flatMap(line => {
  const field = (from: number, to: number) => line.slice(from - 1, to).trim();
  const id = field(1, 19), ra = Number(field(21, 31)), dec = Number(field(33, 43)), distance = Number(field(82, 87)), error = Number(field(89, 94));
  if (![ra, dec, distance, error].every(Number.isFinite)) throw new TypeError(`${inputPath}: Gaia DR3 ${id} has a malformed position or distance.`);
  if (!(distance > 0) || error / distance > MAX_RELATIVE_ERROR) { uncertain++; return []; }
  if ((separation(ra, dec, 80.894, -69.756) < 12 && distance > 35) || (separation(ra, dec, 13.187, -72.829) < 8 && distance > 45)) { magellanic++; return []; }
  if (separation(ra, dec, 283.764, -30.480) < 10 && distance > 18 && distance < 35) { sagittarius++; return []; }
  const r = ra * Math.PI / 180, d = dec * Math.PI / 180, unit = [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
  const fromCentre = Math.hypot(...unit.map((value, axis) => value * distance - centreKpc[axis]!));
  if (fromCentre < INNER_KPC || fromCentre > OUTER_KPC) { outside++; return []; }
  if (share(id) >= Math.exp(-(fromCentre - INNER_KPC) / SCALE_LENGTH_KPC)) { tapered++; return []; }
  return [`${id},${ra},${dec},${distance}`];
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, gzipSync(['GaiaDR3,RAdeg,DEdeg,Dist', ...kept].join('\n') + '\n', { level: 9 }));
console.log(JSON.stringify({ rows: lines.length, centreKpc: +Math.hypot(...centreKpc).toFixed(3), uncertain, magellanic, sagittarius, outsideShell: outside, tapered, kept: kept.length, bytes: (await readFile(outputPath)).length, output: outputPath }));
