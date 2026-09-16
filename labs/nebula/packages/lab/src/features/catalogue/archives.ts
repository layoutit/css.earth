import {queryWhere as where,pendingQuery as pending,inventoryQuery as inventory} from '@cssearth/nebula-reconstruction/observations/archives';
export {numberValue,imageFromRow,metadataQueryUrl} from '@cssearth/nebula-reconstruction/observations/archives';
import type {ArchiveProvider,MessierObject} from './types';
import {searchRadiusDegrees} from './selection';
export const endpoints: Record<ArchiveProvider, string> = {
  mast: 'https://mast.stsci.edu/vo-tap/api/v0.1/caom/sync',
  irsa: 'https://irsa.ipac.caltech.edu/TAP/sync',
  eso: 'https://archive.eso.org/tap_obs/sync',
};
export const inventoryPolicy = 'Calibrated image discovery (ObsCore level 2+). ESO/IRSA use footprint overlap; MAST uses pointing centres in a padded sky box because its spatial TAP predicates time out. This is not exhaustive archive coverage. Search extents are catalogue-based discovery windows, not measured nebula boundaries. Keep partial high-resolution fields for future composites and named zoom regions. File availability and pixel quality require inspection. Missing sizes stay unknown; capped results are explicit.';
const config=(provider: ArchiveProvider,object: MessierObject)=>({endpoint:endpoints[provider],radiusDegrees:searchRadiusDegrees(object),transport:{timeoutMs:55000,userAgent:'cssEarth-NebulaLab-MetadataInventory/1'}});
export function queryWhere(provider:ArchiveProvider,object:MessierObject) {return where(provider,object,searchRadiusDegrees(object));}
export function pendingQuery(provider:ArchiveProvider,object:MessierObject) {return pending(provider,config(provider,object));}
export function inventoryQuery(provider:ArchiveProvider,object:MessierObject,maxRecords:number,signal?:AbortSignal) {return inventory(provider,object,maxRecords,config(provider,object),signal);}
