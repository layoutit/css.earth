import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { replayCompactSampled } from "./compact-sampled.ts";
import { jointRecord } from "../../../features/joint-fit/model.ts";
import { maximumPlanningEmission, prepareCompactSampledInputs } from '@cssearth/volume-bake/compact-inputs/sampled';
test("compact sampled replay rejects changed measured particles before any reconstruction", async () => {
  const root = await mkdtemp(join(tmpdir(), "nebula-sampled-"));
  try {
    const path = "src/objects/m1/source/compact/model.json.gz";
    const bytes = await readFile(path);
    const model: unknown = JSON.parse(gunzipSync(bytes).toString());
    assert.ok(
      jointRecord(model) &&
        jointRecord(model.particles) &&
        typeof model.particles.path === "string",
    );
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), bytes);
    await writeFile(
      join(root, model.particles.path),
      Buffer.from("altered measured particles"),
    );
    await assert.rejects(
      replayCompactSampled(
        root,
        { path },
        "prepared",
      ),
      /header check|Compact pin differs/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('sampled planning preserves features unique to any lens without changing its emission', () => {
  const reference = (x: number, _y: number, _z: number, out: [number, number, number]) => { out.fill(x < 0 ? 3 : 0); };
  const secondary = (x: number, _y: number, _z: number, out: [number, number, number]) => { out.fill(x > 0 ? 7 : 1); };
  const planning = maximumPlanningEmission([reference, secondary]), reverse = maximumPlanningEmission([secondary, reference]);
  const out: [number, number, number] = [0, 0, 0], alternate: [number, number, number] = [0, 0, 0];
  for (const [x, expected] of [[-1, 3], [0, 1], [1, 7]] as const) {
    planning(x, 0, 0, out); reverse(x, 0, 0, alternate);
    assert.deepEqual(out, [expected, expected, expected]); assert.deepEqual(alternate, out);
  }
  reference(1, 0, 0, out); assert.deepEqual(out, [0, 0, 0]);
  secondary(-1, 0, 0, out); assert.deepEqual(out, [1, 1, 1]);
  assert.throws(() => maximumPlanningEmission([]), /at least one/);
  const invalid = maximumPlanningEmission([reference, (_x, _y, _z, rgb) => { rgb[0] = 1; }]);
  assert.throws(() => invalid(1, 0, 0, out), /finite nonnegative/);
});

test('retained sampled loader rejects a renamed scene before reading particles or writing outputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-retained-sampled-'));
  try {
    const value: unknown = JSON.parse(gunzipSync(await readFile('src/objects/m1/source/compact/model.json.gz')).toString());
    assert.ok(jointRecord(value)); value.sourceResult = '0'.repeat(64);
    const bytes = gzipSync(Buffer.from(JSON.stringify(value))), path = 'input.json.gz';
    await writeFile(join(root, path), bytes);
    await assert.rejects(prepareCompactSampledInputs(root,
      { path },
      { decodeFits() { throw new Error('Must reject before decoding'); } }), /source result differs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
