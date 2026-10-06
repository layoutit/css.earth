import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';
import ts from 'typescript';
import { objectFromEntry } from '../directory/object-directory.mts';
import type { SceneFactory } from '../browser/browser-types.mts';

// Isolate the router's scene collaborators, not its loader registration or autostart.
const routerUrl = new URL('./scene-router.mts', import.meta.url);
const router = ts.createSourceFile(routerUrl.pathname, readFileSync(routerUrl, 'utf8'), ts.ScriptTarget.Latest, true);
for (const statement of router.statements) {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith('.')) continue;
  const specifier = statement.moduleSpecifier.text;
  if (['../directory/object-directory.mts', './scene-imports.mts', './world-imports.mts'].includes(specifier)) continue;
  const clause = statement.importClause;
  if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
  const names = clause.namedBindings.elements.filter(binding => !binding.isTypeOnly).map(binding => (binding.propertyName ?? binding.name).text);
  if (names.length) mock.module(new URL(specifier, routerUrl).href, { namedExports: Object.fromEntries(names.map(name => [name, () => {}])) });
}
const mount: SceneFactory = () => { throw new Error('Only scene loading is exercised.'); };
mock.module(new URL('./packaged-object-runtime.mts', import.meta.url).href, { namedExports: { async loadPackagedObject() { return mount; } } });
const object = objectFromEntry({ descriptor: { schema: 'cssearth-object@2', id: 'router-registration', type: 'layered-body', properties: { worldFrame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [1, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 },
  catalog: { name: 'Router registration', systemName: 'Solar System', classification: 'planet', color: '#aabbcc', distanceAu: 1, description: 'A body.' },
} }, distance: { meters: 3.085677581491367e16, value: 1, unit: 'pc', quantity: 'catalogue', referencePoint: 'observer', epochJdTt: null }, discovery: { featured: false, imagery: false, illustration: false } });

test('the production router import registers the default directory loader during module evaluation', async () => {
  await assert.rejects(object.loadScene(), /runtime loader is not registered/u);
  await import('./scene-router.mts');
  assert.equal(await object.loadScene(), mount);
});
