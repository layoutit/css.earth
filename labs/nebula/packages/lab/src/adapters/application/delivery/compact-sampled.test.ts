import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { replayCompactSampled } from "./compact-sampled.ts";
import { jointRecord } from "../../../features/joint-fit/model.ts";
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
        { path, sha256: createHash("sha256").update(bytes).digest("hex") },
        "prepared",
      ),
      /Compact pin differs/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
