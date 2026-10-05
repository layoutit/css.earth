/** Dependency-free application-source selection shared by CI triggering and semantic seeds. */
import { execFileSync } from 'node:child_process';
export const applicationSource = (path: string): boolean => /^(?:site\/|src\/|packages\/[^/]+\/src\/|astro\.config\.mts$)/u.test(path) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path);
export function hasApplicationRenames(checkout: string, base: string, head: string): boolean {
  const fields = execFileSync('git', ['diff', '--name-status', '-z', '-M', `${base}..${head}`], { cwd: checkout, encoding: 'utf8' }).split('\0');
  for (let i = 0; i < fields.length && fields[i];) {
    const status = fields[i++]!, old = fields[i++]!;
    const next = status.startsWith('R') || status.startsWith('C') ? fields[i++]! : old;
    if (status.startsWith('R') && (applicationSource(old) || applicationSource(next))) return true;
  }
  return false;
}
