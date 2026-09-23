import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { runInNewContext } from "node:vm";

import { required } from './navigation-test-values.mts';
import { googleAnalyticsBootstrap } from "../google-analytics.mts";

test("analytics ignores local visits and loads on css.earth", () => {
  for (const hostname of ["localhost", "127.0.0.1", "::1"]) {
    const local = runAnalyticsBootstrap(hostname);
    assert.equal(local.window["ga-disable-G-QN2DXDZ41X"], true);
    assert.equal(local.appendedTags.length, 0);
    assert.equal(local.window.dataLayer, undefined);
  }

  for (const hostname of ["css.earth", "www.css.earth"]) {
    const production = runAnalyticsBootstrap(hostname);
    assert.equal(production.window["ga-disable-G-QN2DXDZ41X"], undefined);
    // The tag waits for the page's own files; gtag() calls queue in dataLayer meanwhile.
    assert.equal(production.appendedTags.length, 0);
    assert.equal(required(production.window.dataLayer).length, 2);
    production.load();
    assert.equal(production.appendedTags.length, 1);
    assert.equal(production.appendedTags[0].async, true);
    assert.equal(
      production.appendedTags[0].src,
      "https://www.googletagmanager.com/gtag/js?id=G-QN2DXDZ41X",
    );
  }
  // A bootstrap that runs after the page has loaded adds the tag at once.
  assert.equal(runAnalyticsBootstrap("css.earth", "complete").appendedTags.length, 1);
});

function runAnalyticsBootstrap(hostname: string, readyState = "loading") {
  type Tag = { tagName: string; async?: boolean; src?: string };
  const appendedTags: Tag[] = [], loadListeners: (() => void)[] = [];
  const window: { location: { hostname: string }; dataLayer?: unknown[]; "ga-disable-G-QN2DXDZ41X"?: boolean;
    addEventListener(type: string, listener: () => void): void } = { location: { hostname },
    addEventListener(type, listener) { if (type === "load") loadListeners.push(listener); } };
  const document = {
    readyState,
    createElement: (tagName: string): Tag => ({ tagName }),
    head: { appendChild: (tag: Tag) => appendedTags.push(tag) },
  };
  runInNewContext(googleAnalyticsBootstrap, {
    Date,
    document,
    encodeURIComponent,
    window,
  });
  return { appendedTags, window, load: () => { for (const listener of loadListeners.splice(0)) listener(); } };
}
