/** Cloudflare Web Analytics: page views and referrers from a 6 KB beacon, without cookies. Google's gtag.js was 181 KB of
 * every first visit (2026-09-30). The token comes from the css.earth site in the Cloudflare dashboard. */
export const WEB_ANALYTICS_TOKEN = '27c2ddbc11a4469eb66cb7bd1ba74ba1';

export const webAnalyticsBootstrap = String.raw`
(function () {
  var productionHosts = ["css.earth", "www.css.earth"];
  if (productionHosts.indexOf(window.location.hostname) < 0) return;

  // The page's own files come first on a slow connection: the beacon loads after the page does.
  function load() {
    var tag = document.createElement("script");
    tag.defer = true;
    tag.src = "https://static.cloudflareinsights.com/beacon.min.js";
    tag.setAttribute("data-cf-beacon", JSON.stringify({ token: "${WEB_ANALYTICS_TOKEN}" }));
    document.head.appendChild(tag);
  }
  if (document.readyState === "complete") load();
  else window.addEventListener("load", load, { once: true });
})();
`.trim();
