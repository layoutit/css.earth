/** Folder grouping ("zones") and test detection for the architecture map.
 *
 * A zone is the folder a file is counted in: `packages/<name>`, `labs/nebula-pkg/<name>`,
 * `src/renderers/css/<sub>`, `src/preparation/<sub>`, `tools/objects/<sub>`, `site/<sub>`, and
 * `<area>/<sub>` elsewhere. Loose files in a folder form a `(root)` zone, for example `site(root)`.
 * Files at the repository root, such as `astro.config.mts`, form the `(repository root)` zone.
 * Change these rules together with the baseline when the layout changes. */

export const REPOSITORY_ROOT_ZONE = '(repository root)';

export function zoneOf(file: string): string {
  const parts = file.split('/');
  const [top = '', second = '', third = '', fourth = ''] = parts;
  if (parts.length === 1) return REPOSITORY_ROOT_ZONE;
  if (top === 'packages') return `packages/${second}`;
  if (file.startsWith('labs/nebula/packages/')) return `labs/nebula-pkg/${fourth}`;
  if (top === 'labs') return 'labs/nebula(app)';
  if (file.startsWith('src/renderers/css/')) return parts.length > 4 ? `src/renderers/css/${fourth}` : 'src/renderers/css(root)';
  if (file.startsWith('src/preparation/')) return parts.length > 3 ? `src/preparation/${third}` : 'src/preparation(root)';
  if (file.startsWith('tools/objects/')) return parts.length > 3 ? `tools/objects/${third}` : 'tools/objects(root)';
  if (top === 'site') return parts.length > 2 ? `site/${second}` : 'site(root)';
  if (top === 'src' || top === 'tools' || top === 'tests') return parts.length > 2 ? `${top}/${second}` : `${top}(root)`;
  return top;
}

/** The top-level area of a zone: `packages`, `src`, `site`, `tools`, `labs`, `tests`, `netlify`… */
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
