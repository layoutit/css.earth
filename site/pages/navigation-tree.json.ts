import type { APIRoute } from 'astro';
import { navigationTree } from '../navigation/navigation-tree.mts';
import { navigationTreeText } from '../navigation/navigation-tree-data.mts';

// The application's own tree: the branches `NavigationTree.astro` leaves unrendered in the shell.
export const GET: APIRoute = () => new Response(navigationTreeText(navigationTree()),
  { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
