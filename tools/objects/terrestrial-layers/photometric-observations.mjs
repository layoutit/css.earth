import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const radians=Math.PI/180;

/** Controlled ISIS labels plus pinned observer/Sun vectors, interpreted only during preparation. */
export async function loadControlledObservationGeometry({sourceDirectory,entries,vectors:paths}) {
 const vectors={};
 for(const name of ['sun','observer']){
  const {response}=JSON.parse(await readFile(resolve(sourceDirectory,paths[name]),'utf8'));
  vectors[name]=response.result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map(line=>{const[jd,,...position]=line.split(',');return{et:(Number(jd)-2451545)*86400,position:position.slice(0,3).map(Number)}});
 }
 const geometry=new Map();
 for(const entry of entries){
  const label=await readFile(resolve(sourceDirectory,entry.path),'utf8'),et=Number(label.match(/CkTableStartTime\s*=\s*([^\s]+)/)[1]),frame=controlledBodyFrame(label,et);
  const transform=name=>{const sample=vectors[name].find(row=>Math.abs(row.et-et)<.001);if(!sample||!sample.position.every(Number.isFinite))throw new Error('Missing controlled observation geometry: '+entry.id);return frame.map(axis=>axis.reduce((sum,value,i)=>sum+value*sample.position[i],0))};
  geometry.set(entry.imageId,{sun:transform('sun'),observer:transform('observer')});
 }
 return geometry;
}

export function controlledBodyFrame(label, et) {
  const array = key => label.match(new RegExp(`\\b${key}\\s*=\\s*\\(([^)]+)\\)`))[1].split(",").map(Number);
  const centuries = et / (86400 * 36525), days = et / 86400;
  const rates = array("SysNutPrec1");
  const arguments_ = array("SysNutPrec0").map((value, i) => (value + rates[i] * centuries) * radians);
  const angle = (key, periodic, fn, time) => (array(key).reduce((sum, value, i) => sum + value * time ** i, 0) +
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


export function colorPhotometricGain(normal, geometry, weight, profile) {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error("Missing or invalid observation disk weight");
  const cosine = position => {
    const v = position.map((value, i) => value - profile.radiusKm * normal[i]);
    return normal.reduce((sum, value, i) => sum + value * v[i], 0) / Math.hypot(...v);
  };
  const mu0 = cosine(geometry.sun), mu = cosine(geometry.observer);
  if (!Number.isFinite(mu0) || !Number.isFinite(mu) ||
      mu0 < Math.cos(profile.maximumIncidenceDegrees * radians) ||
      mu < Math.cos(profile.maximumEmissionDegrees * radians)) return null;
  // ISIS Lunar-Lambert: weight 0 is Lambert, weight 1 is Lommel-Seeliger.
  const disk = (incidence, emission) => (1 - weight) * incidence + 2 * weight * incidence / (incidence + emission);
  return disk(Math.cos(profile.referenceIncidenceDegrees * radians),
    Math.cos(profile.referenceEmissionDegrees * radians)) / disk(mu0, mu);
}


/** Correct each complete color footprint before exposure matching; withheld footprints cannot borrow another date. */
export function composeCorrectedColor({groups,profile,width,height,sourceIds,photometryProfile,sampleColorBand}) {
 const photometry={...photometryProfile,observations:{},correctedPixels:0,withheldPixels:0};
  // Keep corrected highlights until exposure matching; quantize only afterward.
  const rgb = new Float32Array(width * height * 3), missing = new Uint8Array(width * height).fill(1);
  const owners = new Uint8Array(width * height);
  const coverage = {};
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
        if (samples.some(sample => sample === null)) continue;
        const longitude = (x + 0.5) * 2 * Math.PI / width;
        const normal = [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
        const gains = samples.map(({ band }) => colorPhotometricGain(normal, band.capture, weight, photometryProfile));
        if (gains.some(gain => gain === null)) {
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
        // One fixed display transfer for every band/date. I/F=1 maps to white.
        // Infrared/red, green/green, violet/blue is enhanced, not natural color.
        for (let c = 0; c < 3; c++) {
          const value = samples[c].value * gains[c];
          rgb[index * 3 + c] = 255 * Math.max(0, value) ** (1 / profile.gamma);
        }
      }
    }
    coverage[observation] = { pixels, surfacePercent: solidAngle / (width * height * 2 / Math.PI) * 100 };
  }
  for (let i = 0; i < missing.length; i++) if (missing[i] === 2) missing[i] = 1;
  return { rgb, missing, owners, observationNames: ordered.map(([name]) => name), coverage, photometry,
    sourceIds };
}

export function matchObservedColorLevels(color, monochrome, { width, height, boundaryPixels, luminance: coefficients }) {
  const samples = color.observationNames.map(() => []);
  const maxima = color.observationNames.map(() => 0);
  const luminance = (rgb, i) => coefficients[0] * rgb[i] + coefficients[1] * rgb[i + 1] + coefficients[2] * rgb[i + 2];
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
    const source = luminance(color.rgb, c), reference = luminance(monochrome.rgb, c);
    if (source > 0 && reference > 0) samples[owner - 1].push(reference / source);
  }
  const levels = color.observationNames.map((observation, i) => {
    const ratios = samples[i].sort((a, b) => a - b);
    const requestedGain = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 1;
    return { observation, boundarySamples: ratios.length,
      gain: Math.min(requestedGain, maxima[i] ? 255 / maxima[i] : 1) };
  });
  for (let i = 0; i < color.owners.length; i++) {
    if (!color.owners[i]) continue;
    const { gain } = levels[color.owners[i] - 1];
    for (let c = 0; c < 3; c++) color.rgb[i * 3 + c] = Math.round(color.rgb[i * 3 + c] * gain);
  }
  return levels;
}


