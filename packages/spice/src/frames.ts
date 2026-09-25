/**
 * Reference frames from text kernels. PCK body-fixed frames follow the IAU
 * pole model (right ascension, declination and prime meridian polynomials,
 * optional nutation-precession terms). Frame kernels define fixed-offset
 * (class 4) frames by angles, matrix or quaternion, CK-driven (class 3)
 * frames, and PCK (class 2) frames. `rotation(frame, et)` returns the matrix
 * that maps J2000 vectors into the frame, resolving the chain through
 * whichever providers the caller supplies.
 */
import { has, number, numbers, string, strings, type KernelPool } from './text-kernel.js';
import { multiply, transpose, quaternionToMatrix, type Matrix3 } from './ck.js';
import { ECLIPTIC_OBLIQUITY_RAD } from './geometry.js';

const RAD = Math.PI / 180;
/** SPICE `rotate`: the frame rotation by `angle` about axis 1, 2 or 3 (vectors expressed in the rotated frame). */
export function rotate(angle: number, axis: 1 | 2 | 3): Matrix3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  if (axis === 1) return [[1, 0, 0], [0, c, s], [0, -s, c]];
  if (axis === 2) return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
  return [[c, s, 0], [-s, c, 0], [0, 0, 1]];
}
export const identity: Matrix3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** The IAU pole model's angles at ET for a body described by BODYnnn_POLE_RA/_POLE_DEC/_PM (degrees; per century or per day):
 * the pole's right ascension and declination and the prime meridian angle W, with any nutation-precession terms applied. */
export function pckAngles(pool: KernelPool, body: number, et: number): { ra: number; dec: number; w: number } {
  const key = (name: string) => `BODY${body}_${name}`;
  if (!has(pool, key('POLE_RA')) || !has(pool, key('POLE_DEC')) || !has(pool, key('PM'))) throw new Error(`No PCK orientation for body ${body}.`);
  const days = et / 86400, centuries = days / 36525;
  const poly = (coefficients: number[], t: number) => coefficients.reduce((sum, c, i) => sum + c * t ** i, 0);
  let ra = poly(numbers(pool, key('POLE_RA')), centuries), dec = poly(numbers(pool, key('POLE_DEC')), centuries), w = poly(numbers(pool, key('PM')), days);
  if (has(pool, key('NUT_PREC_RA')) || has(pool, key('NUT_PREC_DEC')) || has(pool, key('NUT_PREC_PM'))) {
    const angles = numbers(pool, `BODY${Math.floor(body / 100)}_NUT_PREC_ANGLES`);
    const terms = (name: string) => has(pool, key(name)) ? numbers(pool, key(name)) : [];
    for (let i = 0; i < angles.length; i += 2) {
      const theta = (angles[i] + angles[i + 1] * centuries) * RAD, k = i / 2;
      ra += (terms('NUT_PREC_RA')[k] ?? 0) * Math.sin(theta); dec += (terms('NUT_PREC_DEC')[k] ?? 0) * Math.cos(theta); w += (terms('NUT_PREC_PM')[k] ?? 0) * Math.sin(theta);
    }
  }
  return { ra, dec, w };
}

/** Body-fixed rotation from J2000 at ET for a body described by BODYnnn_POLE_RA/_POLE_DEC/_PM (degrees; per century or per day). */
export function pckRotation(pool: KernelPool, body: number, et: number): Matrix3 {
  const { ra, dec, w } = pckAngles(pool, body, et);
  return multiply(rotate(w * RAD, 3), multiply(rotate((90 - dec) * RAD, 1), rotate((90 + ra) * RAD, 3)));
}

export interface FrameDefinition { readonly id: number; readonly name: string; readonly class: number; readonly classId: number; readonly center?: number }

/**
 * NAIF body codes for SPICE's built-in IAU_<body> frames, which no kernel defines. Their
 * orientation still comes from the loaded PCK. Built-in frames get the internal id
 * BUILT_IN_FRAME_BASE + body code here; SPICE's own numbering is not reproduced.
 */
export const IAU_BODY_CODES: Readonly<Record<string, number>> = Object.freeze({
  SUN: 10, MERCURY: 199, VENUS: 299, EARTH: 399, MOON: 301, MARS: 499, PHOBOS: 401, DEIMOS: 402,
  JUPITER: 599, IO: 501, EUROPA: 502, GANYMEDE: 503, CALLISTO: 504, AMALTHEA: 505, HIMALIA: 506, THEBE: 514, ADRASTEA: 515, METIS: 516,
  SATURN: 699, MIMAS: 601, ENCELADUS: 602, TETHYS: 603, DIONE: 604, RHEA: 605, TITAN: 606, HYPERION: 607, IAPETUS: 608, PHOEBE: 609,
  JANUS: 610, EPIMETHEUS: 611, HELENE: 612, TELESTO: 613, CALYPSO: 614, ATLAS: 615, PROMETHEUS: 616, PANDORA: 617, PAN: 618,
  METHONE: 632, PALLENE: 633, POLYDEUCES: 634, DAPHNIS: 635,
  URANUS: 799, ARIEL: 701, UMBRIEL: 702, TITANIA: 703, OBERON: 704, MIRANDA: 705, PUCK: 715,
  NEPTUNE: 899, TRITON: 801, NEREID: 802, LARISSA: 807, PROTEUS: 808, PLUTO: 999, CHARON: 901,
});
const BUILT_IN_FRAME_BASE = 1_000_000;

/** Frame ids and classes from FRAME_* variables; J2000 (1), ECLIPJ2000 (17) and IAU_<body> frames are built in. */
export function frameDefinition(pool: KernelPool, nameOrId: string | number): FrameDefinition {
  if (nameOrId === 'J2000' || nameOrId === 1) return { id: 1, name: 'J2000', class: 1, classId: 1 };
  if (nameOrId === 'ECLIPJ2000' || nameOrId === 17) return { id: 17, name: 'ECLIPJ2000', class: 1, classId: 17 };
  const builtInBody = typeof nameOrId === 'string' ? (!has(pool, `FRAME_${nameOrId}`) && /^IAU_[A-Z]+$/u.test(nameOrId) ? IAU_BODY_CODES[nameOrId.slice(4)] : undefined)
    : Object.values(IAU_BODY_CODES).find(code => BUILT_IN_FRAME_BASE + code === nameOrId);
  if (builtInBody !== undefined) {
    const name = `IAU_${Object.keys(IAU_BODY_CODES).find(key => IAU_BODY_CODES[key] === builtInBody)}`;
    return { id: BUILT_IN_FRAME_BASE + builtInBody, name, class: 2, classId: builtInBody, center: builtInBody };
  }
  const id = typeof nameOrId === 'number' ? nameOrId : has(pool, `FRAME_${nameOrId}`) ? number(pool, `FRAME_${nameOrId}`) : NaN;
  if (!Number.isInteger(id)) throw new Error(`Unknown frame: ${nameOrId}`);
  const name = has(pool, `FRAME_${id}_NAME`) ? string(pool, `FRAME_${id}_NAME`) : String(nameOrId);
  return { id, name, class: number(pool, `FRAME_${id}_CLASS`), classId: number(pool, `FRAME_${id}_CLASS_ID`), ...(has(pool, `FRAME_${id}_CENTER`) ? { center: number(pool, `FRAME_${id}_CENTER`) } : {}) };
}

/** The fixed offset of a class 4 frame as its TKFRAME_* variables list it: the matrix M with V_relative = M * V_frame, mapping
 * this frame's vectors into the relative frame (frames.req; ANGLES compose as [a1]_i [a2]_j [a3]_k, MATRIX is column-major,
 * QUATERNION goes through q2m). DART's terminal DRACO quaternion equals its base and cruise matrices composed this way. */
export function tkFrameRotation(pool: KernelPool, frame: FrameDefinition): { relative: string; matrix: Matrix3 } {
  const key = (suffix: string) => has(pool, `TKFRAME_${frame.id}_${suffix}`) ? `TKFRAME_${frame.id}_${suffix}` : `TKFRAME_${frame.name}_${suffix}`;
  const relative = string(pool, key('RELATIVE')), spec = string(pool, key('SPEC')).toUpperCase();
  if (spec === 'ANGLES') {
    const angles = numbers(pool, key('ANGLES')), axes = numbers(pool, key('AXES')), units = has(pool, key('UNITS')) ? string(pool, key('UNITS')).toUpperCase() : 'RADIANS';
    if (angles.length !== 3 || axes.length !== 3 || !axes.every(axis => [1, 2, 3].includes(axis))) throw new Error(`Invalid TKFRAME angles for ${frame.name}.`);
    const scale = units === 'DEGREES' ? RAD : units === 'RADIANS' ? 1 : units === 'ARCSECONDS' ? RAD / 3600 : NaN;
    if (!Number.isFinite(scale)) throw new Error(`Unsupported TKFRAME angle units for ${frame.name}: ${units}`);
    // [a1]_i [a2]_j [a3]_k, the matrix from this frame to its relative frame.
    const [a1, a2, a3] = angles.map(a => a * scale), [i, j, k] = axes as (1 | 2 | 3)[];
    return { relative, matrix: multiply(rotate(a1, i), multiply(rotate(a2, j), rotate(a3, k))) };
  }
  if (spec === 'MATRIX') {
    const m = numbers(pool, key('MATRIX'));
    if (m.length !== 9) throw new Error(`Invalid TKFRAME matrix for ${frame.name}.`);
    // Kernel matrices are listed column by column (Fortran order).
    return { relative, matrix: [[m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]]] };
  }
  if (spec === 'QUATERNION') {
    const q = numbers(pool, has(pool, key('Q')) ? key('Q') : key('QUATERNION'));
    if (q.length !== 4) throw new Error(`Invalid TKFRAME quaternion for ${frame.name}.`);
    return { relative, matrix: quaternionToMatrix(q) };
  }
  throw new Error(`Unsupported TKFRAME spec for ${frame.name}: ${spec}`);
}

export interface FrameProviders {
  /** C-matrix from the CK reference frame into the instrument frame at ET, plus that reference frame's id. */
  readonly ck?: (instrument: number, et: number) => { cMatrix: Matrix3; reference: number } | null;
  readonly pck?: (body: number, et: number) => Matrix3;
}

/** Rotation from J2000 into the named frame at ET. */
export function rotation(pool: KernelPool, nameOrId: string | number, et: number, providers: FrameProviders, depth = 0): Matrix3 {
  if (depth > 32) throw new Error('Frame chain is too deep.');
  const frame = frameDefinition(pool, nameOrId);
  if (frame.class === 1) {
    if (frame.id === 1) return identity;
    // ECLIPJ2000: the J2000 equator turned to the ecliptic about +X by the IAU 1976 obliquity.
    if (frame.id === 17) return rotate(ECLIPTIC_OBLIQUITY_RAD, 1);
    throw new Error(`Only the J2000 and ECLIPJ2000 inertial frames are supported, not ${frame.name}.`);
  }
  if (frame.class === 2) { if (!providers.pck) throw new Error(`No PCK provider for ${frame.name}.`); return providers.pck(frame.classId, et); }
  if (frame.class === 3) {
    if (!providers.ck) throw new Error(`No CK provider for ${frame.name}.`);
    const pointing = providers.ck(frame.classId, et);
    if (!pointing) throw new Error(`No CK pointing for ${frame.name} at ET ${et}.`);
    return multiply(pointing.cMatrix, rotation(pool, pointing.reference, et, providers, depth + 1));
  }
  if (frame.class === 4) { const { relative, matrix } = tkFrameRotation(pool, frame); return multiply(transpose(matrix), rotation(pool, relative, et, providers, depth + 1)); }
  if (frame.class === 5) return multiply(eulerFrameRotation(pool, frame, et), rotation(pool, string(pool, `FRAME_${frame.id}_RELATIVE`), et, providers, depth + 1));
  if (frame.class === 6) return rotation(pool, switchFrameMember(pool, frame, et), et, providers, depth + 1);
  throw new Error(`Unsupported frame class ${frame.class} for ${frame.name}.`);
}

/** Parameterized Euler dynamic frames: polynomial angles in seconds past the frame epoch; the kernel lists the rotation
 * from this frame to its base as [a1]_i [a2]_j [a3]_k, so the base-to-frame matrix is its transpose. */
export function eulerFrameRotation(pool: KernelPool, frame: FrameDefinition, et: number): Matrix3 {
  const key = (suffix: string) => `FRAME_${frame.id}_${suffix}`;
  if (string(pool, key('DEF_STYLE')).toUpperCase() !== 'PARAMETERIZED' || string(pool, key('FAMILY')).toUpperCase() !== 'EULER') throw new Error(`Unsupported dynamic frame family for ${frame.name}.`);
  const epoch = number(pool, key('EPOCH')), axes = numbers(pool, key('AXES')) as (1 | 2 | 3)[], units = string(pool, key('UNITS')).toUpperCase();
  const scale = units === 'DEGREES' ? RAD : units === 'RADIANS' ? 1 : NaN;
  if (axes.length !== 3 || !axes.every(axis => [1, 2, 3].includes(axis)) || !Number.isFinite(scale)) throw new Error(`Invalid Euler frame definition for ${frame.name}.`);
  const t = et - epoch;
  const angle = (n: number) => numbers(pool, key(`ANGLE_${n}_COEFFS`)).reduce((sum, c, i) => sum + c * t ** i, 0) * scale;
  const toBase = multiply(rotate(angle(1), axes[0]), multiply(rotate(angle(2), axes[1]), rotate(angle(3), axes[2])));
  return [[toBase[0][0], toBase[1][0], toBase[2][0]], [toBase[0][1], toBase[1][1], toBase[2][1]], [toBase[0][2], toBase[1][2], toBase[2][2]]];
}

/** Switch frames select one aligned frame by the ET window (start inclusive, stop exclusive) that contains et. */
export function switchFrameMember(pool: KernelPool, frame: FrameDefinition, et: number): string {
  const key = (suffix: string) => `FRAME_${frame.id}_${suffix}`;
  const members = strings(pool, key('ALIGNED_WITH')), starts = numbers(pool, key('START')), stops = numbers(pool, key('STOP'));
  if (members.length !== starts.length || members.length !== stops.length || !members.length) throw new Error(`Invalid switch frame windows for ${frame.name}.`);
  for (let i = members.length - 1; i >= 0; i--) if (et >= starts[i] && et < stops[i]) return members[i];
  throw new Error(`Switch frame ${frame.name} has no member at ET ${et}.`);
}
export { strings as frameStrings };
