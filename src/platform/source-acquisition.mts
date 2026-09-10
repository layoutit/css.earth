import type { SourceEntry } from "./source-manifest.mts";
import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { assertSourceBytes } from "./source-manifest.mts";

export async function publishSourceBytes({
  destination,
  bytes,
  entry,
  planetName,
}: { destination: string; bytes: Uint8Array; entry: SourceEntry; planetName: string }) {
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
