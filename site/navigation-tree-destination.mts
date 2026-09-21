import type { TreeDestination } from '../atlas/src/objects.mts';
import { appNavigationDestination } from './navigation-destination.mts';

/** The shared Atlas tree, drawn inside the application: a row leads where the
 * application can actually go, not to a page named after its object package. */
export const applicationTreeDestination: TreeDestination = object =>
  appNavigationDestination(object.id, object.focusId);
