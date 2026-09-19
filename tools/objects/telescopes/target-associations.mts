/** Source-backed claims that a body is present in an observation whose archive target names something else.
 *
 * Archive target names describe the pointing, not every object inside the field. These records join an exact archive
 * observation to one additional cssEarth target only when a cited source establishes that association. */
import { requireArray, requireRecord, requireString } from '../../source-values.mts';

export const TARGET_ASSOCIATIONS_SCHEMA = 'cssearth-target-associations@1';

export interface TargetAssociationObservation {
  readonly id: string;
  readonly startIso: string;
  readonly endIso?: string;
  readonly filter?: string;
}

export interface TargetAssociationEvidence {
  readonly citation: string;
  readonly locator: string;
  readonly establishes: string;
}

export interface TargetAssociation {
  readonly target: string;
  /** Ledger key, such as `hst`. */
  readonly archive: string;
  /** Telescope and exact mode keys used by the capability query. */
  readonly telescope: string;
  readonly mode: string;
  readonly archiveTarget: string;
  readonly programme: string;
  readonly verified: string;
  readonly observations: readonly TargetAssociationObservation[];
  readonly evidence: readonly TargetAssociationEvidence[];
}

const iso = (value: unknown, label: string) => {
  const text = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(text) || !Number.isFinite(Date.parse(text)))
    throw new TypeError(`${label} is not an ISO UTC instant.`);
  return text;
};

export function parseTargetAssociations(value: unknown): TargetAssociation[] {
  const root = requireRecord(value, 'target associations');
  if (root.schema !== TARGET_ASSOCIATIONS_SCHEMA) throw new TypeError(`Unsupported target-association schema ${String(root.schema)}.`);
  const seen = new Set<string>();
  return requireArray(root.associations, 'target associations').map((raw, index) => {
    const row = requireRecord(raw, `target association ${index}`);
    const target = requireString(row.target, 'association target'), archive = requireString(row.archive, 'association archive');
    const telescope = requireString(row.telescope, 'association telescope'), mode = requireString(row.mode, 'association mode');
    const archiveTarget = requireString(row.archiveTarget, 'association archive target'), programme = requireString(row.programme, 'association programme');
    const verified = requireString(row.verified, 'association verification date');
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(verified) || !Number.isFinite(Date.parse(`${verified}T00:00:00Z`)))
      throw new TypeError('association verification date is not YYYY-MM-DD.');
    const observations = requireArray(row.observations, 'association observations').map((rawObservation, observationIndex) => {
      const observation = requireRecord(rawObservation, `association observation ${observationIndex}`);
      const id = requireString(observation.id, 'association observation id'), startIso = iso(observation.startIso, 'association observation start');
      const endIso = observation.endIso === undefined ? undefined : iso(observation.endIso, 'association observation end');
      if (endIso && endIso < startIso) throw new RangeError(`${id}: observation end precedes its start.`);
      const key = `${target}|${archive}|${telescope}|${mode}|${id}`;
      if (seen.has(key)) throw new TypeError(`${id}: this target association appears twice.`);
      seen.add(key);
      return { id, startIso, ...(endIso ? { endIso } : {}), ...(observation.filter === undefined ? {} : { filter: requireString(observation.filter, 'association observation filter') }) };
    });
    if (!observations.length) throw new TypeError(`${target}: a target association names at least one exact observation.`);
    const evidence = requireArray(row.evidence, 'association evidence').map((rawEvidence, evidenceIndex) => {
      const item = requireRecord(rawEvidence, `association evidence ${evidenceIndex}`);
      return { citation: requireString(item.citation, 'association citation'), locator: requireString(item.locator, 'association locator'),
        establishes: requireString(item.establishes, 'association claim') };
    });
    if (!evidence.length) throw new TypeError(`${target}: a target association has no cited evidence.`);
    return { target, archive, telescope, mode, archiveTarget, programme, verified, observations, evidence };
  });
}
