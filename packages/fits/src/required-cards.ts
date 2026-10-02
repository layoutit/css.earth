/** Require an already-decoded finite numeric card; numeric strings are refused. */
export function requiredFiniteCard(header: Readonly<Record<string, unknown>>, key: string, name: string): number {
  const value = header[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} carries no numeric ${key}.`);
  return value;
}

/** Require non-blank decoded text and return its trimmed value. */
export function requiredTrimmedTextCard(header: Readonly<Record<string, unknown>>, key: string, name: string): string {
  const value = header[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} carries no ${key}.`);
  return value.trim();
}
