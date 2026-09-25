/** Cited claims that a body is present in exact archive observations filed under another target.
 *
 * The checked-in claim stores only the semantic join. MAST remains authoritative for the observation's programme, mode,
 * archive target, filter and time; cssEarth reads those facts live through the pinned Astroquery boundary. */
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { ArchiveTransportError, mastObservations, type MastObservationResult } from '@cssearth/telescope/node';

export const TARGET_ASSOCIATIONS_SCHEMA = 'cssearth-target-associations@2';

export interface TargetAssociationEvidence {
  readonly citation: string;
  readonly locator: string;
  readonly establishes: string;
}

export interface TargetAssociationSource {
  readonly target: string;
  readonly archive: 'mast';
  readonly collection: string;
  readonly observations: readonly string[];
  readonly evidence: readonly TargetAssociationEvidence[];
}

export interface TargetAssociation {
  readonly responseRecord?: MastObservationResult['responseRecord'];
  readonly target: string;
  readonly archive: 'mast';
  readonly collection: string;
  readonly mode: string;
  readonly archiveTarget: string;
  readonly programme: string;
  readonly astroquery: string;
  readonly queriedAt: string;
  readonly observations: MastObservationResult['observations'];
  readonly evidence: readonly TargetAssociationEvidence[];
}

export function parseTargetAssociationSources(value: unknown): TargetAssociationSource[] {
  const root = requireRecord(value, 'target associations');
  if (root.schema !== TARGET_ASSOCIATIONS_SCHEMA) throw new TypeError(`Unsupported target-association schema ${String(root.schema)}.`);
  const seen = new Set<string>();
  return requireArray(root.associations, 'target associations').map((raw, index) => {
    const row = requireRecord(raw, `target association ${index}`);
    const target = requireString(row.target, 'association target');
    const copied = ['telescope', 'mode', 'archiveTarget', 'programme', 'verified', 'startIso', 'endIso', 'filter'].find(name => row[name] !== undefined);
    if (copied) throw new TypeError(`${target}: ${copied} is MAST-owned and must not be copied into the association source.`);
    if (row.archive !== 'mast') throw new TypeError(`${target}: target association archive must be mast.`);
    const collection = requireString(row.collection, 'association MAST collection');
    const observations = requireArray(row.observations, 'association observations').map((id, observationIndex) =>
      requireString(id, `association observation ${observationIndex}`));
    if (!observations.length) throw new TypeError(`${target}: a target association names at least one exact observation.`);
    for (const id of observations) {
      const key = `${target}|${collection}|${id}`;
      if (seen.has(key)) throw new TypeError(`${id}: this target association appears twice.`);
      seen.add(key);
    }
    const evidence = requireArray(row.evidence, 'association evidence').map((rawEvidence, evidenceIndex) => {
      const item = requireRecord(rawEvidence, `association evidence ${evidenceIndex}`);
      return { citation: requireString(item.citation, 'association citation'), locator: requireString(item.locator, 'association locator'),
        establishes: requireString(item.establishes, 'association claim') };
    });
    if (!evidence.length) throw new TypeError(`${target}: a target association has no cited evidence.`);
    return { target, archive: 'mast', collection, observations, evidence };
  });
}

/** Overlay one cited semantic join on authoritative MAST rows, grouping only where the archive facts agree. */
export function hydrateTargetAssociation(source: TargetAssociationSource, result: MastObservationResult): TargetAssociation[] {
  const groups = new Map<string, MastObservationResult['observations'][number][]>();
  for (const observation of result.observations) {
    if (observation.collection !== source.collection) throw new TypeError(`${observation.id}: target association requested ${source.collection}, got ${observation.collection}.`);
    const key = `${observation.mode}\0${observation.archiveTarget}\0${observation.programme}`;
    const group = groups.get(key) ?? [];
    group.push(observation); groups.set(key, group);
  }
  return [...groups.values()].map(observations => ({ target: source.target, archive: 'mast', collection: source.collection,
    mode: observations[0]!.mode, archiveTarget: observations[0]!.archiveTarget, programme: observations[0]!.programme,
    astroquery: result.astroquery, queriedAt: result.queriedAt, observations, evidence: source.evidence, ...(result.responseRecord ? { responseRecord: result.responseRecord } : {}) }));
}

/** Resolve only the target associations needed by the current query. */
export async function loadTargetAssociations(sources: readonly TargetAssociationSource[], options: { lookup?: typeof mastObservations; failures?: { collection: string; reason: string }[] } = {}): Promise<TargetAssociation[]> {
  const hydrated: TargetAssociation[] = [];
  for (const source of sources) {
    try { hydrated.push(...hydrateTargetAssociation(source, await (options.lookup ?? mastObservations)(source.collection, source.observations))); }
    catch (error) {
      if (!(error instanceof ArchiveTransportError) || !options.failures) throw error;
      options.failures?.push({ collection: source.collection, reason: error.message });
    }
  }
  return hydrated;
}
