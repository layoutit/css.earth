#!/usr/bin/env node
// Entry script: node tools/prepare/cli/prepare-navigation.mts [--catalog-only] [<object-id>...]. The work is in ../prepare-navigation.mts.
import { prepareNavigation } from '../prepare-navigation.mts';

const args = process.argv.slice(2);
const catalogOnly = args.includes('--catalog-only');
const objectIds = args.filter(arg => arg !== '--catalog-only');
const result = await prepareNavigation({ catalogOnly, objectIds: objectIds.length ? objectIds : undefined });
console.log(JSON.stringify({
  ...result,
  bodyMarkers:
    `${result.planetCount} prepared 16px raster markers with 2x density`,
  sunMarker: "NASA HMI raster marker with 2x density",
  blackHoleMarker: "NASA/GSFC simulated accretion-disk marker with 2x density",
  supernovaMarker: "NASA/ESA/CSA Webb MIRI Cassiopeia A marker with 2x density",
  actionMarkers: "4 prepared monochrome shaded markers with 2x density",
}));
