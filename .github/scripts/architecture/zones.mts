/** Folder grouping ("zones") and test detection for the architecture map.
 *
 * A zone is the folder a file is counted in: `packages/<name>`, `labs/nebula-pkg/<name>`, `labs/<lab>` beside
 * `labs/nebula(app)`, the topics of
 * `@cssearth/bake` (`packages/bake/src/<topic>`, `packages/bake/src/objects/<topic>`,
 * `packages/bake/src/objects/layers/<kind>`, `packages/bake/cli`, `packages/bake/authoring/<body>`), so a cycle
 * between bake topics shows instead of hiding inside one package,
 * `src/renderers/css/<sub>`, `src/preparation/<sub>`, `site/<sub>`, `.github/scripts/<sub>`, and
 * `<area>/<sub>` elsewhere. Loose files in a folder form a `(root)` zone, for example `site(root)`.
 * Files at the repository root, such as `astro.config.mts`, form the `(repository root)` zone.
 * Change these rules together with the baseline when the layout changes. */

export const REPOSITORY_ROOT_ZONE = '(repository root)';

export function zoneOf(file: string): string {
  const parts = file.split('/');
  const [top = '', second = '', third = '', fourth = ''] = parts;
  if (parts.length === 1) return REPOSITORY_ROOT_ZONE;
  if (file.startsWith('packages/bake/')) return bakeZone(parts);
  if (top === 'packages') return `packages/${second}`;
  if (file.startsWith('labs/nebula/packages/')) return `labs/nebula-pkg/${fourth}`;
  if (top === 'labs') return second === 'nebula' ? 'labs/nebula(app)' : `labs/${second}`;
  if (file.startsWith('src/renderers/css/')) return parts.length > 4 ? `src/renderers/css/${fourth}` : 'src/renderers/css(root)';
  if (file.startsWith('src/preparation/')) return parts.length > 3 ? `src/preparation/${third}` : 'src/preparation(root)';
  if (file.startsWith('.github/scripts/')) return parts.length > 3 ? `.github/scripts/${third}` : '.github/scripts(root)';
  if (top === 'site') return parts.length > 2 ? `site/${second}` : 'site(root)';
  if (top === 'src' || top === 'tests') return parts.length > 2 ? `${top}/${second}` : `${top}(root)`;
  return top;
}

function bakeZone(parts: readonly string[]): string {
  const [, , area = '', topic = '', kind = '', layer = ''] = parts;
  if (area === 'src') {
    if (parts.length === 4) return 'packages/bake/src(root)';
    if (topic === 'objects' && kind === 'layers' && parts.length > 6) return `packages/bake/src/objects/layers/${layer}`;
    if (topic === 'objects' && parts.length > 5) return `packages/bake/src/objects/${kind}`;
    return parts.length > 4 ? `packages/bake/src/${topic}` : 'packages/bake/src(root)';
  }
  if (area === 'cli') return 'packages/bake/cli';
  if (area === 'authoring' && parts.length > 4) return `packages/bake/authoring/${topic}`;
  return 'packages/bake(root)';
}

/** The top-level area of a zone: `packages`, `src`, `site`, `labs`, `tests`, `deploy`… */
export function areaOf(zone: string): string {
  if (zone.startsWith('labs')) return 'labs';
  return zone.split(/[/(]/u)[0] || zone;
}

/** Tests, fixtures and harnesses. They are left out of the structural numbers, so the layering shown
 * is the one production code needs. */
export function isTestPath(file: string): boolean {
  return /(^|\/)(tests?|__tests__|fixtures)(\/|$)|\.(test|spec)\.|test-support|-harness/u.test(file);
}

/** Code-point order, so a baseline sorts the same on every machine and locale. */
export function byText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
