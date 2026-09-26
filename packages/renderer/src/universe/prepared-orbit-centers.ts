import type { PositionM } from '@cssearth/engine';
import { numbers, record, text } from '../validation/guards.js';

export interface PreparedOrbitCenter {
  readonly positionM: PositionM;
  readonly centerBodyId: string;
}
interface Point { readonly id: string; readonly positionM: PositionM; }

/** Validate transported coordinate origins. They never acquire a render entry. */
export function parsePreparedOrbitCenters(value: unknown, focus: Point,
  bodies: readonly { readonly id: string; readonly positionM: PositionM;
    readonly orbit?: { readonly centerBodyId: string; readonly centerPositionM: PositionM } }[],
): Readonly<Record<string, PreparedOrbitCenter>> {
  const entries = value === undefined ? [] : Object.entries(record(value, 'orbit centres'));
  const visible = new Set([focus.id, ...bodies.map(body => body.id)]);
  const centers = Object.fromEntries(entries.map(([id, value]) => {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || visible.has(id)) throw new TypeError('Orbit centre identities must be valid and exclude rendered points.');
    const input = record(value, 'orbit centre', ['positionM', 'centerBodyId']);
    const position = numbers(input.positionM, 'orbit centre position');
    if (position.length !== 3) throw new TypeError('Orbit centre position must be a finite three-vector.');
    const centerBodyId = text(input.centerBodyId, 'orbit centre parent');
    const positionM: PositionM = Object.freeze([position[0]!, position[1]!, position[2]!]);
    return [id, Object.freeze({ positionM, centerBodyId })] as const;
  }));
  const nodes = new Map<string, { readonly positionM: PositionM; readonly centerBodyId?: string }>([
    [focus.id, focus],
    ...bodies.map(body => [body.id, { positionM: body.positionM, centerBodyId: body.orbit?.centerBodyId }] as const),
    ...Object.entries(centers),
  ]);
  for (const body of bodies) {
    if (!body.orbit) continue;
    const parent = nodes.get(body.orbit.centerBodyId);
    if (!parent || !parent.positionM.every((value, axis) => value === body.orbit!.centerPositionM[axis])) {
      throw new TypeError('Context orbit centre must match a prepared parent body or coordinate origin.');
    }
  }
  for (const [start] of nodes) {
    const ancestors = new Set<string>();
    for (let id: string | undefined = start; id !== undefined;) {
      const node = nodes.get(id);
      if (!node || ancestors.has(id)) throw new TypeError('Context orbit parent hierarchy must terminate at a prepared point.');
      ancestors.add(id); id = node.centerBodyId;
    }
  }
  return Object.freeze(centers);
}
