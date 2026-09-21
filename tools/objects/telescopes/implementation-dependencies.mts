/** Build-derived identity for the complete local TypeScript module closure of an operation. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { build } from 'esbuild';

export interface ImplementationFingerprint { readonly sha256: string; readonly files: readonly { readonly path: string; readonly sha256: string }[] }

export async function implementationFingerprint(root: string, entries: readonly string[]): Promise<ImplementationFingerprint> {
  const absolute = entries.map(entry => isAbsolute(entry) ? entry : resolve(root, entry));
  const result = await build({ absWorkingDir: root, entryPoints: absolute, bundle: true, write: false, metafile: true, platform: 'node', format: 'esm',
    packages: 'external', treeShaking: false, logLevel: 'silent' });
  const paths = Object.keys(result.metafile.inputs).map(path => resolve(root, path)).filter(path => !relative(root, path).startsWith('..')).sort();
  const files = await Promise.all(paths.map(async path => { const bytes = await readFile(path); return { path: relative(root, path), sha256: createHash('sha256').update(bytes).digest('hex'), bytes }; }));
  const digest = createHash('sha256');
  for (const file of files) digest.update(file.path.length.toString()).update(':').update(file.path).update(':').update(file.bytes);
  return { sha256: digest.digest('hex'), files: files.map(({ path, sha256 }) => ({ path, sha256 })) };
}
