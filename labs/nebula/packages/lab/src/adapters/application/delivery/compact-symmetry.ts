/** Export accepted research voxels; renderer-specific replay is injected into the internal baker. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { replayCompactSymmetry as replay } from '@cssearth/bake/volume/node';
import { compileCssVolume } from "../../../../../../../../src/renderers/css/preparation/volume.ts";
import { validatePreparedCssVolume } from "@cssearth/renderer/volume/validation.ts";
import { jointRecord } from "../../../features/joint-fit/model.ts";
import type { CompilerPin } from "@cssearth/bake/volume";
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
function objectVolume(value: unknown) {
  if (!jointRecord(value)) throw new Error("Invalid volume envelope");
  return validatePreparedCssVolume(value.data);
}
export async function exportCompactSymmetry(
  root: string,
  sourceDirectory: string,
  outputDirectory: string,
): Promise<CompilerPin> {
  const result: unknown = JSON.parse(
    await readFile(resolve(root, sourceDirectory, "result.json"), "utf8"),
  );
  if (!jointRecord(result) || !jointRecord(result.recipe))
    throw new Error("Missing symmetry recipe");
  const expected = objectVolume(
    JSON.parse(
      await readFile(
        resolve(root, sourceDirectory, "prepared/volume.json"),
        "utf8",
      ),
    ),
  );
  const recipe = result.recipe,
    channels = [];
  await mkdir(resolve(root, outputDirectory), { recursive: true });
  for (let c = 0; c < 3; c++) {
    const bytes = await readFile(
      resolve(root, sourceDirectory, `emission-${c}.f32`),
    );
    const compressed = gzipSync(bytes, { level: 9 }),
      path = `${outputDirectory}/emission-${c}.f32.gz`;
    await writeFile(resolve(root, path), compressed);
    channels.push({
      path,
      sha256: sha(compressed),
      uncompressedSha256: sha(bytes),
      bytes: bytes.length,
    });
  }
  const path = `${outputDirectory}/model.json`,
    bytes = Buffer.from(
      JSON.stringify(
        {
          schema: "cssearth-compact-symmetry@1",
          recipe,
          channels,
          expectedSha256: sha(Buffer.from(JSON.stringify(expected))),
          provenance: expected.provenance,
          interpretation:
            "Three RGB emissivity voxel fields before optical integration, not rendered slices.",
        },
        null,
        2,
      ) + "\n",
    );
  await writeFile(resolve(root, path), bytes);
  return { path };
}
export function replayCompactSymmetry(root: string, pin: CompilerPin, outputDirectory: string) {
  return replay(root, pin, outputDirectory, {
    compileVolume: input => validatePreparedCssVolume(compileCssVolume({ ...input, recipe: { anchors: [] } })),
  });
}
