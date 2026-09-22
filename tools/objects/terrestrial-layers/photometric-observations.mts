import type {ObservationGeometry,PhotometryProfile,ObservedColorContext,ColorBand,RgbObservation} from './contracts.mts';
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


/** Correct each complete color footprint before exposure matching; withheld footprints cannot borrow another date. */
export function composeCorrectedColor({groups,profile,width,height,sourceIds,photometryProfile,sampleColorBand}: ObservedColorContext & {photometryProfile:PhotometryProfile;sampleColorBand:(band:ColorBand,easting:number,northing:number)=>number|null}) {
 // Level matching carries corrected I/F into the monochrome base's display-linear light, where I/F 1 is white.
 const display=bandColorDisplay(profile.filters,'radiance-factor',[0,1]);
 const photometry={...photometryProfile,observations:{} as Record<string,{correctedPixels:number;withheldPixels:number}>,correctedPixels:0,withheldPixels:0};
  // Keep corrected highlights until exposure matching; quantize only afterward.
  const rgb = new Float32Array(width * height * 3), missing = new Uint8Array(width * height).fill(1);
  const owners = new Uint8Array(width * height);
  const coverage: Record<string,{pixels:number;surfacePercent:number}> = {};
  // Highest native density wins. Keep boundaries between observations;
  // do not blend across dates, transfer monochrome detail, or synthesize color.
  const ordered = [...groups].sort((a, b) => a[1][0].resolution[0] - b[1][0].resolution[0]);
  for (const [observationIndex, [observation, bands]] of ordered.entries()) {
    const weight = photometryProfile.observationWeights[observation];
    const stats = photometry.observations[observation] = { correctedPixels: 0, withheldPixels: 0 };
    const channels = profile.filters.map(filter => bands.filter(band => band.filter === filter));
    if (channels.some(channel => !channel.length)) throw new Error(`Incomplete color observation: ${observation}`);
    let pixels = 0, solidAngle = 0;
    for (let y = 0; y < height; y++) {
      const latitude = (90 - (y + 0.5) * 180 / height) * Math.PI / 180;
      const northing = latitude * profile.referenceRadiusMeters;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (missing[index] !== 1) continue;
        const easting = ((x + 0.5) * 360 / width - profile.centerLongitude) * Math.PI / 180 * profile.referenceRadiusMeters;
        const samples = channels.map(channel => {
          for (const band of channel) {
            const value = sampleColorBand(band, easting, northing);
            if (value !== null) return { value, band };
          }
          return null;
        });
        if (!samples.every((sample): sample is {value:number;band:ColorBand} => sample !== null)) continue;
        const longitude = (x + 0.5) * 2 * Math.PI / width;
        const normal = [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
        const gains = samples.map(({ band }) => {if(!band.capture)throw new Error("Missing observation capture geometry");return colorPhotometricGain(normal, band.capture, weight, photometryProfile);});
        if (!gains.every((gain): gain is number => gain !== null)) {
          // Reserve this footprint until all color sequences finish, then use
          // monochrome rather than substituting another date's color.
          missing[index] = 2;
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
        for (let c = 0; c < 3; c++) {
          const value = samples[c].value * gains[c];
          rgb[index * 3 + c] = value;
        }
      }
    }
    coverage[observation] = { pixels, surfacePercent: solidAngle / (width * height * 2 / Math.PI) * 100 };
  }
  for (let i = 0; i < missing.length; i++) if (missing[i] === 2) missing[i] = 1;
  return { rgb, missing, owners, observationNames: ordered.map(([name]) => name), coverage, photometry,
    sourceIds,display,colorDisplay:bandColorEvidence(display) };
}

export function matchObservedColorLevels(color: Pick<ReturnType<typeof composeCorrectedColor>,"observationNames"|"owners"|"rgb">, monochrome: RgbObservation, { width, height, boundaryPixels, luminance: coefficients }: {width:number;height:number;boundaryPixels:number;luminance:readonly number[]}) {
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
  const levels = color.observationNames.map((observation, i) => {
    const ratios = samples[i].sort((a, b) => a - b);
    const requestedGain = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 1;
    return { observation, boundarySamples: ratios.length,
      gain: Math.min(requestedGain, maxima[i] ? 1 / maxima[i] : 1) };
  });
  for (let i = 0; i < color.owners.length; i++) {
    if (!color.owners[i]) continue;
    const { gain } = levels[color.owners[i] - 1];
    for (let c = 0; c < 3; c++) color.rgb[i * 3 + c] *= gain;
  }
  return levels;
}
