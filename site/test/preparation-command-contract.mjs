import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseAst } from "vite";
import { OBJECTS } from "../objects.mjs";

// Read the actual root entry point and exercise its registry selection without
// launching producers or writing cache receipts into the checked-out project.
export async function assertSharedPreparationCommand(root, packageSource) {
  const { scripts } = JSON.parse(packageSource);
  const command = /^node (tools\/[a-z0-9-]+\.mjs)$/u.exec(scripts["prepare:planets"]);
  assert.ok(command, "All objects use one preparation module entry point");
  const url = new URL(command[1], root), source = await readFile(url, "utf8");
  const entry = await import(url.href), ast = parseAst(source);
  const steps = ast.body.filter(node => node.type === "VariableDeclaration")
    .flatMap(node => node.declarations).find(node => node.id.name === "sharedSteps")?.init;
  assert.equal(steps?.type, "ArrayExpression", "Shared prerequisites are explicit preparation inputs");
  assert.deepEqual(steps.elements.map(node => `node tools/${node.value}`),
    ["prepare:titles", "prepare:wordmark", "prepare:planet-title-sources", "prepare:scientific-charts"]
      .map(name => scripts[name]));
  assert.match(entry.preparePlanets.toString(),
    /for \(const script of sharedSteps\)[\s\S]+await runObjectCommand[\s\S]+await runCachedPreparationObjects[\s\S]+prepare-navigation\.mjs/u,
    "Shared prerequisites finish before package preparation, then navigation is prepared");
  const events = [], ids = OBJECTS.map(object => object.id);
  const report = await entry.runCachedPreparationObjects({ projectRoot: fileURLToPath(root), force: true,
    environment: async () => ({}),
    sharedFiles: async () => { events.push("shared"); return []; },
    packageFiles: async (_, id) => { events.push(id); return { inputs: [], outputs: [] }; },
    schedule: async ({ objectIds }) => {
      assert.deepEqual(objectIds, ids, "Default preparation selects every real registry object");
      return { results: [] };
    }, onEvent() {} });
  assert.deepEqual(events, ["shared", ...ids]);
  assert.deepEqual(report.rebuilt, ids);
  assert.deepEqual(report.cached, []);
}
