import { isMissingSourceInput } from '@cssearth/core';

/** Collect coded absences for restoration; corrupt or undeclared inputs remain failures. */
export async function missingFitsInputs<T>(inputs: Iterable<T>, read: (input: T) => Promise<unknown>): Promise<T[]> {
  const missing: T[] = [];
  for (const input of inputs) {
    try { await read(input); }
    catch (error) {
      if (!isMissingSourceInput(error)) throw error;
      missing.push(input);
    }
  }
  return missing;
}
