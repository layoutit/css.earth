import type { DestinationCatalog, DestinationResult, ResolvedDestination } from './destination-types.js';
import type { createDestinationStore } from './prepared-destination-store.js';
export type DestinationWorkerRequest = { type: 'init'; catalog: DestinationCatalog }
  | { type: 'cancel'; id: number }
  | { type: 'search'; id: number; query: string; limit: number }
  | { type: 'resolve'; id: number; entityId: string };
export interface DestinationWorkerResponse {
  id: number; error?: string; value?: DestinationResult[] | ResolvedDestination | null;
  stats?: ReturnType<ReturnType<typeof createDestinationStore>['stats']>;
}
