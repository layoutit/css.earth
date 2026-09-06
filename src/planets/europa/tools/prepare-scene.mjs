import { writeFile } from "node:fs/promises";
import { prepareSolidBodySurface } from "../../../platform/prepare-solid-body-surface.mjs";
import { preparePerspectiveCamera } from "../../../platform/prepare-perspective-camera.mjs";
import { prepareHeliocentricView } from "../../../platform/prepare-heliocentric-view.mjs";
import { preparePlanetarySystem } from "../../../platform/prepare-planetary-system.mjs";
import { prepareAstrometricSkySceneRegistration } from "../../../platform/astrometric-sky-registration.mjs";
import { loadAstronomyPackage } from "../../../platform/astronomy-package.mjs";
import { PREPARED_EUROPA_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_EUROPA_SKY_SUN as sun } from "../runtime/preparedSkySun.mjs";
import { EUROPA_CAMERA_POSE, EUROPA_PRESENTATION_FRAME as frame } from "./scene-camera-pose.mjs";

const { BODIES } = await loadAstronomyPackage();
const radiusKm = BODIES.europa.meanRadiusKm, radius = 230;
const registration = prepareAstrometricSkySceneRegistration("europa");
const sky = { ...PREPARED_EUROPA_STARFIELD,
  cameraContract: "scene-locked-unbounded-accumulated-matrix3d",
  sceneRegistration: registration.cssTransform, sceneRegistrationModel: registration.model,
  sceneRegistrationChain: registration.chain, sceneRegistrationEpoch: registration.epoch };
const scene = {
  camera: preparePerspectiveCamera({ sky, radius, ...EUROPA_CAMERA_POSE }), sky, sun,
  systemTransform: frame.cssTransform,
  // Mean-radius sphere; a resolved shape model is not claimed.
  bodyLeaves: prepareSolidBodySurface({ id: "europa", radius,
    mapUrl: "/scenes/europa/europa-normal-surface@2x.webp", polesUrl: "/scenes/europa/europa-normal-poles@2x.webp" }),
  heliocentricView: prepareHeliocentricView({ bodyId: "europa", presentationFrame: frame,
    bodyRadiusUnits: radius, bodyRadiusKilometers: radiusKm,
    sunSprite: { imagePixels: sun.asset.density1.width,
      opaqueCoreDiameterShare: sun.distanceScaling.spriteOpaqueCoreDiameterShare },
    system: await preparePlanetarySystem({ bodyId: "europa", presentationFrame: frame, kilometersPerUnit: radiusKm / radius }),
  }),
};
await writeFile(new URL("../.prepared/scene.json", import.meta.url), JSON.stringify(scene));
console.log(`Prepared Europa scene: ${scene.bodyLeaves.length} retained surface leaves.`);
