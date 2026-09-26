/** Cache identities follow executable owners, including internal workspace packages. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative, resolve, isAbsolute } from 'node:path';
import { build } from 'esbuild';

export async function implementationPins(root: string, entries: readonly string[]) {
  const manifests = new Set<string>();
  const sourceEntries = entries.filter(path => /\.[cm]?tsx?$/.test(path));
  const result = sourceEntries.length ? await build({
    absWorkingDir: root, entryPoints: sourceEntries, outdir: '.local/nebula-lab/fingerprint-only',
    bundle: true, write: false, metafile: true, platform: 'node', format: 'esm',
    packages: 'external', logLevel: 'silent',
    plugins: [{ name: 'nebula-internal-owner-identity', setup(builder) {
      // The FITS reader was a relative module under tools/ before it became @cssearth/fits; its sources stay owners of
      // every identity that reads FITS. The package publishes built files, so its entries map to their sources here.
      builder.onResolve({ filter: /^@cssearth\/fits(?:\/node)?$/ }, args => {
        manifests.add('packages/fits/package.json');
        return { path: resolve(root, args.path.endsWith('/node') ? 'packages/fits/src/node/index.ts' : 'packages/fits/src/index.ts') };
      });
      // The telescope library (product records, label readers, astronomy-package clients) was relative modules under
      // tools/objects/ before it became @cssearth/telescope; its sources stay owners the same way.
      builder.onResolve({ filter: /^@cssearth\/telescope(?:\/node)?$/ }, args => {
        manifests.add('packages/telescope/package.json');
        return { path: resolve(root, args.path.endsWith('/node') ? 'packages/telescope/src/node/index.ts' : 'packages/telescope/src/index.ts') };
      });
      // The SPICE kernel readers were relative modules under tools/ before they became @cssearth/spice; the same.
      builder.onResolve({ filter: /^@cssearth\/spice(?:\/node)?$/ }, args => {
        manifests.add('packages/spice/package.json');
        return { path: resolve(root, args.path.endsWith('/node') ? 'packages/spice/src/node/index.ts' : 'packages/spice/src/index.ts') };
      });
      // The volume contracts, fields and materials were the lab's volume-core package before they became
      // `@cssearth/bake/volume`, and the volume bake was volume-bake before `@cssearth/bake/volume/node`; the preparation
      // topics (photometry, raster, scene, presentation) were relative modules under src/ and tools/. Each topic entry maps
      // to its source index the same way.
      builder.onResolve({ filter: /^@cssearth\/bake\/(?:volume(?:\/node)?|photometry|raster|scene|presentation|sky|shell|stars|volume-leaves)$/ }, args => {
        manifests.add('packages/bake/package.json');
        return { path: resolve(root, 'packages/bake/src', args.path.slice('@cssearth/bake/'.length), 'index.ts') };
      });
      // The star colour fit was a relative module (src/preparation/stars/color.ts) before it joined @cssearth/engine, whose
      // sources stay owners the same way.
      builder.onResolve({ filter: /^@cssearth\/engine$/ }, () => {
        manifests.add('packages/engine/package.json');
        return { path: resolve(root, 'packages/engine/src/index.ts') };
      });
      // The CSS renderer runtime was relative modules under src/renderers/css/ before it became @cssearth/renderer; the lab
      // imports its TypeScript source subpaths (`@cssearth/renderer/volume/types.ts`), which stay owners the same way.
      builder.onResolve({ filter: /^@cssearth\/renderer\// }, async args => {
        const value: unknown = JSON.parse(await readFile(resolve(root, 'packages/renderer/package.json'), 'utf8'));
        const subpath = args.path.slice('@cssearth/renderer/'.length), [directory = ''] = subpath.split('/');
        const owner = value && typeof value === 'object' && 'exports' in value && value.exports && typeof value.exports === 'object'
          ? Reflect.get(value.exports, `./${directory}/*`) : undefined;
        if (typeof owner !== 'string' || owner !== `./src/${directory}/*` || subpath.split('/').includes('..') || !/\.ts$/.test(subpath))
          throw new Error(`Missing public implementation owner: ${args.path}`);
        manifests.add('packages/renderer/package.json');
        return { path: resolve(root, 'packages/renderer/src', subpath) };
      });
      builder.onResolve({ filter: /^@cssearth\/(?:nebula-reconstruction|nebula-lab)(?:\/|$)/ }, async args => {
        const [scope, name, ...tail] = args.path.split('/');
        const directory = name === 'nebula-reconstruction' ? 'reconstruction' : name === 'nebula-lab' ? 'lab' : name;
        const path = `labs/nebula/packages/${directory}/package.json`;
        const value: unknown = JSON.parse(await readFile(resolve(root, path), 'utf8'));
        if (!value || typeof value !== 'object' || !('name' in value) || value.name !== `${scope}/${name}` ||
            !('exports' in value) || !value.exports || typeof value.exports !== 'object') throw new Error('Invalid implementation package.');
        const key = tail.length ? `./${tail.join('/')}` : '.';
        const owner = Reflect.get(value.exports, key);
        if (typeof owner !== 'string' || !owner.startsWith('./src/') || owner.split('/').includes('..'))
          throw new Error(`Missing public implementation owner: ${args.path}`);
        manifests.add(path);
        return { path: resolve(root, `labs/nebula/packages/${directory}`, owner) };
      });
    } }],
  }) : undefined;
  const paths = [...new Set([...entries, ...manifests, ...Object.keys(result?.metafile?.inputs ?? {})])].sort();
  return Promise.all(paths.map(async path => {
    const full = resolve(root, path), name = relative(root, full).replaceAll('\\', '/');
    if (isAbsolute(name) || name === '..' || name.startsWith('../')) throw new Error('Implementation owner leaves repository.');
    return { path: name, sha256: createHash('sha256').update(await readFile(full)).digest('hex') };
  }));
}
