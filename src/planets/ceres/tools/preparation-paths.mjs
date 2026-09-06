import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const CERES_OBJECT_ROOT = resolve(import.meta.dirname, "..");
export const CERES_SOURCE_ROOT = resolve(CERES_OBJECT_ROOT, "source");
export const CERES_PUBLIC_ROOT = resolve(
  CERES_OBJECT_ROOT,
  "../../../public/scenes/ceres",
);
export const CERES_PREPARED_ROOT = resolve(CERES_OBJECT_ROOT, ".prepared");

export async function ensureCeresPreparationDirectories() {
  await Promise.all([
    mkdir(CERES_PUBLIC_ROOT, { recursive: true }),
    mkdir(CERES_PREPARED_ROOT, { recursive: true }),
  ]);
}
