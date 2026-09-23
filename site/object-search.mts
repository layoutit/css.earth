import { normalizeDestinationQuery } from './destination-search.mts';
import { matchesObjectCategory, matchesObjectClassification, objectCategory } from './object-categories.mts';

export const SEARCH_QUERY_LIMIT = 200;
export interface ObjectSearchLabels {
  name: string;
  names: readonly string[];
  classification: string;
  classificationName: string;
  systemName: string;
  illustration?: boolean;
  candidate?: boolean;
}

/** One matching policy for the native form response and its live enhancement. */
export function searchObjects<T extends ObjectSearchLabels>(items: readonly T[], value: string, category = 'planet',
  { illustrations = false } = {}) {
  const query = value.slice(0, SEARCH_QUERY_LIMIT).trim().toLocaleLowerCase('en');
  const normalized = normalizeDestinationQuery(query);
  const showAll = query === 'all objects';
  const classification = items.find(item => query === item.classificationName || query === `${item.classificationName}s`
    || item.classificationName === 'nebula' && query === 'nebulae'
    || item.classificationName === 'galaxy' && query === 'galaxies' || query === item.classification)?.classification;
  const systemName = items.find(item => query === item.systemName)?.systemName;
  const matches = items.filter(item => classification
    ? matchesObjectClassification(item.classification, classification) && (!item.illustration || illustrations) && !item.candidate
    : showAll || (systemName ? item.systemName === systemName
      : item.name.includes(query) || normalized.length > 0 && item.names.some(name => name.includes(normalized))));
  const nextCategory = classification ? objectCategory(classification) : showAll ? 'all'
    : matches.some(item => matchesObjectCategory(item.classification, category)) ? category
      : objectCategory(matches[0]?.classification) ?? category;
  return { query, matches, category: nextCategory, classification, systemName, showAll,
    detailQuery: classification || systemName || showAll ? '' : query };
}

/** Read only the labels already published by the shared result components. */
export function objectSearchLabels(item: HTMLElement): ObjectSearchLabels {
  const names: unknown = JSON.parse(item.dataset.objectSearchNames ?? '[]');
  if (!Array.isArray(names) || !names.every(name => typeof name === 'string')) throw new TypeError('Prepared object search names are invalid.');
  return { name: item.dataset.objectName ?? '', names,
    illustration: item.dataset.objectIllustration === 'true',
    candidate: item.dataset.objectCandidate === 'true',
    classification: item.dataset.objectClassification ?? '', classificationName: item.dataset.objectClassificationName ?? '',
    systemName: item.dataset.objectSystemName ?? '' };
}
