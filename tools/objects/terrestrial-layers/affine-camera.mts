import type {CameraPlan} from '../../../src/renderers/css/navigation/types.ts';
import type {createEllipsoidGeometry} from './ellipsoid-geometry.mts';
import type {prepareRowMaterial} from './row-material.mts';
import type {parseReferenceCelestialSource} from './reference-celestial-source.mts';
export interface AffineCameraConfiguration {namespace: string; camera: Pick<CameraPlan,'minimumControlPitchDegrees'|'maximumControlPitchDegrees'|'initialScenePitchDegrees'|'maximumScenePitchDegrees'|'minimumZoom'|'maximumZoom'|'defaultZoom'|'responsiveFit'>;}
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {CUBIC_SKY_STANDARD} from '../../../src/platform/cubic-sky-contract.mts';
import {prepareEllipsoidMaterialPlaneTransform} from './material-plane.mts';

export async function prepareAffineCamera({config,geometry,scene,lighting,contract,outputDirectory}: {config: AffineCameraConfiguration; geometry: ReturnType<typeof createEllipsoidGeometry>; scene: {geometry: {equatorialRadius: number}}; lighting: Pick<Awaited<ReturnType<typeof prepareRowMaterial>>,'presentationFrameSize'|'surfaceRadius'>; contract: ReturnType<typeof parseReferenceCelestialSource>; outputDirectory: string}) {
  const p=config.camera;
  const defaultPitch=p.maximumControlPitchDegrees*(1-p.initialScenePitchDegrees/p.maximumScenePitchDegrees);
  const defaultYaw=CUBIC_SKY_STANDARD.defaultControlYawDegrees;
  const camera={schema:`css${config.namespace}-prepared-camera@2`,model:'google-earth-pro-cubic-sky-unbounded-accumulated-matrix3d',cameraModel:'accumulated-matrix3d',
    state:{target:[0,0,0],rotX:defaultPitch,rotY:defaultYaw,zoom:p.defaultZoom,distance:0},
    minimumControlPitchDegrees:p.minimumControlPitchDegrees,maximumControlPitchDegrees:p.maximumControlPitchDegrees,
    defaultControlPitchDegrees:defaultPitch,defaultControlYawDegrees:defaultYaw,initialScenePitchDegrees:p.initialScenePitchDegrees,
    maximumScenePitchDegrees:p.maximumScenePitchDegrees,minimumZoom:p.minimumZoom,maximumZoom:p.maximumZoom,defaultZoom:p.defaultZoom,
    logicalBodyDiameter:scene.geometry.equatorialRadius*2,responsiveFit:p.responsiveFit,sceneScale:p.defaultZoom/50,
    horizontalOrbit:true,pitchBounded:false,yawBounded:false,runtimeMatrixFormatting:true,
    oracleContract:{source:contract.sourceProduct,sampleCount:contract.sampleCount,qualification:contract.captureQualification,
      nativeStateFields:['latitude','longitude','distance','heading','tilt'],
      projection:{...contract.camera.projection,axis:'horizontal',runtimeProjection:false},
      orientation:{...contract.camera.orientation,cubicRotationResponse:contract.camera.cubicTransport.rotationResponse,cubicZoomResponse:contract.camera.cubicTransport.zoomResponse}},
    materialDepthContract:{model:'prepared-camera-facing-plane-in-shared-moon-depth-context-with-camera-counter-rotation',
      referenceScenePitchDegrees:p.initialScenePitchDegrees,
      planeTransform:prepareEllipsoidMaterialPlaneTransform({pitchDegrees:p.initialScenePitchDegrees,yawDegrees:defaultYaw,
        outputSize:lighting.presentationFrameSize,contentRadius:lighting.surfaceRadius,physicalRadius:geometry.equatorialRadius,
        equatorialRadius:geometry.equatorialRadius,polarRadius:geometry.polarRadius,axialTiltDegrees:geometry.axialTiltDegrees,
        bodyRotationDegrees:geometry.bodyRotationDegrees,depthBias:geometry.materialDepthBias}),
      depthBias:geometry.materialDepthBias,runtimeGeometry:false,runtimeRasterization:false},
  };
  await writeFile(resolve(outputDirectory,'camera.json'),JSON.stringify(camera)+'\n');return camera;
}
