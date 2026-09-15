/** Resolve historical recipe paths without rewriting their hash-pinned scientific bytes. */
const relocated: [string, string][] = [
  ['lmc-', 'lmc/'], ['smc-', 'smc/'],
];
const prefix = 'labs/nebula/models/';
export function resolveLabModelPath(path: string): string {
  if (path === 'labs/nebula/src/validate-image-registration.py' || path === 'labs/nebula/src/alignment/validate-image-registration.py')
    return 'labs/nebula/models/lmc/candidates/source/wise-registration/validate-image-registration.pinned.py';
  if (path === 'labs/nebula/src/star-removal/star-removal.py' || path === 'labs/nebula/src/star-removal/star-separation.py')
    return path.replace('labs/nebula/src/star-removal/', 'labs/nebula/packages/reconstruction/src/star-removal/');
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
