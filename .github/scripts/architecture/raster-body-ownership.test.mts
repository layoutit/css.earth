import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
const root = resolve(import.meta.dirname, '../../..');
const contracts = new Set(['BodyMapProduct', 'BodyMapObservation', 'BodyMapFrame', 'BodyMapGrid', 'AngularResolution', 'MeasurementDefinition', 'CombinationPolicy', 'TimeDependence', 'ResolutionEvidence', 'ResolutionAssumption', 'LimbBlock', 'RasterRecipe', 'LightingRecipe', 'SurfaceRasterRecipe', 'SurfaceEncoding', 'AtmosphereRecipe', 'InteriorRecipe', 'StructureSource', 'EmissionRecipe', 'LambertRasterConfig', 'InteriorPalette', 'CutawayAngles']);
const parsers = new Set(['parseBodyMapProduct', 'parseCombinationPolicy', 'parseResolutionEvidence', 'parseAcceptedAssumptions', 'parseLimbBlock', 'parseRasterRecipe']);
test('moved formats have no second definition or parser outside objects', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.ts', '*.mts'], { cwd: root, encoding: 'utf8' }).split('\0');
  const findings: string[] = [];
  for (const file of new Set(files)) {
    if (!file || file.startsWith('packages/objects/') || file.includes('.test.') || file.startsWith('output/')) continue;
    let source: string; try { source = readFileSync(resolve(root, file), 'utf8'); } catch { continue; }
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && contracts.has(node.name.text)) findings.push(`${file}: duplicate ${node.name.text}`);
      if (ts.isFunctionDeclaration(node) && node.name && parsers.has(node.name.text)) findings.push(`${file}: duplicate ${node.name.text}`);
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && parsers.has(node.name.text) && node.initializer) findings.push(`${file}: duplicate ${node.name.text}`);
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  assert.deepEqual(findings, []);
});
test('preparation readers invoke shared parsers and supply owner resolution', () => {
  for (const [file, call] of [
    ['packages/bake/src/raster/validation.ts', 'parseRasterRecipe(value, resolveLightingRecipe)'],
    ['packages/bake/src/objects/layers/observation/body-maps/body-map-product.ts', 'parseBodyMapProduct(value, surfaceResolutionKm)'],
  ]) assert.ok(readFileSync(resolve(root, file!), 'utf8').includes(call!), `${file} lost its shared reader`);
  const raster = readFileSync(resolve(root, 'packages/objects/src/prepared-data/raster-recipe-parser.ts'), 'utf8');
  assert.ok(raster.includes("parseLimbBlock(lighting.limb, 'lighting.limb')"));
  assert.ok(raster.includes("parseLimbBlock(atmosphere.limb, 'atmosphere.limb')"));
  const body = readFileSync(resolve(root, 'packages/objects/src/prepared-data/body-map-product.ts'), 'utf8');
  assert.ok(body.includes('parseResolutionEvidence(resolution.evidence)'));
});
