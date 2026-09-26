import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A `tools/prepare` library is imported, never run: its command is the entry script of the same name in
 * `tools/prepare/cli/`. Run directly, a library would otherwise exit 0 having done nothing. Importing stays silent,
 * and so does a bundle that inlines the library (its `import.meta` is the bundle's, outside `tools/prepare`). */
export function refuseDirectRun(meta: ImportMeta): void {
  if (!meta.main) return;
  const file = fileURLToPath(meta.url);
  if (!/[/\\]tools[/\\]prepare[/\\][^/\\]+\.mts$/u.test(file)) return;
  console.error(`${basename(file)} is a library. Run node tools/prepare/cli/${basename(file)} instead.`);
  process.exit(1);
}
