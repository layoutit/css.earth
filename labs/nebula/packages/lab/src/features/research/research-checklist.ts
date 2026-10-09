/** The Research step's read-only checklist, read from what the object already keeps: its README's Sources table, its
 * host's classification, its recipe and its configured method. Nothing here is written; `research <id>` (planned)
 * will write `source/research.json` with the same rows. */

export interface ResearchLink { label: string; url: string }
export type SourceKind = 'paper' | 'model' | 'image' | 'other';
export interface ResearchChecklist {
  papers: ResearchLink[]; models: ResearchLink[]; images: ResearchLink[];
  type: string; symmetry: string; velocity: string; method: string;
}

const markdownLink = /\[([^\]]+)\]\(([^)\s]+)\)/;
/** What a Sources row names, by its first link: a published 3D model or simulation, an image, a paper, or other. */
export function sourceKind(label: string, url: string): SourceKind {
  const text = `${label} ${url}`.toLowerCase();
  if (/github\.com|dryad|3d[-_ %]|\b3d\b|3d_files|simulation|_model\b/.test(text)) return 'model';
  if (/\/images?\/|photojournal|apod\.nasa|wikimedia|hips|eso\.org\/public\/images/.test(text)) return 'image';
  if (/\(\d{4}\)|arxiv\.org|adsabs|iopscience|aanda\.org|academic\.oup/.test(text)) return 'paper';
  return 'other';
}
/** Every web link in the README's `## Sources` section, table rows and prose alike, once each, in order. */
export function readmeSources(readme: string): (ResearchLink & { kind: SourceKind })[] {
  const lines = readme.split('\n'), start = lines.findIndex(line => /^##\s+Sources\b/.test(line));
  if (start < 0) return [];
  const rows: (ResearchLink & { kind: SourceKind })[] = [], seen = new Set<string>();
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    for (const match of line.matchAll(new RegExp(markdownLink, 'g'))) {
      const [, label, url] = match as unknown as [string, string, string];
      if (!/^https?:\/\//.test(url) || seen.has(url)) continue;
      seen.add(url); rows.push({ label, url, kind: sourceKind(label, url) });
    }
  }
  return rows;
}
/** The nebula's type: its host's classification fact, else the phrase its description gives ("a planetary nebula"). */
export function nebulaType(content: unknown, objectText: string): string {
  const facts = (content as { panel?: { facts?: { id?: string; value?: string }[] } } | null)?.panel?.facts;
  const fact = Array.isArray(facts) ? facts.find(item => item?.id === 'classification' && typeof item.value === 'string') : undefined;
  if (fact?.value) return fact.value;
  const description = /"description":\s*"([^"]+)"/.exec(objectText)?.[1] ?? '';
  const phrase = /\bis (?:an? )?([a-z][a-z -]+?)(?: about| with| in| of|[.,])/i.exec(description)?.[1];
  if (phrase) return phrase[0]!.toUpperCase() + phrase.slice(1);
  return /"classification":\s*"([^"]+)"/.exec(objectText)?.[1] ?? 'Not recorded';
}
/** The symmetry the configured method assumes. */
export function symmetryOf(workflow: string | undefined, surfaces: readonly string[]): string {
  if (workflow === 'symmetry') return 'Axial (assumed)';
  if (workflow === 'plates') return surfaces.length ? `Published surfaces: ${surfaces.join(', ')}` : 'Published surfaces';
  if (workflow === 'density') return 'None (density model)';
  return 'None assumed';
}
