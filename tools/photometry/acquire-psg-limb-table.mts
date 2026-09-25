/**
 * Build a planet's PSG limb profile (halo.mts) from the NASA GSFC Planetary Spectrum Generator API: the planet's own
 * atmosphere template, a 1 km beam on a limb line of sight at each tangent altitude with the Sun behind the observer
 * (full phase: solar zenith 90 degrees at the tangent point, azimuth 0), and the nadir radiance under an overhead Sun
 * in the same units. One profile serves every lighting frame. PSG serves one call at a time per client, so calls run
 * in sequence; answers are kept in output/psg-limb/<body>.jsonl, and a rerun resumes.
 *
 *   node tools/photometry/acquire-psg-limb-table.mts --body=mars --psg-name=Mars --altitudes=0,2,5,... [--api=http://localhost:3000/api.php]
 *
 * Writes src/objects/<body>/source/atmosphere/psg-limb.json and the two configurations it used beside it.
 */
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PSG_LIMB_TABLE_SCHEMA } from './halo.mts';

// The public service, or a local PSG container (https://hub.docker.com/r/nasapsg/psg) with --api=http://localhost:3000/api.php.
const API = process.argv.find(value => value.startsWith('--api='))?.slice(6) ?? 'https://psg.gsfc.nasa.gov/api.php';
// PSG refuses curl's and Node's default agents; a browser agent string is accepted.
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const BANDS = { red: [0.64, 0.67], green: [0.53, 0.56], blue: [0.44, 0.49] } as const;
type Band = keyof typeof BANDS;

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const required = (name: string) => { const value = argument(name); if (!value) throw new TypeError(`--${name}= is required.`); return value; };
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

async function call(type: string, config: string, extra: Record<string, string> = {}): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(API, { method: 'POST', headers: { 'User-Agent': AGENT, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ type, file: config, ...extra }) });
    const text = await response.text();
    if (response.ok && !text.startsWith('Your other API call is still running')) return text;
    await sleep(60_000);
  }
  throw new Error(`PSG kept refusing a ${type} call after 30 minutes.`);
}
const tag = (config: string, key: string) => config.match(new RegExp(`^<${key}>(.*)$`, 'm'))?.[1];
const set = (config: string, key: string, value: string | number) => new RegExp(`^<${key}>`, 'm').test(config)
  ? config.replace(new RegExp(`^<${key}>.*$`, 'm'), `<${key}>${value}`) : `${config}<${key}>${value}\n`;

function bands(spectrum: string, where: string): Record<Band, number> {
  const rows = spectrum.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.trim().split(/\s+/u).slice(0, 2).map(Number));
  if (!rows.length || rows.some(row => row.some(value => !Number.isFinite(value)))) throw new Error(`${where}: PSG returned no spectrum: ${spectrum.slice(0, 200)}`);
  return Object.fromEntries(Object.entries(BANDS).map(([band, [low, high]]) => {
    const inside = rows.filter(([wavelength]) => wavelength >= low && wavelength <= high).map(([, value]) => value);
    if (!inside.length) throw new Error(`${where}: no PSG sample in the ${band} band ${low}-${high} um.`);
    return [band, inside.reduce((sum, value) => sum + value, 0) / inside.length];
  })) as Record<Band, number>;
}

const body = required('body'), psgName = required('psg-name');
const altitudes = required('altitudes').split(',').map(Number);
const root = process.cwd(), cachePath = resolve(root, 'output/psg-limb', `${body}.jsonl`), outputDirectory = resolve(root, 'src/objects', body, 'source/atmosphere');
await mkdir(dirname(cachePath), { recursive: true });
const cache = new Map<string, unknown>((await readFile(cachePath, 'utf8').catch(() => '')).split('\n').filter(Boolean).map(line => { const { key, value } = JSON.parse(line); return [key, value]; }));
const cached = async <T,>(key: string, compute: () => Promise<T>): Promise<T> => {
  if (cache.has(key)) return cache.get(key) as T;
  const value = await compute(); cache.set(key, value); await appendFile(cachePath, JSON.stringify({ key, value }) + '\n'); return value;
};

const template = await cached('template', () => call('cfg', `<OBJECT>Planet\n<OBJECT-NAME>${psgName}\n<OBJECT-DATE>2025/01/01 00:00\n<GEOMETRY>Observatory\n<GENERATOR-RANGE1>0.38\n<GENERATOR-RANGE2>0.70\n<GENERATOR-RANGEUNIT>um\n`, { wephm: 'y', watm: 'y' }));
const longitude = Number(tag(template, 'OBJECT-OBS-LONGITUDE')), latitude = tag(template, 'OBJECT-OBS-LATITUDE');
// A PSG without its atmosphere package answers with no template; its halo would be empty, not absent.
if (!tag(template, 'ATMOSPHERE-DESCRIPTION') || !Number(tag(template, 'ATMOSPHERE-NGAS')))
  throw new Error(`${body}: PSG returned no atmosphere template for ${psgName}; a local PSG needs its atmospheres package.`);
// The Sun shares the sub-observer latitude; its longitude is searched below.
let base = template;
for (const [key, value] of Object.entries({ 'OBJECT-SOLAR-LATITUDE': latitude ?? 0, 'ATMOSPHERE-NMAX': 8, 'ATMOSPHERE-LMAX': 57, 'GENERATOR-BEAM': 1, 'GENERATOR-BEAM-UNIT': 'km',
  'GENERATOR-RESOLUTION': 100, 'GENERATOR-RESOLUTIONUNIT': 'RP', 'GENERATOR-RADUNITS': 'Wsrm2um', 'GENERATOR-TRANS-APPLY': 'N', 'GEOMETRY-OBS-ALTITUDE': 1000, 'GEOMETRY-ALTITUDE-UNIT': 'km' })) base = set(base, key, value);
const nadirConfig = set(set(set(base, 'GEOMETRY', 'Nadir'), 'GEOMETRY-USER-PARAM', 0), 'OBJECT-SOLAR-LONGITUDE', longitude);
const limbConfig = set(base, 'GEOMETRY', 'Limb');
const nadir = await cached('nadir', async () => bands(await call('rad', nadirConfig), 'nadir'));
// Full phase: the Sun on the tangent point's horizon behind the observer (azimuth 0). The sub-solar longitude that puts
// it there is searched with PSG's own geometry module, since its tangent point need not sit at the sub-observer point.
// PSG's geometry module holds the solar angle fixed for a tangent path below an opaque layer (Venus at 60 km reports 81.2
// degrees for every Sun longitude), so the Sun is placed at the profile's middle altitude.
const geometryAltitude = altitudes[Math.floor(altitudes.length / 2)];
const zenithAt = async (offset: number) => Number(await cached(`zenith:${offset.toFixed(4)}`, async () =>
  tag(await call('cfg', set(set(set(limbConfig, 'GEOMETRY-USER-PARAM', geometryAltitude), 'OBJECT-SOLAR-LONGITUDE', longitude + offset), 'GEOMETRY-AZIMUTH', 0)), 'GEOMETRY-SOLAR-ANGLE') ?? 'NaN'));
let low = 60, high = 120, offset = 90, solarZenith = await zenithAt(offset);
for (let step = 0; step < 16 && !(Math.abs(solarZenith - 90) < 0.1); step++) {
  if (!Number.isFinite(solarZenith)) throw new Error(`${body}: PSG computed no solar angle for a Sun ${offset} degrees east of the tangent point.`);
  if (solarZenith < 90) low = offset; else high = offset;
  offset = (low + high) / 2; solarZenith = await zenithAt(offset);
}
if (!(Math.abs(solarZenith - 90) < 0.1)) throw new Error(`${body}: no Sun longitude between 60 and 120 degrees puts the Sun on the tangent point's horizon (last ${solarZenith} at ${offset}).`);
const flood = set(set(limbConfig, 'OBJECT-SOLAR-LONGITUDE', longitude + offset), 'GEOMETRY-AZIMUTH', 0);
const radiance: Record<Band, number[]> = { red: [], green: [], blue: [] };
const warnings = new Set<string>();
for (const altitude of altitudes) {
  const cell = await cached(`limb:${altitude}`, async () => {
    const spectrum = await call('rad', set(flood, 'GEOMETRY-USER-PARAM', altitude));
    return { ...bands(spectrum, `${body} ${altitude} km`), warnings: spectrum.split('\n').filter(line => /WARNING|ERROR/u.test(line)) };
  });
  for (const band of Object.keys(BANDS) as Band[]) radiance[band].push(cell[band]);
  cell.warnings.forEach(line => warnings.add(line.replace(/^#\s*/u, '')));
  console.log(`${body}: ${altitude} km`);
}
await mkdir(outputDirectory, { recursive: true });
const clock = (config: string) => config.split('\n').filter(line => !/^# .*(Synthesized|took)/u.test(line)).join('\n');
await writeFile(resolve(outputDirectory, 'psg-limb.cfg'), clock(flood));
await writeFile(resolve(outputDirectory, 'psg-nadir.cfg'), clock(nadirConfig));
await writeFile(resolve(outputDirectory, 'psg-limb.json'), JSON.stringify({
  schema: PSG_LIMB_TABLE_SCHEMA, body, psgObject: psgName, radiusKm: Number(tag(template, 'OBJECT-DIAMETER')) / 2,
  atmosphere: tag(template, 'ATMOSPHERE-DESCRIPTION'), units: 'W sr-1 m-2 um-1', bandsMicrometres: BANDS,
  configurations: { limb: 'atmosphere/psg-limb.cfg', nadir: 'atmosphere/psg-nadir.cfg' },
  geometry: { solarZenithDegrees: solarZenith, solarLongitudeOffsetDegrees: offset, atAltitudeKm: geometryAltitude, azimuthDegrees: 0, meaning: 'full phase: the Sun on the tangent point horizon behind the observer' },
  nadirOverheadSun: nadir, altitudesKm: altitudes, radiance, warnings: [...warnings].sort(),
}, null, 1) + '\n');
console.log(`${body}: wrote ${resolve(outputDirectory, 'psg-limb.json')}`);
