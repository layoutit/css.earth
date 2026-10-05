// Entry script: node .github/scripts/checks/check-no-variables.mts
/**
 * What the page draws a body with names no CSS custom property. A value goes on the element that draws it, as a
 * literal: the body stylesheets, the sky layer's and the renderer's set and read none, and the renderer writes none. The
 * prepared runtimes are held to the same by `requireShippedRuntime` where they are pinned and mounted
 * (packages/objects/src/prepared-data/runtime-validation/shipped-runtime.ts).
 *
 * The bake's working form does name custom properties, inside its own headless measurement
 * (packages/bake/src/presentation/*-records.ts); it is not checked here. The shell's stylesheets (site/shell, site/layouts/site.css,
 * site/object-shell.css) keep their design tokens: they style the interface, not a body.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The stylesheets a body is drawn with: each body's own, the sky layer's, and the renderer's. */
const STYLESHEETS = /^(?:src\/renderers\/css\/styles\/.*|src\/styles\/.*|site\/layouts\/cubic-sky|packages\/renderer\/src\/styles\/[^/]+)\.css$/u;
/** The renderer's sources, without its tests and fixtures. */
const RENDERER = /^packages\/renderer\/src\/(?!.*\.test\.m?ts$).*\.ts$/u;
/** Two values that belong to the shell: the label font its stylesheet defines, and the sequence player's hold, which its
 * stylesheet animates with. Each is named once, in the file listed. */
const KEPT: Readonly<Record<string, RegExp>> = {
  'packages/renderer/src/styles/world-context.css': /var\(--shell-font-label,/gu,
  'packages/renderer/src/rendering/object-control-binding.ts': /'--sequence-hold'/gu,
};

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//gu, comment => comment.replace(/[^\n]/gu, ' '));
/** Each line of a stylesheet that sets or reads a custom property, as `path:line: excerpt`. */
export function stylesheetVariables(path: string, text: string): string[] {
  const kept = KEPT[path], found: string[] = [];
  withoutComments(text).split('\n').forEach((line, index) => {
    const rest = kept ? line.replace(kept, '') : line;
    if (/\bvar\(/u.test(rest) || /(?:^|[{;\s])--[a-zA-Z_][\w-]*\s*:/u.test(rest)) found.push(`${path}:${index + 1}: ${line.trim().slice(0, 160)}`);
  });
  return found;
}
/** Each line of a renderer source that names a custom property in a string or reads one through `var()`. */
export function sourceVariables(path: string, text: string): string[] {
  const kept = KEPT[path], found: string[] = [];
  withoutComments(text).split('\n').forEach((line, index) => {
    const code = (kept ? line.replace(kept, '') : line).replace(/\/\/.*$/u, '');
    if (/['"`]--[a-zA-Z_]/u.test(code) || /\bvar\(\s*--/u.test(code)) found.push(`${path}:${index + 1}: ${line.trim().slice(0, 160)}`);
  });
  return found;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 }).split('\0').filter(Boolean);
  const sheets = tracked.filter(path => STYLESHEETS.test(path)), sources = tracked.filter(path => RENDERER.test(path));
  const read = (path: string) => { try { return readFileSync(resolve(root, path), 'utf8'); } catch { return ''; } };
  const found = [...sheets.flatMap(path => stylesheetVariables(path, read(path))), ...sources.flatMap(path => sourceVariables(path, read(path)))];
  if (found.length) {
    console.error(`${found.length} place(s) set, read or write a CSS custom property where a body is drawn. Write the value on the element ` +
      `that draws it (docs/surface-preparation.md):\n${found.slice(0, 200).join('\n')}` + (found.length > 200 ? `\n… and ${found.length - 200} more` : ''));
    process.exit(1);
  }
  console.log(`No custom property in ${sheets.length} stylesheets and ${sources.length} renderer sources.`);
}
