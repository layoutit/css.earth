import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Write source bytes atomically: a partial file never stands in for the source. */
export async function publishSourceBytes({ destination, bytes }: { destination: string; bytes: Uint8Array }) {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.partial-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
