import { CSS_COMPILER_RENDER_BUDGET } from '../../../../../../../../src/renderers/css/volume/compiler-render-budget.ts';
import { replayCompactSampled as replay } from '@cssearth/volume-bake/compact-inputs/sampled';
import { compileCssVolume } from '../../../../../../../../src/renderers/css/preparation/volume.ts';
import { validatePreparedCssVolume } from '../../../../../../../../src/renderers/css/volume/validation.ts';
/** Retained measured particles and per-emitter materials; never stores rendered slices. */
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { geometrySha } from "../../../server/workflows/geometry/registered-source.ts";
import { jointRecord } from "../../../features/joint-fit/model.ts";
import { readSampledRecipe } from "../../../features/sampled-prior/model.ts";
import { readCompilerResult } from "../../../features/compiler/result.ts";
import { readCompilerRequest } from "../../../features/compiler/model.ts";
import {
  readCompilerBakeResult,
  type CompilerPin,
} from "@cssearth/volume-core/contracts/compiler-bake";
import { loadCompilerImages } from "../../../server/workflows/compiler/images.ts";
import { decodeFits } from "../fits.ts";
import {
  sampledPointColors,
  prepareSampledMaterial,
  type SampledColor,
} from "@cssearth/volume-core/materials/sampled";
import { prepareSampledField } from "@cssearth/volume-core/fields/sampled";
import {
  gridDiffuse,
  type DiffuseAtom,
} from "@cssearth/nebula-reconstruction/methods/sampled/emission-fit";
import { bakeCompiler } from "../../../server/workflows/compiler/bake.ts";
import { registerComponentBanks } from "../../../server/workflows/sampled-prior/layout.ts";
import { prepareCompilerStarSprites } from "../star-sprites.ts";
const object = (v: unknown): Record<string, unknown> => {
  if (!jointRecord(v)) throw new Error("Invalid compact record");
  return v;
};
const text = (v: unknown): string => {
  if (typeof v !== "string") throw new Error("Invalid compact string");
  return v;
};
const finite = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new Error("Invalid compact number");
  return v;
};
const array = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw new Error("Invalid compact list");
  return v;
};
const triple = (v: unknown): [number, number, number] => {
  const a = array(v).map(finite);
  if (a.length !== 3) throw new Error("Invalid vector");
  return [a[0]!, a[1]!, a[2]!];
};
const pin = (v: unknown): CompilerPin => {
  const p = object(v);
  return { path: text(p.path) };
};
async function pinned(root: string, p: CompilerPin) {
  if (p.path.startsWith("/") || p.path.split("/").includes(".."))
    throw new Error("Invalid compact source path");
  const actual = await realpath(resolve(root, p.path));
  const offset = relative(await realpath(root), actual);
  if (offset === ".." || offset.startsWith("../") || isAbsolute(offset)) throw new Error("Compact pin escapes root");
  return readFile(actual);
}
async function json(root: string, path: string) {
  return JSON.parse(await readFile(resolve(root, path), "utf8")) as unknown;
}
async function save(root: string, path: string, bytes: Buffer) {
  await writeFile(resolve(root, path), bytes);
  return { path, sha256: geometrySha(bytes) };
}
export async function exportCompactSampled(
  root: string,
  sourceResult: string,
  outputDirectory: string,
): Promise<CompilerPin> {
  const result = readCompilerResult(
    await json(root, `.local/nebula-lab/compiler/${sourceResult}/result.json`),
  );
  const method = object(
      JSON.parse((await pinned(root, result.method)).toString()),
    ),
    prior = object(method.sampledPrior);
  const recipe = readSampledRecipe(
    JSON.parse((await pinned(root, pin(prior.recipe))).toString()),
  );
  const compiler = object(method.recipe),
    request = readCompilerRequest(method.request);
  const images = await loadCompilerImages(
    root,
    text(compiler.observationCatalogue),
    request,
    recipe.centerIcrsDegrees,
  );
  const fits = await pinned(root, pin(prior.source)),
    values = decodeFits(fits).values;
  await mkdir(resolve(root, outputDirectory), { recursive: true });
  const particles = await save(
    root,
    `${outputDirectory}/particles.fits.gz`,
    gzipSync(fits, { level: 9 }),
  );
  const model = object(
    JSON.parse((await pinned(root, result.model)).toString()),
  );
  const materials = array(object(method.materials).receipts),
    lenses = [];
  const expected: Record<string, string> = {};
  for (const lens of result.scene.lenses) {
    const volume = object(
      JSON.parse((await pinned(root, lens.volume)).toString()),
    );
    const data = volume;
    const { provenance: _provenance, ...rendered } = data;
    expected[lens.id] = geometrySha(JSON.stringify(rendered));
  }
  for (const image of images.images) {
    const colors =
        recipe.lensComponents[image.id]!.ejecta > 0
          ? sampledPointColors(values, recipe, image)
          : new Float64Array(recipe.source.height * 4),
      bytes = Buffer.alloc(colors.length * 8);
    for (let i = 0; i < colors.length; i++)
      bytes.writeDoubleLE(colors[i]!, i * 8);
    const points = await save(
      root,
      `${outputDirectory}/${image.id}-colors.f64.gz`,
      gzipSync(bytes, { level: 9 }),
    );
    const material = object(
      object(
        materials.find((m) => object(object(m).material).sourceId === image.id),
      ).material,
    );
    const fitPin = array(model.emissionFits).find(
      (f) => object(f).sourceId === image.id,
    );
    const fit = fitPin
      ? (JSON.parse(
          (await pinned(root, pin(object(fitPin).receipt))).toString(),
        ) as unknown)
      : undefined;
    lenses.push({
      id: image.id,
      label: image.label,
      credit: image.credit,
      page: image.page,
      points,
      material,
      fit,
    });
  }
  const bytes = Buffer.from(
    JSON.stringify(
      {
        schema: "cssearth-compact-sampled@1",
        sourceResult,
        recipe,
        particles,
        lenses,
        expected,
        scene: result.scene,
        provenance: {
          model: result.model,
          method: result.method,
          interpretation: result.interpretation,
        },
        interpretation:
          "Original measured XYZ/flux particles; one retained chromaticity per finite emitter and lens; finite diffuse atoms, fitted strengths and materials. No image planes or atlases.",
      },
      null,
      2,
    ) + "\n",
  );
  return save(
    root,
    `${outputDirectory}/model.json.gz`,
    gzipSync(bytes, { level: 9 }),
  );
}
export async function replayCompactSampled(root: string, inputPin: CompilerPin, outputDirectory: string) {
  return replay(root, inputPin, outputDirectory, {
    renderBudget: CSS_COMPILER_RENDER_BUDGET,
    compileVolume: input => compileCssVolume({ ...input, recipe: { anchors: [] } }),
    validateVolume: validatePreparedCssVolume,
    prepareStarSprites: prepareCompilerStarSprites,
    decodeFits,
  });
}
