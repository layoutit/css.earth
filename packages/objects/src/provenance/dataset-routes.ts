/** The body dataset a hosted lens is reached through. */
export interface DatasetHost { readonly objectId: string; readonly lensId: string }

/**
 * The application's dataset routes. Which URL selects a prepared object's dataset is the application's decision, so this
 * package never names a route: the host passes the function that formats a dataset's URL and the one that reads it back.
 */
export interface DatasetRoutes {
  /** The canonical URL of `lensId` on the object whose own route is `route`; throws for a route that cannot select one. */
  readonly destination: (objectId: string, route: string, lensId: string) => string;
  /** `value` when it is exactly a canonical dataset URL of the owner's lens (or of its host's dataset); throws otherwise. */
  readonly parse: (value: unknown, ownerId: string, ownerLensId: string, host?: DatasetHost) => string;
}

/** Where a prepared object's lens is reached: its own dataset, or, for a volume attached to a body, the body's dataset that
 * shows it. An attached volume is no place of its own, so it never gets a destination of its own. */
export function objectDataset(object: { readonly id: string; readonly name: string; readonly route: string;
  readonly hostedBy?: { readonly objectId: string; readonly name: string; readonly route: string; readonly datasets: Readonly<Record<string, { readonly lensId: string; readonly label: string }>> } },
  lens: { readonly id: string; readonly label: string }, destination: DatasetRoutes['destination']) {
  const hosted = object.hostedBy;
  if (hosted === undefined) return { objectId: object.id, objectName: object.name, lensId: lens.id, label: lens.label, href: destination(object.id, object.route, lens.id) };
  const dataset = hosted.datasets[lens.id];
  if (dataset === undefined) throw new TypeError(`No dataset of ${hosted.objectId} shows ${object.id}/${lens.id}.`);
  return { objectId: object.id, objectName: hosted.name, lensId: lens.id, label: dataset.label, href: destination(hosted.objectId, hosted.route, dataset.lensId),
    host: { objectId: hosted.objectId, lensId: dataset.lensId } };
}
