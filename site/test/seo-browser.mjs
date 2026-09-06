import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { OBJECTS } from "../objects.mjs";
import { previewSite } from "../../tools/preview.mjs";
import { assertHomepageReachability } from "./seo-discovery.mjs";

// Inspect the built response as a crawler without JavaScript, then verify the
// same metadata and retained heading in real Chrome at both supported DPRs.
const origin = "https://css.earth";
const server = await previewSite({ port: 4267 });
const base = "http://127.0.0.1:4267";
const canonicalUrls = OBJECTS.map(({ route }) => origin + route);
const report = [];
const socialImages = new Set();
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ javaScriptEnabled: false });
  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type"), /xml/);
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
  assert.match(robots.headers.get("content-type"), /text\/plain/);
  assert.equal(await robots.text(), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);

  const aliases = [
    { route: "/", object: OBJECTS.find(({ id }) => id === "earth") },
    { route: "/earth/?utm_source=seo-check#view", object: OBJECTS.find(({ id }) => id === "earth") },
  ];
  const discoveryPages = [];
  const descriptions = new Set();
  for (const { route, object } of [...OBJECTS.map((object) => ({ route: object.route, object })), ...aliases]) {
    const response = await page.goto(base + route, { waitUntil: "domcontentloaded" });
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
    assert.match(response.headers.get("content-type"), /image\/jpeg/);
    const bytes = Buffer.from(await response.arrayBuffer());
    const image = await sharp(bytes).metadata();
    assert.deepEqual([image.format, image.width, image.height], ["jpeg", 1200, 630]);
    assert.ok(bytes.length < 500000, `${imageUrl} exceeds 500 KB`);
    assert.deepEqual(bytes, await readFile(resolve(`public${new URL(imageUrl).pathname}`)));
  }
  await page.close();

  for (const density of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: density });
    for (const object of OBJECTS) {
      const problems = [];
      const onError = (error) => problems.push(error.message);
      page.on("pageerror", onError);
      await page.goto(base + object.route, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForFunction(() => document.documentElement.dataset.ready === "true", null, { timeout: 60000 });
      verifyMetadata(await readMetadata(page), object);
      assert.equal(await page.locator(".planet-stage").count(), 1);
      assert.equal(await page.locator(".polycss-camera").count(), 1);
      assert.equal(await page.locator("h1").textContent().then((text) => text.trim()), object.name);
      const textBounds = await page.locator("h1 .visually-hidden").boundingBox();
      assert.equal(textBounds.width, 1);
      assert.equal(textBounds.height, 1);
      assert.deepEqual(problems, []);
      page.off("pageerror", onError);
      report.push({ mode: "chrome", object: object.id, density, mountedScenes: 1 });
      console.log(`SEO and heading: ${object.id}, DPR ${density}`);
    }
    await page.close();
  }
  await mkdir("output/seo", { recursive: true });
  await writeFile("output/seo/report.json", JSON.stringify({ ok: true, browser: browser.version(), checks: report }, null, 2) + "\n");
  console.log(`SEO passed: ${OBJECTS.length + 1} pages, query/hash normalization, ${OBJECTS.length} scene images, Chrome DPR 1 and 2.`);
} finally {
  await browser?.close();
  await server.close();
}

function readMetadata(page) {
  return page.evaluate(() => {
    const meta = (name) => document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.content;
    return {
      title: document.title,
      titleCount: document.querySelectorAll("title").length,
      description: meta("description"),
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      og: Object.fromEntries(["type", "site_name", "title", "description", "url", "image", "image:alt", "image:width", "image:height"].map((key) => [key, meta(`og:${key}`)])),
      twitter: Object.fromEntries(["card", "title", "description", "image", "image:alt"].map((key) => [key, meta(`twitter:${key}`)])),
      lang: document.documentElement.lang,
      h1: document.querySelector("h1")?.textContent.trim(),
      introduction: document.querySelector(".planet-introduction")?.textContent ?? "",
      robots: meta("robots") ?? "",
      links: [...document.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")),
    };
  });
}

function verifyMetadata(seo, object) {
  assert.equal(seo.titleCount, 1);
  assert.equal(seo.canonicalCount, 1);
  assert.equal(seo.title, `${object.name} in 3D | cssEarth`);
  assert.equal(seo.canonical, origin + object.route);
  assert.ok(seo.description.includes(object.name) && seo.description.includes("cssEarth"));
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
