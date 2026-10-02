import { checks, failure } from '@cssearth/core';
// Preserve the prepared readers' historical diagnostics.
export const { record, array, text, finite, positive, unique, numbers } = checks(failure('Prepared presentation: '));
