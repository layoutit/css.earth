/** Source-relative references to published per-channel photometric models; no model evaluation. */
export interface LimbBlock {
  /** Model records per channel, source-relative: `photometry/<id>.json`. */
  readonly models: readonly [string, string, string];
  /** Source-relative image whose mean observed color is the overlay's reference; absent, the caller supplies one. */
  readonly reference?: string;
}

export function parseLimbBlock(value: unknown, where: string): LimbBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${where} must be an object, got ${JSON.stringify(value)}.`);
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).filter(key => key !== 'models' && key !== 'reference');
  if (unknown.length) throw new TypeError(`${where} has unknown keys: ${unknown.join(', ')}.`);
  const models = record.models;
  if (!Array.isArray(models) || models.length !== 3 || !models.every(path => typeof path === 'string' && /^photometry\/[a-z][a-z0-9-]*\.json$/u.test(path)))
    throw new TypeError(`${where}.models must name three records as photometry/<id>.json (red, green, blue), got ${JSON.stringify(models)}.`);
  if (record.reference !== undefined && (typeof record.reference !== 'string' || record.reference.startsWith('/') || record.reference.includes('..')))
    throw new TypeError(`${where}.reference must be a source-relative image path, got ${JSON.stringify(record.reference)}.`);
  return { models: [models[0], models[1], models[2]], ...(record.reference === undefined ? {} : { reference: record.reference as string }) };
}

