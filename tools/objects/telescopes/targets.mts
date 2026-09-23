export interface TargetCatalogueEntry {
  readonly archiveClass?: string;
  readonly classificationSource?: string;
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
}

export type TargetResolution =
  | { readonly status: 'resolved'; readonly requested: string; readonly canonical: { readonly id: string; readonly name: string }; readonly matchedBy: 'id' | 'name' | 'alias' }
  | { readonly status: 'ambiguous'; readonly requested: string; readonly candidates: readonly { readonly id: string; readonly name: string; readonly matchedBy: 'id' | 'name' | 'alias' }[] }
  | { readonly status: 'unknown'; readonly requested: string; readonly suggestions: readonly { readonly id: string; readonly name: string; readonly distance: number }[] };

const normalized = (value: string): string => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, '');

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) current[column] = Math.min(
      current[column - 1]! + 1, previous[column]! + 1,
      previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1));
    previous = current;
  }
  return previous[right.length]!;
}

/** Resolve a user-facing name through the same catalogue the application ships. Near matches are suggestions only: a
 * telescope query never silently changes its scientific target. */
export function resolveTarget(requested: string, catalogue: readonly TargetCatalogueEntry[]): TargetResolution {
  const query = normalized(requested);
  const idMatches = catalogue.filter(entry => entry.id === requested);
  if (idMatches.length === 1) {
    const entry = idMatches[0]!;
    return { status: 'resolved', requested, canonical: { id: entry.id, name: entry.name }, matchedBy: 'id' };
  }
  const matches: { readonly id: string; readonly name: string; readonly matchedBy: 'id' | 'name' | 'alias' }[] = [];
  for (const entry of catalogue) {
    const values = [{ value: entry.name, matchedBy: 'name' as const }, { value: entry.id, matchedBy: 'id' as const },
      ...entry.aliases.map(value => ({ value, matchedBy: 'alias' as const }))];
    const exact = values.find(candidate => normalized(candidate.value) === query);
    if (exact && !matches.some(match => match.id === entry.id)) matches.push({ id: entry.id, name: entry.name, matchedBy: exact.matchedBy });
  }
  if (matches.length === 1) {
    const match = matches[0]!;
    return { status: 'resolved', requested, canonical: { id: match.id, name: match.name }, matchedBy: match.matchedBy };
  }
  if (matches.length > 1) return { status: 'ambiguous', requested, candidates: matches.sort((a, b) => a.id.localeCompare(b.id)) };
  const suggestions = catalogue.map(entry => ({ id: entry.id, name: entry.name,
    distance: Math.min(...[entry.id, entry.name, ...entry.aliases].map(value => editDistance(query, normalized(value)))) }))
    .filter(entry => entry.distance <= Math.max(2, Math.floor(query.length / 3)))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id)).slice(0, 3);
  return { status: 'unknown', requested, suggestions };
}

/** An entered name may be sent to an archive only when the catalogue resolves it to one target. Keep it
 * request-scoped: a provider spelling observed in one search is not a permanent alias for a body. */
export function withRequestedTargetName(requested: string, targetId: string, catalogue: readonly TargetCatalogueEntry[]): readonly TargetCatalogueEntry[] {
  const key = normalized(requested);
  const matches = catalogue.filter(entry => [entry.id, entry.name, ...entry.aliases].some(value => normalized(value) === key));
  const resolution = resolveTarget(requested, catalogue);
  if (matches.length !== 1 || matches[0]!.id !== targetId || resolution.status !== 'resolved' || resolution.canonical.id !== targetId) return catalogue;
  return catalogue.map(entry => entry.id === matches[0]!.id && ![entry.name, ...entry.aliases].includes(requested)
    ? { ...entry, aliases: [...entry.aliases, requested] } : entry);
}

/** Preserve the user's uniquely resolved spelling when a request is carried forward under its canonical id. */
export function canonicalTargetRequest<Request extends { readonly target: string; readonly requestedTargetName?: string }>(request: Request, targetId: string) {
  const requested = request.requestedTargetName ?? request.target;
  return { ...request, target: targetId, ...(requested === targetId ? {} : { requestedTargetName: requested }) };
}
