import { WORKSPACE } from '@cssearth/telescope-core/node';
import { resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import { CLI_PACKAGE_ROOT } from '../paths.mts';
import { loadSolarGeometry, type SolarGeometry } from '@cssearth/bake/objects/scene';
import { readSphereBank, sphereDirection } from './sphere-bank.mts';

export const sphereRoot = (): string => WORKSPACE ?? resolve(CLI_PACKAGE_ROOT, 'data/spheres');
export async function sphereSolarGeometry(): Promise<SolarGeometry> {
  if(WORKSPACE)return loadSolarGeometry(WORKSPACE);
  const bank=await readSphereBank(sphereRoot());
  const direction=(id:string,key:string)=>sphereDirection(requireRecord(bank.bodies[id],`No packaged standard sphere for ${id}`)[key]);
  const unavailable=():never=>{throw new TypeError('Standalone sphere navigation reads only Sun direction and ecliptic north.');};
  return {
    requireBodyFixedSunDirection:id=>direction(id,'sun'),requireBodyFixedEclipticNorth:id=>direction(id,'north'),
    requireBodyFixedToIcrf:unavailable,bodyFixedStarDirection:unavailable,requireBodyOrbit:unavailable,
    get SOLAR_GEOMETRY_EPOCH_LABEL(){return unavailable();},get SOLAR_GEOMETRY_EPOCH_JD_TT(){return unavailable();},get ASTRONOMICAL_UNIT_KILOMETERS(){return unavailable();},
  };
}
