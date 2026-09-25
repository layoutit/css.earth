import { readCompactPin as pinned } from './io.ts';
/** Replay retained measured samples and emitter colors without fitting or native images. */
import { gunzipSync } from 'node:zlib';
import { hash as geometrySha } from './io.ts';
import { readSampledRecipe } from '../../contracts/sampled-recipe.ts';
import { readCompilerBakeResult, type CompilerPin } from '../../contracts/compiler-bake.ts';
import { prepareSampledMaterial, type SampledColor } from '../../materials/sampled.ts';
import { prepareSampledField } from '../../fields/sampled.ts';
import { gridDiffuse, type DiffuseAtom } from '../../fields/diffuse-atoms.ts';
import { bakeCompiler as bake, type BakeCompilerOptions, type CompilerBakeBackend } from '../compiler/bake.ts';
import { registerComponentBanks as register, type ComponentBankBackend } from '../compiler/component-layout.ts';
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
export interface SampledReplayBackend extends Omit<CompilerBakeBackend, 'compileVolume'>, ComponentBankBackend {
  decodeFits(bytes: Buffer): { values: Float32Array };
}
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
function colors(v: unknown): SampledColor[] {
  return array(v).map((c) => {
    const r = object(c),
      rgb = triple(r.rgb);
    if (typeof r.covered !== "boolean" || rgb.some((n) => n < 0 || n > 1))
      throw new Error("Invalid material color");
    return { rgb, covered: r.covered };
  });
}
type EmissionSampler = BakeCompilerOptions['sampleEmission'];
/** Planning-only envelope: a feature unique to any lens remains represented without summing its brightness into the baked field. */
export function maximumPlanningEmission(samplers: readonly EmissionSampler[]): EmissionSampler {
  if (!samplers.length || samplers.some(sample => typeof sample !== 'function')) throw new TypeError('Planning requires at least one emission sampler.');
  const inputs = [...samplers], value: [number, number, number] = [0, 0, 0];
  return (x, y, z, out) => {
    let maximum = 0;
    for (const sample of inputs) {
      value.fill(NaN); sample(x, y, z, value);
      if (value.some(n => !Number.isFinite(n) || n < 0)) throw new TypeError('Planning components must write finite nonnegative emission.');
      maximum = Math.max(maximum, ...value);
    }
    out.fill(maximum);
  };
}

/** Verified scientific inputs for replay or a separately identified inspection bake. No fitting, source image access or output writes. */
export async function prepareCompactSampledInputs(
  root: string,
  inputPin: CompilerPin,
  backend: Pick<SampledReplayBackend, 'decodeFits'>,
  signal: AbortSignal = new AbortController().signal,
) {
  signal.throwIfAborted();
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
    id = text(m.sourceResult);
  if (id !== original.id) throw new TypeError('Compact source result differs from its retained scene.');
  const fits = gunzipSync(await pinned(root, pin(m.particles)), {
      maxOutputLength: 100_000_000,
    }),
    values = backend.decodeFits(fits).values;
  const prepared = prepareSampledField(values, recipe, signal),
    lensInputs = array(m.lenses).map(object);
  const lensIds = lensInputs.map(lens => text(lens.id));
  if (new Set(lensIds).size !== lensIds.length || lensIds.length !== original.lenses.length ||
      original.lenses.some(lens => !lensIds.includes(lens.id))) throw new TypeError('Compact lenses differ from the retained scene.');
  const expectedInput = object(m.expected), expected: Record<string, string> = {};
  for (const id of lensIds) {
    const digest = expectedInput[id];
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw new TypeError('Missing accepted compact sampled volume hash.');
    expected[id] = digest;
  }
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
    const retained = { pointColors, windColors: colors(material.windColors), atomColors: colors(material.diffuseColors) };
    if (retained.windColors.length !== recipe.terms.length || retained.atomColors.length !== atoms.length)
      throw new TypeError('Retained material colors differ from sampled components.');
    const prepareMaterial = () => prepareSampledMaterial(
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
      retained,
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
      prepareMaterial,
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
  const lenses = [];
  for (const input of lensInputs) lenses.push(input === reference ? ref : await load(input));
  const sources = lensInputs.map(l => ({ id: text(l.id), label: text(l.label), credit: text(l.credit), page: text(l.page) }));
  return { id, original, recipe, neutralField, lenses, sources, expected,
    samplePlanningEmission: maximumPlanningEmission([neutralField.sampleEmission, ...lenses.map(lens => lens.field.sampleEmission)]) };
}

export async function replayCompactSampled(root: string, inputPin: CompilerPin, outputDirectory: string, backend: SampledReplayBackend) {
  const bakeCompiler = (options: BakeCompilerOptions) => bake(options, backend);
  const prepareCompilerStarSprites = backend.prepareStarSprites, signal = new AbortController().signal;
  const input = await prepareCompactSampledInputs(root, inputPin, backend, signal);
  const { id, original, neutralField, expected, sources } = input;
  const base = {
    root,
    id,
    fieldIdentity: original.fieldIdentity,
    sampling: original.sampling,
    historicalReplay: original.sampling.renderBudget === undefined,
    reservedStars: original.stars.length,
    preparedPhysical: original.frame.referenceFrame === 'lab-sky-west-north-toward',
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
  for (const l of input.lenses) {
    signal.throwIfAborted();
    const painter = l.prepareMaterial();
    const bank = await bakeCompiler({
      ...base,
      outputDirectory: `${outputDirectory}/${l.sourceId}`,
      sampleEmission: l.field.sampleEmission,
      lenses: [
        {
          id: l.sourceId,
          label: l.label,
          sampleMaterial: painter.sampleMaterial,
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
  const registered = await register(
    root,
    `${outputDirectory}/registered`,
    neutral,
    lenses,
    signal,
    pin => pinned(root, pin),
    backend,
  );
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
    sources,
  };
}
