/** The measured subject may differ from the object whose display it locates. */
export interface DistanceSubject {
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
  readonly reason: string;
}

export function parseDistanceSubject(input: unknown): DistanceSubject {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid distance subject.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !['id', 'name', 'relationship', 'reason'].includes(key)) ||
      !['id', 'name', 'relationship', 'reason'].every(key => typeof value[key] === 'string' && String(value[key]).trim()) ||
      typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.relationship !== 'string' || typeof value.reason !== 'string') {
    throw new TypeError('Distance subject requires identity, relationship and adoption reason.');
  }
  return { id: value.id, name: value.name, relationship: value.relationship, reason: value.reason };
}

/** Check a prepared derivation, never replace its coordinates at runtime.
 * 1e-10 of the radial distance allows the producer's 12-significant-digit rounding.
 */
export function validateSpatialPosition(frame: { readonly referenceFrame: unknown }, row: {
  readonly id: string; readonly positionM: readonly number[];
  readonly skyPosition: { readonly raDeg: number; readonly decDeg: number };
  readonly distance: { readonly valuePc: number; readonly subject?: unknown };
}): void {
  if (frame.referenceFrame !== 'sun-icrf') throw new TypeError('Unsupported spatial reference frame.');
  if (!Number.isFinite(row.skyPosition.raDeg) || !Number.isFinite(row.skyPosition.decDeg) || row.skyPosition.raDeg < 0 || row.skyPosition.raDeg >= 360 || row.skyPosition.decDeg < -90 || row.skyPosition.decDeg > 90) throw new TypeError('Invalid spatial sky coordinates.');
  const radius = row.distance.valuePc * 3.085677581491367e16;
  const ra = row.skyPosition.raDeg * Math.PI / 180, dec = row.skyPosition.decDeg * Math.PI / 180;
  const expected = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  if (!Number.isFinite(radius) || radius <= 0 || row.positionM.length !== 3 ||
      row.positionM.some((value, index) => !Number.isFinite(value) || Math.abs(value / radius - expected[index]!) > 1e-10)) {
    throw new TypeError(`Prepared position disagrees with sky coordinates and distance: ${row.id}.`);
  }
  if (row.distance.subject !== undefined && parseDistanceSubject(row.distance.subject).id === row.id) {
    throw new TypeError('An adopted distance subject must differ from the displayed object.');
  }
}

/** Physical hosts can lack positions; they do not acquire rendering capabilities. */
export interface UnpositionedHost {
  readonly id: string; readonly name: string; readonly sourceRef: string; readonly reason: string;
  readonly hostId?: string;
}

export function validatePhysicalHosts(objects: readonly { readonly id: string; readonly hostId?: string }[],
  hosts: readonly UnpositionedHost[]): void {
  const byId = new Map<string, { readonly id: string; readonly hostId?: string }>();
  for (const row of [...objects, ...hosts]) {
    if (byId.has(row.id)) throw new TypeError(`Duplicate physical host identity: ${row.id}.`);
    byId.set(row.id, row);
  }
  const complete = new Set<string>();
  for (const row of byId.values()) {
    const chain = new Set<string>();
    let current: typeof row | undefined = row;
    while (current && !complete.has(current.id)) {
      if (chain.has(current.id)) throw new TypeError(`Cyclic physical host: ${current.id}.`);
      chain.add(current.id);
      if (current.hostId !== undefined && !byId.has(current.hostId)) throw new TypeError(`Unknown physical host: ${current.hostId}.`);
      current = current.hostId === undefined ? undefined : byId.get(current.hostId);
    }
    chain.forEach(id => complete.add(id));
  }
}
