import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { publishSourceBytes } from "./source-acquisition.mjs";

test("publishes only validated source bytes and preserves known-good data", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-acquisition-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const destination = join(root, "source.bin");
  const knownGood = Buffer.from("known good");
  const replacement = Buffer.from("replacement");
  await writeFile(destination, knownGood);

  await assert.rejects(
    publishSourceBytes({
      destination,
      bytes: Buffer.from("invalid"),
      entry: sourceEntry(replacement),
      planetName: "Fixture",
    }),
    /size drifted|hash drifted/,
  );
  assert.deepEqual(await readFile(destination), knownGood);

  await publishSourceBytes({
    destination,
    bytes: replacement,
    entry: sourceEntry(replacement),
    planetName: "Fixture",
  });
  assert.deepEqual(await readFile(destination), replacement);
  assert.deepEqual(
    (await readdir(root)).filter((name) => name.includes(".partial-")),
    [],
  );
});

function sourceEntry(bytes) {
  return Object.freeze({
    path: "source.bin",
    expectedBytes: bytes.byteLength,
    expectedSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
