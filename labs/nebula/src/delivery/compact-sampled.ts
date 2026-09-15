/** Retained measured particles and per-emitter materials; never stores rendered slices. */
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { geometrySha } from "../reconstruction/geometry/registered-source";
import { jointRecord } from "../reconstruction/joint-fit/model";
import { readSampledRecipe } from "../reconstruction/sampled-prior/model";
import { readCompilerResult } from "../reconstruction/compiler/result";
import { readCompilerRequest } from "../reconstruction/compiler/model";
import {
  readCompilerBakeResult,
  type CompilerPin,
} from "../reconstruction/compiler/bake-types";
import { loadCompilerImages } from "../reconstruction/compiler/images";
import { decodeFits } from "../reconstruction/getsf-fits";
import {
  sampledPointColors,
  prepareSampledMaterial,
  type SampledColor,
} from "../reconstruction/sampled-prior/material";
import { prepareSampledField } from "../reconstruction/sampled-prior/field";
import {
  gridDiffuse,
  type DiffuseAtom,
} from "../reconstruction/sampled-prior/emission-fit";
import { bakeCompiler } from "../reconstruction/compiler/bake";
import { registerComponentBanks } from "../reconstruction/sampled-prior/layout";
import { prepareCompilerStarSprites } from "../reconstruction/compiler/star-sprites";
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
  return { path: text(p.path), sha256: text(p.sha256) };
};
async function pinned(root: string, p: CompilerPin) {
  if (
    !/^[a-f0-9]{64}$/.test(p.sha256) ||
    p.path.startsWith("/") ||
    p.path.split("/").includes("..")
  )
    throw new Error("Invalid compact pin");
  const actual = await realpath(resolve(root, p.path));
  const offset = relative(await realpath(root), actual);
  if (offset === ".." || offset.startsWith("../") || isAbsolute(offset)) throw new Error("Compact pin escapes root");
  const b = await readFile(actual);
  if (geometrySha(b) !== p.sha256) throw new Error("Compact pin differs");
  return b;
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
function colors(v: unknown): SampledColor[] {
  return array(v).map((c) => {
    const r = object(c),
      rgb = triple(r.rgb);
    if (typeof r.covered !== "boolean" || rgb.some((n) => n < 0 || n > 1))
      throw new Error("Invalid material color");
    return { rgb, covered: r.covered };
  });
}
export async function replayCompactSampled(
  root: string,
  inputPin: CompilerPin,
  outputDirectory: string,
) {
  const m = object(
    JSON.parse(
      gunzipSync(await pinned(root, inputPin), {
        maxOutputLength: 10_000_000,
      }).toString(),
    ),
  );
  if (m.schema !== "cssearth-compact-sampled@1")
    throw new Error("Invalid compact sampled model");
  const recipe = readSampledRecipe(m.recipe),
    original = readCompilerBakeResult(m.scene),
    id = text(m.sourceResult),
    signal = new AbortController().signal;
  const fits = gunzipSync(await pinned(root, pin(m.particles)), {
      maxOutputLength: 100_000_000,
    }),
    values = decodeFits(fits).values;
  if (geometrySha(fits) !== recipe.source.sha256) throw new Error("Compact particles differ from the scientific source pin");
  const prepared = prepareSampledField(values, recipe, signal),
    lensInputs = array(m.lenses).map(object);
  const load = async (l: Record<string, unknown>) => {
    const sourceId = text(l.id),
      weights = recipe.lensComponents[sourceId];
    if (!weights) throw new Error("Unknown compact lens");
    const material = object(l.material),
      fit = l.fit === undefined ? undefined : object(l.fit);
    const atoms: DiffuseAtom[] = fit
      ? array(fit.atoms).map((a) => {
          const r = object(a),
            sigmaArcsec = finite(r.sigmaArcsec);
          if (sigmaArcsec <= 0) throw new Error("Invalid atom");
          return { centerArcsec: triple(r.centerArcsec), sigmaArcsec };
        })
      : [];
    const coefficients = fit ? array(fit.coefficients).map(finite) : [],
      diffuse = fit
        ? gridDiffuse(prepared, atoms, coefficients, signal)
        : undefined;
    const b = gunzipSync(await pinned(root, pin(l.points)), {
      maxOutputLength: recipe.source.height * 32,
    });
    if (b.length !== recipe.source.height * 32)
      throw new Error("Point colors size differs");
    const pointColors = new Float64Array(recipe.source.height * 4);
    for (let i = 0; i < pointColors.length; i++) {
      pointColors[i] = b.readDoubleLE(i * 8);
      if (
        !Number.isFinite(pointColors[i]) ||
        pointColors[i]! < 0 ||
        pointColors[i]! > 1 ||
        (i % 4 === 3 && pointColors[i] !== 0 && pointColors[i] !== 1)
      )
        throw new Error("Invalid point color");
    }
    const fitData =
      fit && diffuse
        ? { atoms, coefficients, ejectaGain: finite(fit.ejectaGain), diffuse }
        : undefined;
    const painter = prepareSampledMaterial(
      values,
      recipe,
      prepared,
      {
        id: sourceId,
        sampleRgb() {
          throw new Error("Compact replay must not sample a source image");
        },
      },
      weights,
      fitData,
      signal,
      {
        pointColors,
        windColors: colors(material.windColors),
        atomColors: colors(material.diffuseColors),
      },
    );
    return {
      sourceId,
      label: text(l.label),
      field: fitData
        ? prepared.field(
            { ejecta: weights.ejecta * fitData.ejectaGain, pwn: weights.pwn },
            1,
            diffuse,
          )
        : prepared.field(weights),
      painter,
    };
  };
  const referenceId = original.lenses[0]!.id,
    reference = lensInputs.find((l) => l.id === referenceId);
  if (!reference) throw new Error("Missing reference lens");
  const referenceFit =
    reference.fit === undefined ? undefined : object(reference.fit);
  const ref = await load(reference);
  const neutralField = referenceFit
    ? prepared.field(
        { ejecta: finite(referenceFit.ejectaGain), pwn: 1 },
        1,
        gridDiffuse(
          prepared,
          array(referenceFit.atoms).map((a) => ({
            centerArcsec: triple(object(a).centerArcsec),
            sigmaArcsec: finite(object(a).sigmaArcsec),
          })),
          array(referenceFit.coefficients).map(finite),
        ),
      )
    : prepared.field({ ejecta: 1, pwn: 1 });
  const base = {
    root,
    id,
    fieldIdentity: original.fieldIdentity,
    boundsArcsec: original.boundsArcsec,
    skyBoundsArcsec: original.skyBoundsArcsec,
    signal,
  };
  const neutral = await bakeCompiler({
    ...base,
    outputDirectory: `${outputDirectory}/neutral`,
    sampleEmission: neutralField.sampleEmission,
    lenses: [
      {
        id: "neutral-material",
        label: "Neutral components",
        sampleMaterial(_x, _y, _z, rgb) {
          rgb.fill(255);
          return true;
        },
      },
    ],
  });
  const lenses = [];
  for (const input of lensInputs) {
    const l = input === reference ? ref : await load(input);
    const bank = await bakeCompiler({
      ...base,
      outputDirectory: `${outputDirectory}/${l.sourceId}`,
      sampleEmission: l.field.sampleEmission,
      lenses: [
        {
          id: l.sourceId,
          label: l.label,
          sampleMaterial: l.painter.sampleMaterial,
        },
      ],
    });
    lenses.push(
      ...bank.lenses.map((lens) => ({
        ...lens,
        alphaSha256: bank.alphaSha256,
      })),
    );
  }
  const registered = await registerComponentBanks(
    root,
    `${outputDirectory}/registered`,
    neutral,
    lenses,
    signal,
    pin => pinned(root, pin),
  );
  const expected = object(m.expected);
  for (const lens of registered.lenses) {
    const volume = object(
      JSON.parse((await pinned(root, lens.volume)).toString()),
    );
    const { provenance: _provenance, ...rendered } = volume;
    if (geometrySha(JSON.stringify(rendered)) !== expected[lens.id])
      throw new Error(
        `Compact sampled replay changed accepted ${lens.id} volume`,
      );
  }
  const sprites = await prepareCompilerStarSprites(
    root,
    `${outputDirectory}/stars`,
    original.stars,
  );
  const scene = readCompilerBakeResult({
    ...registered,
    stars: original.stars,
    ...sprites,
  });
  return {
    id,
    scene,
    sources: lensInputs.map((l) => ({
      id: text(l.id),
      label: text(l.label),
      credit: text(l.credit),
      page: text(l.page),
    })),
  };
}
