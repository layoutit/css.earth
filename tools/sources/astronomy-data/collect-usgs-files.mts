// List the files each USGS Astrogeology (Astropedia) product in the ledger actually offers, from its own product page.
//
//   USGS_WORK_DIR=output/usgs-files node tools/sources/astronomy-data/collect-usgs-files.mts
//
// The first USGS screen recorded "No TIFF evidence found" without reading each product. An Astropedia product page links
// every resource it serves (CKAN downloads under /ckan/dataset/<id>/resource/, and external files such as planetarynames
// PDFs), so the page is read and each link kept with its file type. A georeferenced raster is a GeoTIFF, ISIS cube, PDS
// image or JPEG 2000; browse, thumbnail and full-size JPEGs and PNGs are previews. Collection writes only scratch output.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { batch, string } from "./collect/client.mts";
import { databasePath } from "./model.mts";

const dir = resolve(process.env.USGS_WORK_DIR ?? "output/usgs-files");
await mkdir(dir + "/cache", { recursive: true });
export const RASTER = /\.(tif|tiff|cub|img|jp2)$/i;
export const PREVIEW = /(^|\/)(browse|thumb|full)[^/]*\.(jpg|jpeg|png|gif)$/i;

async function page(url: string): Promise<string> {
  const path = `${dir}/cache/${createHash("sha256").update(url).digest("hex")}.html`;
  try { return await readFile(path, "utf8"); } catch (e) { if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e; }
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw Error(`HTTP ${r.status} ${url}`);
      const html = await r.text();
      await writeFile(path, html);
      return html;
    } catch (e) { last = e; await new Promise((done) => setTimeout(done, 2000 * (attempt + 1))); }
  }
  throw last;
}
export function productFiles(html: string): { url: string; name: string; kind: "raster" | "preview" | "document" | "other" }[] {
  const urls = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"))
    .filter((u) => /\/ckan\/dataset\/[^/]+\/resource\/|planetarymaps\.usgs\.gov|planetarynames\.wr\.usgs\.gov\/images|pubs\.usgs\.gov\/.+\.(pdf|zip)$/i.test(u));
  return [...new Set(urls)].map((url) => {
    const name = decodeURIComponent(url.split("?")[0]!.split("/").pop() ?? "");
    const kind = RASTER.test(name) ? "raster" : PREVIEW.test(name) || /\.(jpg|jpeg|png|gif)$/i.test(name) ? "preview"
      : /\.(pdf|zip|txt|xml|lbl|shp|kmz|kml)$/i.test(name) ? "document" : "other";
    return { url, name, kind };
  });
}

const db = new DatabaseSync(databasePath, { readOnly: true });
const rows = db.prepare("SELECT id, url FROM datasets WHERE source='usgs' ORDER BY id").all().map((r) => ({ id: string(r.id), url: string(r.url) }));
db.close();
/** A collection page (a mission's or map series' landing page) links member products instead of serving files. */
export function memberProducts(html: string, self: string): string[] {
  return [...new Set([...html.matchAll(/href="(?:https:\/\/astrogeology\.usgs\.gov)?\/search\/map\/([^"/?#]+)"/g)].map((m) => m[1]!.trim()))].filter((id) => id !== self).sort();
}
const out: Record<string, ReturnType<typeof productFiles>> = {}, members: Record<string, string[]> = {};
let done = 0;
await batch(rows, async (row) => {
  const html = await page(row.url);
  out[row.id] = productFiles(html);
  if (!out[row.id]!.length) members[row.id] = memberProducts(html, row.id);
  if (++done % 200 === 0) console.log(`[${done}/${rows.length}] product pages read`);
}, 3);
await writeFile(`${dir}/usgs-files.json`, JSON.stringify({ retrievedAt: new Date().toISOString(), products: out, collections: members }, null, 1) + "\n");
const withRaster = Object.values(out).filter((files) => files.some((f) => f.kind === "raster")).length;
console.log(`${rows.length} products read; ${withRaster} offer a georeferenced raster; written to ${dir}/usgs-files.json`);
// Collection writes only ignored scratch output. Review before a SQLite transaction.
