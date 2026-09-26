import assert from 'node:assert/strict';
import { POLAR_CAP_STYLE } from '../../src/renderers/css/preparation/scene/polar-cap.ts';

export type Pole = 'north' | 'south';
export interface PreparedCap { readonly pole: Pole; readonly style: string; readonly label?: string }

const length = (style: string, pattern: RegExp) => { const match = pattern.exec(style); return match ? Number(match[1]) : undefined; };
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/**
 * A cap leaf faces out of its body. This reads facing the way the browser culls a leaf, not the way polar-cap.ts's
 * requireOutwardCap does (the sign of the matrix's z axis): a box carried by axes X and Y shows its front along
 * sign(det) · (X × Y), the normal the back-face test takes from the inverse transform. That normal must point away from the
 * body's centre, from a plate on its own pole's side of the equator, centred on the rotation axis (the leaves' z).
 */
export function assertCapFacesOut(where: string, pole: Pole, style: string): void {
  const m = /(?:^|;)transform:matrix3d\(([^)]+)\)/u.exec(style)?.[1]?.split(',').map(Number) ?? [];
  assert.ok(m.length === 16 && m.every(Number.isFinite), `${where}: a cap has a finite matrix3d (${style.slice(0, 80)})`);
  assert.ok(m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1, `${where}: a flat plate has no perspective terms (${m.join(',')})`);
  const width = length(style, /--polycss-atlas-width:([\d.]+)px/u) ?? length(style, /(?:^|;)width:([\d.]+)px/u) ?? 64;
  const height = length(style, /--polycss-atlas-height:([\d.]+)px/u) ?? length(style, /(?:^|;)height:([\d.]+)px/u) ?? 64;
  const x = m.slice(0, 3), y = m.slice(4, 7), z = m.slice(8, 11);
  const cross = [x[1]! * y[2]! - x[2]! * y[1]!, x[2]! * y[0]! - x[0]! * y[2]!, x[0]! * y[1]! - x[1]! * y[0]!];
  const front = cross.map(value => value * Math.sign(dot(cross, z)));
  const centre = [0, 1, 2].map(axis => m[12 + axis]! + x[axis]! * width / 2 + y[axis]! * height / 2);
  const half = Math.hypot(x[0]!, x[1]!, x[2]!) * width / 2;
  assert.equal(Math.sign(centre[2]!), pole === 'north' ? 1 : -1, `${where}: the plate sits on the ${pole} side (centre ${centre.join(',')})`);
  assert.ok(Math.hypot(centre[0]!, centre[1]!) < half * 1e-3, `${where}: the disc is centred on the rotation axis (centre ${centre.join(',')})`);
  assert.ok(dot(front, centre) > 0, `${where}: the plate faces out of the body (front ${front.join(',')}, centre ${centre.join(',')})`);
}

/** The one cap rule (src/renderers/css/preparation/scene/polar-cap.ts) on a lane's prepared caps: both poles closed, each cap
 * the disc its round image fills, never drawn from both sides, and facing out of the body. */
export function assertPolarCaps(owner: string, caps: readonly PreparedCap[]): void {
  assert.deepEqual(new Set(caps.map(cap => cap.pole)), new Set(['north', 'south']), `${owner}: caps close both poles`);
  for (const { pole, style, label = pole } of caps) {
    const where = `${owner} ${label}`;
    assert.ok(style.endsWith(POLAR_CAP_STYLE), `${where}: the cap is the disc its round image fills (…${style.slice(-48)})`);
    assert.ok(!style.includes('backface-visibility'), `${where}: a cap is never drawn from both sides`);
    assertCapFacesOut(where, pole, style);
  }
}

/** The pole a cap's class names (`…-north` or `…-south`). */
export function poleOfClass(className: string): Pole {
  const poles = className.split(/\s+/u).flatMap(name => /-(north|south)$/u.exec(name)?.[1] ?? []);
  const [pole] = new Set(poles);
  if (poles.length === 0 || new Set(poles).size !== 1 || (pole !== 'north' && pole !== 'south')) throw new TypeError(`Cap class "${className}" names no single pole.`);
  return pole;
}
