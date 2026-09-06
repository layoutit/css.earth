import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const IO_OBJECT_ROOT = resolve(import.meta.dirname, "..");
export const IO_SOURCE_ROOT = resolve(IO_OBJECT_ROOT, "source");
export const IO_PUBLIC_ROOT = resolve(
  IO_OBJECT_ROOT,
  "../../../public/scenes/io",
);
export const IO_PREPARED_ROOT = resolve(IO_OBJECT_ROOT, ".prepared");

export async function ensureIoPreparationDirectories() {
  await Promise.all([
    mkdir(IO_PUBLIC_ROOT, { recursive: true }),
    mkdir(IO_PREPARED_ROOT, { recursive: true }),
  ]);
}
