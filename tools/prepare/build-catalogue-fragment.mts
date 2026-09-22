import { createHash } from "node:crypto";
import { realpathSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every object page inlined the same ~1.65 MB object-browser catalogue.
 * `CatalogueRows.astro` now
 * renders it exactly once, at the `catalogue-fragment` build target; this
 * script runs right after `astro build` to turn that one render into the
 * shared, content-addressed file every page actually ships, following the
 * same convention as `dist/objects/<id>/<sha256>.json`
 * (`site/pages/objects/[id]/[sha256].json.ts`):
 *
 *   1. Hash `dist/catalogue-fragment/index.html` and republish it at
 *      `dist/catalogue/<sha256>.html`. The hash in the path is what makes it
 *      cacheable indefinitely: a change in content always ships a new URL.
 *   2. Delete the generic `dist/catalogue-fragment/` build target: it is not
 *      content-addressed and would just be a second, unreferenced copy.
 *   3. Substitute the `__CATALOGUE_FRAGMENT_SHA__` / `__CATALOGUE_FRAGMENT_BYTES__`
 *      tokens `ObjectResults.astro` left on every object page's
 *      `#object-category-results` panel with the real pin, so the browser and
 *      the no-JS search function (`search-response.mts`) can fetch and verify
 *      the same bytes.
 */

const FRAGMENT_ROUTE = "catalogue-fragment";
const SHA_TOKEN = "__CATALOGUE_FRAGMENT_SHA__";
const BYTES_TOKEN = "__CATALOGUE_FRAGMENT_BYTES__";

async function walkHtml(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

export interface BuildCatalogueFragmentResult {
  sha256: string;
  bytes: number;
  url: string;
  pagesRewritten: number;
}

export async function buildCatalogueFragment(distDir: string): Promise<BuildCatalogueFragmentResult> {
  const fragmentDir = join(distDir, FRAGMENT_ROUTE);
  const fragmentFile = join(fragmentDir, "index.html");
  let content: Buffer;
  try {
    content = await readFile(fragmentFile);
  } catch (error) {
    throw new Error(`Catalogue fragment build target is missing: ${fragmentFile}.`, { cause: error });
  }
  const sha256 = createHash("sha256").update(content).digest("hex");
  const bytes = content.byteLength;
  const url = `/catalogue/${sha256}.html`;
  const catalogueDir = join(distDir, "catalogue");
  await mkdir(catalogueDir, { recursive: true });
  await writeFile(join(catalogueDir, `${sha256}.html`), content);
  await rm(fragmentDir, { recursive: true, force: true });

  const pages = await walkHtml(distDir);
  let pagesRewritten = 0;
  for (const page of pages) {
    const html = await readFile(page, "utf8");
    if (!html.includes(SHA_TOKEN)) continue;
    const rewritten = html.split(SHA_TOKEN).join(sha256).split(BYTES_TOKEN).join(String(bytes));
    await writeFile(page, rewritten, "utf8");
    pagesRewritten++;
  }
  if (pagesRewritten === 0) {
    throw new Error("No page referenced the catalogue fragment token; ObjectResults.astro may have drifted.");
  }
  return { sha256, bytes, url, pagesRewritten };
}

function usage(): never {
  process.stderr.write("Usage:\n  node tools/prepare/build-catalogue-fragment.mts <distDir>\n");
  process.exit(2);
}

async function main(argv: readonly string[]) {
  const [distDir = "dist"] = argv;
  const result = await buildCatalogueFragment(distDir);
  process.stdout.write(
    `Catalogue fragment: ${result.url} (${result.bytes} bytes), referenced by ${result.pagesRewritten} page${result.pagesRewritten === 1 ? "" : "s"}.\n`,
  );
}

const isMain = process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
