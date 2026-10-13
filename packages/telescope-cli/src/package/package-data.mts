/** Copy preserved runtime inputs without parsing or changing their bytes. */
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prepareSpherePackage } from '../sphere/sphere-package.mts';
import { shippedObjectIds } from '../archives/ledger.mts';
import { namedShippedObjects, readJsonOrNull } from '../archives/targets.mts';
import { chandraShippedObjects, shippedSkyObjects } from '../archives/chandra/archive-ledger.mts';
import { spitzerShippedObjects } from '../archives/spitzer/archive-ledger.mts';
import { readMarks } from '../simulations/read.mts';
import { opensOn } from '../simulations/leads.mts';
import { hostNames } from '../papers.mts';
import { loadTargetCatalogue } from '../observation-query/query.mts';

const omitted = new Set(['fixtures', 'authoring', '__pycache__', 'node_modules', 'prepared', 'oracle', 'source-authoring', 'examples', 'evidence', 'new-object']);
export async function copyPackageData(source: string, destination: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (omitted.has(entry.name) || /\.md$/iu.test(entry.name)&&!/(?:LICENSE|NOTICE)/u.test(entry.name) || /(?:^test_|\.test\.|\.map$|\.[cm]?[jt]s$|\.pyc$)/u.test(entry.name)) continue;
    const from = resolve(source, entry.name), to = resolve(destination, entry.name);
    if (entry.isDirectory()) await copyPackageData(from, to);
    else if (entry.isFile()) { await mkdir(dirname(to), { recursive: true }); await copyFile(from, to); }
  }
}
export async function preparePackageData(root: string, packageRoot: string, outputRoot = packageRoot): Promise<void> {
  const data = resolve(outputRoot, 'data');
  await prepareSpherePackage(root, resolve(data, 'spheres'));
  await prepareDiscoveryPackageData(root, packageRoot, outputRoot);
}

/** Read-only discovery inputs can be prepared independently of the restored sphere bank. */
export async function prepareDiscoveryPackageData(root: string, packageRoot: string, outputRoot: string): Promise<void> {
  const data = resolve(outputRoot, 'data');
  const cssTarget = resolve(data, 'renderer/volume.css');
  await mkdir(dirname(cssTarget), { recursive: true });
  await copyFile(resolve(root, 'packages/renderer/src/styles/volume.css'), cssTarget);
  await copyPackageData(resolve(packageRoot, 'src'), resolve(data, 'cli/src'));
  for (const owner of ['telescope-core']) {
    const target = resolve(data, owner);
    await mkdir(target, { recursive: true });
    // Only data lookups use these owner manifests; they do not declare installable dependencies.
    await writeFile(resolve(target, 'package.json'), JSON.stringify({ name: `@cssearth/${owner}`, private: true, type: 'module' }) + '\n');
    if (owner === 'telescope-core') await copyPackageData(resolve(root, 'packages', owner, 'toolchains'), resolve(target, 'toolchains'));
    // These libraries' executable code is bundled; none of their src data is read by standalone commands.
  }
  const sources = resolve(root, 'src/sources');
  for (const entry of await readdir(sources, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'wwt') {
      // The converted catalogue is read; its original WTML is only acquisition evidence.
      for(const name of ['core-imagesets.jsonl','fits-associations.json','phat-fits.json','WWT-CORE-CATALOGS-LICENSE.txt']) {
        const target=resolve(data,'src/sources/wwt',name);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(sources,entry.name,name),target);
      }
    }
    else for (const name of entry.name === 'telescopes' ? ['target-associations.json'] : entry.name === 'pds' ? ['ledger.json', 'discovery.json'] : ['ledger.json']) {
      const target = resolve(data, 'src/sources', entry.name, name);
      try { await mkdir(dirname(target), { recursive: true }); await copyFile(resolve(sources, entry.name, name), target); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    }
  }
  await mkdir(data, { recursive: true });
  const catalogue = await loadTargetCatalogue(root);
  await writeFile(resolve(data, 'target-catalogue.json'), JSON.stringify(catalogue) + '\n');
  const ids = await shippedObjectIds(root);
  await writeFile(resolve(data, 'site-targets.json'), JSON.stringify({ ids,
    named: await namedShippedObjects(readJsonOrNull, root), sky: await shippedSkyObjects(root), chandra: await chandraShippedObjects(root),
    spitzer: await spitzerShippedObjects(root),
    marks: Object.fromEntries(await Promise.all(ids.map(async id => [id, [...await readMarks(root, id)]]))),
    opensOn: Object.fromEntries((await Promise.all(ids.map(async id => [id, await opensOn(root, id)] as const))).filter((entry): entry is readonly [string, string] => entry[1] !== undefined)),
    hosts: Object.fromEntries(await Promise.all(catalogue.map(async o => [o.id, await hostNames(root, o.id, catalogue)]))) }) + '\n');
}

/** The package root is the publishable layout; checkout source aliases are private imports. */
export async function validatePublishPackage(root: string, packageRoot: string): Promise<void> {
  const { readFile } = await import('node:fs/promises');
  const { requireRecord, requireString } = await import('@cssearth/core');
  const source = requireRecord(JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8')), 'package manifest');
  const dependencies = requireRecord(source.dependencies, 'runtime dependencies');
  for (const [name, version] of Object.entries(dependencies)) {
    if (name.startsWith('@cssearth/') || requireString(version, `${name} version`).startsWith('workspace:'))
      throw new Error(`Unpublished runtime dependency: ${name}`);
  }
  await copyFile(resolve(root, 'LICENSE'), resolve(packageRoot, 'LICENSE'));
}
