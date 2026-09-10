import type { RasterInfo } from "./contracts.mts";
export function orientLatitudeBands(data: Buffer, { width, height, channels, bandCount }: RasterInfo & {bandCount: number}) {
  const bandHeight = height / bandCount;
  if (!Buffer.isBuffer(data) || !Number.isInteger(bandHeight)) {
    throw new Error("Surface texture does not match its prepared latitude grid.");
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

export function preparePolarAtlas(data: Uint8Array, {
  width,
  height,
  channels,
  tileSize,
  boundaryLatitudeRadians,
  sampling = "bilinear",
}: RasterInfo & {tileSize: number; boundaryLatitudeRadians: number; sampling?: "bilinear" | "nearest"}) {
  if (!["bilinear", "nearest"].includes(sampling)) throw new Error("Unsupported polar atlas sampling.");
  const output = Buffer.alloc(tileSize * 4 * tileSize * 4);
  const supersampling = sampling === "nearest" ? 1 : 2;
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
            const rgba = (sampling === "nearest" ? sampleNearest : sampleBilinear)(
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

function sampleBilinear(data: Uint8Array, { width, height, channels }: RasterInfo, x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = x0 + 1;
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - Math.floor(y);
  const sample = (sourceX: number, sourceY: number, channel: number) => {
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

// The selected source texel owns both its RGB value and its missing-data style.
// A single pixel-center sample also avoids blending across the polar footprint.
function sampleNearest(data: Uint8Array, { width, height, channels }: RasterInfo, x: number, y: number) {
  const sx = ((Math.floor(x + 0.5) % width) + width) % width;
  const sy = Math.max(0, Math.min(height - 1, Math.floor(y + 0.5)));
  const i = (sy * width + sx) * channels;
  return [data[i], data[i + 1], data[i + 2], channels === 4 ? data[i + 3] : 255];
}
