#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  ensureMoonPreparationDirectories,
  MOON_PUBLIC_ROOT,
} from "./preparation-paths.mjs";
import { validateMoonSourceGroup } from "./source-manifest.mjs";

const MATERIAL_FRAME_SIZE = 512;
const MATERIAL_PRESENTATION_SIZE = 512;
const CURVATURE_LIMB_FLOOR = 0.52;

sharp.concurrency(2);
await Promise.all([
  validateMoonSourceGroup("scene"),
  validateMoonSourceGroup("lenses"),
]);
await ensureMoonPreparationDirectories();

const lensPlans = Object.freeze([
  Object.freeze({
    id: "surface",
    label: "Surface",
    input: "surface/lroc-color-2k.jpg",
    output: "moon-surface",
    qualification: "NASA LRO/LROC visible-colour global surface mosaic",
    presentation: Object.freeze({
      model: "prepared-neutral-lunar-reflectance-presentation",
      saturation: 0.35,
      linearGain: 0.9,
      linearOffset: -78,
      sharpenSigma: 0.65,
      qualification:
        "Prepared tonal presentation preserves the LROC surface structure; " +
        "brightness and saturation are display choices, not calibrated albedo.",
    }),
  }),
  Object.freeze({
    id: "topography",
    label: "Topography",
    input: "lenses/lola-topography-print.jpg",
    output: "moon-topography",
    qualification: "NASA LRO/LOLA elevation map with shaded relief",
  }),
  Object.freeze({
    id: "crust",
    label: "Crust",
    input: "lenses/grail-crustal-thickness-print.jpg",
    output: "moon-crustal-thickness",
    qualification: "NASA GRAIL crustal-thickness map with shaded relief",
  }),
]);

for (const plan of lensPlans) await prepareLens(plan);
await Promise.all([1, 2].map(writeCurvatureMaterial));

const preparedLenses = Object.freeze({
  schema: "cssmoon-prepared-lenses@1",
  defaultLens: "surface",
  runtimeFilters: false,
  runtimeRasterization: false,
  controls: Object.freeze(lensPlans.map((plan) => Object.freeze({
    id: plan.id,
    label: plan.label,
    thumbnailUrl: `/scenes/moon/${plan.output}-thumbnail.webp`,
    surfaceUrl: `/scenes/moon/${plan.output}.webp`,
    surface2xUrl: `/scenes/moon/${plan.output}@2x.webp`,
    polesUrl: `/scenes/moon/${plan.output}-poles.webp`,
    poles2xUrl: `/scenes/moon/${plan.output}-poles@2x.webp`,
    qualification: plan.qualification,
    ...(plan.presentation ? { presentation: plan.presentation } : {}),
  }))),
  material: Object.freeze({
    schema: "cssmoon-prepared-curvature-material@1",
    model: "prepared-full-phase-spherical-curvature",
    one: "/scenes/moon/moon-curvature.webp",
    two: "/scenes/moon/moon-curvature@2x.webp",
    frameSize: MATERIAL_FRAME_SIZE,
    presentationSize: MATERIAL_PRESENTATION_SIZE,
    limbFloor: CURVATURE_LIMB_FLOOR,
    runtimeRasterization: false,
    qualification:
      "Prepared black-alpha curvature supplies display depth without claiming " +
      "an epoch-specific lunar phase or illumination geometry.",
  }),
  provenance: Object.freeze({
    surface: "NASA SVS CGI Moon Kit; LRO/LROC and LOLA",
    topography: "NASA GSFC SVS; LRO Lunar Orbiter Laser Altimeter",
    crust: "NASA GSFC SVS; Gravity Recovery and Interior Laboratory",
  }),
});
await writeFile(
  new URL("../runtime/preparedLenses.mjs", import.meta.url),
  "// Generated from checked Moon observation sources. Do not edit by hand.\n" +
    `export const PREPARED_MOON_LENSES = Object.freeze(${JSON.stringify(preparedLenses)});\n`,
);

async function prepareLens(plan) {
  const input = resolve(import.meta.dirname, "../source", plan.input);
  for (const density of [1, 2]) {
    const width = 1024 * density;
    const height = 512 * density;
    let pipeline = sharp(input)
      .resize(width, height, { fit: "fill" })
      .removeAlpha();
    if (plan.presentation) {
      pipeline = pipeline
        .modulate({ saturation: plan.presentation.saturation })
        .linear(
          plan.presentation.linearGain,
          plan.presentation.linearOffset,
        )
        .sharpen({ sigma: plan.presentation.sharpenSigma });
    }
    const { data, info } = await pipeline.raw()
      .toBuffer({ resolveWithObject: true });
    const surface = orientLatitudeBands(data, {
      width,
      height,
      channels: info.channels,
      bandCount: 16,
    });
    const poles = preparePolarAtlas(data, {
      width,
      height,
      channels: info.channels,
      tileSize: 128 * density,
      boundaryLatitudeRadians: Math.PI / 2 - Math.PI / 16,
    });
    const suffix = density === 2 ? "@2x" : "";
    await Promise.all([
      sharp(surface, { raw: { width, height, channels: info.channels } })
        .webp({ quality: 88, smartSubsample: true })
        .toFile(resolve(MOON_PUBLIC_ROOT, `${plan.output}${suffix}.webp`)),
      sharp(poles, {
        raw: {
          width: 512 * density,
          height: 128 * density,
          channels: 4,
        },
      })
        .webp({ quality: 88, alphaQuality: 100, smartSubsample: true })
        .toFile(resolve(
          MOON_PUBLIC_ROOT,
          `${plan.output}-poles${suffix}.webp`,
        )),
    ]);
  }
  const metadata = await sharp(input).metadata();
  const cropSize = Math.round(metadata.height / 2);
  let thumbnail = sharp(input)
    .extract({
      left: Math.round((metadata.width - cropSize) / 2),
      top: Math.round((metadata.height - cropSize) / 2),
      width: cropSize,
      height: cropSize,
    })
    .resize(96, 96, { kernel: sharp.kernel.lanczos3 })
    .removeAlpha();
  if (plan.presentation) {
    thumbnail = thumbnail
      .modulate({ saturation: plan.presentation.saturation })
      .linear(
        plan.presentation.linearGain,
        plan.presentation.linearOffset,
      )
      .sharpen({ sigma: plan.presentation.sharpenSigma });
  }
  await thumbnail
    .webp({ quality: 88, effort: 6 })
    .toFile(resolve(MOON_PUBLIC_ROOT, `${plan.output}-thumbnail.webp`));
}

async function writeCurvatureMaterial(density) {
  const size = MATERIAL_FRAME_SIZE * density;
  const pixels = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size * 0.505;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x - center) / radius;
      const ny = (y - center) / radius;
      const radialSquared = nx * nx + ny * ny;
      if (radialSquared > 1) continue;
      const normalZ = Math.sqrt(1 - radialSquared);
      const illumination = CURVATURE_LIMB_FLOOR +
        normalZ * (1 - CURVATURE_LIMB_FLOOR);
      pixels[(y * size + x) * 4 + 3] = Math.round(
        Math.max(0, Math.min(1, 1 - illumination)) * 255,
      );
    }
  }
  const suffix = density === 2 ? "@2x" : "";
  await sharp(pixels, {
    raw: { width: size, height: size, channels: 4 },
  }).webp({ lossless: true, alphaQuality: 100 }).toFile(resolve(
    MOON_PUBLIC_ROOT,
    `moon-curvature${suffix}.webp`,
  ));
}

function orientLatitudeBands(data, { width, height, channels, bandCount }) {
  const bandHeight = height / bandCount;
  if (!Buffer.isBuffer(data) || !Number.isInteger(bandHeight)) {
    throw new Error("Moon texture does not match its prepared latitude grid.");
  }
  const output = Buffer.alloc(data.length);
  const rowBytes = width * channels;
  for (let band = 0; band < bandCount; band += 1) {
    const bandStart = band * bandHeight;
    for (let row = 0; row < bandHeight; row += 1) {
      const sourceRow = bandStart + row;
      const outputRow = bandStart + bandHeight - 1 - row;
      data.copy(
        output,
        outputRow * rowBytes,
        sourceRow * rowBytes,
        (sourceRow + 1) * rowBytes,
      );
    }
  }
  return output;
}

function preparePolarAtlas(data, {
  width,
  height,
  channels,
  tileSize,
  boundaryLatitudeRadians,
}) {
  const output = Buffer.alloc(tileSize * 4 * tileSize * 4);
  const supersampling = 2;
  const samples = supersampling ** 2;
  const tiles = [
    { pole: "north", inner: false },
    { pole: "south", inner: false },
    { pole: "north", inner: true },
    { pole: "south", inner: true },
  ];
  for (const [tile, { pole, inner }] of tiles.entries()) {
    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const premultiplied = [0, 0, 0];
        let alphaTotal = 0;
        for (let sampleY = 0; sampleY < supersampling; sampleY += 1) {
          for (let sampleX = 0; sampleX < supersampling; sampleX += 1) {
            const unitX = (x + (sampleX + 0.5) / supersampling) /
              tileSize * 2 - 1;
            const unitY = (y + (sampleY + 0.5) / supersampling) /
              tileSize * 2 - 1;
            const radius = Math.hypot(unitX, unitY);
            if (radius > 1) continue;
            const latitudeMagnitude = Math.acos(Math.min(
              1,
              (inner ? 1 : radius) * Math.cos(boundaryLatitudeRadians),
            ));
            const latitude = pole === "north"
              ? latitudeMagnitude
              : -latitudeMagnitude;
            const longitude = ((Math.atan2(unitY, unitX) % (Math.PI * 2)) +
              Math.PI * 2) % (Math.PI * 2);
            const sourceX = longitude / (Math.PI * 2) * width - 0.5;
            const sourceY = (Math.PI / 2 - latitude) / Math.PI * height - 0.5;
            const rgba = sampleBilinear(
              data,
              { width, height, channels },
              sourceX,
              sourceY,
            );
            const alpha = rgba[3] / 255;
            for (let channel = 0; channel < 3; channel += 1) {
              premultiplied[channel] += rgba[channel] * alpha;
            }
            alphaTotal += alpha;
          }
        }
        const target = (y * tileSize * 4 + tile * tileSize + x) * 4;
        if (alphaTotal > 0) {
          for (let channel = 0; channel < 3; channel += 1) {
            output[target + channel] = Math.round(
              premultiplied[channel] / alphaTotal,
            );
          }
          output[target + 3] = Math.round(alphaTotal / samples * 255);
        }
      }
    }
  }
  return output;
}

function sampleBilinear(data, { width, height, channels }, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = x0 + 1;
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - Math.floor(y);
  const sample = (sourceX, sourceY, channel) => {
    const wrappedX = ((sourceX % width) + width) % width;
    return data[(sourceY * width + wrappedX) * channels + channel] ??
      (channel === 3 ? 255 : 0);
  };
  const rgba = [0, 0, 0, 255];
  for (let channel = 0; channel < Math.min(4, channels); channel += 1) {
    const top = sample(x0, y0, channel) * (1 - tx) +
      sample(x1, y0, channel) * tx;
    const bottom = sample(x0, y1, channel) * (1 - tx) +
      sample(x1, y1, channel) * tx;
    rgba[channel] = Math.round(top * (1 - ty) + bottom * ty);
  }
  return rgba;
}
