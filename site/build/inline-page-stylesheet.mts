import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const STYLESHEET_LINK = /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)">/gu;

/** `html` with each linked build stylesheet written in its place. A stylesheet link blocks the first paint on a second
 * request: inline, Earth painted at 292 ms against 768 ms linked, on a 1.6 Mbps, 150 ms link (2026-10-02). */
export async function inlineStylesheetLinks(html: string, read: (href: string) => Promise<string>): Promise<string> {
  const sheets = new Map<string, string>();
  for (const [, href] of html.matchAll(STYLESHEET_LINK)) if (!sheets.has(href!)) sheets.set(href!, await read(href!));
  return html.replace(STYLESHEET_LINK, (_link, href: string) => `<style>${sheets.get(href)!}</style>`);
}

/** Inlines the stylesheet of every page a reader opens. The fragments a flight fetches (`/navigation/<id>/`,
 * `/system-bodies-fragment/<id>/`) keep their link: the open page already has the sheet, and a fragment that carried it
 * would send it again on every flight. Astro's `build.inlineStylesheets` decides per stylesheet, not per page. */
export async function inlinePageStylesheets(dist: string): Promise<number> {
  const cache = new Map<string, Promise<string>>();
  const read = (href: string) => cache.get(href) ?? cache.set(href, readFile(join(dist, href), 'utf8')).get(href)!;
  const pages = ['index.html', ...(await readdir(dist, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && !['navigation', 'system-bodies-fragment', '_astro'].includes(entry.name))
    .map(entry => join(entry.name, 'index.html'))];
  let inlined = 0;
  await Promise.all(pages.map(async page => {
    const file = join(dist, page), html = await readFile(file, 'utf8').catch(() => null);
    if (html === null) return;
    const next = await inlineStylesheetLinks(html, read);
    if (next !== html) { await writeFile(file, next); inlined++; }
  }));
  return inlined;
}
