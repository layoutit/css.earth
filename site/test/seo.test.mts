import assert from "node:assert/strict";
import { sourceTest } from "@cssearth/objects/node/source-test";
const test = sourceTest();
import { SCENE_OBJECTS, requireObject } from "../objects.mts";
import { breadcrumbJsonLd, homeSeo, objectSeo, websiteJsonLd } from "../seo.mts";
import { pageTrail } from "../seo-trail.mts";
import { availableSocialImages, billboardSocialImages, committedSocialImages } from "../social-images.mts";

test("the home page is named and addressed as the site, not as the Earth page it opens on", () => {
  const earth = objectSeo(requireObject("earth")), home = homeSeo(earth);
  assert.equal(home.canonical, "https://css.earth/");
  assert.notEqual(home.title, earth.title);
  assert.equal(home.image, earth.image);
  assert.equal(websiteJsonLd().url, "https://css.earth/");
});

test("breadcrumbs follow the orbit chain through pages, passing over centres that have none", () => {
  const names = (id: string) => breadcrumbJsonLd(pageTrail(requireObject(id))).itemListElement.map(step => step.name);
  assert.deepEqual(names("phobos"), ["cssEarth", "Sun", "Mars", "Phobos"]);
  assert.deepEqual(names("sun"), ["cssEarth", "Sun"]);
  // Kepler-16 b orbits the A–B barycentre, which is not a page: the trail goes on to Kepler-16 A.
  assert.deepEqual(names("kepler-16ab-b").slice(0, 2), ["cssEarth", requireObject("kepler-16-a").name]);
  const items = breadcrumbJsonLd(pageTrail(requireObject("phobos"))).itemListElement;
  assert.deepEqual(items.map(step => step.position), [1, 2, 3, 4]);
  assert.equal(items.at(-1)?.item, "https://css.earth/phobos/");
});

test("every scene page has a share image of its own: a committed capture or its arrival billboard", () => {
  const committed = committedSocialImages(), billboards = billboardSocialImages(SCENE_OBJECTS, committed);
  for (const id of committed) assert.ok(!billboards.has(id), `${id}: a committed capture wins over the billboard`);
  const available = availableSocialImages(SCENE_OBJECTS);
  const without = SCENE_OBJECTS.filter(object => !available.has(object.id)).map(object => object.id);
  assert.deepEqual(without, SCENE_OBJECTS.filter(object => !object.discovery?.arrival?.billboard && !committed.has(object.id)).map(object => object.id));
  assert.ok(billboards.size > 3000, `${billboards.size} billboard share images`);
  assert.equal(objectSeo(requireObject("betelgeuse"), { socialImages: available }).image, "https://css.earth/social/betelgeuse.jpg");
});
