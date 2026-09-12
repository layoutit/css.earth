import { required } from "../../tools/test-values.mts";
import type { ObjectEntry } from "../object-schema.mts";
import type { Page } from 'playwright';
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { OBJECTS } from "../objects.mts";
import { browserObjects } from './browser-objects.mts';
import { assertHomepageReachability } from "./seo-discovery.mts";

// Inspect the supplied server as a crawler without JavaScript. General browser
// conformance owns scene rendering and retained DOM checks at both DPRs.
const origin = "https://css.earth";
const base = (process.argv.slice(2).find(argument => /^https?:\/\//u.test(argument)) ?? "http://127.0.0.1:4210").replace(/\/$/u, "");
const canonicalUrls = OBJECTS.map(({ route }) => origin + route);
const report = [];
const socialImages = new Set<string>();
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ javaScriptEnabled: false });
  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(required(sitemap.headers.get("content-type")), /xml/);
  const xml = await sitemap.text();
  const listed = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("Invalid sitemap XML");
    if (doc.documentElement.namespaceURI !== "http://www.sitemaps.org/schemas/sitemap/0.9") {
      throw new Error("Invalid sitemap namespace");
    }
    return [...doc.querySelectorAll("url > loc")].map((loc) => loc.textContent);
  }, xml);
  assert.deepEqual(listed, canonicalUrls);
  assert.equal(new Set(listed).size, OBJECTS.length);
  const robots = await fetch(`${base}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(required(robots.headers.get("content-type")), /text\/plain/);
  assert.equal(await robots.text(), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);

  const aliases = [
    { route: "/", object: required(OBJECTS.find(({ id }) => id === "earth")) },
    { route: "/earth/?utm_source=seo-check#view", object: required(OBJECTS.find(({ id }) => id === "earth")) },
  ];
  const discoveryPages = [];
  const descriptions = new Set();
  for (const { route, object } of [...browserObjects().map((object) => ({ route: object.route, object })), ...aliases]) {
    const response = required(await page.goto(base + route, { waitUntil: "domcontentloaded" }));
    assert.equal(response.status(), 200, route);
    assert.doesNotMatch(response.headers()["x-robots-tag"] ?? "", /noindex/i);
    const seo = await readMetadata(page);
    verifyMetadata(seo, object);
    socialImages.add(seo.og.image);
    assert.equal(seo.lang, "en");
    assert.equal(seo.h1, object.name);
    assert.ok(seo.introduction.length > 30, `${route}: introduction must be in initial HTML`);
    assert.doesNotMatch(seo.robots, /noindex|nofollow/i);
    // Query aliases verify metadata but must not supply links for the clean URL.
    if (!new URL(page.url()).search) {
      discoveryPages.push({ url: page.url(), links: seo.links });
    }
    descriptions.add(seo.description);
    report.push({ mode: "no-javascript", route, canonical: seo.canonical, title: seo.title });
  }
  assert.equal(descriptions.size, OBJECTS.length, "Each object needs its own description");
  assertHomepageReachability(discoveryPages, OBJECTS.map(({ route }) => route), base + "/");
  assert.equal(socialImages.size, OBJECTS.length, "Each object has its own plain scene capture");
  for (const imageUrl of socialImages) {
    const response = await fetch(base + new URL(imageUrl).pathname);
    assert.equal(response.status, 200, imageUrl);
    assert.match(required(response.headers.get("content-type")), /image\/jpeg/);
    const bytes = Buffer.from(await response.arrayBuffer());
    const image = await sharp(bytes).metadata();
    assert.deepEqual([image.format, image.width, image.height], ["jpeg", 1200, 630]);
    assert.ok(bytes.length < 500000, `${imageUrl} exceeds 500 KB`);
    assert.deepEqual(bytes, await readFile(resolve(`public${new URL(imageUrl).pathname}`)));
  }
  await page.close();

  await mkdir("output/seo", { recursive: true });
  await writeFile("output/seo/report.json", JSON.stringify({ ok: true, base, browser: browser.version(), checks: report }, null, 2) + "\n");
  console.log(`SEO passed: ${OBJECTS.length + 1} pages without JavaScript, query/hash normalization, ${OBJECTS.length} scene images.`);
} finally {
  await browser?.close();
}

function readMetadata(page: Page) {
  return page.evaluate(() => {
    const meta = (name: string) => {
      const element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      if (!(element instanceof HTMLMetaElement)) throw new Error(`Missing metadata: ${name}`);
      return element.content;
    };
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!(canonical instanceof HTMLLinkElement)) throw new Error('Missing canonical link.');
    const social = (prefix: string) => ({title: meta(`${prefix}:title`), description: meta(`${prefix}:description`),
      image: meta(`${prefix}:image`), 'image:alt': meta(`${prefix}:image:alt`)});
    return {
      title: document.title,
      titleCount: document.querySelectorAll("title").length,
      description: meta("description"),
      canonical: canonical.href,
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      og: {...social("og"), type: meta("og:type"), site_name: meta("og:site_name"), url: meta("og:url"), "image:width": meta("og:image:width"), "image:height": meta("og:image:height")},
      twitter: {...social("twitter"), card: meta("twitter:card")},
      lang: document.documentElement.lang,
      h1: document.querySelector("h1")?.textContent.trim(),
      introduction: document.querySelector(".planet-introduction")?.textContent ?? "",
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
      links: [...document.querySelectorAll("a[href]")].map((link) => {
        const href = link.getAttribute("href");
        if (href === null) throw new Error("Observed link has no href.");
        return href;
      }),
    };
  });
}

function verifyMetadata(seo: Awaited<ReturnType<typeof readMetadata>>, object: ObjectEntry) {
  assert.equal(seo.titleCount, 1);
  assert.equal(seo.canonicalCount, 1);
  assert.equal(seo.title, `${object.name} | cssEarth`);
  assert.equal(seo.canonical, origin + object.route);
  assert.ok(seo.description.includes(object.name) && seo.description.includes("cssEarth"), `${object.id}: description must name the object and cssEarth: ${seo.description}`);
  assert.equal(seo.og.type, "website");
  assert.equal(seo.og.site_name, "cssEarth");
  assert.equal(seo.og.url, seo.canonical);
  assert.equal(seo.twitter.card, "summary_large_image");
  for (const social of [seo.og, seo.twitter]) {
    assert.equal(social.title, seo.title);
    assert.equal(social.description, seo.description);
    assert.equal(social.image, `${origin}/social/${object.id}.jpg`);
    assert.equal(social["image:alt"], `${object.name} in the cssEarth 3D explorer`);
  }
  assert.equal(seo.twitter.image, seo.og.image);
  assert.equal(seo.og["image:width"], "1200");
  assert.equal(seo.og["image:height"], "630");
}
