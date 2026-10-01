import { isRecord } from '@cssearth/core';

/** A fact a package states about itself for its card, with the publication it comes from. */
export interface ObjectFact {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** How the value was obtained or what it does not mean, in the source's terms. */
  readonly note?: string;
  readonly source: { readonly label: string; readonly url: string };
}

/** The facts a package's descriptor states under `properties.facts`, for a package without a content recipe of its own (a
 * galaxy, a cluster of galaxies, a nebula the world's host draws); empty when it states none. Each names its source. */
export function objectFacts(descriptor: unknown): readonly ObjectFact[] {
  if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.facts === undefined) return Object.freeze([]);
  const id = String(descriptor.id), facts = descriptor.properties.facts;
  if (!Array.isArray(facts)) throw new TypeError(`src/objects/${id}/object.json: properties.facts is a list of facts.`);
  const seen = new Set<string>();
  return Object.freeze(facts.map((fact: unknown, index) => {
    const at = `src/objects/${id}/object.json: properties.facts[${index}]`;
    if (!isRecord(fact) || Object.keys(fact).some(key => !['id', 'label', 'value', 'note', 'source'].includes(key))
      || typeof fact.id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(fact.id) || typeof fact.label !== 'string' || !fact.label.trim()
      || typeof fact.value !== 'string' || !fact.value.trim() || (fact.note !== undefined && (typeof fact.note !== 'string' || !fact.note.trim()))) {
      throw new TypeError(`${at} needs an id, a label and a value, with an optional note and its source.`);
    }
    if (seen.has(fact.id)) throw new TypeError(`${at} repeats the fact ${fact.id}.`);
    seen.add(fact.id);
    const source = fact.source;
    if (!isRecord(source) || Object.keys(source).some(key => key !== 'label' && key !== 'url') || typeof source.label !== 'string' || !source.label.trim()
      || typeof source.url !== 'string' || !/^https:\/\//u.test(source.url)) throw new TypeError(`${at}.source needs a label and an https url; a fact without a source is not stated.`);
    return Object.freeze({ id: fact.id, label: fact.label, value: fact.value, ...(fact.note === undefined ? {} : { note: fact.note as string }),
      source: Object.freeze({ label: source.label, url: source.url }) });
  }));
}
