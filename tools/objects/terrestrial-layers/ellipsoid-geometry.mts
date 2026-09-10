import {array,number,object,parse,string} from '../material-composition/data-schema.mts';
const ellipsoidProfile=object({schema:string,equatorialRadius:number,equatorialRadiusKm:number,polarRadiusKm:number,
 latitudeSegments:number,longitudeSegments:number,latitudeBoundsDegrees:array(number),axialTiltDegrees:number,bodyRotationDegrees:number,materialDepthBias:number,
 polar:object({boundaryLatitudeDegrees:number,overlap:number,inpaintRadius:number,boundaryAngularSmoothingDegrees:number,innerOverlap:number,innerInset:number})});
export const parseEllipsoidProfile=(value:unknown)=>parse(value,ellipsoidProfile,'ellipsoid geometry profile');
/** Affine latitude bands and silhouette points from authored ellipsoid axes. */
export function createEllipsoidGeometry(value: unknown) {
  const profile=parseEllipsoidProfile(value);
  const { equatorialRadius, equatorialRadiusKm, polarRadiusKm, latitudeBoundsDegrees, longitudeSegments } = profile;
  if (![equatorialRadius, equatorialRadiusKm, polarRadiusKm].every(value => Number.isFinite(value) && value > 0) ||
      !Number.isSafeInteger(longitudeSegments) || longitudeSegments < 3 || !Array.isArray(latitudeBoundsDegrees) ||
      latitudeBoundsDegrees.length < 2 || latitudeBoundsDegrees.some((latitude, i) => !Number.isFinite(latitude) ||
        latitude < -90 || latitude > 90 || (i > 0 && latitude <= latitudeBoundsDegrees[i - 1]))) {
    throw new TypeError('Invalid authored ellipsoid geometry.');
  }
  const polarRadius = equatorialRadius * polarRadiusKm / equatorialRadiusKm;
  function point(latitude: number, longitude: number): [number,number,number] {
    const latitudeRadius = Math.cos(latitude);
    return [equatorialRadius * latitudeRadius * Math.cos(longitude),
      equatorialRadius * latitudeRadius * Math.sin(longitude), polarRadius * Math.sin(latitude)];
  }
  function rasterBands(height: number) {
    if (!Number.isInteger(height) || height <= 0) throw new RangeError('Surface height must be a positive integer.');
    return Object.freeze(Array.from({ length: latitudeBoundsDegrees.length - 1 }, (_, index) => {
      const y = Math.round((90 - latitudeBoundsDegrees[index + 1]) / 180 * height);
      const bottom = Math.round((90 - latitudeBoundsDegrees[index]) / 180 * height);
      return Object.freeze({ y, height: bottom - y });
    }));
  }
  function silhouetteVertices() {
    const vertices = latitudeBoundsDegrees.flatMap(latitudeDegrees => Array.from({ length: longitudeSegments }, (_, longitudeIndex) =>
      point(latitudeDegrees * Math.PI / 180, longitudeIndex / longitudeSegments * Math.PI * 2)));
    vertices.push([0, 0, -polarRadius], [0, 0, polarRadius]);
    return vertices;
  }
  return Object.freeze({ ...profile, polarRadius, point, rasterBands, silhouetteVertices });
}
