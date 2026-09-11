import assert from "node:assert/strict";

export interface DiscoveryPage { url: string; links: readonly string[]; }

export function assertHomepageReachability(pages: readonly DiscoveryPage[], requiredRoutes: readonly string[], homepage: string) {
  const home = new URL(homepage);
  const linksByPage = new Map<string, Set<string>>();
  for (const { url, links } of pages) {
    const source = new URL(url);
    if (source.origin !== home.origin) continue;
    const targets = new Set<string>();
    for (const link of links) {
      const target = new URL(link, source);
      if (target.origin === home.origin && target.pathname !== source.pathname) {
        targets.add(target.pathname);
      }
    }
    linksByPage.set(source.pathname, targets);
  }

  // Only links reached from the homepage can discover another object. Merely
  // visiting a registry route during metadata inspection must not discover it.
  const reachable = new Set([home.pathname]);
  for (const source of reachable) {
    for (const target of linksByPage.get(source) ?? []) reachable.add(target);
  }
  for (const route of requiredRoutes) {
    assert.ok(reachable.has(route), `${route} must be reachable from the homepage through crawlable links`);
  }
}
