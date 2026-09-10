import type {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import {validateDirectionalSunPlan} from '../../../src/platform/directional-sun-contract.mts';
import {validatePreparedCubicSky} from '../../../src/platform/cubic-sky-contract.mts';
import {requireRecord} from '../../source-values.mts';
import {parseReferenceCelestialSource} from './reference-celestial-source.mts';
export interface ReferenceCelestialConfig {namespace: string; distanceAu: number; reference: {path: string; schema: string; cameraLabel: string; catalogueLabel: string; skyQualification: string};}
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {preparePlanetCubicSky} from '../../../src/platform/prepare-cubic-sky-source.mts';
import {preparePlanetDirectionalSun} from '../../../src/platform/prepare-directional-sun.mts';
import {DIRECTIONAL_SUN_PRESENTATION_STANDARD} from '../../../src/platform/directional-sun-contract.mts';

/** A pinned measured camera contract supplies the sky's sampling and Sun geometry. */
export async function prepareReferenceCelestial({config,sourceDirectory,publicDirectory,outputDirectory,sourceManifest}: {config: ReferenceCelestialConfig; sourceDirectory: string; publicDirectory: string; outputDirectory: string; sourceManifest: Awaited<ReturnType<typeof createSourceManifest>>}) {
  const entry=sourceManifest.manifest.inputs.find(entry=>entry.path===config.reference.path);
  if(!entry)throw new Error('Measured celestial reference is not pinned.');
  const bytes=await readFile(resolve(sourceDirectory,entry.path));sourceManifest.assertBytes(entry,bytes);
  const contract=parseReferenceCelestialSource(JSON.parse(bytes.toString('utf8'))),projection=contract.camera.projection,catalogue=contract.sky.catalogue;
  const direction=(value: readonly number[])=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)&&Math.hypot(...value)>0;
  if(contract.schema!==config.reference.schema||contract.sky.googleTextureRedistributed!==false||contract.sun.sourcePixelsRedistributed!==false||
    contract.sun.independentBillboard!==true||JSON.stringify(contract.sun.appearance.nativeTextureSize)!=='[128,128]'||
    JSON.stringify(contract.sun.appearance.nativeBlend)!=='["SRC_ALPHA","ONE"]'||!direction(contract.sun.defaultCameraBinding.viewDirection)||
    contract.sun.appearance.analyticRadialFit.model!=='opaque-core-generalized-exponential-falloff')throw new TypeError('Measured celestial reference is incompatible.');
  const ensureDirectories=()=>mkdir(publicDirectory,{recursive:true});
  const sky=await preparePlanetCubicSky({objectId:config.namespace,sourceRoot:sourceDirectory,publicRoot:publicDirectory,ensureDirectories,
    validateSourceGroup:consumer=>sourceManifest.validateGroup(consumer),includeSun:false,writeModule:false,
    cameraContract:{oracle:true,source:config.reference.cameraLabel,sourcePath:`source/${entry.path}`,
      rotationResponse:contract.camera.cubicTransport.rotationResponse,zoomResponse:contract.camera.cubicTransport.zoomResponse,
      horizontalFovDegrees:projection.horizontalFovDegrees,focalLengthOverViewportWidth:projection.focalX/2,
      qualification:config.reference.skyQualification},
    pointSourceContract:{source:config.reference.catalogueLabel,sourcePath:`source/${entry.path}`,drawCount:catalogue.drawCount,
      nativePointSizePixels:catalogue.pointSizePixels,logicalPointFootprintPixels:1,backgroundDiffuseGain:0.68,backgroundDetailGain:0.4},
  });
  const normalize=(value: readonly number[])=>value.map(component=>component/Math.hypot(...value));
  const localDirection=normalize(contract.sun.bodyDirectionAtReference),referenceViewDirection=normalize(contract.sun.defaultCameraBinding.viewDirection);
  const sun=await preparePlanetDirectionalSun({objectId:config.namespace,publicRoot:publicDirectory,ensureDirectories,writeModule:false,
    meanHeliocentricDistanceAu:config.distanceAu,presentation:{schema:DIRECTIONAL_SUN_PRESENTATION_STANDARD.schema,
      source:contract.sourceProduct,sourcePath:`src/planets/${config.namespace}/source/${entry.path}`,localDirection,referenceViewDirection,
      appearance:{model:'clean-room-native-radial-profile-fit',nativeBlend:[...contract.sun.appearance.nativeBlend],
        sourceOverApproximation:'alpha-encoded-additive-radiance-without-runtime-blend-mode',analyticRadialFit:{...contract.sun.appearance.analyticRadialFit}},
      projection:{focalX:projection.focalX,horizontalFovDegrees:projection.horizontalFovDegrees,
        centerDistanceOverFar:contract.sun.centerDistanceOverFar,halfExtentOverFar:contract.sun.halfExtentOverFar,
        halfExtentOverCenter:contract.sun.halfExtentOverCenter,apparentViewportWidthShare:projection.focalX*contract.sun.halfExtentOverCenter,
        fixedAngularSize:true,runtimeGeometry:false},
      culling:{states:[...contract.sun.cullingStates],rearCameraAndViewportAtPublication:true,planetOccultation:'retained-paint-order-behind-opaque-body'},
      qualification:contract.captureQualification},
    planMetadata:{model:'google-earth-contract-clean-room-retained-billboard',
      defaultCameraBinding:{...contract.sun.defaultCameraBinding,nativeCamera:{...contract.sun.defaultCameraBinding.nativeCamera},viewDirection:referenceViewDirection},
      referenceTimeUtc:contract.sun.referenceTimeUtc,oracle:{source:contract.sourceProduct,sourcePath:`source/${entry.path}`,sampleCount:contract.sampleCount,
        maximumCenterReplayResidualPixels:contract.sun.maximumCenterReplayResidualPixels,qualification:contract.captureQualification}},
  });
  await Promise.all([writeFile(resolve(outputDirectory,'sky.json'),JSON.stringify(sky)+'\n'),writeFile(resolve(outputDirectory,'sun.json'),JSON.stringify(sun)+'\n')]);
  const prepared=requireRecord(JSON.parse(JSON.stringify({sky,sun,contract})));
  return {sky:validatePreparedCubicSky(prepared.sky,{requireSun:false}),sun:validateDirectionalSunPlan(prepared.sun),contract:parseReferenceCelestialSource(prepared.contract)};
}
