import {prepareDensityProjection as project} from '@cssearth/volume-core/fields/density-projection';
import {sampleEncoded,type VolumeSource} from '@cssearth/volume-bake/compact-inputs/density-grid';
import {channelDensity} from '@cssearth/volume-bake/slices/density';
export function prepareDensityProjection(source:VolumeSource,distance:number,width=256){const encoded:[number,number,number,number]=[0,0,0,0];return project({bounds:source.recipe.grid.bounds,depth:source.depth,exposureGain:source.recipe.material.exposureGain,densityAt(x,y,z){sampleEncoded(source,x,y,z,encoded);return channelDensity(encoded[3],source.recipe.grid.encoding);}},distance,width);}
