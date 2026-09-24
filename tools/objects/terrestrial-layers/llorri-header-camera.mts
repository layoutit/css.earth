import { cross3 as cross } from '../../../src/platform/vector3.mts';
/** Native FITS TAN-SIP camera seed. Surface registration remains a separate requirement. */
import { sha256 } from '@cssearth/core/node';
import { scanFitsCards, fitsCardValue } from '../observation/fits.mts';
import { requireFiniteNumber } from '@cssearth/core';
import type { KernelSet } from '../../spice/kernel-set.mts';
import { pckRotation } from '../../spice/frames.mts';
import { utcToEt } from '../../spice/lsk.mts';
import { llorriFieldTargets, requireLlorriTarget } from './llorri-geo.mts';
import { dotN as dot } from '../../../src/platform/vector3.mts';

const inverse = (a: readonly (readonly number[])[]) => {
  const columns = [cross(a[1], a[2]), cross(a[2], a[0]), cross(a[0], a[1])], determinant = dot(a[0], columns[0]);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-16) throw new Error('Degenerate FITS camera.');
  return [0,1,2].map(i => columns.map(column => column[i] / determinant));
};

/** Same header equations as prepare-archived-camera.py; shared SPICE supplies the source body frame.
 * A frame that shows several bodies needs the caller to name the camera's target. */
export function llorriHeaderCamera(bytes: Buffer, kernels: KernelSet, bodyId: number, target?: string) {
  const h: Record<string, unknown> = {};
  // Other mission cards may contain FITS undefined values. Decode only the camera's fields.
  scanFitsCards(bytes, 0, (key, card) => {
    if (!/^(NAXIS[12]|CTYPE[12]|CRVAL[12]|CRPIX[12]|CD[12]_[12]|[AB]_\d_\d|SPCTS[CO][XYZ]|MIDUTC|STARTUTC|TRGFOVN|TRGFOV\d+)$/.test(key)) return;
    if (Object.hasOwn(h, key)) throw new Error(`Duplicate FITS camera field ${key}.`);
    h[key] = fitsCardValue(card);
  }, 131040);
  const number = (key: string) => requireFiniteNumber(h[key], `FITS ${key}`);
  const image = { width: number('NAXIS1'), height: number('NAXIS2') };
  const text = (key: string) => { const value = h[key]; if (typeof value !== 'string') throw new Error(`Missing FITS ${key}.`); return value.replace(/^'(.*)'$/, '$1').trim(); };
  if (image.width !== 1024 || image.height !== 1024 || text('CTYPE1') !== 'RA---TAN-SIP' || text('CTYPE2') !== 'DEC--TAN-SIP') throw new Error('Unsupported L\'LORRI WCS.');
  const targets = llorriFieldTargets(h);
  if (target === undefined && targets.length !== 1) throw new Error(`L'LORRI frame shows several targets (${targets.join(', ')}); name the camera target.`);
  const cameraTarget = target === undefined ? targets[0] : requireLlorriTarget(h, target);
  const utc = text('MIDUTC');
  const rotation = pckRotation(kernels.pool, bodyId, utcToEt(kernels.leapSeconds, utc.endsWith('Z') ? utc : `${utc}Z`));
  const bodyToJ2000 = rotation[0].map((_, i) => rotation.map(row => row[i]));
  const eye = ['X','Y','Z'].map(c => number(`SPCTSC${c}`)), solar = ['X','Y','Z'].map(c => number(`SPCTSO${c}`));
  const sun = rotation.map(row => dot(row, solar)), sunLength = Math.hypot(...sun);
  const ra = number('CRVAL1') * Math.PI / 180, dec = number('CRVAL2') * Math.PI / 180;
  const east = [-Math.sin(ra), Math.cos(ra), 0], north = [-Math.sin(dec)*Math.cos(ra), -Math.sin(dec)*Math.sin(ra), Math.cos(dec)];
  const bore = [Math.cos(dec)*Math.cos(ra), Math.cos(dec)*Math.sin(ra), Math.sin(dec)];
  const cd = [[number('CD1_1'), number('CD1_2')], [number('CD2_1'), number('CD2_2')]], determinant = cd[0][0]*cd[1][1]-cd[0][1]*cd[1][0];
  if (!Number.isFinite(determinant) || determinant === 0) throw new Error('Degenerate FITS CD matrix.');
  const inv = [[cd[1][1]/determinant,-cd[0][1]/determinant],[-cd[1][0]/determinant,cd[0][0]/determinant]];
  const referencePixel = [number('CRPIX1')-1, number('CRPIX2')-1];
  const k = [...inv.map((row, i) => east.map((e,j) => (row[0]*e+row[1]*north[j])*180/Math.PI + referencePixel[i]*bore[j])), bore];
  const matrix = k.map(row => [...[0,1,2].map(i => dot(row, bodyToJ2000.map(r => r[i]))), -dot(row, eye)]);
  const terms = (prefix: string) => [2,3].flatMap(d => Array.from({length:d+1}, (_,i) => [i,d-i,h[`${prefix}_${i}_${d-i}`] === undefined ? 0 : number(`${prefix}_${i}_${d-i}`)]));
  return { schema: 'cssearth-archived-camera@1', target: cameraTarget, startTime: text('STARTUTC'), filter: 'PANCHROMATIC', width: image.width, height: image.height,
    matrix, rayMatrix: inverse(matrix.map(row => row.slice(0,3))), positionKm: rotation.map(row => dot(row,eye)), sunDirection: sun.map(n => n/sunLength),
    sip: { referencePixel, a: terms('A'), b: terms('B'), offsetPixels: [0,0] },
    checks: { status: 'unregistered-header-seed', pointing: 'Original FITS WCS and source body frame. No image-to-surface registration established.' } };
}
