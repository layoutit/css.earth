import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** Every `.html`/`.css` file under `distDir` (relative, slash-separated), for scanning
 * a real `ASSET_ORIGIN` build without assuming which pages exist. */
async function walk(root: string, dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, full));
    else if (entry.isFile() && /\.(?:html|css)$/u.test(entry.name)) files.push(full);
  }
  return files;
}

export interface SceneReference { path: string; line: number; text: string; }

const CONTEXT_CHARS = 70;

/** Every literal `/scenes/` occurrence remaining in emitted HTML or CSS: with
 * `ASSET_ORIGIN` set, every consumption point should have resolved it away
 * before it reached the page (see `src/renderers/css/rendering/prepared-asset-origin.ts`,
 * `site/asset-origin.mts`). A non-empty result means one was missed.
 * `text` is a short window around the match, not the whole (often minified, multi-megabyte) line. */
export async function findSceneReferences(distDir: string): Promise<SceneReference[]> {
  const files = await walk(distDir, distDir);
  const found: SceneReference[] = [];
  for (const file of files.sort()) {
    const text = await readFile(file, "utf8");
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!;
      let from = 0;
      for (let at = line.indexOf("/scenes/", from); at !== -1; at = line.indexOf("/scenes/", from)) {
        found.push({ path: relative(distDir, file).split(sep).join("/"), line: index + 1,
          text: line.slice(Math.max(0, at - CONTEXT_CHARS), at + CONTEXT_CHARS) });
        from = at + "/scenes/".length;
      }
    }
  }
  return found;
}

function usage(): never {
  process.stderr.write("Usage: node tools/assets/check-asset-origin-scenes.mts <distDir>\n");
  process.exit(2);
}

async function main(argv: readonly string[]) {
  const [distDir] = argv;
  if (!distDir) usage();
  const found = await findSceneReferences(distDir);
  if (found.length) {
    process.stderr.write(`${found.length} literal /scenes/ reference(s) remain under ${distDir} with ASSET_ORIGIN set:\n`);
    for (const entry of found.slice(0, 50)) process.stderr.write(`  ${entry.path}:${entry.line}: ${entry.text}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`No /scenes/ references found under ${distDir}.\n`);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) await main(process.argv.slice(2));
