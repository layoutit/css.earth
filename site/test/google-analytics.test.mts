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
    assert.equal(production.appendedTags.length, 1);
    assert.equal(production.appendedTags[0].async, true);
    assert.equal(
      production.appendedTags[0].src,
      "https://www.googletagmanager.com/gtag/js?id=G-QN2DXDZ41X",
    );
    assert.equal(required(production.window.dataLayer).length, 2);
  }
});

function runAnalyticsBootstrap(hostname: string) {
  type Tag = { tagName: string; async?: boolean; src?: string };
  const appendedTags: Tag[] = [];
  const window: { location: { hostname: string }; dataLayer?: unknown[]; "ga-disable-G-QN2DXDZ41X"?: boolean } = { location: { hostname } };
  const document = {
    createElement: (tagName: string): Tag => ({ tagName }),
    head: { appendChild: (tag: Tag) => appendedTags.push(tag) },
  };
  runInNewContext(googleAnalyticsBootstrap, {
    Date,
    document,
    encodeURIComponent,
    window,
  });
  return { appendedTags, window };
}
