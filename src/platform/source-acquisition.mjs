import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { assertSourceBytes } from "./source-manifest.mjs";

export async function publishSourceBytes({
  destination,
  bytes,
  entry,
  planetName,
}) {
  assertSourceBytes({ entry, bytes, planetName });
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.partial-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return entry;
}
