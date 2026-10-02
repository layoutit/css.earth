import type { APIRoute } from 'astro';
import { worldHolderReaches } from '../../world-places.mts';

// Every holder file's star with its place and its system's reach, read once after a page's first view: the camera reads
// a star's holder when it comes near (site/world-approach.mts).
export const GET: APIRoute = () => new Response(JSON.stringify(worldHolderReaches()), { headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
} });
