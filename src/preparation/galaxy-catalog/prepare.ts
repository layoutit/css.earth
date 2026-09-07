import { M_PER_PC } from '@cssearth/astronomy';
import type { AuthorMetadata, CsvRow, GalaxyDistance, GalaxyMembership, GalaxyRecipe, GalaxySource, PreparedGalaxy, PreparedGalaxyCatalog, Vec3 } from './types.js';

/** Derived display coordinates: 12 significant digits, far below distance errors. */
function rounded(value: number): number { return Number(value.toPrecision(12)); }
function number(value: string | undefined): number | undefined {
  if (value === undefined || !value.trim()) return undefined;
  const n = Number(value); return Number.isFinite(n) ? n : undefined;
}
export function galaxyPositionM(raDeg: number, decDeg: number, distancePc: number): Vec3 {
  if (![raDeg, decDeg, distancePc].every(Number.isFinite) || raDeg < 0 || raDeg >= 360 || decDeg < -90 || decDeg > 90 || distancePc <= 0) throw new TypeError('Invalid galaxy astrometry.');
  const a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
  const direction = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  return direction.map(v => Math.abs(v) < 1e-15 ? 0 : rounded(v * distancePc * M_PER_PC)) as Vec3;
}

export function classifyMembership(id: string, metadata: ReadonlyMap<string, AuthorMetadata>, recipe: GalaxyRecipe, table: ReadonlyMap<string, string>): GalaxyMembership {
  const authoredName = recipe.membershipNames[id], code = authoredName === undefined ? undefined : table.get(authoredName);
  if (authoredName !== undefined && code === undefined) throw new TypeError(`Membership binding has no source row: ${authoredName}`);
  const codes = code?.split('/') ?? [];
  // Preserve published ambiguity between satellite and field, even if a newer
  // catalogue uses one host for convenience. Both G/L and A/L remain in the LG.
  if (codes.length > 1) return { group: codes.every(v => v !== 'N') ? 'local-group' : 'uncertain', subgroup: 'unknown', basis: `Published association ${code}; subgroup ambiguous.`, sourceRef: `${recipe.membershipSourceId}:${authoredName}` };
  if (code === 'N') return { group: 'local-volume', subgroup: 'field', basis: 'Published neighboring galaxy (N), not a Local Group membership assertion.', sourceRef: `${recipe.membershipSourceId}:${authoredName}` };
  const chain: string[] = []; let current: string | undefined = id;
  while (current) {
    if (chain.includes(current)) throw new TypeError(`Cyclic catalogue host chain: ${id}`);
    chain.push(current);
    const root = recipe.hostRoots[current];
    if (root) return { group: 'local-group', subgroup: root, basis: `Author catalogue host association: ${chain.join(' -> ')}; object confirmation is recorded separately.`, sourceRef: `${recipe.catalogueSourceId}:${id}:name_discovery` };
    current = metadata.get(current)?.name_discovery?.host;
  }
  if (code && ['G', 'A', 'L'].includes(code)) return { group: 'local-group', subgroup: code === 'G' ? 'milky-way' : code === 'A' ? 'andromeda' : 'field', basis: `Published Local Group association ${code}.`, sourceRef: `${recipe.membershipSourceId}:${authoredName}` };
  return { group: 'uncertain', subgroup: 'unknown', basis: 'No adopted Local Group membership evidence. Local Volume inclusion or spatial distance does not establish membership.' };
}

function distanceFromRow(row: CsvRow, author: AuthorMetadata, recipe: GalaxyRecipe): GalaxyDistance | string {
  const override = recipe.distanceOverrides[row.key!]; if (override) return override;
  const method = row.distance_measurement_method || author.distance?.distance_measurement_method || 'unspecified';
  if (author.distance?.distance_fixed_host || recipe.excludedDistanceMethods.includes(method)) return `Distance method ${method} is assigned/model-dependent, not an independent measured distance.`;
  const modulus = number(row.distance_modulus), ref = row.ref_distance || author.distance?.ref_distance;
  if (modulus === undefined || !ref) return 'No finite independently sourced distance modulus.';
  const valuePc = 10 ** ((modulus + 5) / 5);
  if (!(valuePc > 0) || !Number.isFinite(valuePc)) return 'Distance modulus does not produce a finite positive distance.';
  const em = number(row.distance_modulus_em), ep = number(row.distance_modulus_ep);
  if ([em, ep].some(v => v !== undefined && v < 0)) throw new TypeError(`Negative distance uncertainty: ${row.key}`);
  return { valuePc: rounded(valuePc), method, sourceRef: ref,
    ...(em === undefined ? {} : { minusPc: rounded(valuePc - 10 ** ((modulus - em + 5) / 5)) }),
    ...(ep === undefined ? {} : { plusPc: rounded(10 ** ((modulus + ep + 5) / 5) - valuePc) }) };
}

function halfLightRadius(row: CsvRow, distance: GalaxyDistance): PreparedGalaxy['halfLightRadius'] {
  const angle = number(row.rhalf); if (angle === undefined || angle <= 0 || !row.ref_structure) return undefined;
  // Source rhalf is projected semi-major angular half-light radius, not a diameter.
  const perArcmin = Math.PI / (180 * 60), valuePc = distance.valuePc * angle * perArcmin;
  const em = number(row.rhalf_em), ep = number(row.rhalf_ep);
  if ([em, ep].some(v => v !== undefined && v < 0)) throw new TypeError(`Negative half-light-radius uncertainty: ${row.key}`);
  // Preserve angular-fit errors at the adopted distance. Distance uncertainty
  // remains separate rather than claiming an undocumented joint distribution.
  return { valuePc: rounded(valuePc), sourceRef: row.ref_structure,
    ...(em === undefined ? {} : { minusPc: rounded(distance.valuePc * em * perArcmin) }),
    ...(ep === undefined ? {} : { plusPc: rounded(distance.valuePc * ep * perArcmin) }) };
}

export function prepareGalaxyCatalog(rows: readonly CsvRow[], metadata: ReadonlyMap<string, AuthorMetadata>, table: ReadonlyMap<string, string>, recipe: GalaxyRecipe, sources: GalaxySource[]): PreparedGalaxyCatalog {
  const objects: PreparedGalaxy[] = [], exclusions: { id: string; reason: string }[] = [], seen = new Set<string>();
  for (const row of rows) {
    const id = row.key;
    if (!id || !/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/.test(id) || seen.has(id)) throw new TypeError(`Invalid or repeated galaxy identifier: ${id}`);
    seen.add(id);
    const exclude = (reason: string) => exclusions.push({ id, reason });
    if (!recipe.eligibleTables.includes(row.table!)) { exclude(`Outside the authored galaxy-table selection: ${row.table}`); continue; }
    const author = metadata.get(id); if (!author) throw new TypeError(`Catalogue row has no original YAML: ${id}`);
    if (author.name_discovery?.false_positive) { exclude(`Author classifies this candidate as false positive/background (${author.name_discovery.false_positive}).`); continue; }
    if (row.confirmed_star_cluster === '1' || author.name_discovery?.confirmed_star_cluster === 1) { exclude('Confirmed star cluster, not a galaxy.'); continue; }
    const raDeg = number(row.ra), decDeg = number(row.dec);
    if (raDeg === undefined || decDeg === undefined || raDeg < 0 || raDeg >= 360 || decDeg < -90 || decDeg > 90) { exclude('No usable ICRS sky coordinates.'); continue; }
    if (author.location?.ra !== undefined && (raDeg !== author.location.ra || decDeg !== author.location.dec)) throw new TypeError(`CSV and original authored sky position disagree: ${id}`);
    const distance = distanceFromRow(row, author, recipe);
    if (typeof distance === 'string') { exclude(distance); continue; }
    const name = row.name?.trim(); if (!name) throw new TypeError(`Galaxy row has no name: ${id}`);
    const detail = recipe.detailObjects[id], radius = halfLightRadius(row, distance);
    const aliases = [...new Set(author.name_discovery?.other_name ?? [])].filter(alias => alias && alias !== name);
    if (aliases.some(alias => typeof alias !== 'string')) throw new TypeError(`Invalid galaxy aliases: ${id}`);
    objects.push({ id, name, aliases, positionM: galaxyPositionM(raDeg, decDeg, distance.valuePc),
      skyPosition: { raDeg, decDeg, sourceRef: author.location?.ref_location || `${recipe.catalogueSourceId}:${id}:location` }, distance,
      ...(row.host ? { hostId: row.host } : {}), membership: classifyMembership(id, metadata, recipe, table),
      status: row.confirmed_galaxy === '1' && row.confirmed_real === '1' ? 'confirmed' : 'candidate',
      ...(radius ? { halfLightRadius: radius } : {}),
      ...(detail ? { detailedObjectId: detail.id } : {}),
      ...(detail?.focusRadiusM ? { presentation: { focusRadiusM: detail.focusRadiusM } } : {}) });
  }
  for (const id of [...Object.keys(recipe.distanceOverrides), ...Object.keys(recipe.detailObjects)]) if (!seen.has(id)) throw new TypeError(`Authored override refers to an absent source row: ${id}`);
  objects.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  exclusions.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { schema: 'cssearth-galaxy-catalog@1', frame: recipe.frame, sources, objects, exclusions, selection: { description: recipe.description } };
}
