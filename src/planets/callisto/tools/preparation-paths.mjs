import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const CALLISTO_OBJECT_ROOT = resolve(import.meta.dirname, "..");
export const CALLISTO_SOURCE_ROOT = resolve(CALLISTO_OBJECT_ROOT, "source");
export const CALLISTO_PUBLIC_ROOT = resolve(
  CALLISTO_OBJECT_ROOT,
  "../../../public/scenes/callisto",
);
export const CALLISTO_PREPARED_ROOT = resolve(CALLISTO_OBJECT_ROOT, ".prepared");

export async function ensureCallistoPreparationDirectories() {
  await Promise.all([
    mkdir(CALLISTO_PUBLIC_ROOT, { recursive: true }),
    mkdir(CALLISTO_PREPARED_ROOT, { recursive: true }),
  ]);
}
