// Collect NASA Photojournal map candidates from science.nasa.gov's public WordPress API into ignored scratch output.
//
//   PHOTOJOURNAL_WORK_DIR=output/photojournal-refresh node packages/bake/cli/astronomy-data-collect-photojournal.mts
//
// The Photojournal has no "map" category, so an entry is chosen by what it says about itself: a title that names a map,
// mosaic, globe, hemisphere, projection or atlas (plural forms included), or a caption that states a map projection or a
// global map or mosaic. Every chosen entry keeps its downloadable files with their pixel sizes, read from the site's own
// media records, and the caption phrases that chose it. Collection writes only scratch output; review the result and the
// proposed decisions (photojournal-review.ts) before one SQLite transaction (astronomy-data-apply-ledger-fixes.mts).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { array, object, string, batch, checkoutRoot } from "@cssearth/bake/sources/astronomy-data";

const dir = resolve(checkoutRoot, process.env.PHOTOJOURNAL_WORK_DIR ?? "output/photojournal-refresh");
const api = "https://science.nasa.gov/wp-json/wp/v2";
/** The science-org term every Photojournal entry carries. */
const PHOTOJOURNAL = 19791;
export const TITLE_MAP =
  /\b(maps?|mapped|mapping|mosaics?|globes?|global views?|hemispheres?|polar views?|cylindrical|projections?|atlas(?:es)?)\b/i;
export const CAPTION_MAP =
  /simple[- ]cylindrical|cylindrical (?:map )?projection|equirectangular|(?:polar )?stereographic|mercator|orthographic projection|sinusoidal projection|map[- ]projected|(?:global|full[- ]globe) (?:maps?|mosaics?)|polar projection/gi;
/** Caption searches that find entries the title rule misses; each hit is confirmed against CAPTION_MAP on the full text. */
const CAPTION_SEARCHES = ["simple cylindrical", "cylindrical projection", "polar stereographic", "stereographic projection",
  "Mercator", "orthographic projection", "map projection", "map projected", "global mosaic", "global map", "equirectangular"];

await mkdir(dir + "/cache", { recursive: true });

async function get(url: string): Promise<{ body: unknown; pages: number }> {
  const key = createHash("sha256").update(url).digest("hex"), path = `${dir}/cache/${key}.json`;
  try {
    const saved = object(JSON.parse(await readFile(path, "utf8")));
    if (saved.url === url) return { body: saved.body, pages: Number(saved.pages) };
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
  }
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw Error(`HTTP ${r.status} ${url}`);
      const body: unknown = await r.json(), pages = Number(r.headers.get("X-WP-TotalPages") ?? "1");
      await writeFile(path, JSON.stringify({ url, retrievedAt: new Date().toISOString(), pages, body }) + "\n");
      return { body, pages };
    } catch (e) {
      last = e;
      await new Promise((done) => setTimeout(done, 2000 * (attempt + 1)));
    }
  }
  throw last;
}
async function all(path: string): Promise<unknown[]> {
  const first = await get(`${api}/${path}&per_page=100&page=1`), out = [...array(first.body)];
  for (let page = 2; page <= first.pages; page++) out.push(...array((await get(`${api}/${path}&per_page=100&page=${page}`)).body));
  return out;
}
export function captionText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8211;|&ndash;/g, "–")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/\s+/g, " ").trim();
}
export function captionPhrases(text: string): string[] {
  return [...new Set([...text.matchAll(CAPTION_MAP)].map((m) => m[0].toLowerCase()))].sort();
}

const terms = new Map<number, string>();
for (const t of await all("science-org?search=photojournal&_fields=id,slug")) terms.set(Number(object(t).id), string(object(t).slug));
console.log(`${terms.size} Photojournal terms`);
type Entry = { post: number; pia: string; title: string; date: string; page: string; target: string; mission: string; instrument: string; mediaIds: number[] };
const kinds = (ids: number[], kind: string) =>
  ids.map((id) => terms.get(id) ?? "").filter((s) => s.startsWith(`photojournal-${kind}-`)).map((s) => s.slice(`photojournal-${kind}-`.length)).join("; ");
const entries = new Map<number, Entry>();
for (const value of await all(`posts?science-org=${PHOTOJOURNAL}&orderby=id&order=asc&_fields=id,title,date,link,science-org,acf`)) {
  const p = object(value), acf = p.acf && typeof p.acf === "object" ? object(p.acf) : {}, ids = array(p["science-org"]).map(Number);
  const downloads = Array.isArray(acf.downloads) ? acf.downloads.map((d) => Number(object(d).file)).filter(Number.isFinite) : [];
  entries.set(Number(p.id), { post: Number(p.id), pia: typeof acf.pia_number === "string" ? acf.pia_number.trim() : "",
    title: captionText(string(object(p.title).rendered)), date: string(p.date).slice(0, 10), page: string(p.link),
    target: kinds(ids, "target"), mission: kinds(ids, "mission"), instrument: kinds(ids, "instrument"), mediaIds: downloads });
}
console.log(`${entries.size} Photojournal entries`);
const byTitle = new Set([...entries.values()].filter((e) => TITLE_MAP.test(e.title)).map((e) => e.post));
const byCaption = new Set<number>();
for (const phrase of CAPTION_SEARCHES)
  for (const hit of await all(`posts?science-org=${PHOTOJOURNAL}&search=${encodeURIComponent(phrase)}&_fields=id`)) byCaption.add(Number(object(hit).id));
const chosen = [...new Set([...byTitle, ...byCaption])].filter((id) => entries.has(id)).sort((a, b) => a - b);
console.log(`${byTitle.size} chosen by title, ${byCaption.size} caption search hits, ${chosen.length} to read`);
const captions = new Map<number, string[]>(), chunks: number[][] = [];
for (let i = 0; i < chosen.length; i += 100) chunks.push(chosen.slice(i, i + 100));
await batch(chunks, async (chunk) => {
  for (const value of array((await get(`${api}/posts?include=${chunk.join(",")}&per_page=100&_fields=id,content`)).body)) {
    const p = object(value);
    captions.set(Number(p.id), captionPhrases(captionText(string(object(p.content).rendered))));
  }
});
const selected = chosen.filter((id) => byTitle.has(id) || (captions.get(id) ?? []).length > 0).map((id) => entries.get(id)!);
const media = new Map<number, { url: string; mime: string; width: number | null; height: number | null; bytes: number | null }>();
const mediaIds = [...new Set(selected.flatMap((e) => e.mediaIds))], mediaChunks: number[][] = [];
for (let i = 0; i < mediaIds.length; i += 100) mediaChunks.push(mediaIds.slice(i, i + 100));
await batch(mediaChunks, async (chunk) => {
  for (const value of array((await get(`${api}/media?include=${chunk.join(",")}&per_page=100&_fields=id,source_url,mime_type,media_details`)).body)) {
    const m = object(value), details = m.media_details && typeof m.media_details === "object" ? object(m.media_details) : {};
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    media.set(Number(m.id), { url: string(m.source_url), mime: typeof m.mime_type === "string" ? m.mime_type : "",
      width: n(details.width), height: n(details.height), bytes: n(details.filesize) });
  }
});
const out = selected.map((e) => ({ ...e, titleMatch: byTitle.has(e.post), captionPhrases: captions.get(e.post) ?? [],
  files: e.mediaIds.map((id) => media.get(id)).filter((f) => f !== undefined) }));
await writeFile(`${dir}/photojournal-maps.json`, JSON.stringify({ retrievedAt: new Date().toISOString(), catalogue: entries.size,
  titleMatches: byTitle.size, captionSearchHits: byCaption.size, selected: out.length, entries: out }, null, 1) + "\n");
console.log(`${out.length} map entries written to ${dir}/photojournal-maps.json (${out.filter((e) => !e.titleMatch).length} by caption only)`);
// Collection writes only ignored scratch output. Review the entries and their proposed decisions before a SQLite transaction.
