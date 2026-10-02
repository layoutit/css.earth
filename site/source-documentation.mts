import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import credits from './prepared-source-credits.json' with { type: 'json' };
import { parseSourceCredits } from '@cssearth/objects/provenance';
import { projectRoot } from '@cssearth/core/node';
import { parseSourceIcons } from './source-icons.mts';

// Astro prepares these ordinary links. The browser never reads Markdown or
// reconstructs a document from scientific citations.
// Resolve against the discovered project root rather than `process.cwd()` (a
// workspace-filtered script runs elsewhere) or `import.meta.url` (once Astro
// bundles this module into `dist/.prerender/chunks`, its own URL no longer
// sits beside the project root).
const root = projectRoot(import.meta.url);
const revision = process.env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root, encoding: 'utf8',
}).trim();
if (!/^[a-f0-9]{40}$/u.test(revision)) throw new Error('Source documentation needs the build commit.');
const checked = new Set<string>();
// Each object's provider index, computed when the source catalogue was written (@cssearth/objects/provenance source-credits.ts).
const CREDITS = parseSourceCredits(credits), PROVIDERS = CREDITS.providers;
const ICONS = parseSourceIcons(JSON.parse(readFileSync(resolve(root, 'site/source/source-icons.json'), 'utf8')));
/** The object and the banks its datasets are drawn from (a nebula's volume, a galaxy's layers): a body's sources include
 * theirs. The Crab listed one source of its volume's sixteen, and its footer one credited name (2026-10-02). */
const owners = new Map<string, readonly string[]>();
function lineageOwners(objectId: string): readonly string[] {
  let known = owners.get(objectId);
  if (!known) {
    const file = resolve(root, 'src/objects', objectId, 'source/content/object.json');
    const content: unknown = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
    const controls: unknown = content && typeof content === 'object' && 'datasets' in content && content.datasets && typeof content.datasets === 'object' && 'controls' in content.datasets ? content.datasets.controls : [];
    const banks = (Array.isArray(controls) ? controls : []).flatMap((control: unknown) => {
      const volume: unknown = control && typeof control === 'object' && 'volume' in control ? control.volume : null;
      const bank: unknown = volume && typeof volume === 'object' && 'objectId' in volume ? volume.objectId : null;
      return typeof bank === 'string' && /^[a-z0-9][a-z0-9-]*$/u.test(bank) ? [bank] : [];
    });
    known = Object.freeze([...new Set([objectId, ...banks])]);
    owners.set(objectId, known);
  }
  return known;
}
/** The rows of an object's Sources tab: each published source it and its datasets' banks use, once, with the address of its site's favicon when one is recorded. */
export const objectSourceRows = (objectId: string) => [...new Set(lineageOwners(objectId).flatMap(owner => CREDITS.sources[owner] ?? []))].map(id => {
  const row = CREDITS.records[id]!;
  return { ...row, iconSrc: ICONS[row.icon]?.assetUrl };
});
const sourceProviders = (objectId: string): readonly string[] => [...new Set(lineageOwners(objectId).flatMap(owner => PROVIDERS[owner] ?? []))];
const creditLabel = (providers: readonly string[]) => {
  if (!providers.length) return 'Sources';
  const shown: string[] = [];
  for (const provider of providers) {
    if (shown.length === 3 || provider.length > 20) continue;
    const next = [...shown, provider];
    const remaining = providers.length - next.length;
    const label = `Sources: ${next.join(', ')}${remaining ? ` and ${remaining} more` : ''}`;
    if (label.length <= 52) shown.push(provider);
  }
  if (!shown.length) return `Sources: ${providers.length} credited ${providers.length === 1 ? 'name' : 'names'}`;
  const remaining = providers.length - shown.length;
  return `Sources: ${shown.join(', ')}${remaining ? ` and ${remaining} more` : ''}`;
};

export function sourceDocumentation(objectId: string, name: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(objectId)) throw new Error(`Invalid source document owner: ${objectId}`);
  const path = `src/objects/${objectId}/README.md`;
  if (!checked.has(path)) {
    if (!existsSync(resolve(root, path))) throw new Error(`Missing source document: ${path}`);
    checked.add(path);
  }
  return { href: `https://github.com/layoutit/cssEarth/blob/${revision}/${path}`,
    label: creditLabel(sourceProviders(objectId)) };
}

// A star hosts its system overview, but its own maps do not own the other bodies'
// credits. Prepare the overview's union from the system's prepared members.
export function systemSourceDocumentation(system: { readonly id: string; readonly name: string; readonly memberIds: readonly string[] }) {
  const providers = [...new Set([system.id, ...system.memberIds].flatMap(sourceProviders))];
  return { ...sourceDocumentation(system.id, system.name), label: creditLabel(providers) };
}
