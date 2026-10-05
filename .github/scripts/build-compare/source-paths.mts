/** Dependency-free source selection: application inputs for semantic seeds, `site/` for the refactor declaration gate. */
import { execFileSync } from 'node:child_process';
export const applicationSource = (path: string): boolean => /^(?:site\/|src\/|packages\/[^/]+\/src\/|astro\.config\.mts$)/u.test(path) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path);
/** The declaration gate guards plan 7's scope only: files under `site/`. Moves elsewhere (object data, packages) need no declaration. */
export const siteSource = (path: string): boolean => path.startsWith('site/') && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path);
export function hasSiteRenames(checkout: string, base: string, head: string): boolean {
  const fields = execFileSync('git', ['diff', '--name-status', '-z', '-M', `${base}..${head}`], { cwd: checkout, encoding: 'utf8' }).split('\0');
  for (let i = 0; i < fields.length && fields[i];) {
    const status = fields[i++]!, old = fields[i++]!;
    const next = status.startsWith('R') || status.startsWith('C') ? fields[i++]! : old;
    if (status.startsWith('R') && (siteSource(old) || siteSource(next))) return true;
  }
  return false;
}

/** Both names of a rename count, including moves out of application ownership. */
export function applicationPaths(status: string): string[] {
  const fields = status.split('\0'), paths: string[] = [];
  for (let i = 0; i < fields.length && fields[i];) {
    const code = fields[i++]!, old = fields[i++]!;
    paths.push(old);
    if (code.startsWith('R') || code.startsWith('C')) paths.push(fields[i++]!);
  }
  return paths.filter(applicationSource);
}
