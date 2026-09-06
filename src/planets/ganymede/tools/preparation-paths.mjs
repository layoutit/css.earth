import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const GANYMEDE_OBJECT_ROOT = resolve(import.meta.dirname, "..");
export const GANYMEDE_SOURCE_ROOT = resolve(GANYMEDE_OBJECT_ROOT, "source");
export const GANYMEDE_PUBLIC_ROOT = resolve(
  GANYMEDE_OBJECT_ROOT,
  "../../../public/scenes/ganymede",
);
export const GANYMEDE_PREPARED_ROOT = resolve(GANYMEDE_OBJECT_ROOT, ".prepared");

export async function ensureGanymedePreparationDirectories() {
  await Promise.all([
    mkdir(GANYMEDE_PUBLIC_ROOT, { recursive: true }),
    mkdir(GANYMEDE_PREPARED_ROOT, { recursive: true }),
  ]);
}
