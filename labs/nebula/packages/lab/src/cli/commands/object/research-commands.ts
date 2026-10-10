/** The Research and Model object commands an agent runs through `labs/nebula/run.mts`: `research <id>|--all`,
 * `model <id> --method <m>` and `stars <id>`. Each writes its progress to the object's `.local/lab/progress.jsonl`. */
import { configuredLabObjects, labObject, type LabObject } from '../../../server/workflows/lab-objects.ts';
import { withProgress } from '../../../server/workflows/plates/progress.ts';
import { buildResearch, readSourceIndex, researchPath, writeResearch } from '../../../server/workflows/research/research.ts';
import { readModelMethod, runModel } from '../../../server/workflows/model/run-model.ts';
import { modelPath } from '../../../server/workflows/model/model-output.ts';
import { fetchObjectStars } from '../../../server/workflows/stars/object-stars.ts';

const root = process.cwd();
/** The site nebulae: each subject's own object, and a second object of a nebula when it is made another way (M1's plates). */
function siteObjects(): LabObject[] {
  const objects = configuredLabObjects(root), bySubject = new Map(objects.map(item => [item.subject, item]));
  return objects.filter(item => !item.parent || bySubject.get(item.parent)?.kind !== item.kind);
}
export async function research(args: string[]) {
  const usage = 'research <id> | research --all';
  const targets = args.length === 1 && args[0] === '--all' ? siteObjects() : args.length === 1 ? [labObject(root, args[0], usage)] : (() => { throw new TypeError(`Usage: ${usage}`); })();
  let index: Awaited<ReturnType<typeof readSourceIndex>> | null = null;
  for (const object of targets) {
    const record = await withProgress(root, object.id, 'research', async stage => {
      if (!index) { stage('Indexing src/sources records', .1); index = await readSourceIndex(root); }
      stage('Reading README, sources, recipe and method', .5);
      const built = await buildResearch(root, object, index);
      stage('Writing source/research.json', .9);
      await writeResearch(root, object, built);
      return built;
    }, value => ({ papers: value.papers.length, models: value.models.length, images: value.images.length, velocity: value.velocity.items.length, method: value.method.chosen }));
    console.log(`${object.id.padEnd(26)} ${String(record.papers.length).padStart(2)} papers · ${record.models.length} models · ${String(record.images.length).padStart(2)} images · velocity ${record.velocity.items.map(item => item.kind).join(',') || 'none'} · ${record.method.chosen} (${record.method.status}) → ${researchPath(root, object).slice(root.length + 1)}`);
  }
}
export async function model(args: string[]) {
  const usage = 'model <id> --method <paper-surfaces|symmetry|kinematic>';
  const object = labObject(root, args[0], usage);
  const rest = args.slice(1), flag = rest.findIndex(arg => arg === '--method' || arg.startsWith('--method='));
  const value = flag < 0 ? undefined : rest[flag]!.includes('=') ? rest[flag]!.slice('--method='.length) : rest[flag + 1];
  if (rest.length !== (flag >= 0 && !rest[flag]!.includes('=') ? 2 : 1)) throw new TypeError(`Usage: ${usage}`);
  const result = await runModel(root, object, readModelMethod(value));
  console.log(`${object.id}: ${result.method} · ${result.outlines.length} outlines · ${result.points.length} points · ${result.surfaces.map(item => item.kind).join(', ')}`);
  for (const [key, metric] of Object.entries(result.metrics)) console.log(`  ${key}: ${metric}`);
  for (const file of result.files) console.log(`  wrote ${file}`);
  for (const note of result.notes) console.log(`  note: ${note}`);
  console.log(`  → ${modelPath(root, object.id, result.method).slice(root.length + 1)}`);
}
export async function stars(args: string[]) {
  const usage = 'stars <id> [--radius-deg=N] [--magnitude-limit=G]';
  const object = labObject(root, args[0], usage), options: { radiusDeg?: number; magnitudeLimit?: number } = {};
  for (const arg of args.slice(1)) {
    const match = /^--(radius-deg|magnitude-limit)=(.+)$/.exec(arg), number = match ? Number(match[2]) : NaN;
    if (!match || !Number.isFinite(number)) throw new TypeError(`Usage: ${usage}`);
    if (match[1] === 'radius-deg') options.radiusDeg = number; else options.magnitudeLimit = number;
  }
  const result = await withProgress(root, object.id, 'stars', stage => fetchObjectStars(root, object, options, stage),
    value => ({ stars: value.stars, radiusDeg: Number(value.radiusDeg.toPrecision(3)) }));
  console.log(`${object.id}: ${result.stars} Gaia stars within ${result.radiusDeg.toFixed(3)}° (G < ${result.magnitudeLimit}${result.truncated ? ', truncated' : ''}) → ${result.path}`);
}
