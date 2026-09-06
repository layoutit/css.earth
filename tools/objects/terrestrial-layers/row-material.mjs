import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {viewSunDirectionToPreparedLightDirection} from '../../../src/platform/directional-sun-coordinate.mjs';

/** One retained material leaf addresses source-prepared phase frames in bounded rows. */
export async function prepareRowMaterial({config,atmosphere:a,sun,sourceDirectory,publicDirectory,outputDirectory}) {
 const p=config.lighting;
 const fingerprint=createHash('sha256');
 const operationSources=['row-material.mjs','photographic-atmosphere.mjs','ellipsoid-geometry.mjs','../../prepared-atmosphere.mjs','../../../src/platform/directional-sun-coordinate.mjs'];
 for(const name of operationSources)fingerprint.update(await readFile(new URL(name,import.meta.url)));
 const sourcePaths=[...new Set([...p.sourcePaths,config.shapePath,config.atmospherePath,...(p.deliveryPath?[p.deliveryPath]:[])])];
 for(const path of sourcePaths)fingerprint.update(await readFile(resolve(sourceDirectory,path)));
 const generatorFingerprint=fingerprint.update(JSON.stringify({profile:config,sun,sharp:sharp.versions})).digest('hex').slice(0,12);
 const delivery=p.deliveryPath?JSON.parse(await readFile(resolve(sourceDirectory,p.deliveryPath),'utf8')):null;
 if(delivery&&(delivery.schema!=='cssearth-material-delivery@1'||!/^([a-f0-9]{12})$/.test(delivery.bankId)||
    delivery.rows?.length!==p.frameCount*2*a.MATERIAL_DENSITIES.length))throw new TypeError('Invalid pinned material delivery identity.');
 const deliveryRows=new Map((delivery?.rows??[]).map(row=>[`${row.density}:${row.row}`,row]));
 if(delivery&&deliveryRows.size!==delivery.rows.length)throw new TypeError('Duplicate pinned material delivery row.');
 const bankFingerprint=delivery?.bankId??generatorFingerprint;
 const initialViewLightDirection=viewSunDirectionToPreparedLightDirection(sun.referenceViewDirection);
 const azimuth=Math.atan2(initialViewLightDirection[1],initialViewLightDirection[0])*180/Math.PI;
 const defaultFrame=Math.round(Math.max(0,Math.min(1,(initialViewLightDirection[2]-p.minimumLightViewZ)/(p.maximumLightViewZ-p.minimumLightViewZ)))*(p.frameCount-1));
 const banks={},projectionSamples=[],preparedFrames1x=[];
 const phaseDirection=viewZ=>{const radians=azimuth*Math.PI/180,projectedLength=Math.sqrt(Math.max(0,1-viewZ**2));return [Math.cos(radians)*projectedLength,Math.sin(radians)*projectedLength,viewZ]};
 for(const density of a.MATERIAL_DENSITIES)banks[density]=await prepareDensity(density);
 const lighting={schema:`css${config.namespace}-prepared-lighting@5`,model:'source-calibrated-fixed-projection-full-sun-phase-density-row-shards',
  bankFingerprint,generatorFingerprint,generatorFingerprintSources:[...operationSources.map(name=>`tools/objects/terrestrial-layers/${name}`),...sourcePaths.map(path=>`source/${path}`),'authored lighting profile','prepared directional sun','sharp runtime versions'],
  deliveryIdentity:delivery?{source:`source/${p.deliveryPath}`,model:'pinned-byte-verified-delivery-identity-independent-of-generator'}:null,
  frameCount:p.frameCount,shadowlessFrameOffset:p.frameCount,defaultFrame,presentationFrameSize:a.MATERIAL_PRESENTATION_SIZE,
  preparedPixelDensities:a.MATERIAL_DENSITIES,surfaceRadius:a.MATERIAL_SURFACE_RADIUS,outerRadius:a.MATERIAL_OUTER_RADIUS,
  worldLightDirection:sun.localDirection,initialViewLightDirection,sourceWorldLightDirection:a.WORLD_LIGHT_DIRECTION,
  illuminationGeometry:a.LIGHT_SOURCE_GEOMETRY,minimumLightViewZ:p.minimumLightViewZ,maximumLightViewZ:p.maximumLightViewZ,
  baseLightAzimuthDegrees:Number(azimuth.toFixed(9)),cameraContract:'google-earth-pro-view-x-up-y-forward-minus-z-to-material-x-down-y-front-plus-z',
  projection:{model:'prepared-oblate-ellipsoid-fixed-camera-projection',presentationPitchDegrees:p.pitchDegrees,phaseStateCount:p.frameCount,
    presentationScale:a.MATERIAL_COVERAGE_SCALE,materialScale:a.MATERIAL_CONTENT_SCALE,
    meshCoverage:{model:'prepared-analytic-oblate-ellipsoid-proportional-overscan',coverageScale:a.MATERIAL_COVERAGE_SCALE,materialScale:a.MATERIAL_CONTENT_SCALE,
      rimFill:'prepared-source-calibrated-opaque-limb-fill',sourcePixelBleed:0,supersampling:a.MATERIAL_SILHOUETTE_SUPERSAMPLING,alphaClamp:true,runtimeWork:false},
    samples:projectionSamples,screenshotDerived:false,runtimeGeometry:false,runtimeRasterization:false},
  atmosphere:{model:a.ATMOSPHERE_RESPONSE.model,response:a.ATMOSPHERE_RESPONSE,profile:a.ATMOSPHERE_PROFILE,independentOfGroundShadows:true,
    source:p.atmosphereLabel,openSpace:a.OPENSPACE_ATMOSPHERE,sourceReference:a.PUBLISHED_ATMOSPHERE_REFERENCE,color:a.ATMOSPHERE_COLOR,
    externalHalo:'prepared-exponential-shell-outside-body-silhouette',runtimeRasterization:false,runtimeAtmosphereMath:false},
  shadow:{model:'prepared-directional-sun-phase-with-psg-qualified-openspace-lambert-terminator',source:p.shadowLabel,ambientFloor:a.OPENSPACE_AMBIENT_INTENSITY,
    terminatorSmoothstep:a.OPENSPACE_TERMINATOR_SMOOTHSTEP,displayTransfer:a.DISPLAY_TRANSFER,referenceChannel:a.LIGHTING_REFERENCE_CHANNEL,
    linearLight:true,fixedCelestialDirection:true,runtimeLightingMath:false},
  banks,totalBytes:Object.values(banks).reduce((total,bank)=>total+bank.totalBytes,0)};
 await writeFile(resolve(outputDirectory,'lighting.json'),JSON.stringify(lighting)+'\n');return lighting;

 async function prepareDensity(density) {
  const frameSize=a.MATERIAL_PRESENTATION_SIZE*density,rasterFrameGutter=p.frameGutter*density,frameStride=frameSize+rasterFrameGutter*2;
  const rows=[],presentations=[],pending=[];
  const projection=density===1?a.prepareMaterialProjection(p.pitchDegrees,density):null;
  for(let rowIndex=0;rowIndex<p.frameCount*2;rowIndex++) {
    const frameIndex=rowIndex%p.frameCount,shadows=rowIndex<p.frameCount;
    const viewZ=p.minimumLightViewZ+frameIndex/(p.frameCount-1)*(p.maximumLightViewZ-p.minimumLightViewZ),lightDirection=phaseDirection(viewZ);
    let prepared;
    if(density===1){
      const phaseAtmosphere=a.prepareAtmosphereFrame(p.pitchDegrees,density,{lightDirection,preparedProjection:projection});
      prepared=a.prepareMaterialFrame(p.pitchDegrees,density,{lightDirection,preparedProjection:projection,shadows,preparedAtmosphere:phaseAtmosphere});
      preparedFrames1x[rowIndex]=prepared.data;
      if(shadows&&[0,defaultFrame,p.frameCount-1].includes(frameIndex))projectionSamples.push({frameIndex,lightViewZ:Number(viewZ.toFixed(9)),pitchDegrees:prepared.projection.pitchDegrees,
        radiusX:prepared.projection.radiusX,radiusY:prepared.projection.radiusY,right:prepared.projection.right,down:prepared.projection.down,view:prepared.projection.view});
    }else{
      const source=preparedFrames1x[rowIndex];if(!source)throw new Error(`Base density frame is missing: ${rowIndex}`);
      const width=a.MATERIAL_PRESENTATION_SIZE*density;
      const data=await sharp(source,{raw:{width:a.MATERIAL_PRESENTATION_SIZE,height:a.MATERIAL_PRESENTATION_SIZE,channels:4}}).resize(width,width,{kernel:'lanczos3'}).raw().toBuffer();
      prepared={data,width,height:width,pixelDensity:density,pitchDegrees:p.pitchDegrees,cameraLightDirection:lightDirection.map(value=>Number(value.toFixed(6))),projection:null};
    }
    const filename=`${config.namespace}-material-${bankFingerprint}-${density}x-row-${String(rowIndex).padStart(3,'0')}.webp`,path=resolve(publicDirectory,filename);
    pending.push((async()=>{
      await sharp(prepared.data,{raw:{width:prepared.width,height:prepared.height,channels:4}})
        .extend({top:rasterFrameGutter,right:rasterFrameGutter,bottom:rasterFrameGutter,left:rasterFrameGutter,background:{r:0,g:0,b:0,alpha:0}})
        .webp({quality:75,alphaQuality:100,effort:4,smartSubsample:true}).toFile(path);
      const bytes=await readFile(path),url=`${config.publicBase}${filename}`;
      const sha256=createHash('sha256').update(bytes).digest('hex'),expected=deliveryRows.get(`${density}:${rowIndex}`);
      if(delivery&&(!expected||expected.sha256!==sha256||expected.bytes!==bytes.length))throw new Error(`Prepared material differs from accepted delivery bytes: ${density}x row ${rowIndex}. A changed image requires a new delivery identity.`);
      rows.push({rowIndex,url,encoding:'webp-q75-alpha-q100',bytes:bytes.length,sha256,width:frameStride,height:frameStride,decodedRgbaBytes:frameStride*frameStride*4});
      presentations.push({frameIndex:rowIndex,phaseFrame:frameIndex,shadows,lightViewZ:Number(viewZ.toFixed(9)),rowIndex,url,
        backgroundPosition:`${-rasterFrameGutter/density}px ${-rasterFrameGutter/density}px`,backgroundSize:`${frameStride/density}px ${frameStride/density}px`,cameraLightDirection:prepared.cameraLightDirection});
    })());
    if(pending.length===4)await Promise.all(pending.splice(0));
  }
  await Promise.all(pending);rows.sort((a,b)=>a.rowIndex-b.rowIndex);presentations.sort((a,b)=>a.frameIndex-b.frameIndex);
  const initialWarmRows=[p.frameCount+Math.max(0,defaultFrame-1),p.frameCount+defaultFrame,p.frameCount+Math.min(p.frameCount-1,defaultFrame+1)];
  const initialDecodedWorkingSetBytes=initialWarmRows.reduce((total,index)=>total+rows[index].decodedRgbaBytes,0);
  const maximumDecodedWorkingSetBytes=[...rows].sort((a,b)=>b.decodedRgbaBytes-a.decodedRgbaBytes).slice(0,3).reduce((total,row)=>total+row.decodedRgbaBytes,0);
  return {schema:`css${config.namespace}-prepared-lighting-bank@1`,preparedPixelDensity:density,frameSize,presentationFrameSize:a.MATERIAL_PRESENTATION_SIZE,
    surfaceRadius:a.MATERIAL_SURFACE_RADIUS,rasterSurfaceRadius:a.MATERIAL_SURFACE_RADIUS*density,outerRadius:a.MATERIAL_OUTER_RADIUS,rasterOuterRadius:a.MATERIAL_OUTER_RADIUS*density,
    transport:{model:'row-shard-cache',encoding:'webp-q75-alpha-q100',preloadBeforeMount:true,retainedLeafCount:1,
      interpolation:'nearest-prepared-view-light-z-with-runtime-css-roll',frameGutter:rasterFrameGutter/density,rasterFrameGutter,framesPerRow:1,rowColumns:1,rowCount:p.frameCount*2,
      defaultFrame:p.frameCount+defaultFrame,defaultRow:p.frameCount+defaultFrame,initialWarmRows,maximumRetainedRowCount:3,addressWritesOnlyOnInput:true,
      retainLastReadyPresentation:true,idleCallbacks:0,publicationModel:'content-addressed-complete-density-bank-switch',initialDecodedWorkingSetBytes,maximumDecodedWorkingSetBytes},
    rows,presentations,totalBytes:rows.reduce((total,row)=>total+row.bytes,0),fullBankDecodedRgbaBytes:rows.reduce((total,row)=>total+row.decodedRgbaBytes,0)};
 }
}
