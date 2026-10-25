import type { PreparedGalaxyStations, PreparedCloudPatches, parseGalaxyStationSky } from '@cssearth/objects';
import { readPrepared } from '../../prepared-data-worker-client.js';
import { createGalaxyStationScene } from './galaxy-station-scene.js';
import type { GalaxyStationBackgroundOptions } from './galaxy-stations.js';
/** Reads source-owned station bindings; all records and cloud arrays are validated in the prepared worker. */
export async function loadGalaxyStationBackground(indexUrl:string):Promise<GalaxyStationBackgroundOptions>{
 const index=await readPrepared<PreparedGalaxyStations>('galaxy-stations',indexUrl);
 return{stations:index.stations,interpolation:index.interpolation,autoExposure:index.autoExposure,hysteresisM:index.hysteresisM,fadeMs:index.fadeMs,replacesBanks:index.replacesBanks,
  farFadeStartM:index.farFadeStartM,farFullDistanceM:index.farFullDistanceM,farImageOpacity:index.farImageOpacity,insideSkyFade:index.insideSkyFade,
  async load(id,document){const entry=index.stations.find(station=>station.id===id);if(!entry)throw new TypeError('Unknown galaxy station.');
   const skyUrl=new URL(entry.sky,new URL(indexUrl,document.baseURI)).href,cloudUrl=new URL(entry.clouds,new URL(indexUrl,document.baseURI)).href;
   const [sky,clouds]=await Promise.all([readPrepared<ReturnType<typeof parseGalaxyStationSky>>('galaxy-station-scene',skyUrl),readPrepared<PreparedCloudPatches>('galaxy-station-clouds',cloudUrl)]);
   return createGalaxyStationScene({document,...sky,clouds,resolveResource:file=>new URL(file,skyUrl).href});
  }};
}
