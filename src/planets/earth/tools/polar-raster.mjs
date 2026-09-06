// Shared preparation mapping for the accepted retained Earth caps.
export function preparePolarAtlas(data, { width, height, channels, tileSize, boundaryLatitudeRadians, longitudeOffsetRadians, sampling = "bilinear", supersampling = 2 }) {
  const output = Buffer.alloc(tileSize * 4 * tileSize * 4);
  const sampleCount = supersampling ** 2;
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
            const unitX = (x + (sampleX + 0.5) / supersampling) / tileSize * 2 - 1;
            const unitY = (y + (sampleY + 0.5) / supersampling) / tileSize * 2 - 1;
            const radius = Math.hypot(unitX, unitY);
            if (radius > 1) continue;
            const sampleRadius = inner ? 1 : radius;
            const latitudeMagnitude = Math.acos(Math.min(
              1,
              sampleRadius * Math.cos(boundaryLatitudeRadians),
            ));
            const latitude = pole === "north" ? latitudeMagnitude : -latitudeMagnitude;
            let longitude = Math.atan2(unitY, unitX) - longitudeOffsetRadians;
            longitude = ((longitude % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const sourceX = longitude / (Math.PI * 2) * width - 0.5;
            const sourceY = (Math.PI / 2 - latitude) / Math.PI * height - 0.5;
            const rgba = sampling === "nearest" ? sampleNearest(data, { width, height, channels }, sourceX, sourceY) : sampleBilinear(data, { width, height, channels }, sourceX, sourceY);
            const alpha = rgba[3] / 255;
            for (let channel = 0; channel < 3; channel += 1) premultiplied[channel] += rgba[channel] * alpha;
            alphaTotal += alpha;
          }
        }
        const target = (y * tileSize * 4 + tile * tileSize + x) * 4;
        if (alphaTotal > 0) {
          for (let channel = 0; channel < 3; channel += 1) output[target + channel] = Math.round(premultiplied[channel] / alphaTotal);
          output[target + 3] = Math.round(alphaTotal / sampleCount * 255);
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
    return data[(sourceY * width + wrappedX) * channels + channel] ?? (channel === 3 ? 255 : 0);
  };
  const rgba = [0, 0, 0, 255];
  for (let channel = 0; channel < 4; channel += 1) {
    if (channel >= channels) continue;
    const top = sample(x0, y0, channel) * (1 - tx) + sample(x1, y0, channel) * tx;
    const bottom = sample(x0, y1, channel) * (1 - tx) + sample(x1, y1, channel) * tx;
    rgba[channel] = Math.round(top * (1 - ty) + bottom * ty);
  }
  return rgba;
}


function sampleNearest(data, {width, height, channels}, x, y) {
  const index = (Math.max(0, Math.min(height - 1, Math.round(y))) * width + ((Math.round(x) % width) + width) % width) * channels;
  return [data[index], data[index+1], data[index+2], channels === 4 ? data[index+3] : 255];
}
