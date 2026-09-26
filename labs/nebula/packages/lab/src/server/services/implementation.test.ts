import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { annotationOnlyModules, implementationPins } from './implementation.ts';

test('cache identity includes transitive numerical owners and leaves no build output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-implementation-'));
  try {
    await writeFile(join(root, 'entry.ts'), "export { value } from './numeric.ts';\n");
    await writeFile(join(root, 'numeric.ts'), 'export const value = 1;\n');
    const before = await implementationPins(root, ['entry.ts']);
    assert.deepEqual(before.map(pin => pin.path), ['entry.ts', 'numeric.ts']);
    await writeFile(join(root, 'numeric.ts'), 'export const value = 2;\n');
    const after = await implementationPins(root, ['entry.ts']);
    assert.equal(before[0]!.sha256, after[0]!.sha256);
    assert.notEqual(before[1]!.sha256, after[1]!.sha256);
    const { readdir } = await import('node:fs/promises');
    assert.deepEqual((await readdir(root)).sort(), ['entry.ts', 'numeric.ts']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('cache identity pins the modules an entry reaches through a barrel, not the barrel\'s other modules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-implementation-'));
  const files = {
    'entry.ts': "import { used, Kind } from './topic/index.ts';\nexport const value = used() + Kind.Leaf;\n",
    'topic/index.ts': "export * from './used.ts';\nexport * from './unused.ts';\nexport * from './kind.ts';\nexport type { Shape } from './shape.ts';\n",
    'topic/used.ts': 'export function used() { return 1; }\n',
    'topic/unused.ts': 'export function unused() { return 2; }\n',
    'topic/kind.ts': 'export enum Kind { Leaf = 1 }\n',
    'topic/shape.ts': 'export interface Shape { size: number }\n',
  };
  try {
    await mkdir(join(root, 'topic'));
    for (const [path, text] of Object.entries(files)) await writeFile(join(root, path), text);
    const before = await implementationPins(root, ['entry.ts']);
    // The barrel forwards the imported names and the enum is inlined where it is read; neither puts code in the bundle.
    assert.deepEqual(before.map(pin => pin.path), ['entry.ts', 'topic/index.ts', 'topic/kind.ts', 'topic/used.ts']);
    await writeFile(join(root, 'topic/unused.ts'), 'export function unused() { return 3; }\n');
    await writeFile(join(root, 'topic/shape.ts'), 'export interface Shape { size: string }\n');
    assert.deepEqual(await implementationPins(root, ['entry.ts']), before);
    await writeFile(join(root, 'topic/kind.ts'), 'export enum Kind { Leaf = 2 }\n');
    assert.notDeepEqual(await implementationPins(root, ['entry.ts']), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('cache identity pins a barrel that renames what an import resolves to, and a module kept for its side effects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-implementation-'));
  try {
    await writeFile(join(root, 'entry.ts'), "import { first } from './names.ts';\nimport './effect.ts';\nexport const value = first;\n");
    await writeFile(join(root, 'names.ts'), "export { a as first, b as second } from './pair.ts';\n");
    await writeFile(join(root, 'pair.ts'), "export const a = 'a'; export const b = 'b';\n");
    await writeFile(join(root, 'effect.ts'), "Reflect.set(globalThis, 'nebulaProbe', 1);\nexport const unusedExport = 1;\n");
    const before = await implementationPins(root, ['entry.ts']);
    assert.deepEqual(before.map(pin => pin.path), ['effect.ts', 'entry.ts', 'names.ts', 'pair.ts']);
    await writeFile(join(root, 'names.ts'), "export { b as first, a as second } from './pair.ts';\n");
    assert.notDeepEqual(await implementationPins(root, ['entry.ts']), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('cache identity pins a module that only imports others, because it orders their evaluation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-implementation-'));
  try {
    await writeFile(join(root, 'entry.ts'), "import './order.ts';\nexport const value = Reflect.get(globalThis, 'nebulaOrder');\n");
    await writeFile(join(root, 'order.ts'), "import './first.ts';\nimport './second.ts';\n");
    await writeFile(join(root, 'first.ts'), "Reflect.set(globalThis, 'nebulaOrder', 1);\n");
    await writeFile(join(root, 'second.ts'), "Reflect.set(globalThis, 'nebulaOrder', 2);\n");
    const before = await implementationPins(root, ['entry.ts']);
    assert.deepEqual(before.map(pin => pin.path), ['entry.ts', 'first.ts', 'order.ts', 'second.ts']);
    await writeFile(join(root, 'order.ts'), "import './second.ts';\nimport './first.ts';\n");
    assert.notDeepEqual(await implementationPins(root, ['entry.ts']), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('cache identity pins a barrel that forwards only an inlined enum', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-implementation-'));
  try {
    await writeFile(join(root, 'entry.ts'), "import { Kind } from './kinds.ts';\nexport const value = Kind.Leaf;\n");
    await writeFile(join(root, 'kinds.ts'), "export { Kind, Kind as Other } from './kind.ts';\n");
    await writeFile(join(root, 'kind.ts'), 'export enum Kind { Leaf = 1 }\n');
    assert.deepEqual((await implementationPins(root, ['entry.ts'])).map(pin => pin.path), ['entry.ts', 'kind.ts', 'kinds.ts']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('relocated preparation entry points pin their live package owners', async () => {
  const entries = [
    'server/workflows/sampled-prior/compile.ts', 'server/routes/shape-cloud.ts',
    ...['prepare-master', 'prepare-observation-structures', 'prepare-observation-geometry',
      'prepare-filled', 'prepare-coherent', 'prepare-structures', 'prepare-nebula-structures'].map(name => `cli/commands/${name}.ts`),
  ].map(path => `labs/nebula/packages/lab/src/${path}`);
  const pins = await implementationPins(process.cwd(), entries);
  for (const entry of entries) assert.ok(pins.some(pin => pin.path === entry));
  assert.ok(pins.some(pin => pin.path === 'labs/nebula/packages/reconstruction/src/methods/sampled/material-fit.ts'));
  assert.ok(pins.some(pin => pin.path === 'packages/bake/src/volume/fields/authored-shapes.ts'));
  assert.ok(pins.some(pin => pin.path === 'packages/bake/package.json'));
  assert.equal(pins.some(pin => pin.path.startsWith('packages/bake/dist/')), false);
  assert.ok(pins.some(pin => pin.path === 'packages/bake/src/volume/node/slices/painted-field.ts'));
  assert.equal(pins.some(pin => pin.path.startsWith('labs/nebula/src/')), false);
  // The shared FITS reader the sampled compiler decodes with is pinned by its sources.
  for (const path of ['packages/fits/package.json', 'packages/fits/src/fits.ts', 'packages/fits/src/transport.ts'])
    assert.ok(pins.some(pin => pin.path === path), path);
});

test('the compiler cache identity follows the bake topics its volume compiler reaches', async () => {
  const pins = await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/server/workflows/compiler/compile.ts']);
  for (const path of ['packages/bake/src/volume-leaves/volume.ts', 'packages/bake/src/scene/projective-surface-raster.ts'])
    assert.ok(pins.some(pin => pin.path === path), path);
  assert.equal(pins.some(pin => pin.path.startsWith('packages/bake/dist/')), false);
});

test('the telescope library a preparation owner reaches is pinned by its sources, not its build', async () => {
  const pins = await implementationPins(process.cwd(), ['tools/objects/circumstellar/author.mts']);
  for (const path of ['packages/telescope/package.json', 'packages/telescope/src/product-record.ts', 'packages/telescope/src/node/product-record.ts'])
    assert.ok(pins.some(pin => pin.path === path), path);
  assert.equal(pins.some(pin => pin.path.startsWith('packages/telescope/dist/')), false);
});

test('the star colour fit a catalogue owner reaches is pinned by its engine sources, not its build', async () => {
  const pins = await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/cli/commands/prepare-lmc-stars.ts']);
  for (const path of ['packages/engine/package.json', 'packages/engine/src/solar-system/star-color.ts'])
    assert.ok(pins.some(pin => pin.path === path), path);
  assert.equal(pins.some(pin => pin.path.startsWith('packages/engine/dist/')), false);
});

test('the object colour transfer and atlas mosaic a sky-band owner reaches are pinned by their bake sources, not their build', async () => {
  const pins = await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/adapters/sources/sky-bands.ts']);
  for (const path of ['packages/bake/package.json', 'packages/bake/src/objects/color/color-transfer.ts', 'packages/bake/src/objects/raster/wise-atlas-mosaic.ts'])
    assert.ok(pins.some(pin => pin.path === path), path);
  assert.equal(pins.some(pin => pin.path.startsWith('packages/bake/dist/')), false);
});

/** A compiler publication pins at most 500 inputs (readPublishedCompiler); the compiler entry's owners are most of them. 340 at
 * J slice 2 (it was 263 before the object raster entry), 436 at J slice 5 while whole topic barrels were owners, 294 once owners
 * followed tree shaking (the modules that put code in the bundle and every module importing them). Fail here, well before a publish is refused, and split the entry the compiler reaches or raise the
 * publication limit on purpose. */
const COMPILER_OWNER_BUDGET = 450;
test('the compiler cache identity stays under its owner budget, well inside the publication limit', async () => {
  const pins = await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/server/workflows/compiler/compile.ts']);
  assert.ok(pins.length <= COMPILER_OWNER_BUDGET, `${pins.length} compiler owners exceed the budget of ${COMPILER_OWNER_BUDGET}`);
});

/** Every lab identity's entry sets: the repository paths named in each non-test module that computes an identity. */
async function labIdentityEntries() {
  const { readdir, readFile, stat } = await import('node:fs/promises');
  const sources: string[] = [];
  const walk = async (directory: string): Promise<void> => { for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path); else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) sources.push(path);
  } };
  await walk(join(process.cwd(), 'labs/nebula/packages/lab/src'));
  const sets: string[][] = [];
  for (const source of sources) {
    const text = await readFile(source, 'utf8');
    if (!/\b(?:implementationPins|finiteModelStarProvenance)\(/.test(text) || relative(process.cwd(), source).endsWith('services/implementation.ts')) continue;
    const entries = [...new Set([...text.matchAll(/'((?:labs|packages|tools)\/[\w./-]+\.m?tsx?)'/g)].map(match => match[1]!))];
    const existing = [];
    for (const entry of entries) if (await stat(join(process.cwd(), entry)).then(file => file.isFile(), () => false)) existing.push(entry);
    if (existing.length) sets.push(existing.sort());
  }
  return sets;
}

/** Why a module's top-level code could act when it is evaluated, or undefined when it only declares. */
function topLevelEffect(text: string, path: string) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, /x$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const ambient = (node: ts.Node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword);
  for (const statement of source.statements) {
    if (ambient(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isFunctionDeclaration(statement) ||
        ts.isEnumDeclaration(statement) || ts.isExportDeclaration(statement)) continue;
    if (ts.isImportDeclaration(statement)) { if (statement.importClause) continue; return `bare import: ${statement.getText(source)}`; }
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.BlockScoped) === ts.NodeFlags.Const) continue;
    if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) continue;
    // `void binding;` marks a compile-time assertion as used; reading a module's own binding does nothing.
    if (ts.isExpressionStatement(statement) && ts.isVoidExpression(statement.expression) && ts.isIdentifier(statement.expression.expression)) continue;
    if (ts.isClassDeclaration(statement) && !ts.getDecorators(statement)?.length &&
        (statement.heritageClauses ?? []).every(clause => clause.types.every(type => ts.isIdentifier(type.expression) || ts.isPropertyAccessExpression(type.expression))) &&
        statement.members.every(member => !ts.isClassStaticBlockDeclaration(member) && !(ts.isPropertyDeclaration(member) && member.initializer &&
          (ts.getModifiers(member) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)) && !(ts.canHaveDecorators(member) && ts.getDecorators(member)?.length))) continue;
    return `top-level ${ts.SyntaxKind[statement.kind]}: ${statement.getText(source).split('\n')[0]!.slice(0, 120)}`;
  }
  return undefined;
}

/** Identities leave out modules esbuild drops on the strength of a package's `sideEffects: false` declaration (bake, fits,
 * spice, telescope). Both runtimes evaluate those modules anyway (run.mts unbundled; the CLI bundle keeps the packages
 * external), so a top-level statement that acts would change what a job does without changing its identity. */
test('modules an identity trusts to have no side effects only declare at their top level', async () => {
  const sets = await labIdentityEntries(), failures: string[] = [];
  assert.ok(sets.length >= 20, `${sets.length} lab identity entry sets`);
  assert.ok(sets.some(set => set.includes('labs/nebula/packages/lab/src/server/workflows/compiler/compile.ts')));
  const { readFile } = await import('node:fs/promises');
  let checked = 0;
  for (const entries of sets) for (const path of await annotationOnlyModules(process.cwd(), entries)) {
    checked++;
    const effect = /\.[cm]?tsx?$/.test(path) ? topLevelEffect(await readFile(path, 'utf8'), path) : 'not a TypeScript module';
    if (effect) failures.push(`${path} (${entries[0]}): ${effect}`);
  }
  assert.ok(checked > 0, 'no module is kept only when sideEffects declarations are ignored');
  assert.deepEqual([...new Set(failures)], []);
});

test('the side-effect guard names top-level code that acts and accepts declarations', () => {
  assert.equal(topLevelEffect("import { a } from './a.ts';\nimport type { B } from './b.ts';\nexport * from './c.ts';\n" +
    "export const schema = shape({ a });\nexport function f() { return 1; }\nexport class C extends Base { static readonly kind: string; value = 1; }\n" +
    'export interface I { a: number }\nexport type T = I;\ndeclare const g: number;\nconst agree: true = true;\nvoid agree;\n', 'a.ts'), undefined);
  for (const text of ['globalThis.x = 1;\n', "import './effect.ts';\n", 'export let counter = 0;\n', 'class C { static x = register(); }\n',
    'class C { static { register(); } }\n', 'if (flag) run();\n', 'export default register();\n', 'class C extends mixin(Base) {}\n', 'void register();\n'])
    assert.ok(topLevelEffect(text, 'a.ts'), text);
});

test('sampled supplementary owner allowlist points at existing implementation files', async () => {
  const { sampledImplementationOwners } = await import('../../features/sampled-prior/ownership.ts');
  const { stat } = await import('node:fs/promises');
  for (const path of sampledImplementationOwners) assert.ok((await stat(join(process.cwd(), path))).isFile(), path);
});
