/**
 * Build a planet's PSG limb profile (halo.mts) from the NASA GSFC Planetary Spectrum Generator: the planet's own
 * atmosphere template, a 1 km beam on a limb line of sight at each tangent altitude with the Sun behind the observer
 * (azimuth 0), and the nadir radiance under an overhead Sun in the same units. One profile serves every lighting frame.
 *
 *   node tools/photometry/acquire-psg-limb-table.mts --body=mars --psg-name=Mars --altitudes=0,2,5,... --lmax=43 \
 *     [--nmax=8 --window-nm=10 --api=http://localhost:3000/api.php --container=psg]
 *
 * PSG bounds the run in four ways, and every answer is checked against them:
 * - A limb line of sight is computed with single scattering only (PSG handbook, chapter 5, "Limb and tangential
 *   simulations", p. 96: https://psg.gsfc.nasa.gov/images/help/handbook.pdf), so limb calls ask for NMAX 0 and the
 *   phase-function length PSG requests for the body's aerosols (--lmax). Brighter multiply scattered light is not in the
 *   profile.
 * - PUMAS silently falls back to a plane-parallel two-stream solver (NMAX 1, LMAX 2), which ignores the tangent altitude,
 *   when (LMAX + 1) x layers x (aerosols + 3) x spectral points passes 1e9. Each band is therefore split into windows (--window-nm,
 *   default 10 nm) and averaged; an answer whose method line is not the requested one, or that carries a two-stream warning, is refused.
 * - With the Sun on the tangent point's horizon the single-scattering limb path receives no sunlight (the answer is
 *   thermal emission, about 1e-41 at 0.46 um for Mars), so the Sun sits one degree above that horizon, at a solar zenith of
 *   89 degrees, instead of on it. Moving it one degree further changes the limb radiance by 0.1 to 0.4 per cent.
 * - With no aerosols PUMAS sets LMAX to 0, so a Rayleigh-only template (Earth) would scatter isotropically; it is refused.
 *
 * The nadir reference uses the same windows with multiple scattering at --nmax (default 8) and the same LMAX. PSG serves
 * one call at a time: the public service answers "still running" and is retried; a local container is checked for a running
 * PSG module before every call (--container). Answers are kept in output/psg-limb/<body>.jsonl, and a rerun resumes.
 *
 * Writes src/objects/<body>/source/atmosphere/psg-limb.json and the limb and nadir configurations beside it.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PSG_LIMB_TABLE_SCHEMA } from '@cssearth/bake/photometry';

// The public service, or a local PSG container (https://hub.docker.com/r/nasapsg/psg) with --api=http://localhost:3000/api.php.
const API = process.argv.find(value => value.startsWith('--api='))?.slice(6) ?? 'https://psg.gsfc.nasa.gov/api.php';
// PSG refuses curl's and Node's default agents; a browser agent string is accepted.
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const BANDS = { red: [640, 670], green: [530, 560], blue: [440, 490] } as const;
type Band = keyof typeof BANDS;
const SOLAR_ZENITH_DEGREES = 89;
const MODULES = ['atmosphere', 'cem', 'continuum', 'generator', 'geometry', 'globes', 'mass', 'psgnest', 'pumas', 'retrieve'];

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const required = (name: string) => { const value = argument(name); if (!value) throw new TypeError(`--${name}= is required.`); return value; };
const integer = (name: string, fallback?: number) => {
  const raw = argument(name), value = raw === undefined ? fallback : Number(raw);
  if (value === undefined || !Number.isInteger(value) || value < 0) throw new TypeError(`--${name}= must be a non-negative integer, got ${JSON.stringify(raw)}.`);
  return value;
};
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
const run = promisify(execFile);

/**
 * A local container runs every call it receives at once, and parallel calls slow each other. Wait until it holds no call in
 * flight (PSG writes results/api<id>_* while an API call runs and deletes them after) and runs no PSG module, three times a second
 * apart, so the gap between another client's consecutive calls is not taken for idle.
 */
async function waitForIdleContainer(container: string) {
  const probe = `ls /var/www/html/results/ | grep -E '^api' ; for p in /proc/[0-9]*; do tr "\\0" " " < $p/cmdline 2>/dev/null; echo; done`;
  for (let attempt = 0, idle = 0; idle < 3; attempt++) {
    const { stdout } = await run('docker', ['exec', container, 'sh', '-c', probe]);
    const busy = stdout.split('\n').filter(line => /^api/u.test(line) || MODULES.some(module => line.startsWith(`bin/${module} `)));
    idle = busy.length ? 0 : idle + 1;
    if (busy.length && attempt % 60 === 0) console.log(`PSG container ${container} is busy (${busy.join('; ')}); waiting.`);
    if (idle < 3) await sleep(1000);
  }
}

async function call(type: string, config: string, extra: Record<string, string> = {}): Promise<string> {
  const container = argument('container');
  for (let attempt = 0; attempt < 30; attempt++) {
    if (container) await waitForIdleContainer(container);
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
// PSG's runcfg.php does nothing with a configuration whose first character is not '<'; a template can open with warnings.
const configuration = (text: string) => text.split('\n').filter(line => !line.startsWith('#')).join('\n');

/** The sections of a type=all answer: results_rad.txt, results_lyr.txt, results_log.txt, results_cfg.txt and the rest. */
function sections(text: string) {
  const result = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of text.split('\n')) {
    const heading = line.match(/^results_([a-z]+)\.txt$/u);
    if (heading) { current = []; result.set(heading[1], current); } else current?.push(line);
  }
  return result;
}

interface Answer { rows: [number, number][]; warnings: string[]; solarZenith: number; }

/** One window's spectrum, refused unless PSG ran the scattering method asked for, with the Sun where it was put. */
function answer(text: string, where: string, expected: RegExp): Answer {
  const parts = sections(text), log = parts.get('log') ?? [], lyr = parts.get('lyr') ?? [], rad = parts.get('rad') ?? [], cfg = parts.get('cfg') ?? [];
  const warnings = log.map(line => line.trim()).filter(Boolean);
  const errors = warnings.filter(line => /^ERROR/u.test(line));
  if (errors.length) throw new Error(`${where}: PSG answered with errors: ${errors.join(' / ')}`);
  if (warnings.some(line => /2-streams/u.test(line))) throw new Error(`${where}: PSG fell back to its two-stream solver, which ignores the tangent altitude: ${warnings.join(' / ')}. Narrow the windows or lower --lmax.`);
  const method = lyr.find(line => /scattering (radiative transfer )?method/u.test(line));
  if (!method || !expected.test(method)) throw new Error(`${where}: PSG ran ${JSON.stringify(method?.replace(/^#\s*/u, ''))}, expected ${expected}.`);
  // PSG names the streams and phase-function length its aerosols need; a run below either is refused, naming both.
  const requirement = warnings.map(line => line.match(/requires higher scattering requirements, of NMAX:(\d+) and LMAX:(\d+)/u)).find(Boolean);
  if (requirement && (Number(requirement[1]) > nmax || Number(requirement[2]) > lmax))
    throw new Error(`${where}: PSG asks for NMAX ${requirement[1]} and LMAX ${requirement[2]} for these aerosols; rerun with --nmax=${Math.max(nmax, Number(requirement[1]))} --lmax=${Math.max(lmax, Number(requirement[2]))}.`);
  const rows = rad.filter(line => line.trim() && !line.startsWith('#')).map(line => line.trim().split(/\s+/u).slice(0, 2).map(Number) as [number, number]);
  if (!rows.length || rows.some(row => row.some(value => !Number.isFinite(value)))) throw new Error(`${where}: PSG returned no spectrum: ${text.slice(0, 300)}`);
  const solarZenith = Number(tag(cfg.join('\n'), 'GEOMETRY-SOLAR-ANGLE'));
  if (!Number.isFinite(solarZenith)) throw new Error(`${where}: PSG's answer holds no solar angle.`);
  return { rows, warnings, solarZenith };
}

const body = required('body'), psgName = required('psg-name');
const altitudes = required('altitudes').split(',').map(Number);
if (!altitudes.length || altitudes.some((value, index) => !Number.isFinite(value) || (index > 0 && value <= altitudes[index - 1])))
  throw new TypeError(`--altitudes= must be increasing numbers in km, got ${JSON.stringify(argument('altitudes'))}.`);
const lmax = integer('lmax'), nmax = integer('nmax', 8), WINDOW_NM = integer('window-nm', 10);
if (!(WINDOW_NM > 0)) throw new TypeError('--window-nm= must be positive.');
const root = process.cwd(), cachePath = resolve(root, 'output/psg-limb', `${body}.jsonl`), outputDirectory = resolve(root, 'src/objects', body, 'source/atmosphere');
await mkdir(dirname(cachePath), { recursive: true });
const cache = new Map<string, unknown>((await readFile(cachePath, 'utf8').catch(() => '')).split('\n').filter(Boolean).map(line => { const { key, value } = JSON.parse(line); return [key, value]; }));
const cached = async <T,>(key: string, compute: () => Promise<T>): Promise<T> => {
  if (cache.has(key)) return cache.get(key) as T;
  const value = await compute(); cache.set(key, value); await appendFile(cachePath, JSON.stringify({ key, value }) + '\n'); return value;
};

const windows = Object.fromEntries((Object.entries(BANDS) as [Band, readonly [number, number]][]).map(([band, [low, high]]) => {
  const list: [number, number][] = [];
  for (let start = low; start < high; start += WINDOW_NM) list.push([start / 1000, Math.min(high, start + WINDOW_NM) / 1000]);
  return [band, list];
})) as Record<Band, [number, number][]>;

/** The band's mean radiance over every spectral point of its windows, and the answers' warnings and solar angles. */
async function bandRadiance(config: string, key: string, where: string, expected: RegExp) {
  const radiance = {} as Record<Band, number>, warnings = new Set<string>(), zeniths: number[] = [];
  for (const band of Object.keys(BANDS) as Band[]) {
    const values: number[] = [];
    for (const [low, high] of windows[band]) {
      const window = `${low.toFixed(3)}-${high.toFixed(3)}`;
      const result = await cached(`${key}:${window}`, async () => answer(await call('all', set(set(config, 'GENERATOR-RANGE1', low), 'GENERATOR-RANGE2', high)), `${where}, ${window} um`, expected));
      values.push(...result.rows.filter(([wavelength]) => wavelength >= low - 1e-9 && wavelength <= high + 1e-9).map(([, value]) => value));
      result.warnings.forEach(line => warnings.add(line));
      zeniths.push(result.solarZenith);
    }
    if (!values.length || values.some(value => !(value > 0))) throw new Error(`${where}, ${band}: PSG returned no positive radiance.`);
    radiance[band] = values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return { radiance, warnings: [...warnings], solarZenith: zeniths.reduce((sum, value) => sum + value, 0) / zeniths.length };
}

const template = configuration(await cached('template', () => call('cfg', `<OBJECT>Planet\n<OBJECT-NAME>${psgName}\n<OBJECT-DATE>2025/01/01 00:00\n<GEOMETRY>Observatory\n<GENERATOR-RANGE1>0.38\n<GENERATOR-RANGE2>0.70\n<GENERATOR-RANGEUNIT>um\n`, { wephm: 'y', watm: 'y' })));
const longitude = Number(tag(template, 'OBJECT-OBS-LONGITUDE')), latitude = tag(template, 'OBJECT-OBS-LATITUDE');
// A PSG without its atmosphere package answers with no template; its halo would be empty, not absent.
if (!tag(template, 'ATMOSPHERE-DESCRIPTION') || !Number(tag(template, 'ATMOSPHERE-NGAS')))
  throw new Error(`${body}: PSG returned no atmosphere template for ${psgName}; a local PSG needs its atmospheres package.`);
if (!Number(tag(template, 'ATMOSPHERE-NAERO')))
  throw new Error(`${body}: the ${psgName} template has no aerosols. PUMAS then sets LMAX to 0, so its single-scattering limb scatters Rayleigh light isotropically (the same radiance with the Sun behind the observer and beside it); refusing.`);
// The Sun shares the sub-observer latitude; its longitude is searched below. The shape is a sphere: the local container's
// templates name Tethys, whose shape model tilts the nadir normal (Mars: a 4.8 degree solar zenith instead of 1.2).
let base = template;
for (const [key, value] of Object.entries({ 'OBJECT-SHAPE': 'Sphere', 'OBJECT-SOLAR-LATITUDE': latitude ?? 0, 'ATMOSPHERE-LMAX': lmax, 'GENERATOR-BEAM': 1, 'GENERATOR-BEAM-UNIT': 'km',
  // About three output points per window: PSG refuses a window narrower than one resolution element.
  'GENERATOR-RESOLUTION': Math.round(1000 / WINDOW_NM), 'GENERATOR-RESOLUTIONUNIT': 'RP', 'GENERATOR-RADUNITS': 'Wsrm2um', 'GENERATOR-TRANS-APPLY': 'N', 'GEOMETRY-OBS-ALTITUDE': 1000, 'GEOMETRY-ALTITUDE-UNIT': 'km' })) base = set(base, key, value);
const nadirConfig = set(set(set(set(base, 'GEOMETRY', 'Nadir'), 'GEOMETRY-USER-PARAM', 0), 'OBJECT-SOLAR-LONGITUDE', longitude), 'ATMOSPHERE-NMAX', nmax);
const limbConfig = set(set(base, 'GEOMETRY', 'Limb'), 'ATMOSPHERE-NMAX', 0);
const nadir = await bandRadiance(nadirConfig, `nadir:n${nmax}:l${lmax}`, `${body} nadir`, new RegExp(`PSGDORT, NMAX:${nmax} / LMAX:${lmax} /`, 'u'));
// The sub-solar longitude that puts the Sun one degree above the tangent point's horizon, behind the observer (azimuth 0),
// is searched with PSG's own geometry module at the profile's middle altitude.
const geometryAltitude = altitudes[Math.floor(altitudes.length / 2)];
const zenithAt = async (offset: number) => Number(await cached(`zenith:${offset.toFixed(4)}`, async () =>
  tag(await call('cfg', set(set(set(limbConfig, 'GEOMETRY-USER-PARAM', geometryAltitude), 'OBJECT-SOLAR-LONGITUDE', longitude + offset), 'GEOMETRY-AZIMUTH', 0)), 'GEOMETRY-SOLAR-ANGLE') ?? 'NaN'));
let low = 60, high = 120, offset = 90, solarZenith = await zenithAt(offset);
for (let step = 0; step < 20 && !(Math.abs(solarZenith - SOLAR_ZENITH_DEGREES) < 0.05); step++) {
  if (!Number.isFinite(solarZenith)) throw new Error(`${body}: PSG computed no solar angle for a Sun ${offset} degrees east of the tangent point.`);
  if (solarZenith < SOLAR_ZENITH_DEGREES) low = offset; else high = offset;
  offset = (low + high) / 2; solarZenith = await zenithAt(offset);
}
if (!(Math.abs(solarZenith - SOLAR_ZENITH_DEGREES) < 0.05)) throw new Error(`${body}: no Sun longitude between 60 and 120 degrees puts the Sun at a ${SOLAR_ZENITH_DEGREES} degree zenith at the tangent point (last ${solarZenith} at ${offset}).`);
const lit = set(set(limbConfig, 'OBJECT-SOLAR-LONGITUDE', longitude + offset), 'GEOMETRY-AZIMUTH', 0);
const radiance: Record<Band, number[]> = { red: [], green: [], blue: [] };
const warnings = new Set(nadir.warnings), limbZenith: number[] = [];
for (const altitude of altitudes) {
  const cell = await bandRadiance(set(lit, 'GEOMETRY-USER-PARAM', altitude), `limb:${altitude}:l${lmax}:o${offset.toFixed(4)}`, `${body} ${altitude} km`, new RegExp(`Single scattering radiative transfer method, LMAX:${lmax} /`, 'u'));
  if (Math.abs(cell.solarZenith - SOLAR_ZENITH_DEGREES) > 0.1) throw new Error(`${body} ${altitude} km: PSG put the Sun at a ${cell.solarZenith} degree zenith, not ${SOLAR_ZENITH_DEGREES}.`);
  for (const band of Object.keys(BANDS) as Band[]) radiance[band].push(cell.radiance[band]);
  cell.warnings.forEach(line => warnings.add(line));
  limbZenith.push(Math.round(cell.solarZenith * 1000) / 1000);
  console.log(`${body}: ${altitude} km`, Object.fromEntries((Object.keys(BANDS) as Band[]).map(band => [band, +(cell.radiance[band] / nadir.radiance[band]).toPrecision(4)])));
}
await mkdir(outputDirectory, { recursive: true });
const clock = (config: string) => config.split('\n').filter(line => !/^# .*(Synthesized|took)/u.test(line)).join('\n');
await writeFile(resolve(outputDirectory, 'psg-limb.cfg'), clock(lit));
await writeFile(resolve(outputDirectory, 'psg-nadir.cfg'), clock(nadirConfig));
const round = (value: number) => +value.toPrecision(7);
await writeFile(resolve(outputDirectory, 'psg-limb.json'), JSON.stringify({
  schema: PSG_LIMB_TABLE_SCHEMA, body, psgObject: psgName, radiusKm: Number(tag(template, 'OBJECT-DIAMETER')) / 2,
  atmosphere: tag(template, 'ATMOSPHERE-DESCRIPTION'), units: 'W sr-1 m-2 um-1',
  bandsMicrometres: Object.fromEntries(Object.entries(BANDS).map(([band, [from, to]]) => [band, [from / 1000, to / 1000]])),
  windowsMicrometres: windows, meaning: `band radiance: the mean of every spectral point of the band's ${WINDOW_NM} nm windows, each window one PSG call`,
  configurations: { limb: 'atmosphere/psg-limb.cfg', nadir: 'atmosphere/psg-nadir.cfg', note: 'GENERATOR-RANGE1/2 are set per window and GEOMETRY-USER-PARAM per altitude' },
  method: { limb: `single scattering, NMAX 0, LMAX ${lmax}: PSG computes limb paths with single scattering only (handbook p. 96)`, nadir: `PSGDORT multiple scattering, NMAX ${nmax}, LMAX ${lmax}` },
  geometry: { solarZenithDegrees: limbZenith, solarLongitudeOffsetDegrees: round(offset), searchedAtAltitudeKm: geometryAltitude, azimuthDegrees: 0,
    meaning: `the Sun ${90 - SOLAR_ZENITH_DEGREES} degree above the tangent point horizon behind the observer: PSG's single-scattering limb path receives no sunlight with the Sun on the horizon`,
    nadirSolarZenithDegrees: round(nadir.solarZenith) },
  nadirOverheadSun: Object.fromEntries(Object.entries(nadir.radiance).map(([band, value]) => [band, round(value)])),
  altitudesKm: altitudes, radiance: Object.fromEntries(Object.entries(radiance).map(([band, values]) => [band, values.map(round)])),
  warnings: [...warnings].sort(),
}, null, 1) + '\n');
console.log(`${body}: wrote ${resolve(outputDirectory, 'psg-limb.json')}`);
