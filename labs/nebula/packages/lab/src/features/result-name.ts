/**
 * Browser-safe name of one saved lab result: a reconstruction, finite model or lens, compiler result or removal.
 * A result is named by what it was made from (`<subject>-<image>`, `<subject>-<settings>`, `<model>-<image>`,
 * a recipe id), never by a fingerprint of its inputs.
 */
export const resultNamePattern = /^[a-z0-9][a-z0-9-]*$/;
export const isResultName = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 160 && resultNamePattern.test(value);
