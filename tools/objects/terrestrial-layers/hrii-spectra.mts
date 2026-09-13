import {readEncounterHdus} from './encounter-fits.mts';

/** Native Deep Impact/EPOXI slit spectra. The first detector axis is wavelength,
 * not an image coordinate. Geometry and surface validity are supplied separately. */
export function decodeHriiSpectra(bytes:Buffer) {
  const hdus=readEncounterHdus(bytes),primary=hdus[0],h=primary.header;
  if(h.INSTRUME!=='HRIIR'||h.BUNIT!=='W/(m^2*sr*um)'||!['RAD','RADREV'].includes(String(h.CALTYPE))||
     h.DNAXIS1!=='+WAVELENGTH'||h.DNAXIS2!=='UP, -Yinstr'||primary.width!==512||
     ![64,256].includes(primary.height)||primary.bitpix!==-32||
     hdus.map(x=>x.name).join(',')!=='PRIMARY,FLAGS,WAVELENGTH,DELTA_WAVELENGTH,SNR') {
    throw new Error('Unsupported calibrated HRII slit product.');
  }
  for(const plane of hdus.slice(1)) if(plane.width!==primary.width||plane.height!==primary.height||plane.bitpix!==(plane.name==='FLAGS'?8:-32)) {
    throw new Error('Misregistered HRII calibration plane.');
  }
  const flags=hdus[1].values,wavelength=hdus[2].values,bandwidth=hdus[3].values,snr=hdus[4].values;
  const reject=(i:number)=>{
    if(!Number.isSafeInteger(i)||i<0||i>=primary.values.length)return 'outside-detector';
    if(flags[i]!==0)return 'detector-quality';
    if(![primary.values[i],wavelength[i],bandwidth[i],snr[i]].every(Number.isFinite)||bandwidth[i]<=0||snr[i]<=0)return 'invalid-spectrum';
    return null;
  };
  return {...primary,wavelength,bandwidth,snr,flags,reject};
}

export interface SolarSpectrum {wavelengthMicrons:number[];irradiance:number[]}
/** PDS HRIIR_020601_2_0, two numeric fields per row; W m^-2 micrometre^-1 at 1 AU. */
export function decodeHriiSolarTable(text:string):SolarSpectrum {
  const wavelengthMicrons:number[]=[],irradiance:number[]=[];
  for(const line of text.trim().split(/\r?\n/)) {
    const fields=line.trim().split(/\s+/).map(Number);
    if(fields.length!==2||!fields.every(Number.isFinite)||fields.some(x=>x<=0)||
       (wavelengthMicrons.length&&fields[0]<=wavelengthMicrons.at(-1)!)) throw new Error('Invalid HRII solar table.');
    wavelengthMicrons.push(fields[0]);irradiance.push(fields[1]);
  }
  if(wavelengthMicrons.length<2||wavelengthMicrons[0]>1.5||wavelengthMicrons.at(-1)!<4.4)throw new Error('Incomplete HRII solar spectrum.');
  return {wavelengthMicrons,irradiance};
}

export function solarIrradiance(solar:SolarSpectrum,wavelength:number) {
  const x=solar.wavelengthMicrons,y=solar.irradiance;
  if(!Number.isFinite(wavelength)||wavelength<x[0]||wavelength>x.at(-1)!)throw new Error('Wavelength outside solar table.');
  let lo=0,hi=x.length-1;
  while(hi-lo>1){const mid=(hi+lo)>>>1;if(x[mid]<=wavelength)lo=mid;else hi=mid;}
  const t=(wavelength-x[lo])/(x[hi]-x[lo]);return y[lo]*(1-t)+y[hi]*t;
}

/** Spectral radiance, W m^-2 sr^-1 micrometre^-1. Exact SI constants. */
export function planckRadiance(wavelengthMicrons:number,temperatureKelvin:number) {
  if(!Number.isFinite(wavelengthMicrons)||wavelengthMicrons<=0||!Number.isFinite(temperatureKelvin)||temperatureKelvin<=0)throw new Error('Invalid Planck arguments.');
  const wavelength=wavelengthMicrons*1e-6,h=6.62607015e-34,c=299792458,k=1.380649e-23;
  return 2*h*c*c/wavelength**5/Math.expm1(h*c/(wavelength*k*temperatureKelvin))*1e-6;
}

const median=(numbers:number[])=>{
  if(!numbers.length)throw new Error('Empty median.');
  const sorted=[...numbers].sort((a,b)=>a-b),m=sorted.length>>>1;
  return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;
};
const weightedMedian=(values:number[],weights:number[])=>{
  const sorted=values.map((value,i)=>({value,weight:weights[i]})).sort((a,b)=>a.value-b.value);
  const half=weights.reduce((a,b)=>a+b,0)/2;let sum=0;
  for(const entry of sorted){sum+=entry.weight;if(sum>=half)return entry.value;}
  throw new Error('Empty weighted median.');
};

export interface SpectralSample {wavelengthMicrons:number;radiance:number;valid:boolean}
export interface HriiContinuum {
  normalizedRadianceAt18:number;slopePerMicron:number;slopePercentPer100Nm:number;
  relativeResidual:number;acceptedChannels:number;availableChannels:number;
}

/** Solar-normalized 1.5–2.2 µm continuum, anchored at the unabsorbed 1.8 µm
 * interval. L1 slope estimation limits the influence of narrow ice bands. */
export function fitHriiContinuum(samples:SpectralSample[],solar:SolarSpectrum):HriiContinuum|null {
  const interval=samples.filter(x=>x.wavelengthMicrons>=1.5&&x.wavelengthMicrons<=2.2),good=interval.filter(x=>x.valid&&Number.isFinite(x.radiance));
  if(good.length<40||good.length<.8*interval.length)return null;
  const normalized=good.map(x=>({x:x.wavelengthMicrons-1.8,y:x.radiance/solarIrradiance(solar,x.wavelengthMicrons)}));
  const anchor=normalized.filter(x=>Math.abs(x.x)<=.025);
  if(anchor.length<3)return null;
  const intercept=median(anchor.map(x=>x.y));if(!(intercept>0))return null;
  const away=normalized.filter(x=>Math.abs(x.x)>1e-8),slope=weightedMedian(away.map(x=>(x.y-intercept)/x.x),away.map(x=>Math.abs(x.x)));
  const error=median(normalized.map(x=>Math.abs(x.y-intercept-slope*x.x)))/intercept;
  if(!Number.isFinite(slope)||!Number.isFinite(error)||error>.1)return null;
  return {normalizedRadianceAt18:intercept,slopePerMicron:slope,slopePercentPer100Nm:10*slope/intercept,relativeResidual:error,acceptedChannels:good.length,availableChannels:interval.length};
}

export interface HriiThermalFit {
  colorTemperatureKelvin:number;anisothermalAmplitude:number;relativeAbsoluteResidual:number;
  acceptedChannels:number;availableChannels:number;
}

/** Groussin et al. 2013, equations 1–4: subtract reflected sunlight, then fit
 * temperature and free anisothermal amplitude to 3.1–4.4 µm with the L1 norm.
 * This is color temperature; it is not an area-average surface temperature. */
export function fitHriiThermal(samples:SpectralSample[],solar:SolarSpectrum,continuum:HriiContinuum,geometry:{incidenceCosine:number;heliocentricDistanceAu:number}):HriiThermalFit|null {
  const {incidenceCosine:mu0,heliocentricDistanceAu:r}=geometry;
  if(!Number.isFinite(mu0)||mu0<=0||mu0>1||!Number.isFinite(r)||r<=0)throw new Error('Invalid thermal illumination geometry.');
  const interval=samples.filter(x=>x.wavelengthMicrons>=3.1&&x.wavelengthMicrons<=4.4),good=interval.filter(x=>x.valid&&Number.isFinite(x.radiance));
  if(good.length<70||good.length<.8*interval.length)return null;
  const data=good.map(x=>{
    const normalized=continuum.normalizedRadianceAt18+continuum.slopePerMicron*(x.wavelengthMicrons-1.8);
    const reflected=solarIrradiance(solar,x.wavelengthMicrons)*normalized;
    return {wavelength:x.wavelengthMicrons,radiance:x.radiance-reflected,emissivity:1-Math.PI*normalized*r*r/mu0};
  });
  if(data.some(x=>x.emissivity<=0||x.emissivity>1)||median(data.map(x=>x.radiance))<=0)return null;
  const denominator=data.reduce((sum,x)=>sum+Math.abs(x.radiance),0);
  const evaluate=(temperature:number)=>{
    const basis=data.map(x=>x.emissivity*planckRadiance(x.wavelength,temperature));
    const amplitude=Math.max(0,weightedMedian(data.map((x,i)=>x.radiance/basis[i]),basis));
    const error=data.reduce((sum,x,i)=>sum+Math.abs(x.radiance-amplitude*basis[i]),0)/denominator;
    return {temperature,amplitude,error};
  };
  // A bounded global scan precedes local refinement; no starting temperature is
  // chosen from the appearance of the map or from the expected comet values.
  let best=evaluate(200);
  for(let t=202;t<=500;t+=2){const candidate=evaluate(t);if(candidate.error<best.error)best=candidate;}
  if(best.temperature===200||best.temperature===500)return null;
  let lo=best.temperature-2,hi=best.temperature+2;
  const ratio=(Math.sqrt(5)-1)/2;let a=evaluate(hi-ratio*(hi-lo)),b=evaluate(lo+ratio*(hi-lo));
  while(hi-lo>.001){if(a.error<b.error){hi=b.temperature;b=a;a=evaluate(hi-ratio*(hi-lo));}else{lo=a.temperature;a=b;b=evaluate(lo+ratio*(hi-lo));}}
  best=a.error<b.error?a:b;
  if(best.error>.1||best.amplitude<=0)return null;
  return {colorTemperatureKelvin:best.temperature,anisothermalAmplitude:best.amplitude,relativeAbsoluteResidual:best.error,acceptedChannels:good.length,availableChannels:interval.length};
}

/** Iterating the reflected and emitted terms removes the small thermal tail in
 * the 1.5–2.2 µm interval. This numerical extension is recorded separately from
 * the paper's assumption that emission there is negligible. */
export function fitHriiSpectrum(samples:SpectralSample[],solar:SolarSpectrum,geometry:{incidenceCosine:number;heliocentricDistanceAu:number}) {
  let continuum=fitHriiContinuum(samples,solar);if(!continuum)return null;
  let thermal=fitHriiThermal(samples,solar,continuum,geometry);if(!thermal)return null;
  for(let iteration=1;iteration<=12;iteration++) {
    const previous=continuum,priorThermal=thermal;
    const corrected=samples.map(x=>{
      if(!x.valid||!Number.isFinite(x.wavelengthMicrons)||x.wavelengthMicrons<=0)return x;
      const normalized=previous.normalizedRadianceAt18+previous.slopePerMicron*(x.wavelengthMicrons-1.8);
      const emissivity=1-Math.PI*normalized*geometry.heliocentricDistanceAu**2/geometry.incidenceCosine;
      return {...x,radiance:x.radiance-emissivity*priorThermal.anisothermalAmplitude*planckRadiance(x.wavelengthMicrons,priorThermal.colorTemperatureKelvin)};
    });
    continuum=fitHriiContinuum(corrected,solar);if(!continuum)return null;
    thermal=fitHriiThermal(samples,solar,continuum,geometry);if(!thermal)return null;
    if(Math.abs(thermal.colorTemperatureKelvin-priorThermal.colorTemperatureKelvin)<.005&&Math.abs(continuum.slopePercentPer100Nm-previous.slopePercentPer100Nm)<.001) {
      return {continuum,thermal,iterations:iteration};
    }
  }
  return null;
}
