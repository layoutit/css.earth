/** Limb-darkening laws a star is drawn with, and the model grids they are read from.
 *
 * A law is quadratic, I(mu)/I(1) = 1 - u1 (1 - mu) - u2 (1 - mu)^2, or a power law, I(mu)/I(1) = mu^alpha, the form interferometry
 * fits to a resolved disc (Hestroffer 1997). A grid law is interpolated between the model nodes around the star: bilinear in effective
 * temperature and gravity, trilinear when the grid also tabulates mass (spherical models). A grid that lacks a node beside the star is
 * read between the nearest nodes that all exist, never extrapolated. */
import { requireFiniteNumber } from '@cssearth/core';
import { checkLimbLaw } from '@cssearth/objects';
import type { LimbLaw } from '@cssearth/objects';

/** Intensity relative to the disc centre at mu = cos(angle from the line of sight). */
export function limbIntensity(mu: number, law: LimbLaw | { readonly u1: number; readonly u2: number }): number {
  if ('law' in law && law.law === 'power') return Math.max(0, mu) ** law.alpha;
  const { u1, u2 } = law as { u1: number; u2: number };
  return 1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2;
}

export interface GridNode { readonly teff: number; readonly logg: number; readonly mass?: number; readonly u1: number; readonly u2: number }
export interface GridRead { readonly u1: number; readonly u2: number; readonly u1Bounds: readonly [number, number]; readonly u2Bounds: readonly [number, number];
  /** The nodes the law was read between: the four (or eight) corners, which may be wider than the nearest two per axis. */
  readonly corners: readonly GridNode[] }

/** The bracket pairs around `value` from sorted `values`, narrowest first: [lo, hi] with lo <= value <= hi and lo < hi. A value on a
 * node is bracketed from below, as the grid reader always has, so a star on a node reads the same corners as before. */
function brackets(values: readonly number[], value: number): (readonly [number, number])[] {
  const below = values.filter(v => v <= value).reverse(), above = values.filter(v => v >= value);
  const out: [number, number, number, number][] = [];
  below.forEach((lo, i) => above.forEach((hi, j) => { if (hi > lo) out.push([lo, hi, i + j, j]); }));
  return out.sort((a, b) => a[2] - b[2] || a[3] - b[3]).map(([lo, hi]) => [lo, hi] as const);
}

/** Interpolate a grid at the star: linear along each axis between the narrowest enclosing nodes that all exist. */
export function interpolateGrid(nodes: readonly GridNode[], at: { readonly teff: number; readonly logg: number; readonly mass?: number }, { darkEdge = false }: { darkEdge?: boolean } = {}): GridRead {
  const axis = (key: 'teff' | 'logg' | 'mass') => [...new Set(nodes.map(node => node[key]).filter((v): v is number => v !== undefined))].sort((a, b) => a - b);
  const teffs = axis('teff'), loggs = axis('logg'), masses = at.mass === undefined ? [] : axis('mass');
  const outside = (name: string, values: readonly number[], value: number) => { if (!(value >= values[0]! && value <= values.at(-1)!)) throw new RangeError(`${value} is outside the grid ${values.join(', ')}.`); };
  outside('Teff', teffs, at.teff); outside('log g', loggs, at.logg); if (at.mass !== undefined) outside('mass', masses, at.mass);
  const find = (t: number, g: number, m?: number) => nodes.filter(n => n.teff === t && n.logg === g && (m === undefined || n.mass === m));
  const candidates: { t: readonly [number, number]; g: readonly [number, number]; m: readonly [number, number] | null; width: number }[] = [];
  const tb = brackets(teffs, at.teff), gb = brackets(loggs, at.logg), mb = at.mass === undefined ? [null] : brackets(masses, at.mass);
  tb.forEach((t, i) => gb.forEach((g, j) => mb.forEach((m, k) => candidates.push({ t, g, m, width: i + j + k }))));
  candidates.sort((a, b) => a.width - b.width);
  for (const { t, g, m } of candidates) {
    const corners: GridNode[] = [];
    let complete = true;
    for (const tv of new Set(t)) for (const gv of new Set(g)) for (const mv of m ? new Set(m) : [undefined]) {
      const found = find(tv, gv, mv);
      if (found.length > 1) throw new TypeError(`The grid must hold exactly one node at ${tv} K, log g ${gv}${mv === undefined ? '' : `, ${mv} solar masses`}.`);
      if (!found.length) { complete = false; break; }
      corners.push(found[0]!);
    }
    if (!complete) continue;
    const fraction = (range: readonly [number, number], value: number) => range[1] === range[0] ? 0 : (value - range[0]) / (range[1] - range[0]);
    const ft = fraction(t, at.teff), fg = fraction(g, at.logg), fm = m ? fraction(m, at.mass!) : 0;
    const weight = (node: GridNode) => (node.teff === t[0] && t[0] !== t[1] ? 1 - ft : node.teff === t[1] && t[0] !== t[1] ? ft : 1)
      * (node.logg === g[0] && g[0] !== g[1] ? 1 - fg : node.logg === g[1] && g[0] !== g[1] ? fg : 1)
      * (!m || m[0] === m[1] ? 1 : node.mass === m[0] ? 1 - fm : fm);
    const sum = (key: 'u1' | 'u2') => corners.reduce((total, node) => total + node[key] * weight(node), 0);
    const u1 = sum('u1'), u2 = sum('u2');
    checkLimbLaw({ u1, u2 }, { darkEdge });
    return { u1, u2, corners, u1Bounds: [Math.min(...corners.map(c => c.u1)), Math.max(...corners.map(c => c.u1))], u2Bounds: [Math.min(...corners.map(c => c.u2)), Math.max(...corners.map(c => c.u2))] };
  }
  throw new TypeError(`The grid holds no complete set of nodes around ${at.teff} K, log g ${at.logg}${at.mass === undefined ? '' : `, ${at.mass} solar masses`}.`);
}

/** Howarth (2011, MNRAS 413, 1515) publishes one coefficient file per ATLAS9 model, named tNNNNNgNN (temperature in K, gravity
 * times ten). The block of a passband starts with its name; its `quadratic` line holds a and b, then the rms and maximum residuals. */
export function readHowarthNode(name: string, text: string, passband: string): GridNode {
  const match = /t(\d{4,6})g(\d{2})\.uc[EP]$/u.exec(name);
  if (!match) throw new TypeError(`${name}: a Howarth (2011) coefficient file is named tNNNNNgNN.ucE or .ucP.`);
  const lines = text.split(/\r?\n/u), start = lines.findIndex(line => line.trimStart().startsWith(`${passband} `));
  if (start < 0) throw new TypeError(`${name}: no ${passband} block.`);
  const quadratic = lines.slice(start + 1, start + 10).find(line => /^\s*quadratic\s/u.test(line));
  if (!quadratic) throw new TypeError(`${name}: the ${passband} block has no quadratic law.`);
  const [a, b] = quadratic.trim().split(/\s+/u).slice(1, 3).map(Number);
  return { teff: Number(match[1]), logg: Number(match[2]) / 10, u1: requireFiniteNumber(a, `${name} quadratic a`), u2: requireFiniteNumber(b, `${name} quadratic b`) };
}
