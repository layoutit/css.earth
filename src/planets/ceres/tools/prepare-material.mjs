import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { CERES_PUBLIC_ROOT, CERES_PREPARED_ROOT } from "./preparation-paths.mjs";
import { resolve } from "node:path";

const surfaces = JSON.parse(await readFile(new URL("../.prepared/surfaces.json", import.meta.url))).surfaces;
const poleSize = 512;
for (const surface of surfaces) {
  const { data, info } = await sharp(resolve(CERES_PUBLIC_ROOT, surface.map.url.split("/").at(-1)))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const atlas = Buffer.alloc(poleSize * 2 * poleSize * 4);
  for (let pole = 0; pole < 2; pole++) for (let y = 0; y < poleSize; y++) for (let x = 0; x < poleSize; x++) {
    const dx = (x + 0.5) / poleSize * 2 - 1, dy = (y + 0.5) / poleSize * 2 - 1;
    const r = Math.hypot(dx, dy);
    if (r > 1) continue;
    const longitude = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
    const latitude = (pole === 0 ? 1 : -1) * Math.acos(r * Math.sin(Math.PI / 16));
    const sx = Math.min(info.width - 1, Math.floor(longitude * info.width));
    const sy = Math.max(0, Math.min(info.height - 1, Math.floor((0.5 - latitude / Math.PI) * info.height)));
    const from = (sy * info.width + sx) * 4, to = (y * poleSize * 2 + pole * poleSize + x) * 4;
    data.copy(atlas, to, from, from + 4);
  }
  surface.polesUrl = `/scenes/ceres/ceres-${surface.id}-poles@2x.webp`;
  await sharp(atlas, { raw: { width: poleSize * 2, height: poleSize, channels: 4 } })
    .webp({ quality: 90 }).toFile(resolve(CERES_PUBLIC_ROOT, surface.polesUrl.split("/").at(-1)));
  const mean = await sharp(data, { raw: info }).resize(1, 1).removeAlpha().raw().toBuffer();
  surface.billboardColor = `#${mean.subarray(0, 3).toString("hex")}`;
}

// Full-phase Lambert attenuation in the view plane, matching Mercury's
// prepared material model. One bounded atlas; no runtime rasterization.
const frameSize = 512, columns = 8, frameCount = 128, rows = frameCount / columns;
const atlasWidth = frameSize * columns, atlasHeight = frameSize * rows;
const pixels = Buffer.alloc(atlasWidth * atlasHeight * 4);
for (let frame = 0; frame < frameCount; frame++) {
  const lz = -1 + 2 * frame / (frameCount - 1), lx = Math.sqrt(1 - lz * lz);
  for (let y = 0; y < frameSize; y++) for (let x = 0; x < frameSize; x++) {
    const nx = (x - (frameSize - 1) / 2) / (frameSize * 0.505);
    const ny = (y - (frameSize - 1) / 2) / (frameSize * 0.505), r2 = nx * nx + ny * ny;
    if (r2 > 1) continue;
    const direct = Math.max(0, nx * lx + Math.sqrt(1 - r2) * lz);
    const t = Math.min(1, direct / 0.1), lit = t * t * (3 - 2 * t) * direct;
    const illumination = frame === frameCount - 1 ? 0.35 + lit * 0.65 : 0.05 + lit;
    const offset = ((Math.floor(frame / columns) * frameSize + y) * atlasWidth + frame % columns * frameSize + x) * 4;
    pixels[offset + 3] = Math.round(Math.min(0.95, Math.max(0, 1 - illumination)) * 255);
  }
}
const url = "/scenes/ceres/ceres-lighting.webp";
await sharp(pixels, { raw: { width: atlasWidth, height: atlasHeight, channels: 4 } })
  .webp({ lossless: true }).toFile(resolve(CERES_PUBLIC_ROOT, "ceres-lighting.webp"));
const frames = Array.from({ length: frameCount }, (_, frame) => ({
  resource: "lighting", frame, row: 0,
  backgroundPosition: `${-(frame % columns) * 460}px ${-Math.floor(frame / columns) * 460}px`,
  backgroundSize: `${columns * 460}px ${rows * 460}px`,
}));
await writeFile(resolve(CERES_PREPARED_ROOT, "material.json"), JSON.stringify({ surfaces, lighting: { url, columns, rowCount: rows, frameCount, frames } }));
console.log("Prepared Ceres poles and lighting.");
