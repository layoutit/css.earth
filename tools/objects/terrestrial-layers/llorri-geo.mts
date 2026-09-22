import { sha256 } from '../../../src/platform/sha256.mts';
import {requireRecord} from '../../sources/source-values.mts';
import type {SipCamera} from './contracts.mts';
import {parseSipCamera,parseLlorriCamera} from './source-records.mts';
import { readFitsPrimary } from '../observation/fits.mts';
import { project } from './osiris-geo.mts';

const unquote = (s: unknown) => typeof s === 'string' ? s.replace(/^'(.*)'$/, '$1').trim() : undefined;
const polynomial = (terms: readonly number[][], u: number, v: number) => terms.reduce((s, [i, j, a]) => s + a * u ** i * v ** j, 0);

/** FITS Paper IV TAN-SIP pixel distortion, with a separately recorded pointing
 * translation constrained by published landmarks. Coordinates remain zero-based
 * in the original FITS array (its first row is displayed at the bottom). */
export function sipPixel(camera: SipCamera, x: number, y: number, inverse: boolean) {
  const { referencePixel: [cx, cy], a, b, offsetPixels: [dx, dy] } = camera.sip;
  if (!inverse) {
    const u = x - dx - cx, v = y - dy - cy;
    return [cx + u + polynomial(a, u, v), cy + v + polynomial(b, u, v)];
  }
  const U = x - cx, V = y - cy;
  let u = U, v = V;
  for (let n = 0; n < 12; n++) {
    const f = u + polynomial(a, u, v) - U, g = v + polynomial(b, u, v) - V;
    if (Math.max(Math.abs(f), Math.abs(g)) < 1e-9) return [u + cx + dx, v + cy + dy];
    const derivative = (terms: readonly number[][], axis: number) => terms.reduce((s, [i,j,c]) => s + (axis === 0
      ? i ? c*i*u**(i-1)*v**j : 0 : j ? c*j*u**i*v**(j-1) : 0), 0);
    const aa = 1 + derivative(a,0), ab = derivative(a,1), ba = derivative(b,0), bb = 1 + derivative(b,1), det = aa*bb-ab*ba;
    if (!Number.isFinite(det) || Math.abs(det) < .1) throw new Error('Degenerate FITS SIP inverse.');
    u -= (bb*f-ab*g)/det; v -= (aa*g-ba*f)/det;
  }
  throw new Error('FITS SIP inverse did not converge.');
}

export function bindSipCamera(value: unknown) {
  const camera=parseSipCamera(value);
  const s = camera.sip;
  if (!s || ![s.referencePixel,s.offsetPixels].every(v => v?.length === 2 && v.every(Number.isFinite)) ||
      ![s.a,s.b].every(v => Array.isArray(v) && v.length === 7 && v.every(t => t.length === 3 &&
        t.every(Number.isFinite) && Number.isInteger(t[0]) && Number.isInteger(t[1]) && t[0] >= 0 && t[1] >= 0 && t[0]+t[1] >= 2 && t[0]+t[1] <= 3)) ||
      Math.hypot(...s.offsetPixels) > 64) throw new Error('Unsupported bound TAN-SIP camera.');
  return {
    projectPoint(point: readonly number[]) { const p = project(camera.matrix, point); return [...sipPixel(camera,p[0],p[1],true),p[2]]; },
    rayPixel(x: number,y: number) { return sipPixel(camera,x,y,false); },
  };
}

/** Every body in a L'LORRI frame's field of view, from TRGFOV1 to TRGFOVN. */
export function llorriFieldTargets(header: Record<string, unknown>) {
  const count = Number(header.TRGFOVN);
  if (!Number.isInteger(count) || count < 1) throw new Error('L\'LORRI header lists no field-of-view target.');
  return Array.from({ length: count }, (_, index) => {
    const target = unquote(header[`TRGFOV${index + 1}`]);
    if (!target) throw new Error(`L'LORRI header is missing TRGFOV${index + 1}.`);
    return target;
  });
}

/** A camera closure names its body; the frame must list that body in its field of view. */
export function requireLlorriTarget(header: Record<string, unknown>, target: string) {
  const targets = llorriFieldTargets(header);
  if (!targets.includes(target)) throw new Error(`L'LORRI camera target ${target} is not in the frame's field of view (${targets.join(', ')}).`);
  return target;
}

/** The partially processed L'LORRI product has co-registered DN, uncertainty and
 * bit-mask FITS HDUs. Do not mistake DN/exposure for absolute radiance or I/F. */
export function decodeLlorri(bytes: Buffer, value: unknown) {
  const camera=parseLlorriCamera(value);
  const image = readFitsPrimary(bytes), sigma = readFitsPrimary(bytes.subarray(image.nextOffset));
  const quality = readFitsPrimary(bytes.subarray(image.nextOffset + sigma.nextOffset)), h = requireRecord(image.header);
  if (image.bitpix !== -32 || sigma.bitpix !== -32 || quality.bitpix !== 16 || quality.zero !== 32768 ||
      [image,sigma,quality].some(f => f.width !== 1024 || f.height !== 1024 || f.scale !== 1) ||
      image.zero !== 0 || sigma.zero !== 0 || image.nextOffset + sigma.nextOffset + quality.nextOffset !== bytes.length ||
      unquote(h.STARTUTC) !== camera.startTime || camera.width !== 1024 || camera.height !== 1024 ||
      unquote(h.CTYPE1) !== 'RA---TAN-SIP' || unquote(h.CTYPE2) !== 'DEC--TAN-SIP' ||
      ['BIASCORR','SMEARCOR','FLATCORR'].some(k => unquote(h[k]) !== 'PERFORM') ||
      unquote(h.AVSCORR) !== 'OMIT' || !(Number(h.EXPTIME) > 0)) throw new Error('Unsupported L\'LORRI calibration or paired FITS layout.');
  requireLlorriTarget(h, camera.target);
  const count = image.values.length, values = new Float32Array(count), flags = quality.values;
  for (let i = 0; i < count; i++) values[i] = image.values[i]/Number(h.EXPTIME);
  return { width:1024,height:1024,planes:{IMAGE:values},camera,...bindSipCamera(camera),
    startTime:camera.startTime,filter:'PANCHROMATIC',
    acceptPixel:(i: number) => flags[i] === 0 && Number.isFinite(values[i]) && Number.isFinite(sigma.values[i]) && sigma.values[i] >= 0,
    qualityReport:{units:'relative DN per second',pairedSigmaAndQuality:true,exposureSeconds:Number(h.EXPTIME),
      flagDefinition:'All nonzero bits rejected: bias, flat, permanent defect, hot pixel, saturation, missing pixel.',
      geometry:'Source-mesh intersections through the original TAN-SIP WCS and the registered image-to-surface translation recorded in the pinned camera closure.',
      illumination:'Original acquisition illumination retained. No albedo or disk-normalization claim.',
      limitations:'Partially processed image: bias, smear and flat corrected; absolute calibration omitted by the source.'} };
}
