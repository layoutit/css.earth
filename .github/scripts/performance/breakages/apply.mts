/** Apply exact adversarial edits only to an explicitly marked, named throwaway copy, refusing symlink escapes. */
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, basename, sep } from 'node:path';
import { args, array, record, string } from '../../build-compare/records.mts';
const options = args(['--copy', '--patch']);
if (!options.get('--copy') || !options.get('--patch')) throw new Error('Required --copy <l7a-throwaway-name> --patch <json>');
const root = await realpath(options.get('--copy')!);
if (!basename(root).startsWith('l7a-throwaway-') || (await readFile(resolve(root, '.performance-throwaway'), 'utf8')).trim() !== 'L7A DISPOSABLE COPY') throw new Error('Refusing unmarked/nonthrowaway target');
const patch = record(JSON.parse(await readFile(options.get('--patch')!, 'utf8')));
const edits = array(patch.edits).map(raw => { const edit = record(raw); return { file: string(edit.file), before: string(edit.before), after: string(edit.after) }; });
const writes: { file: string; content: string }[] = [];
for (const edit of edits) {
  if (!['site/layouts/ObjectLayout.astro', 'site/browser/import-queue.mts', 'site/directory/startup-requests.mts', 'astro.config.mts', 'index.html'].includes(edit.file)) throw new Error('Unexpected patch target');
  const file = resolve(root, edit.file), real = await realpath(file);
  if (!real.startsWith(root + sep) || (await lstat(file)).isSymbolicLink()) throw new Error('Refusing symlink/outside copy');
  const content = await readFile(file, 'utf8');
  if (!edit.before || content.split(edit.before).length !== 2) throw new Error(`Expected one exact patch match: ${edit.file}`);
  writes.push({ file, content: content.replace(edit.before, edit.after) });
}
for (const write of writes) await writeFile(write.file, write.content);
console.log(`Applied ${writes.length} throwaway edits`);
