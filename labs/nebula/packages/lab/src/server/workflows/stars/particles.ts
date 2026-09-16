export * from '@cssearth/nebula-reconstruction/stars/particles';
import {convertParticlesToDensityVolume as convert,type ParticleVolumeOptions} from '@cssearth/nebula-reconstruction/stars/particles';
import {encodeDensityKtx2} from '../../../adapters/preparation/density-encoding.ts';
export function convertParticlesToDensityVolume(options:ParticleVolumeOptions){return convert(options,{encode:encodeDensityKtx2});}
