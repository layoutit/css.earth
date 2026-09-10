/** Resolve historical recipe paths without rewriting their hash-pinned scientific bytes. */
const relocated: [string, string][] = [
  ['lmc-', 'lmc/'], ['smc-', 'smc/'],
];
const prefix = 'labs/nebula/models/';
export function resolveLabModelPath(path: string): string {
  if (!path.startsWith(prefix)) return path;
  const tail = path.slice(prefix.length);
  for (const [before, after] of relocated) if (tail.startsWith(before)) return prefix + after + tail.slice(before.length);
  if (tail.startsWith('tarantula-') || /^structure-benchmark(?:[./]|$)/.test(tail)) return prefix + 'lmc/research/' + tail;
  return path;
}
/** Call after checking the original JSON bytes against their receipt hash. */
export function parseLabModelJson(text: string): any {
  return JSON.parse(text, (_key, value) => typeof value === 'string' ? resolveLabModelPath(value) : value);
}
