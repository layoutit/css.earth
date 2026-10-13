import { access } from 'node:fs/promises';

/** Fail at the pack-data boundary before a missing generated module becomes an opaque import error. */
export async function requirePackageInput(file: string, command: string): Promise<void> {
  try { await access(file); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw new Error(`Telescope pack data needs ${file}. Run \`${command}\` from the checkout root before npm pack or npm publish.`, { cause: error });
    throw error;
  }
}
