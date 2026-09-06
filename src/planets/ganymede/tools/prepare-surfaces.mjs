import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { fromFile } from "geotiff";
import { reprojectSolidBodySurfaceRaster } from "../../../platform/prepare-solid-body-surface.mjs";
import { packProjectiveSurfaceRaster } from "../../../platform/projective-surface-raster.mjs";
import { paintMissingCoverage } from "../../../platform/prepare-missing-coverage.mjs";
import { validateGanymedeSourceGroup } from "./source-manifest.mjs";
import { GANYMEDE_PUBLIC_ROOT, GANYMEDE_PREPARED_ROOT, GANYMEDE_SOURCE_ROOT, ensureGanymedePreparationDirectories } from "./preparation-paths.mjs";

await ensureGanymedePreparationDirectories();
const entries = await validateGanymedeSourceGroup("surfaces");
const width = 8192, height = 4096, bandCount = 16, gutter = 64;
const prepared = [];
let monochrome;
for (const entry of entries) {
  const path = resolve(GANYMEDE_SOURCE_ROOT, entry.path);
  const tiff = await fromFile(path), image = await tiff.getImage();
  const origin = image.getOrigin(), resolution = image.getResolution(), keys = image.getGeoKeys();
  if (image.getWidth() !== entry.width || image.getHeight() !== entry.height || image.getGDALNoData() !== 0 ||
      resolution[0] <= 0 || resolution[1] >= 0 || keys.ProjCenterLongGeoKey !== 180 ||
      Math.abs(keys.GeogSemiMajorAxisGeoKey - entry.projection.referenceRadiusMeters) > 0.01) {
    throw new Error(`Ganymede ${entry.lensId} dimensions, no-data or coordinate mapping changed.`);
  }
  await tiff.close();
  const pipeline = sharp(path).removeAlpha();
  if (entry.lensId === "normal") pipeline.greyscale();
  const source = await pipeline.raw().toBuffer({resolveWithObject:true});
  const channels = source.info.channels;
  if (channels !== (entry.lensId === "normal" ? 1 : 3)) throw new Error("Unexpected source band count");
  const rgba = Buffer.alloc(entry.width * entry.height * 4);
  let withheldSyntheticPixels = 0;
  for (let y=0;y<entry.height;y++) for (let x=0;x<entry.width;x++) {
    const i = y*entry.width+x;
    const red=source.data[i*channels], green=source.data[i*channels+(channels===1?0:1)], blue=source.data[i*channels+(channels===1?0:2)];
    // Both GeoTIFFs map x west-to-east. The monochrome ISIS label names
    // west-positive longitude, which decreases in that same x direction.
    const east = 180 + (origin[0] + (x+.5)*resolution[0])/entry.projection.referenceRadiusMeters*180/Math.PI;
    // USGS I-2762 documents a synthesized red channel at 210–250 W.
    // Withhold that whole sector rather than present modeled red as observed.
    const synthetic = entry.lensId === "enhanced" && east>=110 && east<=150;
    if (synthetic) withheldSyntheticPixels++;
    rgba.set([red,green,blue,red===0||green===0||blue===0||synthetic?0:255],i*4);
  }
  // Alpha-aware interpolation prevents no-data from darkening valid terrain.
  const resized = await sharp(rgba,{raw:{width:entry.width,height:entry.height,channels:4}})
    .resize(width,height,{fit:"fill",kernel:"lanczos3"}).raw().toBuffer();
  const rgb=Buffer.alloc(width*height*3),missing=new Uint8Array(width*height);
  let monochromePixels=0;
  for(let i=0;i<missing.length;i++) {
    rgb.set(resized.subarray(i*4,i*4+3),i*3);
    missing[i]=resized[i*4+3]<255?1:0;
    if(missing[i] && monochrome && !monochrome.missing[i]) {
      rgb.set(monochrome.rgb.subarray(i*3,i*3+3),i*3);missing[i]=0;monochromePixels++;
    }
  }
  if(entry.lensId === "normal") monochrome={rgb,missing};
  const display=paintMissingCoverage(rgb,{width,height,channels:3},missing);
  const pixels=await sharp(display,{raw:{width,height,channels:3}}).ensureAlpha().raw().toBuffer();
  const projected=reprojectSolidBodySurfaceRaster(pixels,{width,height,latitudeSegments:bandCount});
  const {data:packedPixels,...layout}=packProjectiveSurfaceRaster(projected,{width,height,bandCount,gutter});
  const map=await emit(`ganymede-${entry.lensId}-map.webp`,sharp(pixels,{raw:{width,height,channels:4}}));
  const surface=await emit(`ganymede-${entry.lensId}-surface@2x.webp`,sharp(packedPixels,{raw:{width:layout.packedWidth,height:layout.packedHeight,channels:4}}));
  const thumbnail=await emit(`ganymede-${entry.lensId}-thumbnail.webp`,sharp(pixels,{raw:{width,height,channels:4}}).resize(96,48));
  prepared.push({id:entry.lensId,label:entry.label,falseColor:entry.falseColor,map,surface,thumbnail,layout,
    source:{id:entry.id,sha256:entry.expectedSha256,width:entry.width,height:entry.height},projection:entry.projection,
    sourceGeoreference:{origin,resolution},coverage:entry.coverage,missingPixels:missing.reduce((a,b)=>a+b,0),
    monochromePixels,withheldSyntheticPixels});
  console.log(`Prepared Ganymede ${entry.label} surface.`);
}
await writeFile(resolve(GANYMEDE_PREPARED_ROOT,"surfaces.json"),JSON.stringify({objectId:"ganymede",surfaces:prepared}));
async function emit(filename,pipeline) {
 const bytes=await pipeline.webp({lossless:true,effort:4}).toBuffer();
 await writeFile(resolve(GANYMEDE_PUBLIC_ROOT,filename),bytes);
 const {width,height}=await sharp(bytes).metadata();
 return {url:`/scenes/ganymede/${filename}`,width,height,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
}
