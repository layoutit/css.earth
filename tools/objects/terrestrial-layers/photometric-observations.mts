import type { BandRatioPolicy, ObservationGeometry,PhotometryProfile,BandLevelPolicy,ObservedColorContext,ColorBand,RgbObservation} from './contracts.mts';
import {shape,text,array as sourceArray,number} from './source-records.mts';
import {requireRecord} from '../../sources/source-values.mts';
import { diskGain as diskFunctionGain } from '../../photometry/disk.mts';
import { bandColorDisplay, bandColorEvidence, srgbToLinear } from '../color-transfer.mts';
const numberArray=sourceArray(number);
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const radians=Math.PI/180;

/** Controlled ISIS labels plus pinned observer/Sun vectors, interpreted only during preparation. */
export async function loadControlledObservationGeometry({sourceDirectory,entries,vectors:paths}: {sourceDirectory:string;entries:readonly {path:string;id:string;imageId:string}[];vectors:Record<"sun"|"observer",string>}) {
 const vectors=await readObservationVectors(sourceDirectory,paths);
 const geometry=new Map<string,ObservationGeometry>();
 for(const entry of entries){
  const label=await readFile(resolve(sourceDirectory,entry.path),'utf8'),et=Number(label.match(/CkTableStartTime\s*=\s*([^\s]+)/)?.[1]),frame=controlledBodyFrame(label,et);
  const transform=(name: "sun"|"observer")=>{const sample=vectors[name].find(row=>Math.abs(row.et-et)<.001);if(!sample||!sample.position.every(Number.isFinite))throw new Error('Missing controlled observation geometry: '+entry.id);return frame.map(axis=>axis.reduce((sum,value,i)=>sum+value*sample.position[i],0))};
  geometry.set(entry.imageId,{sun:transform('sun'),observer:transform('observer')});
 }
 return geometry;
}

export async function readObservationVectors(sourceDirectory: string,paths: Record<"sun"|"observer",string>) {
 const vectors: Record<"sun"|"observer",{et:number;position:number[]}[]>={sun:[],observer:[]};
 for(const name of ['sun','observer'] as const){
  const {response}=shape({response:shape({result:text})})(JSON.parse(await readFile(resolve(sourceDirectory,paths[name]),'utf8')));
  vectors[name]=response.result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map(line=>{const[jd,,...position]=line.split(',');const sample={et:(Number(jd)-2451545)*86400,position:position.slice(0,3).map(Number)};if(!Number.isFinite(sample.et)||sample.position.length!==3||!sample.position.every(Number.isFinite))throw new Error('Invalid controlled observation vector');return sample});
 }
 return vectors;
}

export function controlledBodyFrame(label: unknown, et: number) {
  const array = (key: string): number[] => typeof label === 'object' ? numberArray(requireRecord(label)[key]) : text(label).match(new RegExp(`\\b${key}\\s*=\\s*\\(([^)]+)\\)`))?.[1].split(",").map(Number) ?? (()=>{throw new Error("Missing controlled body frame coefficient: "+key)})();
  const centuries = et / (86400 * 36525), days = et / 86400;
  const rates = array("SysNutPrec1");
  const arguments_ = array("SysNutPrec0").map((value, i) => (value + rates[i] * centuries) * radians);
  const angle = (key: string, periodic: string, fn: (value:number)=>number, time: number) => (array(key).reduce((sum, value, i) => sum + value * time ** i, 0) +
    array(periodic).reduce((sum, value, i) => sum + value * fn(arguments_[i]), 0)) * radians;
  const ra = angle("PoleRa", "PoleRaNutPrec", Math.sin, centuries);
  const dec = angle("PoleDec", "PoleDecNutPrec", Math.cos, centuries);
  const w = angle("PrimeMeridian", "PmNutPrec", Math.sin, days);
  const x = [-Math.sin(ra), Math.cos(ra), 0];
  const y = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  return [
    x.map((value, i) => Math.cos(w) * value + Math.sin(w) * y[i]),
    x.map((value, i) => -Math.sin(w) * value + Math.cos(w) * y[i]),
    [Math.cos(ra) * Math.cos(dec), Math.sin(ra) * Math.cos(dec), Math.sin(dec)],
  ];
}


export function colorPhotometricGain(normal: readonly number[], geometry: ObservationGeometry, weight: number, profile: Omit<PhotometryProfile,"observationWeights">) {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error("Missing or invalid observation disk weight");
  const cosine = (position: readonly number[]) => {
    const v = position.map((value, i) => value - profile.radiusKm * normal[i]);
    return normal.reduce((sum, value, i) => sum + value * v[i], 0) / Math.hypot(...v);
  };
  const mu0 = cosine(geometry.sun), mu = cosine(geometry.observer);
  if (!Number.isFinite(mu0) || !Number.isFinite(mu) ||
      mu0 < Math.cos(profile.maximumIncidenceDegrees * radians) ||
      mu < Math.cos(profile.maximumEmissionDegrees * radians)) return null;
  // ISIS Lunar-Lambert: weight 0 is Lambert, weight 1 is Lommel-Seeliger.
  return diskFunctionGain({ family: 'lunar-lambert', weight }, { mu0, mu, phase: 0 },
    { mu0: Math.cos(profile.referenceIncidenceDegrees * radians), mu: Math.cos(profile.referenceEmissionDegrees * radians), phase: 0 });
}


type CorrectedSample = Float32Array | 'withheld' | null;
/** One observation's complete, geometry-corrected colour at a map cell: null where a channel has no sample, withheld where the view or the Sun is too steep. */
function correctedSampler(bands: readonly ColorBand[], filters: readonly string[], weight: number, profile: PhotometryProfile, referenceRadiusMeters: number, centerLongitude: number,
  sampleColorBand: (band: ColorBand, easting: number, northing: number) => number | null) {
  const channels = filters.map(filter => bands.filter(band => band.filter === filter));
  return (x: number, y: number, width: number, height: number): CorrectedSample => {
    const latitude = (90 - (y + 0.5) * 180 / height) * Math.PI / 180, northing = latitude * referenceRadiusMeters;
    const easting = ((x + 0.5) * 360 / width - centerLongitude) * Math.PI / 180 * referenceRadiusMeters;
    const samples = channels.map(channel => {
      for (const band of channel) {
        const value = sampleColorBand(band, easting, northing);
        // A non-positive I/F is sky or a frame border, never ground.
        if (value !== null && value > 0) return { value, band };
      }
      return null;
    });
    if (!samples.every((sample): sample is {value:number;band:ColorBand} => sample !== null)) return null;
    const longitude = (x + 0.5) * 2 * Math.PI / width;
    const normal = [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
    const gains = samples.map(({ band }) => {if(!band.capture)throw new Error("Missing observation capture geometry");return colorPhotometricGain(normal, band.capture, weight, profile);});
    if (!gains.every((gain): gain is number => gain !== null)) return 'withheld';
    return Float32Array.from(samples, (sample, c) => sample.value * gains[c]!);
  };
}

/**
 * Per-band gains that carry every observation onto the reference observation's calibration. Where two corrected footprints
 * overlap, the median ratio of their values in each band is one measurement; the log gains solve the weighted least squares
 * over all pairs with enough overlap, so an observation that never meets the reference is tied to it through the ones between.
 */
export function solveBandLevels(samplers: readonly { observation: string; sample: (x: number, y: number, width: number, height: number) => CorrectedSample }[],
  filters: readonly string[], policy: BandLevelPolicy) {
  const reference = samplers.findIndex(({ observation }) => observation === policy.reference);
  if (reference < 0) throw new Error(`Band level reference is not an observation: ${policy.reference}`);
  const width = Math.round(360 / policy.cellDegrees), height = Math.round(180 / policy.cellDegrees);
  const grids = samplers.map(({ sample }) => {
    const values = new Float32Array(width * height * filters.length).fill(NaN);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const cell = sample(x, y, width, height);
      if (cell instanceof Float32Array) values.set(cell, (y * width + x) * filters.length);
    }
    return values;
  });
  const pairs: { a: string; b: string; overlapPixels: number; medianRatios: number[] }[] = [];
  const equations: { a: number; b: number; weight: number; logRatios: number[] }[] = [];
  for (let a = 0; a < grids.length; a++) for (let b = a + 1; b < grids.length; b++) {
    const ratios = filters.map((): number[] => []);
    for (let i = 0; i < width * height; i++) {
      const ia = i * filters.length, va = grids[a]![ia]!, vb = grids[b]![ia]!;
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      for (let c = 0; c < filters.length; c++) { const p = grids[a]![ia + c]!, q = grids[b]![ia + c]!; if (p > 0 && q > 0) ratios[c]!.push(q / p); }
    }
    const overlapPixels = Math.min(...ratios.map(list => list.length));
    if (overlapPixels < policy.minimumOverlapPixels) continue;
    const medianRatios = ratios.map(list => { list.sort((p, q) => p - q); return list[list.length >> 1]!; });
    pairs.push({ a: samplers[a]!.observation, b: samplers[b]!.observation, overlapPixels, medianRatios });
    equations.push({ a, b, weight: overlapPixels, logRatios: medianRatios.map(Math.log) });
  }
  // Unknown u_k = log gain of observation k, u_reference = 0; each pair says u_b - u_a = -log(b / a).
  const free = samplers.map((_, k) => k).filter(k => k !== reference), column = new Map(free.map((k, i) => [k, i]));
  const gains = samplers.map(() => filters.map(() => 1));
  for (let c = 0; c < filters.length; c++) {
    const n = free.length, normal = Array.from({ length: n }, () => new Array<number>(n).fill(0)), rhs = new Array<number>(n).fill(0);
    for (const { a, b, weight, logRatios } of equations) {
      const ia = column.get(a), ib = column.get(b), target = -logRatios[c]!;
      // Row of the design matrix: +1 at b, -1 at a; accumulate weight * rowᵀ row and weight * rowᵀ target.
      const entries = [[ib, 1], [ia, -1]].filter((entry): entry is [number, number] => entry[0] !== undefined);
      for (const [i, s] of entries) { rhs[i] += weight * s * target; for (const [j, t] of entries) normal[i]![j] += weight * s * t; }
    }
    const solution = solveLinear(normal, rhs);
    for (const [k, i] of column) {
      if (!Number.isFinite(solution[i]!)) throw new Error(`Band levels cannot reach observation ${samplers[k]!.observation} from ${policy.reference}: no overlapping footprint chain.`);
      gains[k]![c] = Math.exp(solution[i]!);
    }
  }
  return { reference: policy.reference, cellDegrees: policy.cellDegrees, minimumOverlapPixels: policy.minimumOverlapPixels, pairs,
    gains: Object.fromEntries(samplers.map(({ observation }, k) => [observation, gains[k]!.map(gain => +gain.toFixed(6))])) };
}

/** Gaussian elimination with partial pivoting; NaN where the system leaves an unknown unconstrained. */
function solveLinear(matrix: number[][], rhs: number[]) {
  const n = rhs.length, a = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    if (Math.abs(a[col]![col]!) < 1e-12) continue;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row]![col]! / a[col]![col]!;
      for (let k = col; k <= n; k++) a[row]![k]! -= factor * a[col]![k]!;
    }
  }
  return a.map((row, i) => Math.abs(row[i]!) < 1e-12 ? NaN : row[n]! / row[i]!);
}

/** Correct each complete color footprint before exposure matching; a withheld footprint falls back to the base unless the profile lets the next observation own it. */
export function composeCorrectedColor({groups,profile,width,height,sourceIds,photometryProfile,sampleColorBand}: ObservedColorContext & {photometryProfile:PhotometryProfile;sampleColorBand:(band:ColorBand,easting:number,northing:number)=>number|null}) {
 // Level matching carries corrected I/F into the monochrome base's display-linear light, where I/F 1 is white.
 const display=bandColorDisplay(profile.filters,'radiance-factor',[0,1]);
 const photometry={...photometryProfile,observations:{} as Record<string,{correctedPixels:number;withheldPixels:number}>,correctedPixels:0,withheldPixels:0,
   bandLevels:undefined as ReturnType<typeof solveBandLevels>|undefined,
   bandRatios:undefined as {reference:string;source:string;measured:Record<string,number>;published:Record<string,number>;gains:number[]}|undefined};
  // Keep corrected highlights until exposure matching; quantize only afterward.
  const rgb = new Float32Array(width * height * 3), missing = new Uint8Array(width * height).fill(1);
  const owners = new Uint8Array(width * height);
  const coverage: Record<string,{pixels:number;surfacePercent:number}> = {};
  // Highest native density wins. Keep boundaries between observations;
  // do not blend across dates, transfer monochrome detail, or synthesize color.
  const ordered = [...groups].sort((a, b) => a[1][0].resolution[0] - b[1][0].resolution[0]);
  const samplers = ordered.map(([observation, bands]) => {
    const weight = photometryProfile.observationWeights[observation]!;
    if (profile.filters.some(filter => !bands.some(band => band.filter === filter))) throw new Error(`Incomplete color observation: ${observation}`);
    return { observation, sample: correctedSampler(bands, profile.filters, weight, photometryProfile, profile.referenceRadiusMeters, profile.centerLongitude, sampleColorBand) };
  });
  const bandLevels = photometryProfile.bandLevels ? solveBandLevels(samplers, profile.filters, photometryProfile.bandLevels) : undefined;
  photometry.bandLevels = bandLevels;
  const nextObservationOwnsWithheld = photometryProfile.withheld === 'next-observation';
  for (const [observationIndex, { observation, sample }] of samplers.entries()) {
    const stats = photometry.observations[observation] = { correctedPixels: 0, withheldPixels: 0 };
    const gains = bandLevels?.gains[observation] ?? [1, 1, 1];
    let pixels = 0, solidAngle = 0;
    for (let y = 0; y < height; y++) {
      const latitude = (90 - (y + 0.5) * 180 / height) * Math.PI / 180;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (missing[index] !== 1) continue;
        const cell = sample(x, y, width, height);
        if (cell === null) continue;
        if (cell === 'withheld') {
          // Reserve this footprint until all color sequences finish, then use monochrome rather than substituting
          // another date's color; observations from one encounter may instead let the next one own it.
          if (!nextObservationOwnsWithheld) missing[index] = 2;
          stats.withheldPixels++;
          photometry.withheldPixels++;
          continue;
        }
        stats.correctedPixels++;
        photometry.correctedPixels++;
        missing[index] = 0;
        owners[index] = observationIndex + 1;
        pixels++;
        solidAngle += Math.cos(latitude);
        // Keep floating I/F through level matching. Encoding happens only after
        // this complete color footprint has been composed.
        for (let c = 0; c < 3; c++) rgb[index * 3 + c] = cell[c]! * gains[c]!;
      }
    }
    coverage[observation] = { pixels, surfacePercent: solidAngle / (width * height * 2 / Math.PI) * 100 };
  }
  for (let i = 0; i < missing.length; i++) if (missing[i] === 2) missing[i] = 1;
  if (photometryProfile.bandRatios) photometry.bandRatios = tieBandRatios(rgb, owners, width, height, profile.filters, photometryProfile.bandRatios);
  return { rgb, missing, owners, observationNames: ordered.map(([name]) => name), coverage, photometry,
    sourceIds,display,colorDisplay:bandColorEvidence(display) };
}

/**
 * Tie the composed footprint's whole-disc colour to a published one. The Voyager filter calibration carried by the archive
 * products is not the last word on these bands (Bell and McCord 1991 apply per-filter factors of up to 19 % to reach
 * ground-based spectra), so a recipe may name the published whole-disc ratios; each named band is scaled by one gain so its
 * cosine-weighted mean over every coloured texel, against the reference band's mean, equals the published ratio. Spatial
 * colour differences are untouched. The measured ratios, the published ones and the gains are reported.
 */
export function tieBandRatios(rgb: Float32Array, owners: Uint8Array, width: number, height: number, filters: readonly string[], policy: BandRatioPolicy) {
  const reference = filters.indexOf(policy.reference);
  if (reference < 0) throw new Error(`Band ratio reference is not a filter: ${policy.reference}`);
  const sums = filters.map(() => 0); let weightSum = 0;
  for (let y = 0; y < height; y++) { const w = Math.cos((90 - (y + 0.5) * 180 / height) * Math.PI / 180);
    for (let x = 0; x < width; x++) { const i = y * width + x; if (!owners[i]) continue; weightSum += w; for (let c = 0; c < filters.length; c++) sums[c]! += w * rgb[i * 3 + c]!; } }
  if (!(weightSum > 0)) throw new Error('Band ratios need a coloured footprint.');
  const measured: Record<string, number> = {}, published: Record<string, number> = {}, gains = filters.map(() => 1);
  for (const [filter, ratio] of Object.entries(policy.ratios)) {
    const c = filters.indexOf(filter);
    if (c < 0 || c === reference) throw new Error(`Band ratio names no other filter: ${filter}`);
    measured[filter] = +(sums[c]! / sums[reference]!).toFixed(4); published[filter] = ratio; gains[c] = +(ratio / measured[filter]!).toFixed(4);
  }
  for (let i = 0; i < owners.length; i++) if (owners[i]) for (let c = 0; c < filters.length; c++) rgb[i * 3 + c] = rgb[i * 3 + c]! * gains[c]!;
  return { reference: policy.reference, source: policy.source, measured, published, gains };
}

/**
 * Brightness-match the corrected colour to the monochrome base along footprint boundaries. Per observation by default, each
 * clamped so its brightest value encodes without clipping. `pooled` fits one gain for the whole lens from every boundary sample,
 * for observations already on one calibration (band levels solved): a per-observation fit would re-open the seams, and an
 * observation that never borders the base would get none. The pooled clamp keeps 99.9 % of the texels within range.
 */
export function matchObservedColorLevels(color: Pick<ReturnType<typeof composeCorrectedColor>,"observationNames"|"owners"|"rgb">, monochrome: RgbObservation,
  { width, height, boundaryPixels, luminance: coefficients, pooled = false }: {width:number;height:number;boundaryPixels:number;luminance:readonly number[];pooled?:boolean}) {
  const samples = color.observationNames.map((): number[] => []);
  const maxima = color.observationNames.map(() => 0);
  const luminance = (rgb: ArrayLike<number>, i: number) => coefficients[0] * rgb[i] + coefficients[1] * rgb[i + 1] + coefficients[2] * rgb[i + 2];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, owner = color.owners[i];
    if (!owner) continue;
    const c = i * 3;
    maxima[owner - 1] = Math.max(maxima[owner - 1], color.rgb[c], color.rgb[c + 1], color.rgb[c + 2]);
    if (monochrome.missing[i] || y < boundaryPixels || y >= height - boundaryPixels) continue;
    // Four-texel strip inside each footprint, with longitude wrap. Compare
    // co-located valid observations; missing-data indicators cannot set levels.
    if ([i - boundaryPixels * width, i + boundaryPixels * width, y * width + (x + boundaryPixels) % width,
      y * width + (x + width - boundaryPixels) % width].every(j => color.owners[j] === owner)) continue;
    const source = luminance(color.rgb, c);
    // The base is already a delivered display image. Decode its screen code
    // values for brightness matching; never decode the measured filter values.
    const reference = coefficients.reduce((sum,weight,channel)=>sum+weight*srgbToLinear(monochrome.rgb[c+channel]/255),0);
    if (source > 0 && reference > 0) samples[owner - 1].push(reference / source);
  }
  const median = (values: number[]) => { values.sort((a, b) => a - b); return values.length ? values[Math.floor(values.length / 2)] : 1; };
  let levels: { observation: string; boundarySamples: number; gain: number; pooled?: true; clippedPixels?: number }[];
  if (pooled) {
    const requestedGain = median(samples.flat());
    // The brightest 0.1 % of texels may clip: a histogram of each texel's brightest channel gives that level.
    const bins = 4096, ceiling = Math.max(...maxima), histogram = new Uint32Array(bins);
    let owned = 0;
    for (let i = 0; i < color.owners.length; i++) {
      if (!color.owners[i]) continue;
      owned++;
      const brightest = Math.max(color.rgb[i * 3], color.rgb[i * 3 + 1], color.rgb[i * 3 + 2]);
      histogram[Math.min(bins - 1, Math.floor(brightest / ceiling * bins))]++;
    }
    let seen = 0, bin = 0;
    for (; bin < bins && seen + histogram[bin] < owned * 0.999; bin++) seen += histogram[bin];
    const level = (bin + 1) / bins * ceiling;
    const gain = Math.min(requestedGain, level > 0 ? 1 / level : 1);
    let clippedPixels = 0;
    for (let i = 0; i < color.owners.length; i++) if (color.owners[i] && Math.max(color.rgb[i * 3], color.rgb[i * 3 + 1], color.rgb[i * 3 + 2]) * gain > 1) clippedPixels++;
    levels = color.observationNames.map((observation, i) => ({ observation, boundarySamples: samples[i].length, gain, pooled: true, clippedPixels }));
  } else {
    levels = color.observationNames.map((observation, i) => ({ observation, boundarySamples: samples[i].length,
      gain: Math.min(median(samples[i]), maxima[i] ? 1 / maxima[i] : 1) }));
  }
  for (let i = 0; i < color.owners.length; i++) {
    if (!color.owners[i]) continue;
    const { gain } = levels[color.owners[i] - 1];
    for (let c = 0; c < 3; c++) color.rgb[i * 3 + c] *= gain;
  }
  return levels;
}
