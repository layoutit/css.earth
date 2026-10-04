import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import { ARCHIVED_CAMERA_SCHEMA, parseMatrixArchivedCamera } from '@cssearth/objects/archived-camera';
import { ARCHIVED_CAMERA_SCHEMA as mainSchema } from '@cssearth/objects';

const nodeGlobals = ['Buffer', 'process', 'require', '__dirname', '__filename', 'global'];

function inspectBrowserModule(source: string, filename: string): string[] {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const propertyName = (ts.isPropertyAccessExpression(parent) && parent.name === node)
        || ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)
          || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) && parent.name === node)
        || (ts.isBindingElement(parent) && parent.propertyName === node);
      if (!propertyName) assert.ok(!nodeGlobals.includes(node.text), `${filename}: Browser entry contains Node global ${node.text}`);
    }
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteral(specifier)) {
      assert.ok(!specifier.text.startsWith('node:'), `${filename}: Browser entry imports ${specifier.text}`);
      if (specifier.text.startsWith('.')) imports.push(specifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return imports;
}

function assertBrowserClosure(entries: readonly string[]): void {
  const seen = new Set<string>();
  const visit = (filename: string): void => {
    if (seen.has(filename)) return;
    seen.add(filename);
    for (const specifier of inspectBrowserModule(readFileSync(filename, 'utf8'), filename)) visit(resolve(dirname(filename), specifier));
  };
  entries.forEach(visit);
}

test('browser entry guard rejects Node globals while allowing property names and strings', () => {
  inspectBrowserModule('throw new Error("require node:fs process Buffer"); x.process; x.Buffer; const x = { require: 1, global() {}, get process() { return 1; }, set Buffer(value) {} }; const { process: value } = x;', 'fixture.js');
  for (const name of nodeGlobals) assert.throws(() => inspectBrowserModule(`export const leaked = ${name};`, 'fixture.js'), /Browser entry contains Node global/u);
  assert.throws(() => inspectBrowserModule('export { readFile } from "node:fs";', 'fixture.js'), /Browser entry imports node:fs/u);
});

test('browser entry guard follows shared chunks, including transitive and dynamic imports', () => {
  const root = mkdtempSync(join(tmpdir(), 'browser-entry-'));
  try {
    writeFileSync(join(root, 'index.js'), 'export { value } from "./shared.js";');
    writeFileSync(join(root, 'shared.js'), 'import("./nested.js"); export const value = 1;');
    writeFileSync(join(root, 'nested.js'), 'import "./shared.js";');
    const entries = [join(root, 'index.js')];
    assertBrowserClosure(entries);
    for (const name of ['process', 'Buffer']) {
      writeFileSync(join(root, 'nested.js'), `export const leak = ${name};`);
      assert.throws(() => assertBrowserClosure(entries), /nested\.js: Browser entry contains Node global/u);
    }
    writeFileSync(join(root, 'nested.js'), 'import "node:fs";');
    assert.throws(() => assertBrowserClosure(entries), /Browser entry imports node:fs/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('objects codec typechecking excludes DOM while retaining host encoding globals', () => {
  const config = readFileSync(new URL('../../tsconfig.json', import.meta.url), 'utf8');
  const libs = /"lib"\s*:\s*\[([^\]]*)\]/u.exec(config)?.[1];
  assert.ok(libs);
  assert.doesNotMatch(libs, /DOM/u);
  assertBrowserClosure(['index', 'sources', 'provenance', 'archived-camera'].map(entry =>
    new URL(`../../dist/${entry}.js`, import.meta.url).pathname));
});
test('archived camera is a usable ESM/CJS entry with nonempty declarations', () => {
  assert.equal(ARCHIVED_CAMERA_SCHEMA, mainSchema);
  const required = createRequire(import.meta.url)('@cssearth/objects/archived-camera');
  assert.equal(required.ARCHIVED_CAMERA_SCHEMA, ARCHIVED_CAMERA_SCHEMA);
  const declaration = readFileSync(new URL('../../dist/archived-camera.d.ts', import.meta.url), 'utf8');
  assert.match(declaration, /SpiceCamera/u);
  assert.match(declaration, /ARCHIVED_CAMERA_SCHEMA/u);
  assert.throws(() => parseMatrixArchivedCamera({ schema: 'invalid', matrix: [], rayMatrix: [], positionKm: [], sunDirection: [] }), /Invalid archived source camera/u);
  const cameraSource = readFileSync(new URL('../../../spice/src/camera.ts', import.meta.url), 'utf8');
  assert.match(cameraSource, /from '@cssearth\/objects\/archived-camera'/u);
});
