import type { APIRoute } from 'astro';
import { atlasTree, readObjects } from '../../atlas/src/objects.mts';
import { navigationTreeText } from '../../atlas/src/navigation-tree-data.mts';
import { applicationTreeDestination } from '../navigation/navigation-tree-destination.mts';

// The application's own tree: the branches `NavigationTree.astro` leaves unrendered in the shell.
export const GET: APIRoute = () => new Response(navigationTreeText(atlasTree(readObjects(), applicationTreeDestination)),
  { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
