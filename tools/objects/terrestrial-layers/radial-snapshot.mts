import type {PreparedTriangle} from './contracts.mts';
import sharp from 'sharp';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';
import { dotN as dot } from '@cssearth/core';

/** An orthographic, full-phase context image from the same prepared surface
 * and mesh. This CPU rasterization runs only during source preparation. */
export async function renderRadialSnapshot({ faces, map, sampleSurface, size, longitudeDegrees, latitudeDegrees, ambient, diffuse, displaySampling }: {faces:readonly PreparedTriangle[];map?:string|Buffer;sampleSurface?:(point:readonly number[])=>{color:ArrayLike<number>;normal?:readonly number[]}|null;size:number;longitudeDegrees:number;latitudeDegrees:number;ambient:number;diffuse:number;displaySampling?:string}) {
  if (!Number.isInteger(size) || size < 16 || size > 1024 ||
      ![longitudeDegrees, latitudeDegrees, ambient, diffuse].every(Number.isFinite) ||
      Math.abs(latitudeDegrees) > 90 || ambient < 0 || diffuse < 0 || ambient + diffuse > 1 ||
      (sampleSurface !== undefined && typeof sampleSurface !== 'function') ||
      ![undefined, 'nearest'].includes(displaySampling)) throw new TypeError('Invalid radial snapshot.');
  if (!sampleSurface && !map) throw new Error("Radial snapshot requires a prepared map or source sampler");
  const image = sampleSurface ? null : await sharp(map).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = size * 2, pixels = Buffer.alloc(width * width * 4), depth = new Float64Array(width * width).fill(-Infinity);
  const lon = longitudeDegrees * Math.PI / 180, lat = latitudeDegrees * Math.PI / 180;
  const eye = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const right = [-Math.sin(lon), Math.cos(lon), 0], up = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
  const radius = faces.reduce((maximum, face) => face.vertices.reduce(
    (maximum, vertex) => Math.max(maximum, Math.hypot(...vertex)), maximum), 0);
  const scale = width * .47 / radius;
  for (const face of faces) {
    if (dot(face.normal, eye) <= 0) continue;
    const p = face.vertices.map(v => [width / 2 + dot(v, right) * scale, width / 2 - dot(v, up) * scale, dot(v, eye)]);
    const [a, b, c] = p;
    const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-8) continue;
    for (let y = Math.max(0, Math.floor(Math.min(...p.map(v => v[1])))); y <= Math.min(width - 1, Math.ceil(Math.max(...p.map(v => v[1])))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...p.map(v => v[0])))); x <= Math.min(width - 1, Math.ceil(Math.max(...p.map(v => v[0])))); x++) {
        const u = ((b[1] - c[1]) * (x + .5 - c[0]) + (c[0] - b[0]) * (y + .5 - c[1])) / denominator;
        const v = ((c[1] - a[1]) * (x + .5 - c[0]) + (a[0] - c[0]) * (y + .5 - c[1])) / denominator, w = 1 - u - v;
        if (Math.min(u, v, w) < 0) continue;
        const z = u * a[2] + v * b[2] + w * c[2], index = y * width + x;
        if (z <= depth[index]) continue;
        depth[index] = z;
        const point = face.vertices[0].map((n, i) => n * u + face.vertices[1][i] * v + face.vertices[2][i] * w);
        const sample = face.estimated ? { color: missingCoverageColor(
          Math.atan2(point[1], point[0]) * 180 / Math.PI,
          Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI, 180 / size) } : sampleSurface?.(point);
        const normal = sample?.normal ?? face.vertexNormals[0].map((n, i) => n * u + face.vertexNormals[1][i] * v + face.vertexNormals[2][i] * w);
        const illumination = ambient + diffuse * Math.max(0, dot(normal, eye) / Math.hypot(...normal));
        let color = sample?.color;
        if (!color) {
          if (sampleSurface || !image) throw new Error('A source-surface snapshot must explicitly style missing coverage.');
          const mx = Math.floor(((Math.atan2(point[1], point[0]) / (2 * Math.PI) + 1) % 1) * image.info.width);
          const my = Math.min(image.info.height - 1, Math.floor((.5 - Math.atan2(point[2], Math.hypot(point[0], point[1])) / Math.PI) * image.info.height));
          color = image.data.subarray((my * image.info.width + mx) * 3, (my * image.info.width + mx) * 3 + 3);
        }
        for (let channel = 0; channel < 3; channel++) pixels[index * 4 + channel] = Math.round(color[channel] * illumination);
        pixels[index * 4 + 3] = 255;
      }
    }
  }
  return sharp(pixels, { raw: { width, height: width, channels: 4 } }).resize(size, size, { kernel: displaySampling === 'nearest' ? 'nearest' : 'lanczos3' }).png().toBuffer();
}
