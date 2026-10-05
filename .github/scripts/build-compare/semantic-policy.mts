/** Explicit emitted-output permissions are narrower than graph reachability. */
import { array, record, string } from './records.mts';
export interface OutputPermission { glob: string; reason: string }
export interface SemanticPolicy { outputs: OutputPermission[]; layout: 'none' | 'changes' }
export function semanticPolicy(raw: unknown): SemanticPolicy {
  const value = record(raw);
  const layout = value.layout ?? 'none';
  if (layout !== 'none' && layout !== 'changes') throw new Error('layout must be none or changes');
  const outputs = array(value.outputs ?? []).map(entry => {
    const item = record(entry), glob = string(item.glob), reason = string(item.reason);
    if (Object.keys(item).some(key => !['glob', 'reason'].includes(key)) || !glob || glob.startsWith('/') || glob.split('/').some(part => part === '..' || part === '.') || /[\\\[\]{}]/u.test(glob) || !reason.trim()) throw new Error('outputs require a relative glob and a nonempty reason');
    return { glob, reason };
  });
  return { outputs, layout };
}
export function outputMatches(path: string, glob: string): boolean {
  let pattern = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === '*' && glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; pattern += '(?:.*/)?'; } else pattern += '.*'; }
    else if (char === '*') pattern += '[^/]*';
    else if (char === '?') pattern += '[^/]';
    else pattern += char.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  }
  return new RegExp(`^${pattern}$`, 'u').test(path);
}
/** Bundled package outputs lack per-source maps: seed the package's dist modules. */
export function sourceSeedMatches(key: string, path: string): boolean {
  if (key.endsWith(`:${path}`) || key.includes(`:${path}?`) || key.endsWith(`:${path.replaceAll('.', '@_@')}`)) return true;
  const packagePath = /^(packages\/(?:renderer|engine|core|objects))\/src\//u.exec(path)?.[1];
  return !!packagePath && key.includes(`:${packagePath}/dist/`);
}
/** A compact changed span; identical HTML edits share one review group. */
export function changedHunk(base: string, head: string): { base: string; head: string } {
  let start = 0;
  while (start < base.length && start < head.length && base[start] === head[start]) start++;
  let left = base.length, right = head.length;
  while (left > start && right > start && base[left - 1] === head[right - 1]) { left--; right--; }
  return { base: base.slice(start, left), head: head.slice(start, right) };
}
