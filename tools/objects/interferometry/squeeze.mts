/** Run the pinned SQUEEZE on one OIFITS file with a recipe, and read back the fit it reports for the image it wrote.
 *
 * SQUEEZE (Baron et al.) writes <output>.fits, the posterior mean over the final `discard` realisations, and prints one line per
 * product: "Output -- <name> Nframes: n Chi2r: x V2: y T3P: z". The line for the unsuffixed name is the written image. When no chain
 * reaches burn-in SQUEEZE still writes the image and says so; that is recorded, not hidden. A file with OI_VIS tables is run with
 * -novis: SQUEEZE otherwise fits their differential visibilities too and a Polaris run took more than half an hour. */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { readChannelRows } from './oifits-rows.mts';
import { toolchainPath } from './toolchain.mts';

export interface SqueezeRecipe {
  /** Pixel size in milliarcseconds and image width in pixels. */
  readonly pixelMas: number; readonly width: number;
  /** Maximum-entropy regularisation multiplier (-en), flux elements (-e), iterations (-n) and the realisations averaged (-d). */
  readonly entropy: number; readonly elements: number; readonly iterations: number; readonly discard: number;
}

export interface SqueezeFit { readonly frames: number; readonly reducedChi2: number; readonly vis2: number; readonly closurePhase: number; readonly burnedIn: boolean }

export function squeezeArguments(input: string, start: string, output: string, recipe: SqueezeRecipe, { novis = false } = {}) {
  return [input, '-s', String(recipe.pixelMas), '-w', String(recipe.width), '-not3amp', ...(novis ? ['-novis'] : []), '-i', start, '-en', String(recipe.entropy),
    '-e', String(recipe.elements), '-n', String(recipe.iterations), '-d', String(recipe.discard), '-chains', '1', '-threads', '1', '-quiet', '-o', output];
}

/** The fit SQUEEZE printed for the image named `output` (without extension). */
export function parseSqueezeFit(log: string, output: string): SqueezeFit {
  const text = log.replaceAll(/\u001b\[[0-9;]*m/gu, '');
  const escaped = output.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = new RegExp(`^Output --\\s+${escaped}\\s+Nframes:\\s*(\\d+)\\s+Chi2r:\\s*([\\d.eE+-]+)\\s+V2:\\s*([\\d.eE+-]+)\\s+T3P:\\s*([\\d.eE+-]+)`, 'mu').exec(text);
  if (!match) throw new Error(`SQUEEZE printed no fit for ${output}.`);
  return { frames: Number(match[1]), reducedChi2: Number(match[2]), vis2: Number(match[3]), closurePhase: Number(match[4]), burnedIn: !/NO CHAIN REACHED BURN IN/u.test(text) };
}

/** Run SQUEEZE in the input's directory; returns the written image and the fit it reported. */
export async function runSqueeze(input: string, start: string, output: string, recipe: SqueezeRecipe) {
  const root = await toolchainPath('squeeze'), directory = dirname(input), name = basename(output, '.fits');
  const novis = readChannelRows(await readFile(input)).vis.length > 0;
  const began = Date.now();
  const run = spawnSync(resolve(root, 'source/bin/squeeze'), squeezeArguments(basename(input), resolve(start), name, recipe, { novis }), { cwd: directory, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const log = `${run.stdout}${run.stderr}`;
  await writeFile(resolve(directory, `${name}.log`), log);
  if (run.status !== 0) throw new Error(`SQUEEZE failed on ${input}; see ${resolve(directory, `${name}.log`)}.`);
  return { image: resolve(directory, `${name}.fits`), fit: parseSqueezeFit(log, name), seconds: Math.round((Date.now() - began) / 1000), novis };
}
