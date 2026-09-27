/** Cache identities follow executable owners, including internal workspace packages. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative, resolve, isAbsolute } from 'node:path';
import { build, type Metafile } from 'esbuild';
import ts from 'typescript';

export async function implementationPins(root: string, entries: readonly string[]) {
  const { manifests, metafile } = await identityBuild(root, entries);
  const paths = [...new Set([...entries, ...manifests, ...(metafile ? await reachedOwners(root, metafile) : [])])].sort();
  return Promise.all(paths.map(async path => ({ path: repositoryPath(root, path), sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex') })));
}

/** Every file the identity build reads: the owners and the modules resolved on the way to them (a barrel's other modules).
 * A copy of these files computes the same identity. */
export async function implementationClosure(root: string, entries: readonly string[]) {
  const { manifests, metafile } = await identityBuild(root, entries);
  return [...new Set([...entries, ...manifests, ...Object.keys(metafile?.inputs ?? {})].map(path => repositoryPath(root, path)))].sort();
}

function repositoryPath(root: string, path: string) {
  const name = relative(root, resolve(root, path)).replaceAll('\\', '/');
  if (isAbsolute(name) || name === '..' || name.startsWith('../')) throw new Error('Implementation owner leaves repository.');
  return name;
}

async function identityBuild(root: string, entries: readonly string[]) {
  const manifests = new Set<string>();
  const sourceEntries = entries.filter(path => /\.[cm]?tsx?$/.test(path));
  const result = sourceEntries.length ? await build({
    absWorkingDir: root, entryPoints: sourceEntries, outdir: '.local/nebula-lab/fingerprint-only',
    // Tree shaking keeps the owners to the modules the entries reach, not every module behind a topic barrel. It ignores the
    // packages' `sideEffects: false` declarations (and pure annotations): both runtimes evaluate every imported module, so a
    // module is left out only when esbuild itself finds it free of side effects. No minification: esbuild then inlines only
    // TypeScript enums across modules.
    bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', treeShaking: true, minify: false, ignoreAnnotations: true,
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
      // topics (photometry, raster, scene, presentation) were relative modules under src/ and tools/, and the object topics
      // (`objects/color`, `objects/geometry`, `objects/cameras`, `objects/raster`, `objects/scene`, `objects/sources`, `objects/layers/<kind>`) were relative modules
      // under tools/objects/. Each topic entry maps to its source index the same way.
      builder.onResolve({ filter: /^@cssearth\/bake\/(?:volume(?:\/node)?|photometry|raster|scene|presentation|nebula|environment|image-layers|density|sky|shell|stars|volume-leaves|world-context|cluster-catalog|galaxy-catalog|objects\/(?:color|geometry|cameras|raster|scene|sources|layers\/(?:observation|shape-model|cutaway|giant|material-composition|observed-surfaces|paged-ellipsoid|terrestrial)))$/ }, args => {
        manifests.add('packages/bake/package.json');
        return { path: resolve(root, 'packages/bake/src', args.path.slice('@cssearth/bake/'.length), 'index.ts') };
      });
      // World-rotation validation was a renderer module before it joined @cssearth/objects, beside the registry contracts
      // that were relative modules under site/; the package's sources stay owners the same way.
      builder.onResolve({ filter: /^@cssearth\/objects$/ }, () => {
        manifests.add('packages/objects/package.json');
        return { path: resolve(root, 'packages/objects/src/index.ts') };
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
  return { manifests, metafile: result?.metafile };
}

/** A loaded module is an owner when it puts code in the bundle, when it imports such a module (directly or through other
 * modules, so it orders its evaluation), or when it can change the bundle without putting code in it: it forwards a binding
 * (a barrel on the path from an import to its definition) or declares an enum esbuild inlines where it is read. The modules
 * left are ones esbuild proves free of side effects and the bundle never reads; editing one so that the bundle reads it, or so
 * that it acts when evaluated, makes it contribute code, and so an owner. */
async function reachedOwners(root: string, metafile: Metafile) {
  const contributing = new Set(Object.values(metafile.outputs).flatMap(output =>
    Object.entries(output.inputs).filter(([, input]) => input.bytesInOutput > 0).map(([path]) => path)));
  // Every loaded module was reached from an entry; one that imports a contributing module, directly or through other
  // modules, decides when that module is evaluated, so it is an owner too.
  const importers = new Map<string, string[]>();
  for (const [path, input] of Object.entries(metafile.inputs)) for (const edge of input.imports)
    if (!edge.external) importers.set(edge.path, [...importers.get(edge.path) ?? [], path]);
  const leading = new Set(contributing), pending = [...contributing];
  for (let path = pending.pop(); path !== undefined; path = pending.pop())
    for (const importer of importers.get(path) ?? []) if (!leading.has(importer)) { leading.add(importer); pending.push(importer); }
  const owners: string[] = [];
  for (const path of Object.keys(metafile.inputs))
    if (leading.has(path) || !/\.[cm]?[jt]sx?$/.test(path) || shapesBundleWithoutCode(path, await readFile(resolve(root, path), 'utf8')))
      owners.push(path);
  return owners;
}

function shapesBundleWithoutCode(path: string, text: string) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, /x$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imported = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly) continue;
    const { name, namedBindings } = statement.importClause;
    if (name) imported.add(name.text);
    if (namedBindings && ts.isNamespaceImport(namedBindings)) imported.add(namedBindings.name.text);
    else if (namedBindings) for (const element of namedBindings.elements) if (!element.isTypeOnly) imported.add(element.name.text);
  }
  let shapes = false;
  const visit = (node: ts.Node): void => {
    if (shapes) return;
    if (ts.isEnumDeclaration(node) && !node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword)) shapes = true;
    else if (ts.isExportDeclaration(node) && !node.isTypeOnly) shapes = node.moduleSpecifier !== undefined || (node.exportClause !== undefined &&
      ts.isNamedExports(node.exportClause) && node.exportClause.elements.some(element => !element.isTypeOnly && imported.has((element.propertyName ?? element.name).text)));
    else if (ts.isExportAssignment(node)) shapes = ts.isIdentifier(node.expression) && imported.has(node.expression.text);
    else if (ts.isImportEqualsDeclaration(node)) shapes = !node.isTypeOnly;
    else ts.forEachChild(node, visit);
  };
  visit(source);
  return shapes;
}
