/** A production page reports its own failures: an uncaught error, a rejected promise or a scene the router gave up on
 * (`scene-router.mts` re-dispatches those as `error` events). Each sends one small beacon to `/.netlify/functions/report`,
 * which writes it to the function log; nothing is stored and nothing identifies the reader. A failed start on a reader's
 * device was invisible before: Safari failed cold loads on slow connections through three deploys and only a device on
 * the desk showed it (2026-10-01). At most three reports per page load. */
export const errorReportBootstrap = String.raw`
(function () {
  var productionHosts = ["css.earth", "www.css.earth"];
  if (productionHosts.indexOf(window.location.hostname) < 0 || !navigator.sendBeacon) return;
  var sent = 0;
  function report(kind, message, stack) {
    if (sent++ >= 3) return;
    navigator.sendBeacon("/.netlify/functions/report", JSON.stringify({
      kind: kind, message: String(message).slice(0, 300), stack: String(stack || "").slice(0, 1500),
      page: window.location.pathname, ready: document.documentElement.dataset.ready || "",
      version: (document.querySelector(".explorer-brand-version") || {}).textContent || "" }));
  }
  window.addEventListener("error", function (event) { report("error", event.message, event.error && event.error.stack); });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason; report("rejection", reason && reason.message || reason, reason && reason.stack); });
})();
`.trim();
