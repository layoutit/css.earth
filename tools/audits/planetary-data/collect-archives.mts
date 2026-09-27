import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { array, object, string, number, batch } from "./collect/client.mts";
import { screen } from "./collect/archive-review.mts";
const dir = resolve(process.env.ARCHIVE_WORK_DIR ?? "output/archive-refresh");
const mode = process.argv[2];
if (mode !== "umd" && mode !== "darts") throw Error("Expected umd or darts");
await mkdir(dir + "/cache", { recursive: true });
function clean(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(
      /&#(?:x([0-9a-f]+)|(\d+));/gi,
      (_, h: string | undefined, d: string | undefined) =>
        String.fromCodePoint(parseInt(h ?? d ?? "0", h ? 16 : 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
function links(html: string, url: string): { url: string; text: string }[] {
  return [
    ...html
      .replace(/<!--[\s\S]*?-->/g, "")
      .matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ].flatMap((m) => {
    const target = new URL(m[1].replaceAll("&amp;", "&"), url);
    target.hash = "";
    return /^https?:$/.test(target.protocol)
      ? [{ url: target.href, text: clean(m[2]) }]
      : [];
  });
}
type Page = { url: string; retrievedAt: string; status: number; html: string };
async function page(url: string): Promise<Page> {
  const path =
    dir + "/cache/" + createHash("sha256").update(url).digest("hex") + ".json";
  try {
    const r = object(JSON.parse(await readFile(path, "utf8")));
    if (r.url !== url) throw Error("Cache URL mismatch");
    return {
      url,
      retrievedAt: string(r.retrievedAt),
      status: number(r.status),
      html: string(r.html),
    };
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  const p = {
    url,
    retrievedAt: new Date().toISOString(),
    status: response.status,
    html: await response.text(),
  };
  await writeFile(path, JSON.stringify(p));
  return p;
}
async function save(name: string, value: unknown): Promise<void> {
  await writeFile(
    dir + "/" + name + ".json",
    JSON.stringify(value, null, 2) + "\n",
  );
}
if (mode === "darts") {
  const rows: Record<string, unknown>[] = [];
  for (const kind of ["datasets", "collections"]) {
    const url = "https://data.darts.isas.jaxa.jp/pub/metadata/" + kind + "/";
    const listing = await page(url);
    if (listing.status !== 200)
      throw Error("HTTP " + listing.status + " " + url);
    const files = [
      ...new Set(
        links(listing.html, url)
          .filter((r) => r.url.startsWith(url) && r.url.endsWith(".jsonld"))
          .map((r) => r.url),
      ),
    ].sort();
    await batch(
      files,
      async (url) => {
        const p = await page(url);
        if (p.status !== 200) throw Error("HTTP " + p.status + " " + url);
        const metadata = object(JSON.parse(p.html));
        string(metadata["@id"]);
        string(metadata["@type"]);
        rows.push({ kind, url, retrievedAt: p.retrievedAt, metadata });
      },
      4,
    );
  }
  rows.sort((a, b) => string(a.url).localeCompare(string(b.url)));
  await save("darts", rows);
  console.log(rows.length, "metadata documents");
} else {
  const base = "https://pdssbn.astro.umd.edu";
  let queue = ["by_mission.shtml", "by_target.shtml", "by_datatype.shtml"].map(
    (p) => base + "/data_sb/" + p,
  );
  const seen = new Set<string>(),
    descriptions = new Map<
      string,
      { url: string; title: string; listedBy: string[] }
    >();
  const indexPages: Record<string, unknown>[] = [];
  while (queue.length) {
    const next = new Set<string>();
    await batch(
      queue,
      async (url) => {
        if (seen.has(url)) return;
        seen.add(url);
        const p = await page(url),
          refs = p.status === 200 ? links(p.html, url) : [];
        indexPages.push({
          url,
          status: p.status,
          retrievedAt: p.retrievedAt,
          links: refs.filter((r) => /\/holdings\/|\/data_sb\//.test(r.url)),
        });
        for (const l of refs) {
          if (
            l.url.startsWith(base + "/holdings/") &&
            /dataset\.(shtml|html)$/.test(l.url)
          ) {
            const r = descriptions.get(l.url) ?? {
              url: l.url,
              title: l.text,
              listedBy: [],
            };
            if (!r.listedBy.includes(url)) r.listedBy.push(url);
            descriptions.set(l.url, r);
          } else if (
            l.url.startsWith(base + "/data_sb/") &&
            /\.(shtml|html)$/.test(l.url) &&
            !seen.has(l.url)
          )
            next.add(l.url);
        }
      },
      4,
    );
    if (seen.size > 500) throw Error("Unexpected catalogue index expansion");
    queue = [...next].sort();
  }
  const listing = await page(base + "/holdings/");
  if (listing.status !== 200)
    throw Error("Holdings inventory HTTP " + listing.status);
  const holdings = [
    ...new Set(
      links(listing.html, listing.url)
        .filter((l) =>
          /^https:\/\/pdssbn\.astro\.umd\.edu\/holdings\/[^/?]+\/$/.test(l.url),
        )
        .map((l) => l.url),
    ),
  ].sort();
  await save("umd-index", {
    indexPages,
    holdings,
    holdingsRetrievedAt: listing.retrievedAt,
    descriptions: [...descriptions.values()],
  });
  const rows: Record<string, unknown>[] = [];
  await batch(
    [...descriptions.values()],
    async (item) => {
      const p = await page(item.url),
        start = p.html.search(/id="center(?:wide|col|only)"/);
      const main = (start >= 0 ? p.html.slice(start) : p.html)
        .split(
          "<!-- ################################################ FOOTER",
        )[0]
        .replace(/<!--[\s\S]*?-->/g, "");
      const title = clean(
        main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? item.title,
      );
      const facts: Record<string, string> = {};
      for (const m of main.matchAll(
        /<p\b[^>]*>\s*<b>([^<]+)<\/b>([\s\S]*?)<\/p>/gi,
      ))
        facts[clean(m[1]).replace(/:$/, "")] = clean(m[2]);
      const fields = [...main.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
        .map((m) =>
          [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
            clean(c[1]),
          ),
        )
        .filter((c) => c.length >= 2);
      rows.push({
        ...item,
        status: p.status,
        retrievedAt: p.retrievedAt,
        pageTitle: title,
        facts,
        fields,
        links: links(main, item.url).filter((l) => l.url !== item.url),
        suggestedScreen: screen(item.url, title, ""),
      });
    },
    4,
  );
  rows.sort((a, b) => string(a.url).localeCompare(string(b.url)));
  await save("umd-descriptions", rows);
  console.log(
    holdings.length,
    "holdings;",
    rows.length,
    "descriptions;",
    rows.filter((r) => r.status !== 200).length,
    "non-200 descriptions",
  );
}
// Collection writes only ignored scratch output. Review metadata and decisions before a SQLite transaction.
