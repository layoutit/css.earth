import assert from "node:assert/strict";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { runInNewContext } from "node:vm";

import { WEB_ANALYTICS_TOKEN, webAnalyticsBootstrap } from "../startup/web-analytics.mts";

test("analytics ignores local visits and loads the Cloudflare beacon on css.earth after the page", () => {
  for (const hostname of ["localhost", "127.0.0.1", "::1"]) {
    const local = runAnalyticsBootstrap(hostname);
    local.load();
    assert.equal(local.appendedTags.length, 0);
  }

  for (const hostname of ["css.earth", "www.css.earth"]) {
    const production = runAnalyticsBootstrap(hostname);
    // The beacon waits for the page's own files.
    assert.equal(production.appendedTags.length, 0);
    production.load();
    assert.equal(production.appendedTags.length, 1);
    const [tag] = production.appendedTags;
    assert.equal(tag!.defer, true);
    assert.equal(tag!.src, "https://static.cloudflareinsights.com/beacon.min.js");
    assert.deepEqual(JSON.parse(tag!.attributes["data-cf-beacon"]!), { token: WEB_ANALYTICS_TOKEN });
  }
  // A bootstrap that runs after the page has loaded adds the beacon at once.
  assert.equal(runAnalyticsBootstrap("css.earth", "complete").appendedTags.length, 1);
});

test("the beacon token is a Cloudflare site token", () => {
  assert.match(WEB_ANALYTICS_TOKEN, /^[0-9a-f]{32}$/u, "paste the token of the css.earth site from Cloudflare Web Analytics");
});

function runAnalyticsBootstrap(hostname: string, readyState = "loading") {
  type Tag = { tagName: string; defer?: boolean; src?: string; attributes: Record<string, string>; setAttribute(name: string, value: string): void };
  const appendedTags: Tag[] = [], loadListeners: (() => void)[] = [];
  const window = { location: { hostname },
    addEventListener(type: string, listener: () => void) { if (type === "load") loadListeners.push(listener); } };
  const document = {
    readyState,
    createElement: (tagName: string): Tag => {
      const attributes: Record<string, string> = {};
      return { tagName, attributes, setAttribute(name, value) { attributes[name] = value; } };
    },
    head: { appendChild: (tag: Tag) => appendedTags.push(tag) },
  };
  runInNewContext(webAnalyticsBootstrap, { JSON, document, window });
  return { appendedTags, window, load: () => { for (const listener of loadListeners.splice(0)) listener(); } };
}
