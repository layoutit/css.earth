#!/usr/bin/env node
// Entry script: node packages/bake/cli/prepare-navigation.mts [--catalog-only] [<object-id>...]. The work is in @cssearth/bake/navigation.
import { prepareNavigation } from '@cssearth/bake/navigation';
import { prepareSearchThumbnails } from '@cssearth/bake/site-assets';

const args = process.argv.slice(2);
const catalogOnly = args.includes('--catalog-only');
const objectIds = args.filter(arg => arg !== '--catalog-only');
const result = await prepareNavigation({ catalogOnly, objectIds: objectIds.length ? objectIds : undefined });
// Search previews are cut from the context images drawn here and committed beside them, so no build makes them.
const searchThumbnails = catalogOnly ? undefined : await prepareSearchThumbnails();
console.log(JSON.stringify({
  ...result,
  ...(searchThumbnails ? { searchThumbnails } : {}),
  bodyMarkers:
    `${result.planetCount} prepared 16px raster markers with 2x density`,
  sunMarker: "NASA HMI raster marker with 2x density",
  blackHoleMarker: "NASA/GSFC simulated accretion-disk marker with 2x density",
  supernovaMarker: "NASA/ESA/CSA Webb MIRI Cassiopeia A marker with 2x density",
  actionMarkers: "4 prepared monochrome shaded markers with 2x density",
}));
