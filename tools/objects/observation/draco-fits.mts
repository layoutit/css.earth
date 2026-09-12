import {readEncounterHdus} from '../terrestrial-layers/encounter-fits.mts';

/** DRACO calibrated I/F FITS products. The source supplies a full detector
 * array with an embedded window, not a crop with an implicit new pixel origin.
 * Definitions: DART DRACO SIS, collection urn:nasa:pds:dart:data_dracocal.
 * The current supported layout is the 1024-square, binned terminal image.
 */
const sentinelFields = [
  ['MISPXVAL', 'missing'], ['PXOUTWIN', 'outside-window'],
  ['BADMASKV', 'bad-pixel'], ['SATPXVAL', 'saturated'],
  ['OORADLUT', 'outside-calibration-table'], ['IOVRFLAG', 'invalid-iof'],
] as const;
export type DracoPixelRejection = typeof sentinelFields[number][1] | 'nonfinite' | 'outside-detector';
type FitsHeader = Readonly<Record<string, string | number | boolean>>;

function numeric(header: FitsHeader, key: string): number {
  const value = header[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?$/.test(value.trim())) {
    throw new TypeError(`Missing or invalid DRACO numeric field ${key}.`);
  }
  const result = Number(value.replace(/[dD]/g, 'E'));
  if (!Number.isFinite(result)) throw new TypeError(`Invalid DRACO numeric field ${key}.`);
  return result;
}

function text(header: FitsHeader, key: string): string {
  const value = header[key];
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Missing DRACO field ${key}.`);
  return value;
}

export function decodeDracoIof(bytes: Buffer) {
  const hdus = readEncounterHdus(bytes);
  if (hdus.length !== 1) throw new Error('DRACO I/F input must contain one primary image.');
  const {header, width, height, bitpix, values} = hdus[0];
  if (header.MISSION !== 'DART' || header.INSTRUME !== 'DRACO' || bitpix !== -32 ||
      width !== 1024 || height !== 1024 || header.BINNING !== 'ON' || header.BADIMAGE !== 'FALSE' ||
      header.RADIANCE !== 'PERFORM' || header.IOVERF !== 'PERFORM') {
    throw new Error('Unsupported DRACO product identity, geometry or calibration level.');
  }
  const window = {x:numeric(header,'WINDOWX'), y:numeric(header,'WINDOWY'), width:numeric(header,'WINDOWW'), height:numeric(header,'WINDOWH')};
  if (Object.values(window).some(n=>!Number.isSafeInteger(n) || n < 0) || window.width < 1 || window.height < 1 ||
      window.x + window.width > width || window.y + window.height > height) throw new Error('Invalid DRACO detector window.');
  const exposureSeconds = numeric(header, 'EXPTIME');
  if (!(exposureSeconds > 0)) throw new Error('Invalid DRACO exposure.');
  const startTime = text(header, 'ACQ_UTC'), target = text(header, 'TARGET');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(startTime) || !Number.isFinite(Date.parse(startTime+'Z')) ||
      new Date(startTime+'Z').toISOString().slice(0,19) !== startTime.slice(0,19)) {
    throw new Error('Invalid DRACO acquisition UTC.');
  }
  const seconds = text(header, 'IMGTMSEC'), subseconds = text(header, 'IMGTMSUB');
  if (!/^\d{1,10}$/.test(seconds) || !/^\d{1,5}$/.test(subseconds)) throw new Error('Invalid DRACO capture identifier.');
  const captureId = `${seconds.padStart(10,'0')}_${subseconds.padStart(5,'0')}`;
  const sentinels = sentinelFields.map(([key, reason])=>({key,reason,value:numeric(header,key)}));
  if (new Set(sentinels.map(entry=>entry.value)).size !== sentinels.length) throw new Error('DRACO special values overlap.');
  const outsideWindowValue = numeric(header,'PXOUTWIN');
  const insideWindow = (x:number,y:number)=>x>=window.x && y>=window.y && x<window.x+window.width && y<window.y+window.height;
  const reason = (index:number):DracoPixelRejection|null=>{
    if (!Number.isSafeInteger(index) || index<0 || index>=values.length) return 'outside-detector';
    const value = values[index];
    if (!Number.isFinite(value)) return 'nonfinite';
    const special = sentinels.find(entry=>value === entry.value);
    if (special) return special.reason;
    return insideWindow(index%width,Math.floor(index/width)) ? null : 'outside-window';
  };
  const rejected:Partial<Record<DracoPixelRejection,number>>={};
  let acceptedPixels=0;
  for (let index=0;index<values.length;index++) {
    if (!insideWindow(index%width,Math.floor(index/width)) && values[index] !== outsideWindowValue) {
      throw new Error('DRACO detector window disagrees with its outside-window pixels.');
    }
    const rejection=reason(index);
    if (rejection) rejected[rejection]=(rejected[rejection]??0)+1; else acceptedPixels++;
  }
  return {width,height,header,values,window,reason,captureId,target,startTime,exposureSeconds,
    units:'observed radiance factor (I/F)',
    report:{instrument:'DRACO',captureId,target,startTime,exposureSeconds,window,acceptedPixels,rejected,sentinels,
      detectorOrder:'Stored FITS row/column order; window origin retained.',
      interpretation:'Calibrated observed I/F with acquisition illumination; not geometric albedo.'}};
}
