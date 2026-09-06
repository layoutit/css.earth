import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { fromFile } from "geotiff";
import { reprojectSolidBodySurfaceRaster } from "../../../platform/prepare-solid-body-surface.mjs";
import { packProjectiveSurfaceRaster } from "../../../platform/projective-surface-raster.mjs";
import { paintMissingCoverage } from "../../../platform/prepare-missing-coverage.mjs";
import { validateIoSourceGroup } from "./source-manifest.mjs";
import { IO_PUBLIC_ROOT, IO_PREPARED_ROOT, IO_SOURCE_ROOT, ensureIoPreparationDirectories } from "./preparation-paths.mjs";

await ensureIoPreparationDirectories();
const entries = await validateIoSourceGroup("surfaces");
const width = 4096, height = 2048, bandCount = 16, gutter = 32;
const rasters = new Map();
for (const entry of entries) {
  const path = resolve(IO_SOURCE_ROOT, entry.path);
  const tiff = await fromFile(path), image = await tiff.getImage();
  const origin = image.getOrigin(), resolution = image.getResolution(), keys = image.getGeoKeys();
  if (image.getWidth() !== entry.width || image.getHeight() !== entry.height || image.getGDALNoData() !== 0 ||
      resolution[0] !== 1000 || resolution[1] !== -1000 || keys.ProjCenterLongGeoKey !== 0 ||
      keys.GeogSemiMajorAxisGeoKey !== entry.projection.referenceRadiusMeters) {
    throw new Error(`Io ${entry.lensId} source georeference or validity contract changed.`);
  }
  await tiff.close();
  const source = await sharp(path).removeAlpha().toColourspace("srgb").raw().toBuffer({resolveWithObject:true});
  const rgba = Buffer.alloc(entry.width * entry.height * 4);
  for (let y=0; y<entry.height; y++) for (let x=0; x<entry.width; x++) {
    const p=y*entry.width+x, offset=p*source.info.channels;
    const latitude=(origin[1]+(y+.5)*resolution[1])/entry.projection.referenceRadiusMeters*180/Math.PI;
    const rgb=source.data.subarray(offset,offset+3);
    rgba.set(rgb,p*4);
    // Zero is the explicit GeoTIFF no-data value, not a darkness threshold.
    // The enhanced source contains interpolated polar color: exclude it before
    // interpolation, then use independently observed monochrome where available.
    rgba[p*4+3] = rgb.every(value=>value===0) || (entry.lensId==='enhanced' && Math.abs(latitude)>=85) ? 0 : 255;
  }
  const data=await sharp(rgba,{raw:{width:entry.width,height:entry.height,channels:4}})
    .resize(width,height,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer();
  const rgb=Buffer.alloc(width*height*3),missing=new Uint8Array(width*height);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    // The GeoTIFF is centered on 0 E. The shared surface starts at 0 E;
    // roll 180 degrees without mirroring the positive-east pixel direction.
    const target=y*width+x, sourcePixel=y*width+(x+width/2)%width;
    rgb.set(data.subarray(sourcePixel*4,sourcePixel*4+3),target*3);
    missing[target]=data[sourcePixel*4+3]<255 ? 1 : 0;
  }
  rasters.set(entry.lensId,{entry,rgb,missing,sourceGeoreference:{origin,resolution}});
}
const normal=rasters.get('normal'),enhanced=rasters.get('enhanced');
let monochromePixels=0;
for(let i=0;i<enhanced.missing.length;i++) if(enhanced.missing[i]&&!normal.missing[i]) {
  enhanced.rgb.set(normal.rgb.subarray(i*3,i*3+3),i*3);enhanced.missing[i]=0;monochromePixels++;
}
const surfaces=[];
for(const id of ['normal','enhanced']) {
  const {entry,rgb,missing,sourceGeoreference}=rasters.get(id);
  const display=paintMissingCoverage(rgb,{width,height,channels:3},missing);
  const rgba=await sharp(display,{raw:{width,height,channels:3}}).ensureAlpha().raw().toBuffer();
  const projected=reprojectSolidBodySurfaceRaster(rgba,{width,height,latitudeSegments:bandCount});
  const {data:packedPixels,...layout}=packProjectiveSurfaceRaster(projected,{width,height,bandCount,gutter});
  surfaces.push({id,label:entry.label,falseColor:entry.falseColor,source:{id:entry.id,sha256:entry.expectedSha256,width:entry.width,height:entry.height},
    projection:{...entry.projection,longitudeDegrees:[0,360]},sourceGeoreference,coverage:entry.coverage,
    ...(id==='enhanced'?{monochromePixels,withheldColorLatitudeDegrees:85,sourceProcessing:'USGS Lunar-Lambert L=0.7, seam matching and color-ratio merge; no additional photometric normalization.'}:{}),
    missingPixels:missing.reduce((a,b)=>a+b,0),layout,
    map:await emit(`io-${id}-map.webp`,sharp(rgba,{raw:{width,height,channels:4}})),
    surface:await emit(`io-${id}-surface@2x.webp`,sharp(packedPixels,{raw:{width:layout.packedWidth,height:layout.packedHeight,channels:4}})),
    thumbnail:await emit(`io-${id}-thumbnail.webp`,sharp(rgba,{raw:{width,height,channels:4}}).resize(96,48)),
  });
}
await writeFile(resolve(IO_PREPARED_ROOT,'surfaces.json'),JSON.stringify({objectId:'io',surfaces}));
console.log(`Prepared Io monochrome and enhanced color; ${monochromePixels} enhanced pixels retain observed monochrome.`);
async function emit(filename,pipeline) {
 const bytes=await pipeline.webp({lossless:true,effort:4}).toBuffer();
 await writeFile(resolve(IO_PUBLIC_ROOT,filename),bytes);
 const {width,height}=await sharp(bytes).metadata();
 return {url:`/scenes/io/${filename}`,width,height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
