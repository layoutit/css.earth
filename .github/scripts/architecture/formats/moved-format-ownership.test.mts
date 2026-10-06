import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const schemas = new Set(['PRODUCT_RECORD_SCHEMA', 'VO_METADATA_SCHEMA', 'VO_DISCOVERY_SCHEMA',
  'PUBLISHED_MUTUAL_ORBIT_SCHEMA', 'PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA', 'GAIA_NEBULA_FIELD_SCHEMA',
  'NEBULA_DELIVERY_SCHEMA', 'VOLUME_SOURCE_MANIFEST_SCHEMA']);
// Publishers serialize schemas; these are not permission to validate them locally.
const publishers = new Set([
  'packages/telescope/src/node/product-record.ts', 'packages/telescope-cli/src/delivery/body-map-publication.mts',
  'packages/telescope-cli/src/vo/discovery.mts', 'packages/telescope-cli/authoring/circumstellar/author.mts',
  'packages/bake/authoring/betelgeuse-shell/author.mts', 'packages/bake/authoring/eps-eridani-corona/author.mts', 'packages/bake/authoring/galileo-lucy/orbits.mts',
  'packages/bake/cli/prepare-nebula-field-catalogues.mts', 'packages/telescope-cli/src/new-object/corona/corona-bank.mts', 'site/build/fixtures/context-package.mts',
]);
// Routing and scientific checks retained by the move. Only these exact AST expressions
// are admitted, never the containing file or a named function's arbitrary body.
const routing: Readonly<Record<string, readonly string[]>> = {
  'packages/telescope-cli/src/archive-adapters/fits-source.mts': ['raw.schema !== PRODUCT_RECORD_SCHEMA'],
  'packages/telescope-cli/src/archive-adapters/pds-source.mts': ['raw.schema !== PRODUCT_RECORD_SCHEMA'],
  'packages/telescope-cli/src/delivery/artifact-outputs.mts': ['raw.schema!==PRODUCT_RECORD_SCHEMA'],
  'packages/astronomy/cli/body-epoch-ephemeris.mts': ['record.schema === PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA', 'parameters.schema !== PUBLISHED_MUTUAL_ORBIT_SCHEMA'],
  'packages/astronomy/cli/lib/ephemeris-records.mts': ['objectValue(value).schema === PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA'],
  'packages/bake/src/nebula/delivery-kind.ts': ['schema === NEBULA_DELIVERY_SCHEMA'],
  'packages/bake/src/asset-publication/restore-source-inputs.ts': ["sourceObject(JSON.parse(manifest.toString('utf8'))).schema === VOLUME_SOURCE_MANIFEST_SCHEMA"],
  'packages/bake/cli/prepare-nebula-field-catalogues.mts': ['previous.schema!==GAIA_NEBULA_FIELD_SCHEMA'],
};
const diagnosticOwners = ['prepared-data/source/telescope-product.ts', 'prepared-data/source/vo-discovery.ts',
  'prepared-data/source/volume-source-manifest.ts', 'prepared-data/source/source-record-readers.ts', 'prepared-data/source/volume-presentation-source.ts', 'volume/nebula/gaia-nebula-field.ts', 'volume/nebula/nebula-delivery.ts'];
const normalize = (text: string) => text.replace(/\s+/gu, '');
const tree = (path: string, text: string) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
function literals(source: ts.SourceFile): string[] {
  const result: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) result.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
// Distinctive parser diagnostics, including template heads, without generic value checks.
const diagnostics = diagnosticOwners.flatMap(path => literals(tree(path, readFileSync(new URL(`packages/objects/src/${path}`, new URL('../../../../', import.meta.url)), 'utf8'))))
  .filter(text => !['Expected nebula delivery object.', 'Expected nebula delivery text.', 'Catalogue field requires an object.', 'Catalogue field requires nonempty text.'].includes(text))
  .filter(text => text.length >= 18 && /(?:source vector|source schema|preview names|tracked preview|VO |product record|nebula delivery|nebula framing|compiler delivery|compact bake method|Compact method and delivery|Density-grid delivery|density-grid|catalogue field|Catalogue field|Gaia |retained star appearance|retained catalogue|volume source manifest|context manifest)/u.test(text));

function violations(path: string, text: string): string[] {
  const source = tree(path, text), result: string[] = [], names = new Set(schemas);
  function imports(node: ts.Node): void {
    if (ts.isImportSpecifier(node) && schemas.has((node.propertyName ?? node.name).text)) names.add(node.name.text);
    ts.forEachChild(node, imports);
  }
  imports(source);
  const locate = (node: ts.Node, message: string) => result.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`);
  const routedUses = new Map<string, number>();
  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node) && names.has(node.text)) {
      const parent = node.parent;
      const imported = ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent);
      const published = publishers.has(path) && ts.isPropertyAssignment(parent) && parent.initializer === node && parent.name.getText(source) === 'schema';
      const routed = ts.isBinaryExpression(parent) && (routing[path] ?? []).some(expression => normalize(expression) === normalize(parent.getText(source)));
      if (routed) {
        const expression = normalize(parent.getText(source));
        const count = (routedUses.get(expression) ?? 0) + 1;
        routedUses.set(expression, count);
        const maximum = path === 'packages/telescope-cli/src/delivery/artifact-outputs.mts' ? 2 : 1;
        if (count > maximum) locate(node, 'An admitted routing expression was copied');
      }
      const pythonMetadata = path === 'packages/telescope/src/node/astroquery.ts' && ts.isTemplateSpan(parent) && node.text === 'VO_METADATA_SCHEMA';
      if (!imported && !published && !routed && !pythonMetadata) locate(node, `Moved schema reference ${node.text} must stay in objects`);
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const diagnostic = diagnostics.find(message => node.text.includes(message));
      if (diagnostic) locate(node, `Moved parser diagnostic ${JSON.stringify(diagnostic)}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}

test('git-tracked source cannot return a moved parser under another name', () => {
  assert.ok(diagnostics.length > 10, 'The diagnostic scan must inspect the parser owners.');
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).split('\0')
    .filter(path => /\.(?:[cm]?[jt]sx?)$/u.test(path) && !path.startsWith('packages/objects/') &&
      !/(?:\.test\.|\.spec\.|\/dist\/|\/generated\/|\/vendor\/)/u.test(path));
  const findings = paths.flatMap(path => violations(path, readFileSync(new URL(path, new URL('../../../../', import.meta.url)), 'utf8')));
  assert.deepEqual(findings, []);
});

test('renamed returning copies and diagnostic copies fail, including in admitted callers', () => {
  assert.ok(violations('packages/telescope-cli/src/vo/bridge.mts', `import { VO_DISCOVERY_SCHEMA as schema } from '@cssearth/objects';
    function parseSnapshotMut(value: {schema: string}) { if (value.schema !== schema) throw new TypeError('Unsupported VO snapshot.'); return value; }`).length > 0);
  assert.ok(violations('packages/astronomy/cli/lib/ephemeris-records.mts', `import { PUBLISHED_MUTUAL_ORBIT_SCHEMA } from '@cssearth/objects';
    const parsePublishedParametersCopy = shape({schema: literal(PUBLISHED_MUTUAL_ORBIT_SCHEMA), id: string});`).length > 0);
  assert.ok(violations('packages/astronomy/cli/lib/ephemeris-records.mts', `
    const a = objectValue(value).schema === PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA;
    const b = objectValue(value).schema === PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA;`).length > 0);
  assert.ok(violations('site/new-reader.mts', `throw new TypeError('Unsupported VO snapshot.');`).length > 0);
});
