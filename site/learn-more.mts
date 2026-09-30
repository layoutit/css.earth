/** Authored article links take precedence. Wikipedia resolves other names without guessing an article slug. */
export function wikipediaLearnMoreUrl(name: string, articleUrl?: string): string {
  if (articleUrl) return articleUrl;
  const url = new URL('https://en.wikipedia.org/wiki/Special:Search');
  url.searchParams.set('search', name);
  url.searchParams.set('go', 'Go');
  return url.href;
}
