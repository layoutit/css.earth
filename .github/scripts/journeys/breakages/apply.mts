/** Apply one validated deliberate breakage exclusively to an explicitly named throwaway copy. */
import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, basename, dirname, relative, resolve } from 'node:path';

interface Substitution { file: string; before: string; after: string; occurrences: number }
interface Breakage { schema: 'journey-breakage@1'; id: string; description: string; expectedFamilies: string[]; journeys: string[]; profiles: string[]; substitutions: Substitution[]; limitation: string }
const ids = ['dropped-listener', 'changed-transform', 'duplicate-fetch', 'transient-detach', 'dependent-order', 'reduced-motion', 'webkit-path'];
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected an object');
  return Object.fromEntries(Object.entries(input));
}
function fields(value: Record<string, unknown>, required: string[]) {
  if (Object.keys(value).some(key => !required.includes(key)) || required.some(key => !Object.hasOwn(value, key))) throw new TypeError('Unexpected or missing specification field');
}
function string(input: unknown): string {
  if (typeof input !== 'string' || !input.length) throw new TypeError('Expected a nonempty string');
  return input;
}
function strings(input: unknown): string[] {
  if (!Array.isArray(input) || !input.length) throw new TypeError('Expected a nonempty list');
  return input.map(string);
}
function parse(input: unknown): Breakage {
  const value = record(input);
  fields(value, ['schema', 'id', 'description', 'expectedFamilies', 'journeys', 'profiles', 'substitutions', 'limitation']);
  if (value.schema !== 'journey-breakage@1') throw new TypeError('Unknown breakage schema');
  const id = string(value.id);
  if (!ids.includes(id)) throw new TypeError('Unknown breakage id');
  if (!Array.isArray(value.substitutions) || !value.substitutions.length) throw new TypeError('Expected substitutions');
  const substitutions = value.substitutions.map(input => {
    const row = record(input); fields(row, ['file', 'before', 'after', 'occurrences']);
    const file = string(row.file), before = string(row.before);
    if (!/^site\/[a-zA-Z0-9_./-]+\.(?:mts|astro)$/u.test(file) || file.split('/').includes('..')) throw new TypeError('Target must be a site source');
    if (typeof row.after !== 'string' || row.after === before) throw new TypeError('Expected a changed replacement');
    if (typeof row.occurrences !== 'number' || !Number.isSafeInteger(row.occurrences) || row.occurrences < 1) throw new TypeError('Expected a positive occurrence count');
    return { file, before, after: row.after, occurrences: row.occurrences };
  });
  const expectedFamilies = strings(value.expectedFamilies);
  if (expectedFamilies.some(family => !['network', 'dom', 'rendering', 'content', 'errors'].includes(family))) throw new TypeError('Unknown observation family');
  return { schema: 'journey-breakage@1', id, description: string(value.description), expectedFamilies,
    journeys: strings(value.journeys), profiles: strings(value.profiles), substitutions, limitation: string(value.limitation) };
}
export async function apply(copy: string, id: string, dryRun = false) {
  if (!isAbsolute(copy)) throw new TypeError('--copy must be an absolute path');
  const root = await realpath(copy);
  const source = await realpath(process.cwd());
  if (dirname(root) !== dirname(source) || !basename(root).startsWith(basename(source) + '-')
    || !/^[A-Za-z0-9_-]+$/u.test(basename(root).slice(basename(source).length + 1)))
    throw new Error('Refusing a target that is not a named throwaway sibling of cwd');
  if (!ids.includes(id)) throw new TypeError('Unknown breakage id');
  const input: unknown = JSON.parse(await readFile(resolve(import.meta.dirname, `${id}.json`), 'utf8'));
  const spec = parse(input);
  if (spec.id !== id) throw new Error('Specification identity differs from requested id');
  const pending = new Map<string, string>();
  for (const substitution of spec.substitutions) {
    const file = await realpath(resolve(root, substitution.file)), path = relative(root, file);
    if (path === '..' || path.startsWith('../') || isAbsolute(path) || !path.startsWith('site/')) throw new Error('Source symlink escapes throwaway copy');
    const metadata = await stat(file);
    if (!metadata.isFile() || metadata.nlink !== 1) throw new Error('Source must be a plain, unshared file in the throwaway copy');
    const source = pending.get(file) ?? await readFile(file, 'utf8');
    if (substitution.after.length > 0 && source.includes(substitution.after))
      throw new Error(`${substitution.file}: replacement already present; refusing source drift.`);
    const count = source.split(substitution.before).length - 1;
    if (count !== substitution.occurrences) throw new Error(`${substitution.file}: expected ${substitution.occurrences} exact occurrences; found ${count}. Refusing source drift.`);
    pending.set(file, source.split(substitution.before).join(substitution.after));
  }
  // Validate every substitution before the first write; an unmatched later patch leaves the copy unchanged.
  if (!dryRun) for (const [file, contents] of pending) await writeFile(file, contents);
  console.log(`${dryRun ? 'VALIDATED' : 'APPLIED'} ${spec.id}: ${pending.size} source files; expected ${spec.expectedFamilies.join(', ')}`);
  return spec;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    const args = process.argv.slice(2);
    if (args.length < 4 || args.length > 5 || args[0] !== '--copy' || args[2] !== '--breakage' || (args[4] !== undefined && args[4] !== '--dry-run')) throw new Error('Usage: node apply.mts --copy <permitted absolute copy> --breakage <id> [--dry-run]');
    await apply(string(args[1]), string(args[3]), args[4] === '--dry-run');
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
}
