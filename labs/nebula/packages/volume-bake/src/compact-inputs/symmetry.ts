import type { CompiledVolumeArtifact } from '../compiler/bake.ts';
import type { VolumeSlices } from '@cssearth/volume-core/contracts/volume-slices';
/** Losslessly retained RGB emission voxels; runtime slice images remain disposable. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { DensityVolumeFrame } from "@cssearth/volume-core/contracts/volume-frame";
import { bakeMasterVolumeSlices } from "../slices/emission.ts";
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
import type { CompilerPin } from "@cssearth/volume-core/contracts/compiler-bake";
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
async function pinned(root: string, pin: CompilerPin) {
  if (pin.path.startsWith("/") || pin.path.split("/").includes(".."))
    throw new Error("Invalid compact source path");
  return readFile(resolve(root, pin.path));
}
export interface SymmetryBakeBackend<Volume extends CompiledVolumeArtifact> {
  compileVolume(input: { id: string; frame: DensityVolumeFrame; slices: VolumeSlices }): Volume;
}
export async function replayCompactSymmetry<Volume extends CompiledVolumeArtifact>(
  root: string,
  pin: CompilerPin,
  outputDirectory: string,
  backend: SymmetryBakeBackend<Volume>,
) {
  const input: unknown = JSON.parse((await pinned(root, pin)).toString());
  if (
    !jointRecord(input) ||
    input.schema !== "cssearth-compact-symmetry@1" ||
    !jointRecord(input.recipe) ||
    !Array.isArray(input.channels) ||
    input.channels.length !== 3
  )
    throw new Error("Invalid compact symmetry input");
  const r = input.recipe,
    g = r.grid;
  if (
    !jointRecord(g) ||
    ![g.width, g.height, g.depth].every(
      (n) => Number.isInteger(n) && Number(n) > 0 && Number(n) <= 512,
    ) ||
    typeof r.id !== "string" ||
    !/^[a-z0-9-]+$/.test(r.id) ||
    !Number.isInteger(r.slices) ||
    Number(r.slices) < 1 ||
    Number(r.slices) > 512 ||
    typeof r.displayExposure !== "number" ||
    !Number.isFinite(r.displayExposure) ||
    r.displayExposure <= 0
  )
    throw new Error("Invalid compact symmetry dimensions");
  const grid = {
      width: Number(g.width),
      height: Number(g.height),
      depth: Number(g.depth),
    },
    count = grid.width * grid.height * grid.depth;
  const fields = await Promise.all(
    input.channels.map(async (p: unknown) => {
      if (
        !jointRecord(p) ||
        typeof p.path !== "string" ||
        p.bytes !== count * 4
      )
        throw new Error("Invalid emission pin");
      const b = gunzipSync(
        await pinned(root, { path: p.path }),
        { maxOutputLength: count * 4 },
      );
      if (b.length !== count * 4)
        throw new Error("Emission field differs");
      const values = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        values[i] = b.readFloatLE(i * 4);
        if (!Number.isFinite(values[i]) || values[i]! < 0)
          throw new Error("Invalid emission value");
      }
      return values;
    }),
  );
  const voxelSize = 10 / grid.width;
  const bounds = {
    min: [
      (-grid.width * voxelSize) / 2,
      (-grid.height * voxelSize) / 2,
      (-grid.depth * voxelSize) / 2,
    ] as [number, number, number],
    max: [
      (grid.width * voxelSize) / 2,
      (grid.height * voxelSize) / 2,
      (grid.depth * voxelSize) / 2,
    ] as [number, number, number],
  };
  const baked = await bakeMasterVolumeSlices({
    boundsKpc: bounds,
    sliceCounts: {
      x: Number(r.slices),
      y: Number(r.slices),
      z: Number(r.slices),
    },
    samplesPerSlab: 4,
    masterWidth: 192,
    masterDirectory: resolve(root, outputDirectory),
    deliveryBanks: [],
    exposureGain: r.displayExposure,
    unitsPerSourceUnit: 1,
    provenance: input.provenance,
    sampleEmission(x, y, z, out) {
      const gx = (x - bounds.min[0]) / voxelSize - 0.5,
        gy = (bounds.max[1] - y) / voxelSize - 0.5,
        gz = (z - bounds.min[2]) / voxelSize - 0.5;
      out.fill(0);
      const ix = Math.floor(gx),
        iy = Math.floor(gy),
        iz = Math.floor(gz);
      for (let dz = 0; dz <= 1; dz++)
        for (let dy = 0; dy <= 1; dy++)
          for (let dx = 0; dx <= 1; dx++) {
            const xx = ix + dx,
              yy = iy + dy,
              zz = iz + dz;
            if (
              xx < 0 ||
              xx >= grid.width ||
              yy < 0 ||
              yy >= grid.height ||
              zz < 0 ||
              zz >= grid.depth
            )
              continue;
            const weight =
                (dx ? gx - ix : 1 - gx + ix) *
                (dy ? gy - iy : 1 - gy + iy) *
                (dz ? gz - iz : 1 - gz + iz),
              index = (zz * grid.height + yy) * grid.width + xx;
            for (let c = 0; c < 3; c++)
              out[c]! +=
                (fields[c]![index]! * weight) /
                (voxelSize * Math.sqrt(grid.depth));
          }
    },
  });
  const frame: DensityVolumeFrame = {
    referenceFrame: "lab-image-relative-unscaled",
    epochJdTt: 2451545,
    originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1],
    metersPerUnit: 1,
    boundsUnits: bounds,
  };
  const volume = backend.compileVolume({
      id: r.id,
      frame,
      slices: baked.masters,
    });
  const bytes = Buffer.from(
    JSON.stringify({
      schema: "cssearth-prepared-object@1",
      id: r.id,
      type: "density-volume",
      format: "cssearth-density-volume@1",
      data: volume,
    }) + "\n",
  );
  const path = `${outputDirectory}/volume.json`;
  await mkdir(dirname(resolve(root, path)), { recursive: true });
  await writeFile(resolve(root, path), bytes);
  return { id: r.id, frame, volume, pin: { path } };
}
