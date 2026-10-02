import { readCompactSampled, decodeCompactPointColors } from '@cssearth/objects';
import { readCompactPin as pinned } from './io.ts';
/** Replay retained measured samples and emitter colors without fitting or native images. */
import { gunzipSync } from 'node:zlib';
import { readCompilerBakeResult, type CompilerPin } from '@cssearth/objects';
import { prepareSampledMaterial } from '../../materials/sampled.ts';
import { prepareSampledField } from '../../fields/sampled.ts';
import { gridDiffuse } from '../../fields/diffuse-atoms.ts';
import { bakeCompiler as bake, type BakeCompilerOptions, type CompilerBakeBackend } from '../compiler/bake.ts';
import { registerComponentBanks as register, type ComponentBankBackend } from '../compiler/component-layout.ts';
export interface SampledReplayBackend extends Omit<CompilerBakeBackend, 'compileVolume'>, ComponentBankBackend {
  decodeFits(bytes: Buffer): { values: Float32Array };
}
type EmissionSampler = BakeCompilerOptions['sampleEmission'];
/** Planning-only envelope: a feature unique to any dataset remains represented without summing its brightness into the baked field. */
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
  const m = readCompactSampled(JSON.parse(gunzipSync(await pinned(root, inputPin), { maxOutputLength: 10_000_000 }).toString()));
  const { recipe, original, id } = m;
  const fits = gunzipSync(await pinned(root, m.particles), {
      maxOutputLength: 100_000_000,
    }),
    values = backend.decodeFits(fits).values;
  const prepared = prepareSampledField(values, recipe, signal),
    datasetInputs = m.datasets;
  const load = async (l: typeof datasetInputs[number]) => {
    const sourceId = l.id, weights = recipe.datasetComponents[sourceId];
    if (!weights) throw new Error("Unknown compact dataset");
    const { material, fit } = l, atoms = fit?.atoms ?? [], coefficients = fit?.coefficients ?? [];
    const diffuse = fit ? gridDiffuse(prepared, atoms, coefficients, signal) : undefined;
    const b = gunzipSync(await pinned(root, l.points), {
      maxOutputLength: recipe.source.height * 32,
    });
    const pointColors = decodeCompactPointColors(b, recipe.source.height);
    const fitData =
      fit && diffuse
        ? { atoms, coefficients, ejectaGain: fit.ejectaGain, diffuse }
        : undefined;
    const retained = { pointColors, windColors: material.windColors, atomColors: material.diffuseColors };
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
      label: l.label,
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
  const referenceId = original.datasets[0]!.id,
    reference = datasetInputs.find((l) => l.id === referenceId);
  if (!reference) throw new Error("Missing reference dataset");
  const referenceFit =
    reference.fit;
  const ref = await load(reference);
  const neutralField = referenceFit
    ? prepared.field(
        { ejecta: referenceFit.ejectaGain, pwn: 1 },
        1,
        gridDiffuse(
          prepared,
          referenceFit.atoms,
          referenceFit.coefficients,
        ),
      )
    : prepared.field({ ejecta: 1, pwn: 1 });
  const datasets = [];
  for (const input of datasetInputs) datasets.push(input === reference ? ref : await load(input));
  const sources = datasetInputs.map(l => ({ id: l.id, label: l.label, credit: l.credit, page: l.page }));
  return { id, original, recipe, neutralField, datasets, sources,
    samplePlanningEmission: maximumPlanningEmission([neutralField.sampleEmission, ...datasets.map(dataset => dataset.field.sampleEmission)]) };
}

export async function replayCompactSampled(root: string, inputPin: CompilerPin, outputDirectory: string, backend: SampledReplayBackend) {
  const bakeCompiler = (options: BakeCompilerOptions) => bake(options, backend);
  const prepareCompilerStarSprites = backend.prepareStarSprites, signal = new AbortController().signal;
  const input = await prepareCompactSampledInputs(root, inputPin, backend, signal);
  const { id, original, neutralField, sources } = input;
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
    datasets: [
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
  const datasets = [];
  for (const l of input.datasets) {
    signal.throwIfAborted();
    const painter = l.prepareMaterial();
    const bank = await bakeCompiler({
      ...base,
      outputDirectory: `${outputDirectory}/${l.sourceId}`,
      sampleEmission: l.field.sampleEmission,
      datasets: [
        {
          id: l.sourceId,
          label: l.label,
          sampleMaterial: painter.sampleMaterial,
        },
      ],
    });
    datasets.push(...bank.datasets);
  }
  const registered = await register(
    root,
    `${outputDirectory}/registered`,
    neutral,
    datasets,
    signal,
    pin => pinned(root, pin),
    backend,
  );
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
