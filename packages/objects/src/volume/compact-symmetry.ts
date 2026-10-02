import type { CompilerPin } from './compiler-bake.js';
export const COMPACT_SYMMETRY_SCHEMA = 'cssearth-compact-symmetry@1';
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export function readCompactSymmetry(input: unknown) {

  if (
    !jointRecord(input) ||
    input.schema !== COMPACT_SYMMETRY_SCHEMA ||
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
  const channels = input.channels.map((p: unknown): CompilerPin & { bytes: number } => {
      if (
        !jointRecord(p) ||
        typeof p.path !== "string" ||
        p.bytes !== count * 4
      )
        throw new Error("Invalid emission pin");
    return { path: p.path, bytes: count * 4 };
  });
  return { recipe: { id: r.id, slices: Number(r.slices), displayExposure: r.displayExposure }, grid, count, channels, provenance: input.provenance };
}
export function decodeCompactSymmetryField(bytes: Uint8Array, count: number): Float32Array {
  if (bytes.byteLength !== count * 4) throw new Error("Emission field differs");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), values = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = view.getFloat32(i * 4, true);
    if (!Number.isFinite(values[i]) || values[i]! < 0) throw new Error("Invalid emission value");
  }
  return values;
}
