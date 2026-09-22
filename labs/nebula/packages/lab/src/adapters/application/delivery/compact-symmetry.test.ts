import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replayCompactSymmetry } from "./compact-symmetry.ts";
const path = "src/objects/m2-9/source/compact/model.json";
test("retained symmetry fields replay accepted slices without source photographs", async () => {
  const root = await mkdtemp(join(tmpdir(), "nebula-symmetry-"));
  try {
    await cp(
      "src/objects/m2-9/source/compact",
      join(root, "src/objects/m2-9/source/compact"),
      { recursive: true },
    );
    const bytes = await readFile(join(root, path));
    const result = await replayCompactSymmetry(
      root,
      { path },
      "prepared",
    );
    assert.equal(result.volume.resources.length, 144);
    const input = JSON.parse(bytes.toString());
    for (const resource of result.volume.resources) {
      const pixels = await readFile(join(root, 'prepared', resource.path));
      assert.equal(pixels.length, resource.bytes);
    }
    const corrupt = await readFile(
      join(root, "src/objects/m2-9/source/compact/emission-0.f32.gz"),
    );
    corrupt[0] = corrupt[0]! ^ 1;
    await writeFile(
      join(root, "src/objects/m2-9/source/compact/emission-0.f32.gz"),
      corrupt,
    );
    await assert.rejects(
      replayCompactSymmetry(root, { path }, "broken"),
      /header check|differs/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
