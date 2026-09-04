import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const MERCURY_OBJECT_ROOT = resolve(import.meta.dirname, "..");
export const MERCURY_SOURCE_ROOT = resolve(MERCURY_OBJECT_ROOT, "source");
export const MERCURY_PUBLIC_ROOT = resolve(
  MERCURY_OBJECT_ROOT,
  "../../../public/scenes/mercury",
);
export const MERCURY_PREPARED_ROOT = resolve(MERCURY_OBJECT_ROOT, ".prepared");

export async function ensureMercuryPreparationDirectories() {
  await Promise.all([
    mkdir(MERCURY_PUBLIC_ROOT, { recursive: true }),
    mkdir(MERCURY_PREPARED_ROOT, { recursive: true }),
  ]);
}
