import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const EUROPA_OBJECT_ROOT = resolve(import.meta.dirname, "..");
export const EUROPA_SOURCE_ROOT = resolve(EUROPA_OBJECT_ROOT, "source");
export const EUROPA_PUBLIC_ROOT = resolve(
  EUROPA_OBJECT_ROOT,
  "../../../public/scenes/europa",
);
export const EUROPA_PREPARED_ROOT = resolve(EUROPA_OBJECT_ROOT, ".prepared");

export async function ensureEuropaPreparationDirectories() {
  await Promise.all([
    mkdir(EUROPA_PUBLIC_ROOT, { recursive: true }),
    mkdir(EUROPA_PREPARED_ROOT, { recursive: true }),
  ]);
}
