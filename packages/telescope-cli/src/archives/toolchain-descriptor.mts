import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { WORKSPACE, type ToolchainPins } from '@cssearth/telescope/node';

/** An archive toolchain's pins: the toolchain.json beside its code and the requirements lock it names. The installed
 * environment keeps both texts in its marker, so a changed pin asks for a reinstall. */
export async function readToolchainDescriptor(directory: string, id: string): Promise<ToolchainPins & { readonly lock: string }> {
  const file = resolve(directory, 'toolchain.json'), descriptor = await readFile(file, 'utf8');
  const entry = requireRecord(JSON.parse(descriptor) as unknown, relative(WORKSPACE, file));
  const lock = await readFile(resolve(directory, requireString(entry.requirements, `${relative(WORKSPACE, file)} requirements`)), 'utf8');
  return { id, file: relative(WORKSPACE, file), descriptor, lock, entry };
}
