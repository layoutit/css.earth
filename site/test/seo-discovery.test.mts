import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { assertHomepageReachability } from "./seo-discovery.mts";

const home = "http://127.0.0.1:4267/";
const page = (route: string, links: string[]) => ({ url: new URL(route, home).href, links });

test("discovers objects through multiple pages and resolves relative links at their source", () => {
  assert.doesNotThrow(() => assertHomepageReachability([
    page("/", ["earth/"]),
    page("/earth/", ["#facts", "../sun/?view=default#facts"]),
    page("/sun/", ["../mercury/", "/earth/"]),
    page("/mercury/", ["/sun/"]),
  ], ["/earth/", "/sun/", "/mercury/"], home));
});

test("rejects the orphaned Sun even when its inspected page retains a self-link", () => {
  assert.throws(() => assertHomepageReachability([
    page("/", ["/earth/"]),
    page("/earth/", ["/", "/earth/"]),
    page("/sun/", ["/earth/", "/sun/", "#facts", "?view=default"]),
  ], ["/earth/", "/sun/"], home), /\/sun\/ must be reachable from the homepage/);
});

test("rejects a disconnected cycle even when every object has a link from another page", () => {
  assert.throws(() => assertHomepageReachability([
    page("/", ["/earth/"]),
    page("/earth/", ["/"]),
    page("/sun/", ["/mercury/"]),
    page("/mercury/", ["/sun/"]),
  ], ["/earth/", "/sun/", "/mercury/"], home), /\/sun\/ must be reachable from the homepage/);
});

test("external links with a matching pathname do not discover a local object", () => {
  assert.throws(() => assertHomepageReachability([
    page("/", ["/earth/", "https://example.com/sun/"]),
    page("/earth/", ["/"]),
    page("/sun/", ["/earth/"]),
  ], ["/earth/", "/sun/"], home), /\/sun\/ must be reachable from the homepage/);
});
