import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { googleAnalyticsBootstrap } from "../google-analytics.mjs";

test("analytics ignores local visits and loads on css.earth", () => {
  for (const hostname of ["localhost", "127.0.0.1", "::1"]) {
    const local = runAnalyticsBootstrap(hostname);
    assert.equal(local.window["ga-disable-G-XV72TXWTM5"], true);
    assert.equal(local.appendedTags.length, 0);
    assert.equal(local.window.dataLayer, undefined);
  }

  for (const hostname of ["css.earth", "www.css.earth"]) {
    const production = runAnalyticsBootstrap(hostname);
    assert.equal(production.window["ga-disable-G-XV72TXWTM5"], undefined);
    assert.equal(production.appendedTags.length, 1);
    assert.equal(production.appendedTags[0].async, true);
    assert.equal(
      production.appendedTags[0].src,
      "https://www.googletagmanager.com/gtag/js?id=G-XV72TXWTM5",
    );
    assert.equal(production.window.dataLayer.length, 2);
  }
});

function runAnalyticsBootstrap(hostname) {
  const appendedTags = [];
  const window = { location: { hostname } };
  const document = {
    createElement: (tagName) => ({ tagName }),
    head: { appendChild: (tag) => appendedTags.push(tag) },
  };
  runInNewContext(googleAnalyticsBootstrap, {
    Date,
    document,
    encodeURIComponent,
    window,
  });
  return { appendedTags, window };
}
