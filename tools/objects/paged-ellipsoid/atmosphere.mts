import type {SourceManifest} from '../../../src/platform/source-manifest.mts';
import type {PreparedDirectionalSunPlan} from '../../../src/platform/directional-sun-contract.mts';
import type {PreparedAtmosphereProfile} from '../../prepared-atmosphere.mts';
import {readJsonSource, requireRecord, requireFiniteNumber} from '../../source-values.mts';
import {parseAtmosphereResponse} from './source-contract.mts';
export interface AtmosphereConfiguration {
  material: {tileSize: number; presentationSize: number; framesPerShard: number; discRadius: number;
    illumination: {frameCount: number; minimumLightViewZ: number; maximumLightViewZ: number; baseLightAzimuthDegrees: number}};
  atmosphere: {sourcePath: string; responsePath: string; sourceId: string; maximumOpacityKey: string};
}
import { prepareAtmosphereFrame } from "../../prepared-atmosphere.mts";
import { viewSunDirectionToPreparedLightDirection } from "../../../src/platform/directional-sun-coordinate.mts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";


export function createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun }: {config: AtmosphereConfiguration; sourceDirectory: string; sourceManifest: SourceManifest; sun: Pick<PreparedDirectionalSunPlan, "referenceViewDirection">}) {
const MATERIAL_TILE_SIZE = config.material.tileSize;
const MATERIAL_PRESENTATION_SIZE = config.material.presentationSize;
const MATERIAL_FRAMES_PER_SHARD = config.material.framesPerShard;

async function readAtmosphereModel() {
  const atmospherePath = resolve(
    sourceDirectory, config.atmosphere.sourcePath,
  );
  const presentationResponsePath = resolve(
    sourceDirectory, config.atmosphere.responsePath,
  );
  const [text, presentationResponse] = await Promise.all([
    readFile(atmospherePath, "utf8"),
    readJsonSource(presentationResponsePath).then(parseAtmosphereResponse),
  ]);
  const source = sourceManifest.inputs.find(
    ({ id }) => id === config.atmosphere.sourceId,
  );
  if (!source) throw new Error("Earth atmosphere source manifest entry is missing.");
  if (presentationResponse.schema !==
      "cssearth-google-earth-pro-atmosphere-presentation-response@1" ||
      presentationResponse.observedResponse?.exposure !== 0.2 ||
      presentationResponse.observedResponse?.exposureRole !==
        "camera-response-not-body-irradiance" ||
      presentationResponse.cleanRoomTransfer?.bodySunIntensitySource !==
        "openspace-body-atmosphere-model" ||
      presentationResponse.transferPolicy?.googlePixelsRedistributed !== false ||
      presentationResponse.transferPolicy?.googleShaderBytesRedistributed !== false) {
    throw new Error("Google Earth Pro atmosphere response is incompatible.");
  }

  const [outerRadiusKm, innerRadiusKm] = captureNumbers(
    text,
    /AtmosphereHeight\s*=\s*([\d.]+)\s*-\s*([\d.]+)/u,
    "atmosphere height",
  );
  const planetRadiusKm = captureNumber(
    text,
    /PlanetRadius\s*=\s*([\d.]+)/u,
    "planet radius",
  );
  if (innerRadiusKm !== planetRadiusKm || outerRadiusKm <= planetRadiusKm) {
    throw new Error("OpenSpace body atmosphere radii are inconsistent.");
  }

  const rayleighBlock = captureText(
    text,
    /Rayleigh\s*=\s*\{([\s\S]*?)\n\s*\},\n\s*--\[\[/u,
    "Rayleigh block",
  );
  const mieBlock = captureText(
    text,
    /-- Default\s+Mie\s*=\s*\{([\s\S]*?)\n\s*\},\n\s*Debug/u,
    "Mie block",
  );
  const wavelengthsNanometers = captureList(
    rayleighBlock,
    /Wavelengths\s*=\s*\{([^}]+)\}/u,
    "Rayleigh wavelengths",
  );
  const rayleighScatteringPerKm = captureList(
    rayleighBlock,
    /Scattering\s*=\s*\{([^}]+)\}/u,
    "Rayleigh scattering",
  );
  const mieScatteringPerKm = captureList(
    mieBlock,
    /Scattering\s*=\s*\{([^}]+)\}/u,
    "Mie scattering",
  );
  if (wavelengthsNanometers.length !== 3 ||
      rayleighScatteringPerKm.length !== 3 ||
      mieScatteringPerKm.length !== 3) {
    throw new Error("OpenSpace body atmosphere RGB coefficients are incomplete.");
  }

  return deepFreeze({
    schema: "cssearth-openspace-atmosphere-source@1",
    authority: "OpenSpace RenderableAtmosphere",
    sourceId: source.id,
    sourceSha256: source.expectedSha256,
    planetRadiusKm,
    atmosphereHeightKm: outerRadiusKm - innerRadiusKm,
    outerRadiusRatio: outerRadiusKm / planetRadiusKm,
    sunIntensity: captureNumber(
      text,
      /SunIntensity\s*=\s*([\d.]+)/u,
      "Sun intensity",
    ),
    rayleigh: {
      wavelengthsNanometers,
      scatteringPerKm: rgbCoefficients(rayleighScatteringPerKm),
      scaleHeightKm: captureNumber(
        rayleighBlock,
        /H_R\s*=\s*([\d.]+)/u,
        "Rayleigh scale height",
      ),
    },
    mie: {
      scatteringPerKm: rgbCoefficients(mieScatteringPerKm),
      scaleHeightKm: captureNumber(
        mieBlock,
        /H_M\s*=\s*([\d.]+)/u,
        "Mie scale height",
      ),
      anisotropy: captureNumber(
        mieBlock,
        /^\s*G\s*=\s*([\d.]+)/mu,
        "Mie anisotropy",
      ),
    },
    presentationResponse,
  });
}

function rgbCoefficients(values: readonly number[]): [number, number, number] {
  if (values.length !== 3 || values.some(value => !Number.isFinite(value))) throw new Error('OpenSpace atmosphere RGB coefficients are invalid.');
  return [values[0], values[1], values[2]];
}

function captureText(text: string, expression: RegExp, label: string) {
  const value = text.match(expression)?.[1];
  if (!value) throw new Error(`OpenSpace body ${label} is missing.`);
  return value;
}

function captureNumber(text: string, expression: RegExp, label: string) {
  const value = Number(captureText(text, expression, label));
  if (!Number.isFinite(value)) {
    throw new Error(`OpenSpace body ${label} is not finite.`);
  }
  return value;
}

function captureNumbers(text: string, expression: RegExp, label: string) {
  const match = text.match(expression);
  if (!match) throw new Error(`OpenSpace body ${label} is missing.`);
  const values = match.slice(1).map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`OpenSpace body ${label} is not finite.`);
  }
  return values;
}

function captureList(text: string, expression: RegExp, label: string) {
  return captureText(text, expression, label)
    .split(",")
    .map((value) => Number(value.trim()));
}

function deepFreeze<T extends object>(value: T): Readonly<T> {
  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (nested && typeof nested === "object") deepFreeze(nested);
  }
  return Object.freeze(value);
}

const ATMOSPHERE_ILLUMINATION = config.material.illumination;
const ATMOSPHERE_DEFAULT_FRAME = Math.round(
  (1 + viewSunDirectionToPreparedLightDirection(sun.referenceViewDirection)[2]) / 2 *
    (ATMOSPHERE_ILLUMINATION.frameCount - 1));

function atmosphereProfile(model: Awaited<ReturnType<typeof readAtmosphereModel>>): PreparedAtmosphereProfile {
  const response = model.presentationResponse;
  return {
    radiusKm: model.planetRadiusKm, heightKm: model.atmosphereHeightKm,
    layers: [
      { ...model.rayleigh, phase: "rayleigh", weight: 1 },
      { ...model.mie, phase: "mie", weight: response.cleanRoomTransfer.mieContribution },
    ],
    transfer: { mode: "scattering-rgb",
      intensity: model.sunIntensity, exposure: response.observedResponse.exposure,
      alphaScale: response.observedResponse.skyAlphaLuminanceScale,
      maximumAlpha: requireFiniteNumber(requireRecord(response.cleanRoomTransfer)[config.atmosphere.maximumOpacityKey], "Atmosphere opacity"), limbConcentration: true },
  };
}

function prepareAtmosphereMaterialFrame({ size, frame = ATMOSPHERE_DEFAULT_FRAME, model }: {size: number; frame?: number; model: Awaited<ReturnType<typeof readAtmosphereModel>>}) {
  const z = -1 + 2 * frame / (ATMOSPHERE_ILLUMINATION.frameCount - 1);
  if (!Number.isInteger(frame) || Math.abs(z) > 1) throw new RangeError("Invalid Earth atmosphere frame.");
  // The existing prepared material plane spans the atmospheric outer radius.
  const radius = size * config.material.discRadius / model.outerRadiusRatio;
  return prepareAtmosphereFrame({
    width: size, disc: { centerX: size / 2, centerY: size / 2, radiusX: radius, radiusY: radius },
    profile: atmosphereProfile(model),
    lightDirection: [Math.sqrt(Math.max(0, 1 - z * z)), 0, z],
  });
}

return { readAtmosphereModel, atmosphereProfile, prepareAtmosphereMaterialFrame, MATERIAL_TILE_SIZE, MATERIAL_PRESENTATION_SIZE, MATERIAL_FRAMES_PER_SHARD, ATMOSPHERE_ILLUMINATION, ATMOSPHERE_DEFAULT_FRAME };
}
