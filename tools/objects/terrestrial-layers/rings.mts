import { shape, text, number, array } from '@cssearth/core';
const parseRingProfile = shape({textureSize:number,bands:array(shape({id:text,segments:number,innerRadiusKm:number,outerRadiusKm:number,displayValue:number,displayOpacity:number,qualification:text}))});
export type TerrestrialRings = ReturnType<typeof parseRingProfile>;
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRingLeaves } from '../shape-model/rings.mts';
import { prepareCoplanarColorRaster } from '../material-composition/coplanar-raster.mts';

/** Ring geometry and display assumptions are authored by the body. */
export function validateTerrestrialRings(input: unknown, referenceRadiusKm: number): asserts input is TerrestrialRings | undefined {
  if (input === undefined) return;
  const profile = parseRingProfile(input);
  if (!profile || !Number.isInteger(profile.textureSize) || profile.textureSize < 64 || profile.textureSize > 2048 ||
      !Array.isArray(profile.bands) || !profile.bands.length || profile.bands.length > 16 ||
      new Set(profile.bands.map(band => band.id)).size !== profile.bands.length) {
    throw new TypeError('Invalid prepared ring profile or raster budget.');
  }
  for (const band of profile.bands) {
    if (!/^[a-z][a-z0-9-]*$/.test(band.id) || !Number.isInteger(band.segments) || band.segments < 16 || band.segments > 512 ||
        !Number.isFinite(band.innerRadiusKm) || band.innerRadiusKm <= referenceRadiusKm ||
        !Number.isFinite(band.outerRadiusKm) || band.outerRadiusKm <= band.innerRadiusKm ||
        !Number.isInteger(band.displayValue) || band.displayValue < 0 || band.displayValue > 255 ||
        !Number.isFinite(band.displayOpacity) || band.displayOpacity < 0 || band.displayOpacity > 1 ||
        typeof band.qualification !== 'string' || !band.qualification.trim()) {
      throw new TypeError('Invalid annulus dimensions or display interpretation.');
    }
  }
}

/** Reuse Haumea's annular geometry and its existing coplanar raster compiler.
 * A single prepared image retains transparent inter-ring gaps and body aperture.
 * It shares the physical body carrier; no runtime geometry or optical work occurs. */
export async function prepareTerrestrialRings({ config, publicDirectory }: {config:{rings?:unknown;geometry:{radiusKm:number;radius:number};publicBase:string;namespace:string};publicDirectory:string}) {
  const profile = config.rings;
  if (!profile) return null;
  validateTerrestrialRings(profile, config.geometry.radiusKm);
  const url = `${config.publicBase}${config.namespace}-rings.webp`;
  const texture = { url, width: profile.textureSize, height: 32 };
  const faces: Parameters<typeof prepareCoplanarColorRaster>[0]['faces'] = [];
  for (const band of profile.bands) {
    prepareRingLeaves({ ring: band, displayRadius: config.geometry.radius }, texture, config.geometry.radiusKm, geometry => {
      const m = geometry.matrix.split(',').map(Number);
      const vertices = [[0, 0], [geometry.leafWidth, 0], [geometry.leafWidth, geometry.leafHeight], [0, geometry.leafHeight]].map(([x, y]): [number, number, number] => {
        const w = m[3] * x + m[7] * y + m[15];
        const coordinate=(axis:number)=>(m[axis] * x + m[4 + axis] * y + m[12 + axis]) / w;
        return [coordinate(0), coordinate(1), coordinate(2)];
      });
      faces.push({ vertices, color: [band.displayValue, band.displayValue, band.displayValue, Math.round(band.displayOpacity * 255)] });
    });
  }
  const extent = Math.max(...faces.flatMap(face => face.vertices.flatMap(v => [Math.abs(v[0]), Math.abs(v[1])])));
  const raster = await prepareCoplanarColorRaster({ faces, pixelsPerUnit: profile.textureSize / (2 * extent) });
  await writeFile(resolve(publicDirectory, `${config.namespace}-rings.webp`), raster.bytes);
  const leaves = raster.tiles.map(tile => ({ tag: 's', className: 'prepared-annular-ring',
    style: `position:absolute;display:block;width:${tile.width}px;height:${tile.height}px;margin:0;padding:0;transform-origin:0 0;` +
      `transform:matrix3d(${tile.matrix.join(',')});backface-visibility:visible;--polycss-atlas-width:${tile.width}px;` +
      `--polycss-atlas-height:${tile.height}px;background-position:${-tile.x}px ${-tile.y}px;` +
      `background-size:${raster.width}px ${raster.height}px;background-repeat:no-repeat` }));
  return { leaves, resource: { key: 'rings', url, pool: 'mounted' },
    coverage: { sourceFaceCount: faces.length, preparedTileCount: leaves.length, width: raster.width, height: raster.height, sourceFaces: faces },
    qualification: profile.bands.map(({ id, qualification }) => ({ id, qualification })) };
}
