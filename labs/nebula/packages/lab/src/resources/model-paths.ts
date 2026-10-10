/** Resolve historical recipe paths without rewriting their scientific bytes. */
const relocated: [string, string][] = [
  ['lmc-', 'lmc/'], ['smc-', 'smc/'],
];
const prefix = 'labs/nebula/models/';
export function resolveLabModelPath(path: string): string {
  if (/^labs\/nebula\/sources\/(?:reference-images|orion-reference|(?:lmc-smash-full|smc-smash-full|omega-centauri-vst|omega-centauri-wfi)\.webp)\.json$/.test(path))
    return path.replace('labs/nebula/sources/', 'labs/nebula/packages/lab/sources/');
  if (path === 'labs/nebula/src/validate-image-registration.py' || path === 'labs/nebula/src/alignment/validate-image-registration.py')
    return 'src/objects/lmc-volume/source/candidates/source/wise-registration/validate-image-registration.pinned.py';
  if (path === 'labs/nebula/src/star-removal/star-removal.py' || path === 'labs/nebula/src/star-removal/star-separation.py')
    return path.replace('labs/nebula/src/star-removal/', 'labs/nebula/packages/reconstruction/src/star-removal/');
  if (!path.startsWith(prefix)) return path;
  let tail = path.slice(prefix.length);
  for (const [before, after] of relocated) if (tail.startsWith(before)) { tail = after + tail.slice(before.length); break; }
  if (tail.startsWith('tarantula-') || /^structure-benchmark(?:[./]|$)/.test(tail)) tail = 'lmc/research/' + tail;
  return objectSourcePath(tail) ?? path;
}
/** The lab's model folders moved into their objects' `source/`: `labs/nebula/models/<id>/…` → `src/objects/<object>/source/…`. */
const movedLooseFiles = new Set(['full-density.json', 'magellanic-particles.json', 'image-candidates.json']);
function objectSourcePath(tail: string): string | null {
  if (movedLooseFiles.has(tail)) return `src/objects/lmc-volume/source/${tail}`;
  const slash = tail.indexOf('/'), id = slash < 0 ? tail : tail.slice(0, slash);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || id === 'messier' || id === 'inference-candidates') return null;
  return `src/objects/${id === 'helix' ? 'helix-layers' : `${id}-volume`}/source${slash < 0 ? '' : tail.slice(slash)}`;
}
/** Call after checking the original JSON bytes against their receipt hash. */
export function parseLabModelJson(text: string): any {
  return JSON.parse(text, (_key, value) => typeof value === 'string' ? resolveLabModelPath(value) : value);
}
/** The site object that keeps a lab subject's or recipe's scratch: helix → helix-layers, m45-processing → m45-volume. */
export function labObjectFolder(id: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new TypeError(`Invalid lab subject id: ${JSON.stringify(id)}`);
  if (/-(?:layers|volume)$/.test(id)) return id;
  if (id === 'helix') return 'helix-layers';
  if (id === 'cassiopeia-a') return 'cassiopeia-a-layers';
  if (/^lmc(?:-|$)/.test(id)) return 'lmc-volume';
  if (/^smc(?:-|$)/.test(id)) return 'smc-volume';
  return `${/^(m45|m8)-/.exec(id)?.[1] ?? id}-volume`;
}
/** Per-object scratch, ignored by git: `src/objects/<object>/.local/<parts…>`. */
export const objectScratch = (id: string, ...parts: string[]) => ['src/objects', labObjectFolder(id), '.local', ...parts].join('/');
/** A repository-relative path in lab scratch: the shared `.local/nebula-lab/` caches or an object's own `.local/`. */
export const isLabScratchPath = (path: string) => /^(?:\.local\/nebula-lab\/|src\/objects\/[a-z0-9][a-z0-9-]*\/\.local\/)/.test(path);
