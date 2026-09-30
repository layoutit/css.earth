/** Validate dataset texture dimensions against the shared atlas grid. */
export interface SolidRasterGrid {width:number;height:number;bandCount:number;gutter:number;poleSize:number;}

export interface TextureGridDataset {textureScale?:number;monochromeBase?:string;previewGrid?:{width:number;height:number};surfaceSampling?:unknown;format?:string;}

/** Only facet-table previews may use a smaller flat map. Native triangle
 * materials still sample the complete source table and have their own atlas. */
export function scientificPreviewGrid(dataset:TextureGridDataset, raster:Pick<SolidRasterGrid,'width'|'height'|'bandCount'>) {
  const grid = dataset.previewGrid;
  if (grid === undefined) return { width: raster.width, height: raster.height };
  if (!['facet-scalars', 'circle-catalogue'].includes(dataset.format ?? '') || !grid ||
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
export function datasetTextureGrid(dataset:TextureGridDataset, raster:SolidRasterGrid) {
  const scale = dataset.textureScale ?? 1;
  const grid = {width:raster.width*scale,height:raster.height*scale,gutter:raster.gutter*scale,poleSize:raster.poleSize*scale};
  if (![1, .5, .25, .125].includes(scale) || Object.values(grid).some(n => !Number.isSafeInteger(n) || n <= 0) ||
      grid.height % raster.bandCount !== 0 || (scale !== 1 && (dataset.monochromeBase || dataset.previewGrid || dataset.surfaceSampling))) {
    throw new TypeError('Dataset texture scale must preserve integral atlas bands, gutters and poles.');
  }
  return grid;
}
