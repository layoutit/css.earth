/**
 * Read-only searches of the public archives that the candidate tools consult beyond SIMBAD, OiDB, VizieR and OPUS:
 *
 * - ALMA (ivoa.obscore): millimetre observations with their angular resolution and data rights;
 * - the ESO archive (dbo.raw): raw frames per instrument, which names the interferometers and adaptive-optics imagers;
 * - MAST (CAOM): Hubble, JWST and other space-telescope observations;
 * - DataCite: datasets (Zenodo, figshare, Dryad and others) whose metadata cites a paper's DOI;
 * - the JMMC Measured Stellar Diameters Catalogue (VizieR II/345), so an archive's resolution can be set against a disc.
 *
 * PyVO owns every TAP transaction (ALMA and ESO here); Astroquery owns MAST and the VizieR cone search. DataCite remains direct
 * because neither package owns its REST API. Each search is split into a query and a pure summary of the rows it returns; the
 * summaries are what the tests pin.
 * A search finds leads, never a verdict: a frame still needs a camera, registration and reuse terms before it can ship.
 *
 * Not searched: the PDS registry (its target index, checked 2026-09-16, lists only Lucy's SPICE collections for Dinkinesh although
 * the imaging collections exist, so an empty answer would mislead), CHARA data not deposited in the OiDB, and journal supplements
 * that no DataCite record describes.
 */
import { requireArray, requireRecord } from '@cssearth/core';
import { astroqueryRows, tapRows } from './astronomy-packages/client.mts';
import { mastRequest } from './astronomy-packages/mast.mts';

export const ESO_TAP = 'https://archive.eso.org/tap_obs', ALMA_TAP = 'https://almascience.eso.org/tap', DATACITE_API = 'https://api.datacite.org/dois';

export const adqlString = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** Where to look: a sky position (a star) or the names a solar-system body is observed under. */
export type ArchiveTarget = { readonly position: { readonly ra: number; readonly dec: number; readonly radiusDegrees: number } } | { readonly names: readonly string[] };

/** A dropped connection is retried; a service error is reported with the reason a TAP VOTable carries. */
export async function fetchRetrying(url: string, attempts = 3, fetcher: typeof fetch = fetch, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try { return await fetcher(url, init); } catch (error) { if (attempt >= attempts) throw error; }
  }
}

/** ADQL has no case-insensitive LIKE on every service (the ESO archive lacks UPPER), so each name is tried as written, upper and lower case. */
export function nameMatch(column: string, names: readonly string[]) {
  const variants = [...new Set(names.flatMap(name => [name, name.toUpperCase(), name.toLowerCase()]))].filter(name => name.length >= 3);
  if (!variants.length) throw new TypeError('An archive name search needs a name of at least three characters.');
  return `(${variants.map(name => `${column} LIKE ${adqlString(`%${name}%`)}`).join(' OR ')})`;
}

const mjdToDate = (mjd: number) => Number.isFinite(mjd) ? new Date(Date.UTC(1858, 10, 17) + mjd * 86_400_000).toISOString().slice(0, 10) : null;

export interface AlmaGroup {
  readonly proposal: string; readonly band: string; readonly rights: string; readonly principalAuthors: string;
  readonly targets: readonly string[]; readonly observations: number; readonly bestResolutionArcsec: number;
  readonly firstDate: string | null; readonly lastDate: string | null;
  /** The disc's angular diameter over the finest resolution, when a diameter is known. */
  readonly resolutionElementsAcross: number | null;
}

/** ALMA obscore rows grouped by project and band, finest resolution first. */
export function summariseAlma(rows: readonly Record<string, string>[], diameterMas: number | null = null): AlmaGroup[] {
  const groups = new Map<string, { proposal: string; band: string; rights: string; principalAuthors: string; targets: Set<string>; observations: number; best: number; first: number; last: number }>();
  for (const row of rows) {
    const key = `${row.proposal_id}|${row.band_list}`, resolution = Number(row.spatial_resolution), mjd = Number(row.t_min);
    const group = groups.get(key) ?? { proposal: row.proposal_id ?? '', band: row.band_list ?? '', rights: row.data_rights ?? '', principalAuthors: row.first_author ?? '', targets: new Set<string>(), observations: 0, best: Infinity, first: Infinity, last: -Infinity };
    group.observations++; group.targets.add(row.target_name ?? '');
    if (resolution > 0) group.best = Math.min(group.best, resolution);
    if (Number.isFinite(mjd)) { group.first = Math.min(group.first, mjd); group.last = Math.max(group.last, mjd); }
    // A project is public only when every row is.
    if (row.data_rights !== 'Public') group.rights = row.data_rights ?? '';
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ proposal: group.proposal, band: group.band, rights: group.rights, principalAuthors: group.principalAuthors,
    targets: [...group.targets].filter(Boolean).sort(), observations: group.observations, bestResolutionArcsec: group.best,
    firstDate: mjdToDate(group.first), lastDate: mjdToDate(group.last),
    resolutionElementsAcross: diameterMas !== null && Number.isFinite(group.best) ? diameterMas / (group.best * 1000) : null }))
    .sort((a, b) => a.bestResolutionArcsec - b.bestResolutionArcsec);
}

export async function almaObservations(target: ArchiveTarget, diameterMas: number | null = null) {
  const where = 'position' in target
    ? `INTERSECTS(CIRCLE('ICRS', ${target.position.ra}, ${target.position.dec}, ${target.position.radiusDegrees}), s_region) = 1`
    : nameMatch('target_name', target.names);
  return summariseAlma(await tapRows(ALMA_TAP, `SELECT proposal_id, band_list, target_name, spatial_resolution, t_min, data_rights, first_author FROM ivoa.obscore WHERE ${where}`), diameterMas);
}

/** Instruments whose frames can resolve a disc: long-baseline interferometers and adaptive-optics imagers on one telescope. */
export const ESO_INSTRUMENT_KINDS: Readonly<Record<string, 'interferometer' | 'adaptive-optics'>> = {
  AMBER: 'interferometer', MIDI: 'interferometer', PIONIER: 'interferometer', GRAVITY: 'interferometer', MATISSE: 'interferometer', VINCI: 'interferometer',
  SPHERE: 'adaptive-optics', 'NAOS+CONICA': 'adaptive-optics', ERIS: 'adaptive-optics', SINFONI: 'adaptive-optics', MUSE: 'adaptive-optics',
};

export interface EsoGroup { readonly instrument: string; readonly kind: 'interferometer' | 'adaptive-optics' | 'other'; readonly frames: number; readonly firstDate: string; readonly lastDate: string; readonly firstPublicDate: string }

/** ESO raw science frames grouped by instrument; the resolving instruments first, then by frame count. */
export function summariseEsoRaw(rows: readonly Record<string, string>[]): EsoGroup[] {
  const groups = new Map<string, { instrument: string; frames: number; first: string; last: string; released: string }>();
  for (const row of rows) {
    const instrument = row.instrument ?? '', group = groups.get(instrument) ?? { instrument, frames: 0, first: '9999', last: '0000', released: '9999' };
    group.frames += Number(row.frames ?? 1);
    group.first = [group.first, row.first_date ?? row.date_obs ?? '9999'].sort()[0]!;
    group.last = [group.last, row.last_date ?? row.date_obs ?? '0000'].sort().at(-1)!;
    group.released = [group.released, row.first_release ?? row.release_date ?? '9999'].sort()[0]!;
    groups.set(instrument, group);
  }
  const rank = { interferometer: 0, 'adaptive-optics': 1, other: 2 } as const;
  return [...groups.values()].map(group => ({ instrument: group.instrument, kind: ESO_INSTRUMENT_KINDS[group.instrument] ?? 'other' as const,
    frames: group.frames, firstDate: group.first.slice(0, 10), lastDate: group.last.slice(0, 10), firstPublicDate: group.released.slice(0, 10) }))
    .sort((a, b) => rank[a.kind] - rank[b.kind] || b.frames - a.frames);
}

export async function esoRawObservations(target: ArchiveTarget) {
  // dbo.raw carries a pointing, not a footprint: a box around the position, widened in right ascension by the declination.
  const where = 'position' in target ? (() => {
    const { ra, dec, radiusDegrees } = target.position, widened = radiusDegrees / Math.max(Math.cos(dec * Math.PI / 180), 1e-6);
    return `ra BETWEEN ${ra - widened} AND ${ra + widened} AND dec BETWEEN ${dec - radiusDegrees} AND ${dec + radiusDegrees}`;
  })() : nameMatch('object', target.names);
  return summariseEsoRaw(await tapRows(ESO_TAP, `SELECT instrument, COUNT(*) AS frames, MIN(date_obs) AS first_date, MAX(date_obs) AS last_date, MIN(release_date) AS first_release FROM dbo.raw WHERE dp_cat = 'SCIENCE' AND ${where} GROUP BY instrument`));
}

export interface MastGroup { readonly collection: string; readonly instrument: string; readonly productType: string; readonly proposals: readonly string[]; readonly observations: number }

/** MAST CAOM rows grouped by collection, instrument and product type; imaging first. */
export function summariseMast(rows: readonly unknown[]): MastGroup[] {
  const groups = new Map<string, { collection: string; instrument: string; productType: string; proposals: Set<string>; observations: number }>();
  for (const value of rows) {
    const row = requireRecord(value), collection = String(row.obs_collection ?? ''), instrument = String(row.instrument_name ?? ''), productType = String(row.dataproduct_type ?? '');
    const key = [collection, instrument, productType].join('|'), group = groups.get(key) ?? { collection, instrument, productType, proposals: new Set<string>(), observations: 0 };
    group.observations++;
    if (row.proposal_id !== null && row.proposal_id !== undefined && row.proposal_id !== '') group.proposals.add(String(row.proposal_id));
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ ...group, proposals: [...group.proposals].sort() }))
    .sort((a, b) => Number(b.productType === 'image') - Number(a.productType === 'image') || b.observations - a.observations);
}

export async function mastObservations(target: ArchiveTarget) {
  const columns = 'obs_collection,instrument_name,dataproduct_type,proposal_id,target_name';
  // A cone search for a star; for a body one filtered request per name, since a free-text filter takes one pattern.
  const requests = 'position' in target
    ? [{ service: 'Mast.Caom.Cone', format: 'json', params: { ra: target.position.ra, dec: target.position.dec, radius: target.position.radiusDegrees }, pagesize: 5000 }]
    : target.names.filter(name => name.length >= 3).map(name => ({ service: 'Mast.Caom.Filtered', format: 'json', pagesize: 5000,
      params: { columns, filters: [{ paramName: 'target_name', values: [], freeText: `%${name}%` }] } }));
  const rows: unknown[] = [];
  for (const body of requests) rows.push(...await mastRequest(body));
  return summariseMast(rows);
}

export interface Deposit { readonly doi: string; readonly publisher: string; readonly title: string; readonly resourceType: string; readonly cites: string; readonly url: string; readonly versions: readonly string[] }

/** Relations that make a record the paper's data rather than a record that merely cites the paper. */
export const SUPPLEMENT_RELATIONS: readonly string[] = ['IsSupplementTo', 'IsDocumentedBy', 'IsDescribedBy', 'IsReferencedBy', 'IsCitedBy', 'IsSourceOf'];

/** Datasets and other non-text records that belong to the paper: its DOI in their description (as Zenodo deposits state it) or in a
 * supplement-type relation. DataCite's search also returns records that only cite the paper (a figshare file listing it among its
 * references); those, and the paper's own preprint, are not deposits. */
export function dataciteDeposits(response: unknown, paperDoi: string): Deposit[] {
  const doi = paperDoi.toLowerCase();
  return requireArray(requireRecord(response).data).map(value => requireRecord(value)).flatMap(record => {
    const attributes = requireRecord(record.attributes), types = requireRecord(attributes.types ?? {});
    const resourceType = String(types.resourceTypeGeneral ?? ''), publisher = String(attributes.publisher ?? '');
    if (resourceType === 'Text' || /arxiv/iu.test(publisher)) return [];
    const related = requireArray(attributes.relatedIdentifiers ?? []).map(value => requireRecord(value));
    const described = requireArray(attributes.descriptions ?? []).some(value => String(requireRecord(value).description ?? '').toLowerCase().includes(doi));
    const supplements = related.some(item => String(item.relatedIdentifier).toLowerCase() === doi && SUPPLEMENT_RELATIONS.includes(String(item.relationType)));
    if (!described && !supplements) return [];
    const title = String(requireRecord(requireArray(attributes.titles)[0] ?? { title: '' }).title ?? '');
    // A Zenodo concept DOI and its versions describe one deposit; the related DOIs let a caller recognise one it already cites.
    const versions = related.filter(item => ['HasVersion', 'IsVersionOf'].includes(String(item.relationType))).map(item => String(item.relatedIdentifier).toLowerCase());
    return [{ doi: String(record.id), publisher, title, resourceType, cites: paperDoi, url: `https://doi.org/${String(record.id)}`, versions }];
  });
}

export async function depositsCiting(dois: readonly string[]) {
  const deposits = new Map<string, Deposit>();
  for (const doi of [...new Set(dois.map(doi => doi.toLowerCase()))]) {
    const url = `${DATACITE_API}?${new URLSearchParams({ query: `relatedIdentifiers.relatedIdentifier:"${doi}" OR descriptions.description:"${doi}"`, 'page[size]': '25' })}`;
    const response = await fetchRetrying(url);
    if (!response.ok) throw new Error(`DataCite answered ${response.status} for ${doi}.`);
    for (const deposit of dataciteDeposits(await response.json(), doi)) if (!deposits.has(deposit.doi)) deposits.set(deposit.doi, deposit);
  }
  return [...deposits.values()];
}

export interface MeasuredDiameter { readonly uniformDiskMas: number | null; readonly limbDarkenedMas: number | null; readonly band: string; readonly bibcode: string }

/** JMDC rows [UDdiam, LDdiam, Band, BibCode]; the largest limb-darkened or uniform-disc value is the conservative disc for resolution. */
export function parseJmdc(rows: readonly (readonly unknown[])[]): { measurements: MeasuredDiameter[]; largestMas: number | null } {
  const number = (value: unknown) => value === null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const measurements = rows.map(([ud, ld, band, bibcode]) => ({ uniformDiskMas: number(ud), limbDarkenedMas: number(ld), band: String(band ?? ''), bibcode: String(bibcode ?? '') }));
  const values = measurements.map(m => m.limbDarkenedMas ?? m.uniformDiskMas).filter((v): v is number => v !== null && v > 0);
  return { measurements, largestMas: values.length ? Math.max(...values) : null };
}

export async function measuredDiameters(ra: number, dec: number, radiusDegrees = 30 / 3600) {
  const rows = await astroqueryRows({ operation: 'vizier-region', catalog: 'II/345/jmdc', ra, dec, radiusDegrees, columns: ['UDdiam', 'LDdiam', 'Band', 'BibCode'] });
  return parseJmdc(rows.map(row => [row.UDdiam, row.LDdiam, row.Band, row.BibCode]));
}

export interface ArchiveLeads { readonly alma: readonly AlmaGroup[]; readonly eso: readonly EsoGroup[]; readonly mast: readonly MastGroup[]; readonly deposits: readonly Deposit[] }

/** Leads worth opening, in the order they have worked: a data deposit citing the paper, public ALMA projects that resolve the disc
 * (at least `minimumElements` beams across, or any when the size is unknown), resolving ESO instruments, then space-telescope imaging. */
export function archiveLeads({ alma, eso, mast, deposits }: ArchiveLeads, minimumElements = 3): string[] {
  // Versions of one deposit (a Zenodo concept DOI and its releases) are one lead.
  const byDeposit = new Map<string, Deposit[]>();
  for (const deposit of deposits) {
    const key = `${deposit.publisher}|${deposit.title}`;
    byDeposit.set(key, [...(byDeposit.get(key) ?? []), deposit]);
  }
  const leads: string[] = [...byDeposit.values()].map(group => `deposit ${group.map(deposit => deposit.url).join(', ')} (${group[0]!.publisher}, ${group[0]!.resourceType}) for ${group[0]!.cites}: ${group[0]!.title}; inspect its files`);
  for (const group of alma) {
    if (group.rights !== 'Public' || (group.resolutionElementsAcross !== null && group.resolutionElementsAcross < minimumElements)) continue;
    leads.push(`ALMA ${group.proposal} band ${group.band}: ${group.observations} observations ${group.firstDate}–${group.lastDate} at ${(group.bestResolutionArcsec * 1000).toFixed(1)} mas${group.resolutionElementsAcross === null ? '' : `, ${group.resolutionElementsAcross.toFixed(1)} beams across`} (${group.principalAuthors || 'no author listed'})`);
  }
  for (const group of eso.filter(group => group.kind !== 'other')) leads.push(`ESO ${group.instrument} (${group.kind}): ${group.frames} raw frames ${group.firstDate}–${group.lastDate}`);
  for (const group of mast.filter(group => group.productType === 'image' && ['HST', 'JWST'].includes(group.collection))) leads.push(`MAST ${group.collection} ${group.instrument}: ${group.observations} images, proposals ${group.proposals.join(', ')}`);
  return leads;
}
