import assert from "node:assert/strict";
import test from "node:test";
import { createEntityIntroductionSource } from "../entity-introduction.mjs";

function fixture({ hits = 1, linkedId = "Q80", geonames = "123", disambiguation = false } = {}) {
  const requests = [];
  const source = createEntityIntroductionSource({ fetcher: async (url, options) => {
    requests.push({ url: String(url), options });
    const p = url.searchParams;
    return { ok: true, json: async () => p.get("list") === "search"
      ? { query: { searchinfo: { totalhits: hits }, search: Array.from({ length: hits }, (_, i) => ({ title: `Q${80+i}` })) } }
      : p.get("action") === "wbgetentities"
        ? { entities: { Q80: { id: "Q80", claims: { P1566: [{ rank: "normal", mainsnak: { datavalue: { value: geonames } } }] }, sitelinks: { enwiki: { title: "Source title" } } } } }
        : { query: { pages: [{ pageid: 27, title: "Source title", extract: "Exact published introduction. Second sourced sentence.",
          lastrevid: 42, fullurl: "https://en.wikipedia.org/wiki/Source_title", pageprops: { wikibase_item: linkedId, ...(disambiguation ? { disambiguation: "" } : {}) } }] } } };
  }, now: () => 1_000 });
  return { source, requests };
}

test("resolves an exact external ID and retains unmodified text, revision, source and license", async () => {
  const f = fixture();
  const result = await f.source.load({ geonames: "123" });
  assert.equal(result.text, "Exact published introduction. Second sourced sentence.");
  assert.equal(result.source.wikidata, "Q80"); assert.equal(result.source.revision, 42);
  assert.equal(result.resources[0].href, result.source.url);
  assert.equal(result.resources[1].href, result.source.licenseUrl);
  assert.match(f.requests[0].url, /haswbstatement%3AP1566%3D123/u);
  assert.ok(f.requests.every(request => request.options.credentials === "omit"));
  assert.equal(await f.source.load({ geonames: "123" }), result);
  assert.equal(f.requests.length, 3, "revisiting an entity reuses the cached excerpt");
});

test("prepared Wikidata identity works for any entity kind without a name search", async () => {
  const f = fixture();
  assert.ok(await f.source.load({ wikidata: "Q80" }));
  assert.equal(f.requests.length, 2);
  assert.equal(new URL(f.requests[0].url).searchParams.get("action"), "wbgetentities");
});

test("ambiguous identities, stale external IDs, wrong articles and disambiguations publish no introduction", async () => {
  for (const options of [{ hits: 0 }, { hits: 2 }, { geonames: "999" }, { linkedId: "Q81" }, { disambiguation: true }]) {
    assert.equal(await fixture(options).source.load({ geonames: "123" }), null);
  }
});

test("a missing identity makes no request and never falls back to searching a label", async () => {
  const f = fixture();
  assert.equal(await f.source.load({ name: "Source title" }), null);
  assert.equal(await f.source.load({ geonames: "123 OR anything" }), null);
  assert.equal(f.requests.length, 0);
});

test("failed requests can retry and navigation cancellation reaches the source request", async () => {
  let fail = true, calls = 0;
  const source = createEntityIntroductionSource({ fetcher: async (_url, { signal }) => {
    calls++; signal.throwIfAborted();
    if (fail) throw new Error("Temporary source failure");
    return { ok: true, json: async () => ({ query: { searchinfo: { totalhits: 0 }, search: [] } }) };
  } });
  await assert.rejects(source.load({ geonames: "123" }), /Temporary/);
  fail = false; assert.equal(await source.load({ geonames: "123" }), null);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(source.load({ geonames: "123" }, controller.signal), { name: "AbortError" });
  assert.equal(calls, 3);
});

test("source throttling respects Retry-After across different entity selections", async () => {
  let clock = 1000, calls = 0;
  const source = createEntityIntroductionSource({ now: () => clock, fetcher: async () => {
    calls++; return { ok: false, status: 429, headers: { get: () => "30" } };
  } });
  await assert.rejects(source.load({ geonames: "123" }), /429/);
  clock += 29_999;
  await assert.rejects(source.load({ geonames: "456" }), /cooling down/);
  assert.equal(calls, 1);
  clock += 1;
  await assert.rejects(source.load({ geonames: "456" }), /429/);
  assert.equal(calls, 2);
});
