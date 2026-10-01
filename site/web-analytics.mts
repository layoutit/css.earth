export const googleAnalyticsBootstrap = String.raw`
(function () {
  var GA_ID = "G-QN2DXDZ41X";
  var productionHosts = ["css.earth", "www.css.earth"];

  if (productionHosts.indexOf(window.location.hostname) < 0) {
    window["ga-disable-" + GA_ID] = true;
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);

  // The page's own files come first on a slow connection: the tag loads after the page does, and gtag() queues until then.
  function load() {
    var tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(tag);
  }
  if (document.readyState === "complete") load();
  else window.addEventListener("load", load, { once: true });
})();
`.trim();
