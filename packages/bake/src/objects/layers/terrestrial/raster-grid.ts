/** Validate lens texture dimensions against the shared atlas grid. */
export interface SolidRasterGrid {width:number;height:number;bandCount:number;gutter:number;poleSize:number;}

export interface TextureGridLens {textureScale?:number;monochromeBase?:string;previewGrid?:{width:number;height:number};surfaceSampling?:unknown;format?:string;}

/** Only facet-table previews may use a smaller flat map. Native triangle
 * materials still sample the complete source table and have their own atlas. */
export function scientificPreviewGrid(lens:TextureGridLens, raster:Pick<SolidRasterGrid,'width'|'height'|'bandCount'>) {
  const grid = lens.previewGrid;
  if (grid === undefined) return { width: raster.width, height: raster.height };
  if (lens.format !== 'facet-scalars' || !grid ||
      Object.keys(grid).some(key => !['width', 'height'].includes(key)) ||
      ![grid.width, grid.height].every(n => Number.isSafeInteger(n) && n > 0) ||
      grid.width !== grid.height * 2 || grid.width > raster.width || grid.height > raster.height ||
      grid.height % raster.bandCount !== 0) {
    throw new TypeError('Facet preview grid must be a bounded 2:1 integer raster compatible with its latitude bands.');
  }
  return { width: grid.width, height: grid.height };
}

/** A lower-resolution source can keep the exact existing atlas proportions.
 * CSS addresses and body geometry remain fixed; this only changes baked pixels.
 */
export function lensTextureGrid(lens:TextureGridLens, raster:SolidRasterGrid) {
  const scale = lens.textureScale ?? 1;
  const grid = {width:raster.width*scale,height:raster.height*scale,gutter:raster.gutter*scale,poleSize:raster.poleSize*scale};
  if (![1, .5, .25, .125].includes(scale) || Object.values(grid).some(n => !Number.isSafeInteger(n) || n <= 0) ||
      grid.height % raster.bandCount !== 0 || (scale !== 1 && (lens.monochromeBase || lens.previewGrid || lens.surfaceSampling))) {
    throw new TypeError('Lens texture scale must preserve integral atlas bands, gutters and poles.');
  }
  return grid;
}
