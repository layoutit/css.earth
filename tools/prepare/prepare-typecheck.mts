import { execFile, spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { type RuntimeAssetLocation, inventoryAssets } from '../assets/runtime-assets.mts';
import { installRuntimeAssets } from '../assets/setup.mts';
import { volumeMetadataAssets } from '../assets/runtime-assets.mts';
import { hasErrorCode, requireArray, requireRecord, requireString } from '@cssearth/core';

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, '../..');

/** TypeScript resolves literal JSON imports, not the texture URLs inside their data. Keep the real JSON
 * inputs instead of substituting declarations or importing every object's image bank into a typecheck. */
export function preparedJsonImports(file: string, source: string, root: string): string[] {
  const sources = file.endsWith('.astro')
    ? [...source.matchAll(/(?:^---\r?\n([\s\S]*?)\r?\n---|<script\b[^>]*>([\s\S]*?)<\/script>)/gu)].map(match => match[1] ?? match[2] ?? '')
    : [source];
  const paths = new Set<string>();
  for (const text of sources) {
    const syntax = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0]
        : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
      if (specifier && (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier)) &&
          specifier.text.startsWith('.') && specifier.text.endsWith('.json')) {
        const path = resolve(dirname(file), specifier.text);
        const local = relative(root, path).split(sep).join('/');
        if (/^src\/objects\/[a-z][a-z0-9-]*\/prepared\/.+\.json$/u.test(local)) paths.add(path);
      }
      ts.forEachChild(node, visit);
    };
    visit(syntax);
  }
  return [...paths].sort();
}

/** Scan maintained source, including test imports. Generated declarations are not an alternate data contract.
 * All authored TypeScript/Astro is a conservative superset of the application and test compiler programs, so a
 * newly introduced literal import automatically joins the plan without another hand-maintained body list. */
export async function collectTypecheckPreparedImports(root = projectRoot) {
  const { stdout } = await exec('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  const files = [...new Set(stdout.split('\0').filter(path => /\.(?:[cm]?ts|tsx|astro)$/u.test(path)))];
  const paths = new Set<string>();
  for (const file of files) {
    const source = await readFile(resolve(root, file), 'utf8').catch((error: unknown) => {
      if (hasErrorCode(error, 'ENOENT')) return undefined; // An unstaged source deletion is not a compiler root.
      throw error;
    });
    if (source !== undefined) for (const path of preparedJsonImports(resolve(root, file), source, root)) paths.add(path);
  }
  return [...paths].sort();
}

/** Resolve exact inventories before any request. A missing non-inventoried input remains an error; this path
 * cannot turn an unpublished or unprepared JSON import into a successful typecheck. */
export async function typecheckAssetsForPaths(paths: readonly string[], root = projectRoot): Promise<RuntimeAssetLocation[]> {
  const groups = new Map<string, Set<string>>();
  for (const path of paths) {
    const local = relative(root, resolve(path)).split(sep).join('/');
    const match = /^src\/objects\/([a-z][a-z0-9-]*)\/prepared\/(.+)$/u.exec(local);
    if (!match) throw new TypeError(`Typecheck input is outside an object prepared directory: ${path}`);
    const id = match[1]!, filename = match[2]!;
    if (!groups.has(id)) groups.set(id, new Set());
    groups.get(id)!.add(filename);
  }
  const assets: RuntimeAssetLocation[] = [];
  for (const [id, names] of groups) {
    const filenames = [...names], base = resolve(root, 'src/objects', id);
    const candidates = existsSync(resolve(base, 'inventory.json')) ? await inventoryAssets(root, [id], { filenames }) : [];
    for (const filename of filenames) {
      const file = resolve(base, 'prepared', filename);
      const matches = candidates.filter(asset => asset.file === file);
      if (matches.length > 1) throw new TypeError(`Ambiguous typecheck inventory: ${id}/${filename}`);
      if (matches.length === 1) assets.push(matches[0]!);
      else await access(file); // Tracked/generated inputs are supplied by checkout and build:tools.
    }
  }
  return assets;
}

function uniqueAssets(assets: readonly RuntimeAssetLocation[]): RuntimeAssetLocation[] {
  const selected = new Map<string, RuntimeAssetLocation>();
  for (const asset of assets) {
    const previous = selected.get(asset.file);
    if (previous && (previous.sha256 !== asset.sha256 || previous.bytes !== asset.bytes)) throw new TypeError(`Conflicting typecheck asset pins: ${asset.file}`);
    selected.set(asset.file, asset);
  }
  return [...selected.values()].sort((a, b) => a.file.localeCompare(b.file));
}

/** ObjectShell imports the real feature-index pin. Restore its named-feature JSON inputs, never the rest of
 * those bodies' texture banks; the existing index compiler still validates every catalogue and selection. */
export async function typecheckFeatureAssets(root = projectRoot, ids = SCENE_OBJECTS.map(object => object.id)) {
  const assets: RuntimeAssetLocation[] = [], catalogues: RuntimeAssetLocation[] = [];
  for (const id of ids) {
    const source = await readFile(resolve(root, 'src/objects', id, 'prepared/features.json'), 'utf8').catch((error: unknown) => {
      if (hasErrorCode(error, 'ENOENT')) return undefined;
      throw error;
    });
    if (source === undefined) continue;
    const descriptor = requireRecord(JSON.parse(source));
    if (descriptor.schema !== 'cssearth-prepared-features@1') throw new TypeError(`Invalid feature-index input: ${id}`);
    const pins = [descriptor, ...descriptor.selection === undefined ? [] : requireArray(requireRecord(descriptor.selection).banks).map(value => requireRecord(value))];
    for (const [index, pin] of pins.entries()) {
      const url = requireString(pin.url), prefix = `/scenes/${id}/`;
      if (!url.startsWith(prefix) || !/^[a-zA-Z0-9._-]+\.json$/u.test(url.slice(prefix.length))) throw new TypeError(`Invalid feature catalogue URL: ${url}`);
      const matches = await inventoryAssets(root, [id], { location: 'public', filenames: [url.slice(prefix.length)] });
      const asset = matches[0];
      if (matches.length !== 1 || !asset || asset.file !== resolve(root, `public${url}`) || asset.sha256 !== pin.sha256 || asset.bytes !== pin.bytes)
        throw new TypeError(`The feature catalogue must match its published descriptor and inventory: ${id}`);
      assets.push(asset);
      if (index === 0) catalogues.push(asset);
    }
  }
  return { assets: uniqueAssets(assets), catalogues };
}

export async function restoreTypecheckInputs({ root = projectRoot, fetcher = fetch }:
  { root?: string; fetcher?: typeof fetch } = {}) {
  const imports = await collectTypecheckPreparedImports(root);
  const catalogue = await volumeMetadataAssets(root);
  const features = await typecheckFeatureAssets(root);
  const initial = uniqueAssets([...await typecheckAssetsForPaths(imports, root), ...catalogue.assets, ...features.assets]);
  const first = await installRuntimeAssets(initial, { fetcher });
  const landmarkRuntimes: string[] = [];
  for (const asset of features.catalogues) {
    const data = requireRecord(JSON.parse(await readFile(asset.file, 'utf8')));
    if (data.landmarks !== undefined) landmarkRuntimes.push(resolve(root, 'src/objects', asset.id, 'prepared/runtime.json'));
  }
  const followup = uniqueAssets(await typecheckAssetsForPaths(landmarkRuntimes, root))
    .filter(asset => !initial.some(previous => previous.file === asset.file));
  const second = await installRuntimeAssets(followup, { fetcher });
  const assets = uniqueAssets([...initial, ...followup]);
  return { files: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    installed: first.installed + second.installed, reused: first.reused + second.reused };
}

async function run(root: string, args: string[]) {
  await new Promise<void>((accept, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`Typecheck preparation failed: ${args.join(' ')} (${signal ?? code})`)));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new TypeError('Usage: node tools/prepare/prepare-typecheck.mts (after pnpm build:tools)');
  const result = await restoreTypecheckInputs();
  console.log(`Typecheck inputs: ${result.files} pinned files, ${result.bytes} bytes; ${result.installed} downloaded, ${result.reused} reused. No body texture banks.`);
  // `prepared/page.json` is a build output, not a tracked file: restore-object-json writes it from
  // the restored runtime. The two steps below read it, so it has to exist before they run.
  await run(projectRoot, ['tools/assets/restore-object-json.mts', '--restored-only']);
  await run(projectRoot, ['tools/prepare/prepare-feature-index.mts']);
  await run(projectRoot, ['tools/prepare/prepare-facilities.mts', '--catalog-only', '--restored-only']);
  console.log('Typecheck preparation complete: source catalogues generated.');
}
