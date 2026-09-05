import assert from "node:assert/strict";
import test from "node:test";
import { readPreparedPresentationModule, requirePreparedDefinitionSource } from "./check-prepared-presentation.mjs";
const definition = `import { PREPARED_OBJECT_RUNTIME_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_PRESENTATION } from "./preparedPresentation.mjs";
export const runtimeDefinition = Object.freeze({ ...PREPARED_PRESENTATION, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: "moon", controls: objectControls });`;
test("prepared modules are parsed as JSON, without importing executable payloads", () => {
  assert.deepEqual(readPreparedPresentationModule('export const PREPARED_PRESENTATION = Object.freeze({"tree":[]});'), { tree: [] });
  for (const source of [
    'export const PREPARED_PRESENTATION = Object.freeze({run(){}});',
    'export const PREPARED_PRESENTATION = Object.freeze(globalThis.payload());',
    'import "./private.mjs"; export const PREPARED_PRESENTATION = Object.freeze({});',
  ]) assert.throws(() => readPreparedPresentationModule(source));
});
test("runtime definitions only bind static prepared data and actual controls", () => {
  assert.equal(requirePreparedDefinitionSource(definition), "moon");
  for (const source of [
    definition.replace('id: "moon"', 'id: name()'),
    definition.replace('controls: objectControls', 'controls: objectControls, createPresentation() {}'),
    definition.replace('./preparedPresentation.mjs', './private.mjs'),
    definition + '\nfunction publishFrame() {}',
    definition.replace('...PREPARED_PRESENTATION', '...buildPlan()'),
  ]) assert.throws(() => requirePreparedDefinitionSource(source));
});
