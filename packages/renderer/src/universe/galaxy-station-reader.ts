import {parseGalaxyStationSky,parsePreparedGalaxyStations,readCloudPatches} from '@cssearth/objects';
import {fetchPreparedBank,fetchPreparedJson,preparedReader} from '../prepared-data/prepared-readers.js';
export const galaxyStationsReader=preparedReader('galaxy-stations',async(url,fetcher)=>({value:parsePreparedGalaxyStations(await fetchPreparedJson(url,fetcher)),transfer:[]}));
export const galaxyStationSceneReader=preparedReader('galaxy-station-scene',async(url,fetcher)=>{
 const sky=parseGalaxyStationSky(await fetchPreparedJson(url,fetcher));
 return{value:sky,transfer:[]};
});
export const galaxyStationCloudsReader=preparedReader('galaxy-station-clouds',async(url,fetcher)=>{
 const value=readCloudPatches(await fetchPreparedBank(url,fetcher),url);
 const buffers=[...new Set([value.matrices.buffer,value.cells.buffer])];
 if(!buffers.every((buffer):buffer is ArrayBuffer=>buffer instanceof ArrayBuffer))throw new TypeError('Station cloud buffers must be transferable.');
 return{value,transfer:buffers};
});
