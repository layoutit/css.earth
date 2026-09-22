import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { prepareCssomDeclarationReads } from "./prepared-cssom.mts";
import { preparedDeclarations, createPreparedNodeTree } from "./prepared-node-tree.mts";

test("offline CSS reads retain native decimal serialization before scaling", async () => {
  const text = "width:512px;height:512px;background-position:-4px -312.06625px;background-size:1024px 1024px";
  const reads = await prepareCssomDeclarationReads([text, text]);
  assert.equal(reads.size, 1);
  const read = reads.get(text);
  assert.ok(read);
  assert.equal(read.backgroundPosition, "-4px -312.066px");
  const declarations = preparedDeclarations(text, read);
  assert.equal(declarations.backgroundPosition, "-4px -312.066px");
  assert.equal(declarations.preparedRecord().style, text);
  declarations.backgroundPosition = "-8px -624.132px";
  assert.equal(declarations.backgroundPosition, "-8px -624.132px");
  assert.deepEqual(declarations.preparedRecord().properties, [{ name: "backgroundPosition", value: "-8px -624.132px", custom: false }]);
});

test("retained preparation uses serialized reads without replacing the source declaration bytes", async () => {
  const style = "width:512px;height:512px;background-position:-4px -312.06625px;background-size:1024px 1024px";
  const cssomReads = await prepareCssomDeclarationReads([style]);
  const b = createPreparedNodeTree({ cssomReads }), node = b.element("s", null, style);
  assert.equal(node.style.backgroundPosition, "-4px -312.066px");
  assert.equal(node.style.preparedRecord().style, style);
  await assert.rejects(prepareCssomDeclarationReads([null]), /prepared strings/);
});
