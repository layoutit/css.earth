import { parseSourceCitation } from './source-catalog.mts';
import type { SourceCitation, SourceResolver } from './source-catalog.mts';
/** Shared runtime validation for the authored and prepared exploration catalogues. */
export interface Cited<T> { readonly value: T; readonly citations: readonly SourceCitation[]; }
export type VehicleKind = 'orbiter' | 'lander' | 'rover' | 'probe' | 'observatory' | 'flyby' | 'sample-return';
export interface SpacecraftRecord {
  readonly id: string; readonly name: Cited<string>; readonly aliases: readonly Cited<string>[];
  readonly description: Cited<string>; readonly kind: Cited<VehicleKind>; readonly launch?: Cited<string>; readonly imageId?: string;
}
export interface Participant { readonly spacecraftId: string; readonly role: VehicleKind; readonly citations: readonly SourceCitation[]; }
export interface MissionRecord {
  readonly id: string; readonly name: Cited<string>; readonly description: Cited<string>;
  readonly agencyIds: Cited<readonly string[]>; readonly participants: readonly Participant[];
  readonly started?: Cited<string>; readonly ended?: Cited<string>;
  readonly status?: Cited<{ readonly value: 'active' | 'completed' | 'planned' | 'lost'; readonly asOf: string }>;
  readonly imageId?: string; readonly emblemId?: string;
}
export interface Agency { readonly name: string; readonly sourceUrl: string; readonly src?: string; readonly assetUrl?: string; readonly sha256?: string; readonly bytes?: number; }
export interface ExplorationCatalog {
  readonly schema: 'cssearth-spacecraft-catalog@3';
  readonly spacecraft: readonly SpacecraftRecord[]; readonly missions: readonly MissionRecord[];
}
export type CaptureAttribution =
  | { readonly kind: 'spacecraft'; readonly spacecraftId: string; readonly missionId?: string; readonly evidence: string }
  | { readonly kind: 'mission'; readonly missionId: string; readonly evidence: string }
  | { readonly kind: 'unresolved'; readonly label: string; readonly evidence: string; readonly reason: string };
export interface Capture { readonly attributions: readonly CaptureAttribution[]; }

export function explorationRecord(input: unknown, fields?: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected an exploration record.');
  if (fields && Object.keys(input).some(key => !fields.includes(key))) throw new TypeError('Unexpected exploration field.');
  return input as Record<string, unknown>;
}
export function explorationText(input: unknown): string {
  if (typeof input !== 'string' || !input.trim() || input !== input.trim()) throw new TypeError('Expected nonblank exploration text.');
  return input;
}
export function explorationId(input: unknown): string {
  const id = explorationText(input);
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError(`Invalid catalogue ID: ${id}.`);
  return id;
}
export function explorationUrl(input: unknown): string {
  const url = explorationText(input);
  if (/[\s{}]/.test(url) || !['https:', 'http:'].includes(new URL(url).protocol)) throw new TypeError('Invalid exploration URL.');
  return url;
}
export function explorationArray<T>(input: unknown, parse: (value: unknown) => T): readonly T[] {
  if (!Array.isArray(input)) throw new TypeError('Expected an exploration array.');
  return Object.freeze(input.map(value => parse(value)));
}
function unique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) throw new TypeError(`Duplicate ${label}.`);
}
function enumeration<T extends string>(input: unknown, values: readonly T[]): T {
  const value = explorationText(input);
  const found = values.find(item => item === value);
  if (!found) throw new TypeError(`Unsupported exploration value: ${value}.`);
  return found;
}
const vehicleKind = (input: unknown) => enumeration(input, ['orbiter', 'lander', 'rover', 'probe', 'observatory', 'flyby', 'sample-return'] as const);
/** Validate calendar dates without expanding a source's year/month precision. */
export function explorationDate(input: unknown, full = false): string {
  const value = explorationText(input);
  if (!(full ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/).test(value)) throw new TypeError('Invalid exploration date precision.');
  const [year, month = 1, day = 1] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new TypeError(`Impossible exploration date: ${value}.`);
  return value;
}
function dateBounds(value: string): readonly [number, number] {
  const [y, m, d] = value.split('-').map(Number);
  return [Date.UTC(y, (m ?? 1) - 1, d ?? 1), d ? Date.UTC(y, m - 1, d) : m ? Date.UTC(y, m, 0) : Date.UTC(y, 11, 31)];
}
export function parseAgencies(input: unknown): Readonly<Record<string, Agency>> {
  return Object.freeze(Object.fromEntries(Object.entries(explorationRecord(input)).map(([id, raw]) => {
    if (!/^[A-Z][A-Z0-9-]*$/.test(id)) throw new TypeError('Invalid agency ID.');
    const value = explorationRecord(raw, ['name', 'sourceUrl', 'src', 'assetUrl', 'sha256', 'bytes']);
    const base = { name: explorationText(value.name), sourceUrl: explorationUrl(value.sourceUrl) };
    if (value.src === undefined) {
      if (['assetUrl', 'sha256', 'bytes'].some(key => value[key] !== undefined)) throw new TypeError('Incomplete agency logo.');
      return [id, Object.freeze(base)];
    }
    const src = explorationText(value.src), sha256 = explorationText(value.sha256), bytes = value.bytes;
    if (!src.startsWith('/shell/agency-logos/') || !/^[a-f0-9]{64}$/.test(sha256) || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) throw new TypeError('Invalid agency logo identity.');
    return [id, Object.freeze({ ...base, src, assetUrl: explorationUrl(value.assetUrl), sha256, bytes })];
  })));
}
export function parseExplorationCatalog(input: unknown, agencies: Readonly<Record<string, Agency>>, sources: SourceResolver): ExplorationCatalog {
  const value = explorationRecord(input, ['schema', 'spacecraft', 'missions']);
  if (value.schema !== 'cssearth-spacecraft-catalog@3') throw new TypeError('Unsupported spacecraft catalogue schema.');
  const refs = (raw: unknown) => {
    const citations = explorationArray(raw, value => parseSourceCitation(value, sources));
    unique(citations.map(citation => JSON.stringify(citation)), 'citation');
    if (!citations.length) throw new TypeError('Missing catalogue citation.');
    return citations;
  };
  const cited = <T,>(raw: unknown, parse: (raw: unknown) => T): Cited<T> => {
    const record = explorationRecord(raw, ['value', 'citations']);
    return Object.freeze({ value: parse(record.value), citations: refs(record.citations) });
  };
  const spacecraft = explorationArray(value.spacecraft, raw => {
    const record = explorationRecord(raw, ['id', 'name', 'aliases', 'description', 'kind', 'launch', 'imageId']);
    const aliases = explorationArray(record.aliases, alias => cited(alias, explorationText));
    unique(aliases.map(alias => alias.value), 'spacecraft alias');
    return Object.freeze({ id: explorationId(record.id), name: cited(record.name, explorationText), aliases,
      description: cited(record.description, explorationText), kind: cited(record.kind, vehicleKind),
      ...(record.launch === undefined ? {} : { launch: cited(record.launch, explorationDate) }),
      ...(record.imageId === undefined ? {} : { imageId: explorationId(record.imageId) }) });
  });
  unique(spacecraft.map(record => record.id), 'spacecraft ID');
  const spacecraftIds = new Set(spacecraft.map(record => record.id));
  const missions = explorationArray(value.missions, raw => {
    const record = explorationRecord(raw, ['id', 'name', 'description', 'agencyIds', 'participants', 'started', 'ended', 'status', 'imageId', 'emblemId']);
    const participants = explorationArray(record.participants, raw => {
      const member = explorationRecord(raw, ['spacecraftId', 'role', 'citations']);
      const spacecraftId = explorationId(member.spacecraftId);
      if (!spacecraftIds.has(spacecraftId)) throw new TypeError(`Unknown participating spacecraft: ${spacecraftId}.`);
      return Object.freeze({ spacecraftId, role: vehicleKind(member.role), citations: refs(member.citations) });
    });
    unique(participants.map(member => member.spacecraftId), 'mission participant');
    if (!participants.length) throw new TypeError('A spacecraft mission needs a participant.');
    const agencyIds = cited(record.agencyIds, raw => {
      const ids = explorationArray(raw, explorationText); unique(ids, 'mission agency');
      if (!ids.length || ids.some(id => !Object.hasOwn(agencies, id))) throw new TypeError('Unknown mission agency.');
      return ids;
    });
    const started = record.started === undefined ? undefined : cited(record.started, explorationDate);
    const ended = record.ended === undefined ? undefined : cited(record.ended, explorationDate);
    if (started && ended && dateBounds(started.value)[0] > dateBounds(ended.value)[1]) throw new TypeError('Mission ended before it started.');
    const status = record.status === undefined ? undefined : cited(record.status, raw => {
      const status = explorationRecord(raw, ['value', 'asOf']);
      return Object.freeze({ value: enumeration(status.value, ['active', 'completed', 'planned', 'lost'] as const), asOf: explorationDate(status.asOf, true) });
    });
    if (ended && status?.value.value === 'active' && dateBounds(ended.value)[1] < dateBounds(status.value.asOf)[0]) throw new TypeError('Active status contradicts mission end.');
    return Object.freeze({ id: explorationId(record.id), name: cited(record.name, explorationText), description: cited(record.description, explorationText), agencyIds, participants,
      ...(started ? { started } : {}), ...(ended ? { ended } : {}), ...(status ? { status } : {}),
      ...(record.imageId === undefined ? {} : { imageId: explorationId(record.imageId) }),
      ...(record.emblemId === undefined ? {} : { emblemId: explorationId(record.emblemId) }) });
  });
  unique(missions.map(record => record.id), 'mission ID');
  return Object.freeze({ schema: 'cssearth-spacecraft-catalog@3', spacecraft, missions });
}

export function parseCapture(input: unknown): Capture {
  const capture = explorationRecord(input, ['attributions']);
  const attributions = explorationArray(capture.attributions, (raw): CaptureAttribution => {
    const record = explorationRecord(raw);
    const evidence = explorationText(record.evidence);
    if (record.kind === 'spacecraft') {
      explorationRecord(raw, ['kind', 'spacecraftId', 'missionId', 'evidence']);
      return Object.freeze({ kind: 'spacecraft', spacecraftId: explorationId(record.spacecraftId), evidence,
        ...(record.missionId === undefined ? {} : { missionId: explorationId(record.missionId) }) });
    }
    if (record.kind === 'mission') {
      explorationRecord(raw, ['kind', 'missionId', 'evidence']);
      return Object.freeze({ kind: 'mission', missionId: explorationId(record.missionId), evidence });
    }
    if (record.kind === 'unresolved') {
      explorationRecord(raw, ['kind', 'label', 'evidence', 'reason']);
      return Object.freeze({ kind: 'unresolved', label: explorationText(record.label), evidence, reason: explorationText(record.reason) });
    }
    throw new TypeError('Unknown capture attribution kind.');
  });
  if (!attributions.length) throw new TypeError('Capture needs an attribution.');
  unique(attributions.map(item => item.kind === 'unresolved' ? `unresolved:${item.label}` : item.kind === 'mission' ? `mission:${item.missionId}` : `spacecraft:${item.spacecraftId}:${item.missionId ?? ''}`), 'capture attribution');
  return Object.freeze({ attributions });
}
export function validateCapture(capture: Capture, catalog: ExplorationCatalog): void {
  for (const attribution of capture.attributions) {
    if (attribution.kind === 'unresolved') continue;
    const mission = attribution.missionId === undefined ? undefined : catalog.missions.find(mission => mission.id === attribution.missionId);
    if (attribution.missionId !== undefined && !mission) throw new TypeError(`Unknown capture mission: ${attribution.missionId}.`);
    if (attribution.kind === 'spacecraft') {
      if (!catalog.spacecraft.some(spacecraft => spacecraft.id === attribution.spacecraftId)) throw new TypeError(`Unknown capture spacecraft: ${attribution.spacecraftId}.`);
      if (mission && !mission.participants.some(member => member.spacecraftId === attribution.spacecraftId)) throw new TypeError('Capture mission and spacecraft are not a participating pair.');
    }
  }
}
