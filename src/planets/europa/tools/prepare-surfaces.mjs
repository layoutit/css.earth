import { prepareEuropaColor, matchEuropaColorLevels } from "./prepare-color.mjs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { fromFile } from "geotiff";
import { reprojectSolidBodySurfaceRaster } from "../../../platform/prepare-solid-body-surface.mjs";
import { packProjectiveSurfaceRaster } from "../../../platform/projective-surface-raster.mjs";
import { paintMissingCoverage } from "../../../platform/prepare-missing-coverage.mjs";
import { validateEuropaSourceGroup } from "./source-manifest.mjs";
import { EUROPA_PUBLIC_ROOT, EUROPA_PREPARED_ROOT, EUROPA_SOURCE_ROOT, ensureEuropaPreparationDirectories } from "./preparation-paths.mjs";

await ensureEuropaPreparationDirectories();
const [entry] = await validateEuropaSourceGroup("surfaces");
const path = resolve(EUROPA_SOURCE_ROOT, entry.path);
const tiff = await fromFile(path);
const image = await tiff.getImage();
if (image.getWidth() !== entry.width || image.getHeight() !== entry.height || image.getGDALNoData() !== 0) {
  throw new Error("Europa source dimensions or no-data value changed.");
}
const origin = image.getOrigin(), resolution = image.getResolution(), keys = image.getGeoKeys();
if (resolution[0] <= 0 || resolution[1] >= 0 || keys.ProjCenterLongGeoKey !== 180 ||
    Math.abs(keys.GeogSemiMajorAxisGeoKey - entry.projection.referenceRadiusMeters) > 0.01) {
  throw new Error("Europa source coordinate mapping changed.");
}
await tiff.close();
const source = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });
if (source.info.channels !== 1) throw new Error("Europa source must be monochrome.");
const grayAlpha = Buffer.alloc(source.data.length * 2);
for (let i = 0; i < source.data.length; i++) {
  grayAlpha[i * 2] = source.data[i];
  grayAlpha[i * 2 + 1] = source.data[i] === 0 ? 0 : 255;
}
// Sharp premultiplies alpha during interpolation so no-data black cannot
// darken neighbouring observed terrain. No extrapolation into the gap.
const width = 4096, height = 2048, bandCount = 16, gutter = 32;
const { data, info } = await sharp(grayAlpha, {raw:{width:entry.width,height:entry.height,channels:2}})
  .resize(width, height, {fit:"fill",kernel:"lanczos3"}).toColourspace("srgb").raw().toBuffer({resolveWithObject:true});
if (info.channels !== 4) throw new Error("Europa resampling must retain its validity channel.");
const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
for (let i=0;i<missing.length;i++) {
  rgb.set(data.subarray(i*info.channels,i*info.channels+3),i*3);
  // Withhold pixels straddling no-data boundaries instead of inventing them.
  missing[i] = data[i*info.channels+3] < 255 ? 1 : 0;
}
const normal = await prepareSurface("normal", rgb, missing, {
  label:"Monochrome",falseColor:false,source:{id:entry.id,sha256:entry.expectedSha256,width:entry.width,height:entry.height},
  projection:entry.projection,coverage:entry.coverage,sourceGeoreference:{origin,resolution},
});
const color = await prepareEuropaColor({width,height});
const levels = matchEuropaColorLevels(color, {rgb,missing}, {width,height});
// Keep observed monochrome wherever the independent color coverage is absent.
// The grid is needed only if neither source has a valid observation.
let monochromePixels = 0;
for (let i = 0; i < color.missing.length; i++) {
  if (color.missing[i] && !missing[i]) {
    color.rgb.set(rgb.subarray(i * 3, i * 3 + 3), i * 3);
    color.missing[i] = 0;
    monochromePixels++;
  }
}
const enhanced = await prepareSurface("enhanced", color.rgb, color.missing, {
  label:"Enhanced color",falseColor:true,sourceIds:[entry.id,...color.sourceIds],
  projection:{type:"equirectangular",longitudeDegrees:[0,360],latitudeDegrees:[90,-90],longitudeDirection:"east-positive",referenceRadiusMeters:1560800},
  coverage:"Valid infrared/green/violet observations over the observed monochrome base. Gray grid only where neither source has imagery.",
  monochromePixels,
  observationCoverage:color.coverage,
  photometry:color.photometry,
  levels,
});
await writeFile(resolve(EUROPA_PREPARED_ROOT,"surfaces.json"),JSON.stringify({objectId:"europa",surfaces:[normal,enhanced]}));
console.log("Prepared Europa monochrome and observed enhanced color, with coverage gaps marked.");

async function prepareSurface(id, rgb, missing, metadata) {
  const display = paintMissingCoverage(rgb,{width,height,channels:3},missing);
  const rgba=await sharp(display,{raw:{width,height,channels:3}}).ensureAlpha().raw().toBuffer();
  const projected=reprojectSolidBodySurfaceRaster(rgba,{width,height,latitudeSegments:bandCount});
  const packed=packProjectiveSurfaceRaster(projected,{width,height,bandCount,gutter});
  const {data:packedPixels,...layout}=packed;
  const map=await emit(`europa-${id}-map.webp`,sharp(rgba,{raw:{width,height,channels:4}}));
  const surface=await emit(`europa-${id}-surface@2x.webp`,sharp(packedPixels,{raw:{width:packed.packedWidth,height:packed.packedHeight,channels:4}}));
  const thumbnail=await emit(`europa-${id}-thumbnail.webp`,sharp(rgba,{raw:{width,height,channels:4}}).resize(96,48));
  return {id,...metadata,map,surface,thumbnail,layout,missingPixels:missing.reduce((a,b)=>a+b,0)};
}
async function emit(filename,pipeline) {
 const bytes=await pipeline.webp({lossless:true,effort:4}).toBuffer();
 await writeFile(resolve(EUROPA_PUBLIC_ROOT,filename),bytes);
 const {width,height}=await sharp(bytes).metadata();
 return {url:`/scenes/europa/${filename}`,width,height,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
}
