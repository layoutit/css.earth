/** A test or tool needs an input this checkout does not hold: a download, an archive member, a restored output or an uninstalled
 * toolchain. Callers recognize the absence by `code`, never by the wording of the message, so rewording a message cannot change
 * whether a test skips (`sourceTest` in `@cssearth/objects/node/source-test`). */
export const SOURCE_INPUT_MISSING = 'SOURCE_INPUT_MISSING';

export class MissingSourceInputError extends Error {
  readonly code = SOURCE_INPUT_MISSING;
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'MissingSourceInputError';
  }
}

export function isMissingSourceInput(error: unknown): error is Error & { readonly code: typeof SOURCE_INPUT_MISSING } {
  return error instanceof Error && 'code' in error && error.code === SOURCE_INPUT_MISSING;
}
