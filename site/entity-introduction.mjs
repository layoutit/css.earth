// Editorial text is supplied by Wikimedia's API. The shell only transports it;
// it never writes descriptions or guesses an article from an entity's name.
export function createEntityIntroductionSource({ fetcher = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map();
  const retryAfter = new Map();
  const api = (host, parameters) => {
    const url = new URL(`https://${host}/w/api.php`);
    url.search = new URLSearchParams({ ...parameters, format: "json", origin: "*" });
    return url;
  };
  async function get(url, signal) {
    if ((retryAfter.get(url.origin) ?? 0) > now()) throw new Error("Introduction source is cooling down.");
    const response = await fetcher(url, { signal, credentials: "omit",
      headers: { "Api-User-Agent": "cssEarth/0.1 (https://github.com/layoutit/cssEarth)" } });
    if ([429, 503].includes(response.status)) {
      const header = response.headers?.get("Retry-After");
      const delay = header && /^\d+$/u.test(header) ? Number(header) * 1000 : Date.parse(header) - now();
      retryAfter.set(url.origin, now() + (Number.isFinite(delay) && delay > 0 ? delay : 5000));
    }
    if (!response.ok) throw new Error(`Introduction source returned ${response.status}.`);
    const data = await response.json();
    if (data.error) throw new Error("Introduction source could not answer the request.");
    return data;
  }
  return Object.freeze({
    async load(identifiers, signal) {
      if (!identifiers) return null;
      const geonames = /^\d+$/u.test(identifiers.geonames ?? "") ? identifiers.geonames : null;
      let wikidata = /^Q[1-9]\d*$/u.test(identifiers.wikidata ?? "") ? identifiers.wikidata : null;
      if (!geonames && !wikidata) return null;
      const key = JSON.stringify([wikidata, geonames]);
      const existing = cache.get(key);
      if (existing && now() - existing.at < 3_600_000) return existing.value;
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000);
      if (!wikidata) {
        const result = await get(api("www.wikidata.org", { action: "query", list: "search",
          srsearch: `haswbstatement:P1566=${geonames}`, srnamespace: "0", srlimit: "2", srprop: "" }), requestSignal);
        if (result.query?.searchinfo?.totalhits !== 1 || result.query.search.length !== 1) return null;
        wikidata = result.query.search[0].title;
        if (!/^Q[1-9]\d*$/u.test(wikidata)) return null;
      }
      const result = await get(api("www.wikidata.org", { action: "wbgetentities", ids: wikidata,
        props: "claims|sitelinks", sitefilter: "enwiki" }), requestSignal);
      const entity = result.entities?.[wikidata];
      if (entity?.id !== wikidata || (geonames && !entity.claims?.P1566?.some(claim =>
        claim.rank !== "deprecated" && claim.mainsnak?.datavalue?.value === geonames))) return null;
      const title = entity.sitelinks?.enwiki?.title;
      if (!title) return null;
      const pageResult = await get(api("en.wikipedia.org", { action: "query", prop: "extracts|info|pageprops",
        ppprop: "wikibase_item|disambiguation", titles: title, redirects: "1", exintro: "1",
        exsentences: "2", explaintext: "1", inprop: "url", formatversion: "2" }), requestSignal);
      const pages = pageResult.query?.pages;
      if (pages?.length !== 1) return null;
      const page = pages[0];
      if (page.pageprops?.wikibase_item !== wikidata || "disambiguation" in (page.pageprops ?? {}) ||
          typeof page.extract !== "string" || !page.extract.trim() || !Number.isInteger(page.lastrevid)) return null;
      const article = new URL(page.fullurl);
      if (article.origin !== "https://en.wikipedia.org" || !article.pathname.startsWith("/wiki/")) return null;
      const value = Object.freeze({
        text: page.extract,
        source: Object.freeze({ wikidata, geonames, pageId: page.pageid, revision: page.lastrevid,
          title: page.title, url: article.href, retrievedAt: new Date(now()).toISOString(),
          license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" }),
        resources: [
          { label: "Wikipedia", description: "Introduction · article and contributors", href: article.href },
          { label: "CC BY-SA 4.0", description: "Introduction license · unmodified excerpt", href: "https://creativecommons.org/licenses/by-sa/4.0/" },
        ],
      });
      cache.delete(key); cache.set(key, { at: now(), value });
      if (cache.size > 64) cache.delete(cache.keys().next().value);
      return value;
    },
  });
}
