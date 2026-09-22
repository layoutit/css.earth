/**
 * Which body does a measured sky position belong to?
 *
 * This repository owns none of that science. The candidate positions and their spread come from `whereistheplanet`
 * (Wang et al. 2021), which propagates each planet's published orbit posterior, and the statistics come from SciPy. The
 * work here is the part a catalogue can do: pick the bodies of a system out of the object registry, name the published
 * orbit each one is predicted from, hand the epochs to those tools, and record and draw what comes back.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { BODIES, HOSTED_PLANET_IDS, hostedOrbit, hostedOrbitStateRelativeBmjdTdb, skyBasis, starAstrometry, STAR_IDS, type HostedPlanetId, type StarId } from '@cssearth/astronomy';
import { astroqueryToolchain } from '../astronomy-packages/toolchain.mts';
import { plotNumericPreview, type FigureOptions } from '../astronomy-packages/plots.mts';

const KM_PER_AU = 1.495978707e8;

export type Covariance = readonly [number, number, number];
/** A sky position as offsets from the host star, in mas: east (Δα cos δ) and north (Δδ), with an optional [xx, xy, yy] covariance in mas². */
export interface RelativePosition { readonly id: string; readonly epochMjd: number; readonly eastMas: number; readonly northMas: number; readonly covariance?: Covariance; readonly body?: string }
/** One predicted body, exactly as whereistheplanet reports it: the median of the posterior draws and their standard deviation per axis. */
export interface Candidate { readonly id: string; readonly kind: 'star' | 'planet'; readonly eastMas: number; readonly northMas: number; readonly sigmaEastMas?: number; readonly sigmaNorthMas?: number; readonly predictedFrom?: { readonly tool: string; readonly planet: string; readonly orbit: string } }
/** One orbit drawn per posterior draw, so a bundle shows how well the orbit itself is known. */
export interface OrbitTrack { readonly id: string; readonly points: readonly (readonly [number, number])[] }
export interface CandidateSet { readonly system: string; readonly epochMjd: number; readonly candidates: readonly Candidate[]; readonly tracks: readonly OrbitTrack[]; readonly excluded: readonly { readonly id: string; readonly reason: string }[]; readonly software: Readonly<Record<string, string>> }
/** p, its base-10 logarithm from SciPy's log survival function, and the one-sided normal sigma; each is null where a double cannot hold it. */
export interface CandidateTest { readonly id: string; readonly offsetMas: readonly [number, number]; readonly mahalanobis: number; readonly p: number; readonly log10P: number | null; readonly sigma: number | null }
export interface Association { readonly measurement: RelativePosition; readonly system: string; readonly tests: readonly CandidateTest[]; readonly closest: string }

const finite = (value: number, label: string) => { if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`); return value; };

/** Checks a 2×2 covariance and returns it, or refuses one that is not positive definite. */
export function checkedCovariance(value: readonly number[], label: string): Covariance {
  if (value.length !== 3 || value.some(item => !Number.isFinite(item))) throw new TypeError(`${label} must be three finite numbers.`);
  const [xx, xy, yy] = value as [number, number, number];
  if (!(xx > 0 && yy > 0 && xx * yy - xy * xy > 0)) throw new TypeError(`${label} is not positive definite.`);
  return [xx, xy, yy];
}

/**
 * Reads relative astrometry in the orbitize! CSV layout, which is what direct-imaging astrometry is published and fitted
 * in: `epoch` (MJD), `raoff`, `decoff`, `raoff_err`, `decoff_err` and `radec_corr`, offsets in mas from the host star. An
 * `id` or `object` column names each row. Rows given only as separation and position angle are refused, not converted.
 */
export function readRelativeAstrometryCsv(text: string): RelativePosition[] {
  const lines = text.split(/\r?\n/u).filter(line => line.trim() && !line.trimStart().startsWith('#'));
  const head = lines.shift()?.split(',').map(name => name.trim().toLowerCase());
  if (!head || !lines.length) throw new TypeError('Relative astrometry needs a header and at least one row.');
  const column = (name: string) => head.indexOf(name);
  for (const name of ['epoch', 'raoff', 'decoff']) if (column(name) < 0) throw new TypeError(`Relative astrometry needs a ${name} column.`);
  const ids = new Set<string>();
  return lines.map((line, index) => {
    const cells = line.split(',').map(cell => cell.trim());
    if (cells.length !== head.length) throw new TypeError(`Relative astrometry row ${index + 1} has ${cells.length} fields for ${head.length} columns.`);
    const cell = (name: string) => column(name) < 0 ? '' : cells[column(name)]!;
    const number = (name: string) => { const text = cell(name); if (text === '' || text.toLowerCase() === 'nan') return undefined; const value = Number(text); if (!Number.isFinite(value)) throw new TypeError(`Relative astrometry row ${index + 1} ${name} is not a number.`); return value; };
    const east = number('raoff'), north = number('decoff'), epoch = number('epoch');
    if (east === undefined || north === undefined || epoch === undefined) throw new TypeError(`Relative astrometry row ${index + 1} needs epoch, raoff and decoff; separation and position angle are not converted.`);
    const id = cell('id') || (cell('object') ? `${cell('object')}@${epoch}` : `row-${index + 1}`);
    if (ids.has(id)) throw new TypeError(`Relative astrometry repeats row ${id}.`); ids.add(id);
    const sx = number('raoff_err'), sy = number('decoff_err'), rho = number('radec_corr') ?? 0;
    if ((sx === undefined) !== (sy === undefined)) throw new TypeError(`Relative astrometry row ${index + 1} states only one offset error.`);
    if (rho < -1 || rho > 1) throw new TypeError(`Relative astrometry row ${index + 1} correlation is outside [-1, 1].`);
    return { id, epochMjd: epoch, eastMas: east, northMas: north, ...(sx === undefined ? {} : { covariance: checkedCovariance([sx * sx, rho * sx * sy!, sy! * sy!], `Row ${id} covariance`) }) };
  });
}

/** The hosted planets of one star, from the object registry. */
export function hostedPlanetsOf(system: string): HostedPlanetId[] {
  if (!(STAR_IDS as readonly string[]).includes(system)) throw new TypeError(`${system} is not a star in the object registry.`);
  const planets = HOSTED_PLANET_IDS.filter(id => BODIES[id].parent === system);
  if (!planets.length) throw new TypeError(`${system} has no hosted planets in the object registry.`);
  return planets;
}

/**
 * The bridge to the owners. whereistheplanet predicts each planet from its published posterior; SciPy measures how far the
 * measurement sits from each candidate (Mahalanobis distance), the chi-square tail of that distance in two dimensions, and
 * the one-sided normal σ with the same tail. Nothing here re-derives any of it.
 */
const BRIDGE = String.raw`
import contextlib,io,json,sys
from importlib.metadata import version
import numpy as np
from scipy.spatial.distance import mahalanobis
from scipy.stats import chi2,norm
import math
import os
import h5py
from orbitize import kepler
import whereistheplanet.whereistheplanet as wtp

request=json.load(sys.stdin)
software={name:version(name) for name in ('whereistheplanet','orbitize','scipy','numpy')}
def chains(planet):
 post,tau=wtp.get_chains(planet); post=np.asarray(post,dtype=float)
 index,total=wtp.multi_dict[planet] if planet in wtp.multi_dict else (0,1)
 start=6*index; sma,ecc,inc,aop,pan,tau_frac=[post[:,start+k] for k in range(6)]
 plx=post[:,6*total]
 if planet in wtp.multi_dict:
  masses=post[:,-1-total:-1]; mstar=post[:,-1]
  inside=np.where(post[0,0:6*total:6]<=post[0,start])[0]
  mtot=mstar+np.sum(masses[:,inside],axis=1)
 else: mtot=post[:,7]
 return dict(sma=sma,ecc=ecc,inc=inc,aop=aop,pan=pan,tau=tau_frac,plx=plx,mtot=mtot,tauRef=tau)
def tracks(planet,mjd,draws,steps):
 # orbitize owns the propagation; we only choose which draws and which times.
 c=chains(planet); count=min(draws,len(c['sma'])); out=[]
 for i in range(count):
  period=np.sqrt(c['sma'][i]**3/c['mtot'][i])*365.25
  times=mjd+np.linspace(0,period,steps)
  ra,dec,_=kepler.calc_orbit(times,c['sma'][i],c['ecc'][i],c['inc'][i],c['aop'][i],c['pan'][i],c['tau'][i],c['plx'][i],c['mtot'][i],tau_ref_epoch=c['tauRef'])
  out.append([[float(a),float(b)] for a,b in zip(np.ravel(ra),np.ravel(dec))])
 return out
def fit_astrometry(planet):
 # The astrometry the published fit was made from, as the tool distributes it beside its draws.
 name,_=wtp.post_dict[planet]; index,_=wtp.multi_dict[planet] if planet in wtp.multi_dict else (0,1)
 with h5py.File(os.path.join(wtp.datadir,name),'r') as f:
  if 'data' not in f: return []
  rows=f['data'][()]
 kept=[]
 for row in rows:
  if int(row['object'])!=index+1 or row['quant_type'].decode()!='radec': continue
  kept.append({'epochMjd':float(row['epoch']),'eastMas':float(row['quant1']),'northMas':float(row['quant2']),
   'sigmaEastMas':float(row['quant1_err']),'sigmaNorthMas':float(row['quant2_err']),
   'correlation':(0.0 if not np.isfinite(row['quant12_corr']) else float(row['quant12_corr'])),'instrument':row['instrument'].decode()})
 return kept
def predict(planet,mjd):
 with contextlib.redirect_stdout(io.StringIO()):
  ra,dec,sep,pa=wtp.predict_planet(planet,time_mjd=mjd,num_samples=None)
 return {'eastMas':float(ra[0]),'northMas':float(dec[0]),'sigmaEastMas':float(ra[1]),'sigmaNorthMas':float(dec[1]),'orbit':wtp.get_reference(planet)}
out=[]
for item in request['epochs']:
 predicted={body['id']:predict(body['planet'],item['epochMjd']) for body in request['bodies']}
 tests=[]
 measurement=item.get('measurement')
 if measurement is not None:
  m=np.array(measurement['covariance'],dtype=float); C0=np.array([[m[0],m[1]],[m[1],m[2]]])
  for identity,p in [(request['star'],{'eastMas':0.,'northMas':0.,'sigmaEastMas':0.,'sigmaNorthMas':0.})]+[(k,v) for k,v in predicted.items()]:
   C=C0+np.diag([p['sigmaEastMas']**2,p['sigmaNorthMas']**2])
   d=np.array([measurement['eastMas']-p['eastMas'],measurement['northMas']-p['northMas']])
   R=float(mahalanobis(d,np.zeros(2),np.linalg.inv(C)))
   keep=lambda v: float(v) if math.isfinite(v) else None
   tail=float(chi2.sf(R*R,2)); log10p=keep(float(chi2.logsf(R*R,2))/math.log(10))
   sigma=keep(float(norm.isf(tail))) if tail>0 else None
   tests.append({'id':identity,'offsetMas':[float(d[0]),float(d[1])],'mahalanobis':R,'p':tail,'log10P':log10p,'sigma':None if sigma is None else max(sigma,0.0)})
 out.append({'epochMjd':item['epochMjd'],'predicted':predicted,'tests':tests})
extra={}
if request.get('tracks'):
 extra['tracks']={body['id']:tracks(body['planet'],request['epochs'][0]['epochMjd'],int(request['tracks']['draws']),int(request['tracks']['steps'])) for body in request['bodies']}
if request.get('fitAstrometry'):
 extra['fitAstrometry']={body['id']:fit_astrometry(body['planet']) for body in request['bodies']}
json.dump({'software':software,'epochs':out,**extra},sys.stdout)
`;

interface BridgeResult {
  software: Record<string, string>;
  epochs: { epochMjd: number; predicted: Record<string, { eastMas: number; northMas: number; sigmaEastMas: number; sigmaNorthMas: number; orbit: string }>; tests: CandidateTest[] }[];
  tracks?: Record<string, [number, number][][]>;
  fitAstrometry?: Record<string, { epochMjd: number; eastMas: number; northMas: number; sigmaEastMas: number; sigmaNorthMas: number; correlation: number; instrument: string }[]>;
}
async function bridge(request: unknown): Promise<BridgeResult> {
  const toolchain = await astroqueryToolchain();
  const text = await new Promise<string>((accept, reject) => {
    const child = spawn(toolchain.python, ['-c', BRIDGE], { env: { ...process.env, ...toolchain.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', error = ''; child.stdout.setEncoding('utf8').on('data', chunk => { out += chunk; }); child.stderr.setEncoding('utf8').on('data', chunk => { error += chunk; });
    child.on('error', reject); child.on('close', code => code === 0 ? accept(out) : reject(new Error(`whereistheplanet bridge failed: ${error.slice(-1500)}`)));
    child.stdin.end(JSON.stringify(request));
  });
  return JSON.parse(text) as BridgeResult;
}

/**
 * Each planet's key in whereistheplanet, from its own orbit record. A body whose record names no published prediction is
 * left out and reported: the registry may hold a display orbit for it, which is not something to test a measurement against.
 */
function predictionKeys(planets: readonly HostedPlanetId[]) {
  const predicted = [], excluded = [];
  for (const id of planets) {
    const prediction = hostedOrbit(id).prediction;
    if (prediction) predicted.push({ id: id as string, planet: prediction.planet, tool: prediction.tool });
    else excluded.push({ id: id as string, reason: 'its orbit record names no published orbit prediction' });
  }
  if (!predicted.length) throw new TypeError('No planet of this star names a published orbit prediction.');
  return { predicted, excluded };
}

/** The orbit the site draws for this planet from its own record, one line, for systems whose prediction tool holds no draws. */
function displayTrack(id: HostedPlanetId, system: string, epochMjd: number, count = 360): (readonly [number, number])[] {
  const orbit = hostedOrbit(id), star = starAstrometry(system as StarId), stellarRadiusKm = BODIES[system as keyof typeof BODIES].meanRadiusKm;
  const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees), scale = 1000 / star.distanceParsecs / KM_PER_AU;
  return Array.from({ length: count + 1 }, (_, index) => {
    const p = hostedOrbitStateRelativeBmjdTdb(orbit, star, stellarRadiusKm, epochMjd + orbit.periodDays * index / count).positionKm;
    return [(p[0] * east[0] + p[1] * east[1] + p[2] * east[2]) * scale, (p[0] * north[0] + p[1] * north[1] + p[2] * north[2]) * scale] as const;
  });
}

/** Orbit draws from the prediction tool's own posterior, or the record's single display orbit when it returns none. */
function orbitTracks(result: BridgeResult, bodies: readonly { id: string }[], system: string, epochMjd: number): OrbitTrack[] {
  return bodies.flatMap(body => {
    const drawn = result.tracks?.[body.id];
    return drawn?.length ? drawn.map(points => ({ id: body.id, points })) : [{ id: body.id, points: displayTrack(body.id as HostedPlanetId, system, epochMjd) }];
  });
}

/** Every hosted planet of a star at one epoch, predicted by whereistheplanet from its published orbit posterior. */
export async function candidatesAtEpoch(system: string, epochMjd: number, options: { readonly orbitDraws?: number } = {}): Promise<CandidateSet> {
  finite(epochMjd, 'Epoch');
  const planets = hostedPlanetsOf(system), { predicted: bodies, excluded } = predictionKeys(planets);
  const result = await bridge({ star: system, bodies, epochs: [{ epochMjd }], tracks: { draws: options.orbitDraws ?? 1, steps: 361 } }), epoch = result.epochs[0]!;
  const candidates: Candidate[] = [{ id: system, kind: 'star', eastMas: 0, northMas: 0 }];
  for (const body of bodies) {
    const p = epoch.predicted[body.id]!;
    candidates.push({ id: body.id, kind: 'planet', eastMas: p.eastMas, northMas: p.northMas, sigmaEastMas: p.sigmaEastMas, sigmaNorthMas: p.sigmaNorthMas, predictedFrom: { tool: body.tool, planet: body.planet, orbit: p.orbit } });
  }
  return { system, epochMjd, candidates, tracks: orbitTracks(result, bodies, system, epochMjd), excluded, software: result.software };
}

/** Each measured row against the candidates at its own epoch. */
export async function associate(measurements: readonly RelativePosition[], system: string, options: { readonly orbitDraws?: number; readonly fitAstrometry?: boolean } = {}): Promise<{ sets: CandidateSet[]; associations: Association[]; software: Record<string, string>; fitAstrometry: RelativePosition[] }> {
  for (const measurement of measurements) if (!measurement.covariance) throw new TypeError(`Measurement ${measurement.id} states no position covariance; an association needs one.`);
  const planets = hostedPlanetsOf(system), { predicted: bodies, excluded } = predictionKeys(planets);
  const result = await bridge({ star: system, bodies, epochs: measurements.map(measurement => ({ epochMjd: measurement.epochMjd, measurement: { eastMas: measurement.eastMas, northMas: measurement.northMas, covariance: measurement.covariance } })), tracks: { draws: options.orbitDraws ?? 1, steps: 361 }, ...(options.fitAstrometry ? { fitAstrometry: true } : {}) });
  const sets: CandidateSet[] = [], associations: Association[] = [];
  result.epochs.forEach((epoch, index) => {
    const measurement = measurements[index]!;
    const candidates: Candidate[] = [{ id: system, kind: 'star', eastMas: 0, northMas: 0 }];
    for (const body of bodies) { const p = epoch.predicted[body.id]!; candidates.push({ id: body.id, kind: 'planet', eastMas: p.eastMas, northMas: p.northMas, sigmaEastMas: p.sigmaEastMas, sigmaNorthMas: p.sigmaNorthMas, predictedFrom: { tool: body.tool, planet: body.planet, orbit: p.orbit } }); }
    sets.push({ system, epochMjd: measurement.epochMjd, candidates, tracks: orbitTracks(result, bodies, system, measurement.epochMjd), excluded, software: result.software });
    const closest = [...epoch.tests].sort((a, b) => a.mahalanobis - b.mahalanobis)[0]!.id;
    associations.push({ measurement, system, tests: epoch.tests, closest });
  });
  const fitAstrometry: RelativePosition[] = Object.entries(result.fitAstrometry ?? {}).flatMap(([id, rows]) => rows.map(row => ({
    id: `${id}@${row.epochMjd.toFixed(3)}`, body: id, epochMjd: row.epochMjd, eastMas: row.eastMas, northMas: row.northMas,
    covariance: checkedCovariance([row.sigmaEastMas ** 2, row.correlation * row.sigmaEastMas * row.sigmaNorthMas, row.sigmaNorthMas ** 2], `${id} ${row.instrument} covariance`),
  })));
  return { sets, associations, software: result.software, fitAstrometry };
}

const mark = (system: string, id: string) => id.replace(`${system}-`, '');
const covarianceOf = (candidate: Candidate): Covariance | undefined => candidate.sigmaEastMas && candidate.sigmaNorthMas ? [candidate.sigmaEastMas ** 2, 0, candidate.sigmaNorthMas ** 2] : undefined;

/**
 * The chart astrometry papers print: the star at the origin, each candidate as a disc carrying its letter with its
 * prediction ellipses, a measurement with its 1σ, 2σ and 3σ ellipses, orbits behind them and east to the left. The frame
 * holds the candidates within twice the measurement's separation from the star; others are named as outside it.
 */
export async function previewAssociation(directory: string, association: Association, set: CandidateSet, options: FigureOptions = {}) {
  const m = association.measurement, reach = 2 * Math.hypot(m.eastMas, m.northMas);
  const planets = set.candidates.filter(candidate => candidate.kind === 'planet');
  const inside = planets.filter(candidate => Math.hypot(candidate.eastMas, candidate.northMas) <= reach), outside = planets.filter(candidate => !inside.includes(candidate));
  const closest = association.tests.find(test => test.id === association.closest)!;
  return plotNumericPreview(directory, {
    kind: 'scatter-ellipses', layout: 'publication',
    title: `${association.system} · ${m.id} · closest ${association.closest} (R ${closest.mahalanobis.toFixed(2)})${outside.length ? `, outside the frame: ${outside.map(candidate => candidate.id).join(', ')}` : ''}`,
    xLabel: 'Δα cos δ from star (mas)', yLabel: 'Δδ from star (mas)', invertX: true, sigmaLevels: [1, 2, 3], origin: { label: set.system },
    points: [
      ...inside.map(candidate => ({ x: candidate.eastMas, y: candidate.northMas, label: candidate.id, mark: mark(set.system, candidate.id), series: candidate.id, role: 'candidate' as const, ...(covarianceOf(candidate) ? { covariance: covarianceOf(candidate)! } : {}) })),
      { x: m.eastMas, y: m.northMas, label: m.id, role: 'measurement' as const, series: association.closest, covariance: m.covariance! },
    ],
    tracks: set.tracks.filter(track => inside.some(candidate => candidate.id === track.id)).map(track => ({ label: track.id, series: track.id, points: track.points })),
  }, options);
}

/**
 * Every measurement of a system in one chart, each drawn in the colour of the body it is closest to, over the predicted
 * positions and the orbit draws. This is the figure a system paper prints: the whole system at once.
 */
export async function previewSystem(directory: string, system: string, set: CandidateSet, associations: readonly Association[], options: FigureOptions = {}) {
  return plotNumericPreview(directory, {
    kind: 'scatter-ellipses', layout: 'publication', title: '', xLabel: 'Δα cos δ from star (mas)', yLabel: 'Δδ from star (mas)',
    invertX: true, sigmaLevels: [1, 2, 3], origin: { label: system }, measurementLabel: 'measured, with 1–3σ ellipses',
    points: [
      ...set.candidates.filter(candidate => candidate.kind === 'planet').map(candidate => ({ x: candidate.eastMas, y: candidate.northMas, label: candidate.id, mark: mark(system, candidate.id), series: candidate.id, role: 'candidate' as const, ...(covarianceOf(candidate) ? { covariance: covarianceOf(candidate)! } : {}) })),
      ...associations.map(association => ({ x: association.measurement.eastMas, y: association.measurement.northMas, label: association.measurement.id, role: 'measurement' as const, ...(association.closest === system ? {} : { series: association.closest }), covariance: association.measurement.covariance! })),
    ],
    tracks: set.tracks.map(track => ({ label: track.id, series: track.id, points: track.points })),
  }, options);
}

/** An epoch given as MJD or as an ISO UTC date or date-time. */
export function epochMjd(value: string): number {
  if (/^-?\d+(\.\d+)?$/u.test(value.trim())) return finite(Number(value), 'MJD');
  const ms = Date.parse(/[zZ]|[+-]\d\d:\d\d$/u.test(value) || !value.includes('T') ? value : `${value}Z`);
  if (!Number.isFinite(ms)) throw new TypeError(`Epoch ${value} is neither an MJD nor an ISO date.`);
  return ms / 86400000 + 40587;
}

const refuseExisting = async (directory: string) => { if (await stat(directory).then(() => true, () => false)) throw new Error(`Output directory already exists: ${directory}.`); };
const safeName = (id: string) => id.replace(/[^A-Za-z0-9._-]+/gu, '-');
async function writeJson(path: string, value: unknown) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`); }

const LIMITS = [
  'Relative astrometry only: offsets in mas from the host star. Absolute sky positions are not converted.',
  'whereistheplanet reports a median and a standard deviation per axis, so a candidate ellipse has no correlation between its axes.',
  'A body whose orbit record names no published orbit prediction is left out of the candidates and listed as excluded.',
  'Epochs are used as given, in MJD; the tool reads them as UT.',
  'The orbits drawn behind the points are the site display model of the same published orbit, not the posterior.',
];

/** `telescope candidates`: a star's planets at one epoch, as data and a chart. */
export async function runCandidates(system: string, epoch: number, directory: string, options: FigureOptions & { readonly orbitDraws?: number } = {}) {
  await refuseExisting(directory);
  const set = await candidatesAtEpoch(system, epoch, { orbitDraws: options.orbitDraws ?? 1 });
  await writeJson(resolve(directory, 'candidates.json'), { schema: 'cssearth-sky-candidates@1', ...set, limits: LIMITS });
  await plotNumericPreview(directory, { kind: 'scatter-ellipses', layout: 'publication', title: '', xLabel: 'Δα cos δ from star (mas)', yLabel: 'Δδ from star (mas)', invertX: true, sigmaLevels: [1, 2, 3], origin: { label: system },
    points: set.candidates.filter(candidate => candidate.kind === 'planet').map(candidate => ({ x: candidate.eastMas, y: candidate.northMas, label: candidate.id, mark: mark(system, candidate.id), series: candidate.id, role: 'candidate' as const, ...(covarianceOf(candidate) ? { covariance: covarianceOf(candidate)! } : {}) })),
    tracks: set.tracks.map(track => ({ label: track.id, series: track.id, points: track.points })) }, options);
  return { directory, set };
}

/** `telescope associate`: measured rows against the candidates at each row's epoch, with one chart per row. */
export async function runAssociation(measurementsPath: string, system: string, directory: string, options: FigureOptions & { readonly orbitDraws?: number; readonly fitAstrometry?: boolean } = {}) {
  await refuseExisting(directory);
  const read = readRelativeAstrometryCsv(await readFile(measurementsPath, 'utf8'));
  const first = await associate(read, system, { orbitDraws: options.orbitDraws ?? 1, fitAstrometry: options.fitAstrometry ?? false });
  const measurements = options.fitAstrometry ? [...first.fitAstrometry, ...read] : read;
  const { sets, associations, software } = options.fitAstrometry ? await associate(measurements, system, { orbitDraws: options.orbitDraws ?? 1 }) : first;
  const rows = [];
  for (const [index, association] of associations.entries()) {
    const folder = safeName(association.measurement.id);
    await previewAssociation(resolve(directory, folder), association, sets[index]!, options);
    rows.push({ association, candidates: sets[index]!.candidates, chart: `${folder}/preview.png` });
  }
  // The system chart shows the predictions for the newest epoch it holds; older rows are the track of how the bodies got there.
  const newest = associations.reduce((latest, association, index) => association.measurement.epochMjd > associations[latest]!.measurement.epochMjd ? index : latest, 0);
  await previewSystem(resolve(directory, 'system'), system, sets[newest]!, associations, options);
  await writeJson(resolve(directory, 'association.json'), {
    chart: 'system/preview.png',
    schema: 'cssearth-sky-association@1', system, measurements: resolve(measurementsPath),
    method: 'Candidate positions and their per-axis spread come from whereistheplanet, which propagates each planet published orbit posterior. SciPy measures the Mahalanobis distance R between the measurement and each candidate under their summed covariance, the chi-square tail p of R in two dimensions, and the one-sided normal sigma with the same tail.',
    limits: [...LIMITS, 'The system chart draws the predicted positions at the newest epoch it holds; every measurement is coloured by the body it is closest to, and a measurement closest to the star is left uncoloured.'], software, rows });
  return { directory, rows, software };
}
