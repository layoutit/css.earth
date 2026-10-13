/** Copy preserved runtime inputs without parsing or changing their bytes. */
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadTargetCatalogue } from './observation-query/query.mts';

const omitted = new Set(['fixtures', 'authoring', '__pycache__', 'node_modules', 'prepared', 'oracle', 'source-authoring']);
export async function copyPackageData(source: string, destination: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (omitted.has(entry.name) || /(?:^test_|\.test\.|\.map$|\.[cm]?[jt]s$|\.pyc$)/u.test(entry.name)) continue;
    const from = resolve(source, entry.name), to = resolve(destination, entry.name);
    if (entry.isDirectory()) await copyPackageData(from, to);
    else if (entry.isFile()) { await mkdir(dirname(to), { recursive: true }); await copyFile(from, to); }
  }
}
export async function preparePackageData(root: string, packageRoot: string): Promise<void> {
  const data = resolve(packageRoot, 'data');
  await copyPackageData(resolve(packageRoot, 'src'), resolve(data, 'cli/src'));
  for (const owner of ['telescope-core', 'spice', 'bake']) {
    const target = resolve(data, owner);
    await mkdir(target, { recursive: true });
    // Only data lookups use these owner manifests; they do not declare installable dependencies.
    await writeFile(resolve(target, 'package.json'), JSON.stringify({ name: `@cssearth/${owner}`, private: true, type: 'module' }) + '\n');
    if (owner === 'telescope-core') await copyPackageData(resolve(root, 'packages', owner, 'toolchains'), resolve(target, 'toolchains'));
    await copyPackageData(resolve(root, 'packages', owner, 'src'), resolve(target, 'src'));
  }
  const sources = resolve(root, 'src/sources');
  for (const entry of await readdir(sources, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'wwt') await copyPackageData(resolve(sources, entry.name), resolve(data, 'src/sources', entry.name));
    else for (const name of entry.name === 'telescopes' ? ['target-associations.json'] : entry.name === 'pds' ? ['ledger.json', 'discovery.json'] : ['ledger.json']) {
      const target = resolve(data, 'src/sources', entry.name, name);
      try { await mkdir(dirname(target), { recursive: true }); await copyFile(resolve(sources, entry.name, name), target); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    }
  }
  await mkdir(data, { recursive: true });
  await writeFile(resolve(data, 'target-catalogue.json'), JSON.stringify(await loadTargetCatalogue(root)) + '\n');
}

/** The published manifest declares runtime npm dependencies only; source exports stay checkout-only. */
export async function preparePublishPackage(root: string, packageRoot: string): Promise<void> {
  const { cp, readFile } = await import('node:fs/promises');
  const { requireRecord, requireString } = await import('@cssearth/core');
  const source = requireRecord(JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8')), 'package manifest');
  const configuration = requireRecord(source.publishConfig, 'publish configuration');
  const dependencies = requireRecord(source.dependencies, 'runtime dependencies');
  for (const [name, version] of Object.entries(dependencies)) {
    if (name.startsWith('@cssearth/') || requireString(version, `${name} version`).startsWith('workspace:'))
      throw new Error(`Unpublished runtime dependency: ${name}`);
  }
  const manifest: Record<string, unknown> = { ...source, exports: requireRecord(configuration.exports, 'published exports'), publishConfig: { access: 'public' } };
  delete manifest.devDependencies; delete manifest.scripts; delete manifest.oracleManifest;
  const destination = resolve(packageRoot, '.package');
  await mkdir(destination, { recursive: true });
  for (const name of ['dist', 'data']) await cp(resolve(packageRoot, name), resolve(destination, name), { recursive: true });
  for (const name of ['README.md']) await copyFile(resolve(packageRoot, name), resolve(destination, name));
  await copyFile(resolve(root, 'LICENSE'), resolve(destination, 'LICENSE'));
  await writeFile(resolve(destination, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
}
