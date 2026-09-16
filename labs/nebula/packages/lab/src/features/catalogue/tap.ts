export {readTapTable,tapUrl,type TapTable} from '@cssearth/nebula-reconstruction/observations/tap';
import {fetchTap as fetchArchiveTap} from '@cssearth/nebula-reconstruction/observations/tap';
export function fetchTap(endpoint: string, query: string, maxRecords: number, signal?: AbortSignal) {return fetchArchiveTap(endpoint,query,maxRecords,{timeoutMs:55000,userAgent:'cssEarth-NebulaLab-MetadataInventory/1'},signal);}
