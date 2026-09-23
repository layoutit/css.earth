/** Build-derived identity for the complete local TypeScript module closure of an operation. */
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { build } from 'esbuild';

export interface ImplementationFingerprint { readonly sha256: string; readonly files: readonly { readonly path: string; readonly sha256: string }[] }

export async function implementationFingerprint(root: string, entries: readonly string[]): Promise<ImplementationFingerprint> {
  const absolute = entries.map(entry => isAbsolute(entry) ? entry : resolve(root, entry));
  const canonicalRoot = realpathSync(root);
  const result = await build({ absWorkingDir: root, entryPoints: absolute, outdir: resolve(root, '.fingerprint-output'), bundle: true, write: false, metafile: true, platform: 'node', format: 'esm',
    packages: 'external', conditions: ['types'], treeShaking: false, logLevel: 'silent', plugins: [{
      name: 'authored-generated-imports',
      setup(builder) {
        builder.onResolve({ filter: /\.js$/ }, args => {
          if (!args.path.startsWith('.')) return;
          const requested = resolve(args.resolveDir, args.path), marker = `${sep}dist${sep}`, at = requested.lastIndexOf(marker);
          if (at < 0) return;
          const stem = `${requested.slice(0, at)}${sep}${requested.slice(at + marker.length, -3)}`;
          for (const source of [`${stem}.ts`, `${stem}.mts`, resolve(stem, 'index.ts'), resolve(stem, 'index.mts')]) {
            if (existsSync(source) && !relative(canonicalRoot, realpathSync(source)).startsWith('..')) return { path: source };
          }
          return;
        });
      },
    }] });
  const paths = Object.keys(result.metafile.inputs).map(path => resolve(root, path)).filter(path => !relative(root, path).startsWith('..')).sort();
  const files = await Promise.all(paths.map(async path => { const bytes = await readFile(path); return { path: relative(root, path), sha256: createHash('sha256').update(bytes).digest('hex'), bytes }; }));
  const digest = createHash('sha256');
  for (const file of files) digest.update(file.path.length.toString()).update(':').update(file.path).update(':').update(file.bytes);
  return { sha256: digest.digest('hex'), files: files.map(({ path, sha256 }) => ({ path, sha256 })) };
}
