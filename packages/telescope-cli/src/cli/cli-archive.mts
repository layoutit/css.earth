/** Archive display names come from the shared registry; evidence keeps the service URL. */
import { ARCHIVES } from '../archives/archives.mts';
import type { ExplorationChoice } from '../exploration.mts';

export function archiveLabel(choice: Pick<ExplorationChoice, 'archiveService' | 'telescope'>): string {
  const matches = choice.archiveService ? ARCHIVES.filter(archive => archive.registry?.address === choice.archiveService) : [];
  const facility = choice.telescope.toLowerCase();
  const archive = matches.find(entry => entry.id === facility) ?? matches.find(entry => !entry.ledgerCommand) ?? (matches.length === 1 ? matches[0] : undefined);
  return archive ? archive.displayName ?? archive.name : choice.telescope;
}
