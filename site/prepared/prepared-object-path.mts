/** The path under `/objects/<id>/` that serves a scene body's prepared transport reference: `prepared/object.json` is
 * `object.json`, and a deferred dataset's tables (`prepared/datasets/<dataset>.json`, dataset-tables.ts in
 * `@cssearth/renderer`) are `datasets/<dataset>.json`. Any other reference is not served. */
export function preparedObjectPath(reference: string) {
  if (reference === 'prepared/object.json') return 'object.json';
  const dataset = /^prepared\/datasets\/([a-z0-9][a-z0-9-]*)\.json$/u.exec(reference)?.[1];
  if (dataset === undefined) throw new Error(`Prepared object asset is not available: ${reference}.`);
  return `datasets/${dataset}.json`;
}

/** Where a scene body's transport reference is served: `/objects/<id>/<path>`. */
export function preparedObjectUrl(id: string, reference: string) {
  return `/objects/${id}/${preparedObjectPath(reference)}`;
}
