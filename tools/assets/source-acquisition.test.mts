import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import { publishSourceBytes } from "./source-acquisition.mts";

test("publishes source bytes atomically and leaves no partial file behind", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-acquisition-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const destination = join(root, "nested", "source.bin");
  const replacement = Buffer.from("replacement");
  await publishSourceBytes({ destination, bytes: replacement });
  assert.deepEqual(await readFile(destination), replacement);
  await writeFile(destination, Buffer.from("known good"));
  await publishSourceBytes({ destination, bytes: replacement });
  assert.deepEqual(await readFile(destination), replacement);
  assert.deepEqual((await readdir(join(root, "nested"))).filter((name) => name.includes(".partial-")), []);
});
