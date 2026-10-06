/** Finished pixels the observation lane hands the shared raster lane: interleaved bytes and their shape. */
export interface RasterInfo {width: number; height: number; channels: 1 | 2 | 3 | 4;}
export interface RasterImage {data: Buffer; info: RasterInfo;}
