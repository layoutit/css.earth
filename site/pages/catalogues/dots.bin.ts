import type { APIRoute } from 'astro';
import { catalogueDots, encodeCatalogueDots } from '@cssearth/objects';
import { packPreparedBank } from '@cssearth/objects/node';
import { DOT_CATALOGUES } from '../../server/dot-catalogue-data.mts';
import { CONTEXT_GALAXY_SAMPLE } from '../../prepared/prepared-context-objects.mts';

// The galaxy catalogue's dots as the page draws them (@cssearth/objects catalogue-dots.ts): the sampled Local Group
// galaxies without a package, their ids and places, as one prepared bank the data worker reads. The catalogues themselves
// stay with the build: the page drew fewer than fifty dots from 717 KB of them.
const { galaxies, clusters, nebulae } = DOT_CATALOGUES;
for (const other of [clusters, nebulae]) {
  if (other.frame.referenceFrame !== galaxies.frame.referenceFrame || other.frame.epochJdTt !== galaxies.frame.epochJdTt) throw new TypeError('The prepared catalogues must share a reference frame and epoch.');
}
const file = packPreparedBank(encodeCatalogueDots(catalogueDots(galaxies, CONTEXT_GALAXY_SAMPLE, clusters.objects.length)), '/catalogues/dots.bin');

export const GET: APIRoute = () => new Response(new Uint8Array(file), { headers: { 'Content-Type': 'application/octet-stream' } });
