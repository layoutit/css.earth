import type { SurfaceTriangle } from '@cssearth/renderer/navigation/prepared-surface-hit.ts';
import { orient3d } from 'robust-predicates';

/** Preparation-only visibility priority graph. With both faces front-facing,
 * A can hide B only if A reaches in front of B's plane AND B reaches behind
 * A's plane. An edge B -> A therefore requires B to paint first. Cycles stay
 * together in Chromium's native 3D context; no polygon is cut or approximated.
 * This is the fixed face-priority / cluster decomposition described by
 * Sutherland, Sproull and Schumacker (1974), doi:10.1145/356625.356626.
 * frontSigns come from the actual prepared CSS facing orientation, not a
 * presumed mesh winding, convexity, body name, or signed volume. */
export function visibilityComponents(triangles: readonly SurfaceTriangle[], frontSigns: readonly number[]) {
  if (triangles.length !== frontSigns.length || frontSigns.some(sign => sign !== 1 && sign !== -1)) {
    throw new TypeError('Visibility priorities require each source face orientation.');
  }
  const count = triangles.length;
  const above = Array.from({ length: count }, () => new Uint8Array(count));
  const below = Array.from({ length: count }, () => new Uint8Array(count));
  for (let a = 0; a < count; a++) {
    const [p, q, r] = triangles[a];
    for (let b = 0; b < count; b++) if (a !== b) for (const v of triangles[b]) {
      // orient3d's sign is opposite the ordinary (q-p) x (r-p) dot (v-p).
      const distance = -frontSigns[a] * orient3d(...p, ...q, ...r, ...v);
      if (distance > 0) above[a][b] = 1;
      if (distance < 0) below[a][b] = 1;
    }
  }
  const edges = Array.from({ length: count }, () => [] as number[]);
  for (let a = 0; a < count; a++) for (let b = 0; b < count; b++) if (a !== b) {
    if (above[a][b] && below[b][a] || a < b && !above[a][b] && !below[a][b] && !above[b][a] && !below[b][a]) edges[a].push(b);
  }
  let serial = 0;
  const ids = new Int32Array(count).fill(-1), low = new Int32Array(count), active = new Uint8Array(count);
  const stack: number[] = [], components: number[][] = [];
  function visit(v: number) {
    ids[v] = low[v] = serial++; stack.push(v); active[v] = 1;
    for (const w of edges[v]) {
      if (ids[w] < 0) { visit(w); low[v] = Math.min(low[v], low[w]); }
      else if (active[w]) low[v] = Math.min(low[v], ids[w]);
    }
    if (low[v] === ids[v]) {
      const component: number[] = []; let w: number;
      do { w = stack.pop()!; active[w] = 0; component.push(w); } while (w !== v);
      components.push(component.sort((a, b) => a - b));
    }
  }
  for (let v = 0; v < count; v++) if (ids[v] < 0) visit(v);
  const owner = new Int32Array(count);
  components.forEach((component, i) => component.forEach(face => { owner[face] = i; }));
  const outgoing = components.map(() => new Set<number>()), incoming = new Int32Array(components.length);
  for (let a = 0; a < count; a++) for (const b of edges[a]) if (owner[a] !== owner[b] && !outgoing[owner[a]].has(owner[b])) {
    outgoing[owner[a]].add(owner[b]); incoming[owner[b]]++;
  }
  const ready = components.flatMap((_, i) => incoming[i] === 0 ? [i] : []), ordered: number[][] = [];
  while (ready.length) {
    ready.sort((a, b) => components[a][0] - components[b][0]);
    const next = ready.shift()!; ordered.push(components[next]);
    for (const dependent of outgoing[next]) if (--incoming[dependent] === 0) ready.push(dependent);
  }
  if (ordered.length !== components.length) throw new TypeError('Visibility condensation must be acyclic.');
  return ordered;
}
