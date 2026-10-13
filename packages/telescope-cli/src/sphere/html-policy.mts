/** One offline document contract for the sphere and every standalone viewer. */
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

export function assertStandaloneHtml(html: string): void {
  const { document } = parseHTML(html);
  assert.ok(document.querySelector('html[lang]') && document.querySelector('title'), 'Viewer must parse as a titled HTML document');
  assert.equal(document.querySelectorAll('script,canvas,iframe,object,embed,base,link').length, 0, 'Viewer must contain no executable or external content');
  const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '';
  for (const directive of ["default-src 'none'", "script-src 'none'", "connect-src 'none'", "img-src data:", "base-uri 'none'"]) assert.ok(policy.includes(directive), `Missing ${directive}`);
  const css = [...document.querySelectorAll('style')].map(node => node.textContent ?? '').join('\n') + '\n' +
    [...document.querySelectorAll('[style]')].map(node => node.getAttribute('style') ?? '').join('\n');
  assert.doesNotMatch(css, /@import\b|(?:clip-path|(?:-webkit-)?mask(?:-[\w-]+)?|(?:backdrop-)?filter|(?:mix-)?blend-mode)\s*:|(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/iu);
  assert.doesNotMatch(css, /var\s*\(|@property\b|(?:^|[;{])\s*--[\w-]+\s*:/imu, 'Drawing values must be literal CSS');
  for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gu)) assert.match(match[2], /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$/u);
  for (const node of document.querySelectorAll('*')) for (const attribute of node.attributes) {
    assert.doesNotMatch(attribute.name, /^on/iu, 'Inline event handlers are scripts');
    if (['src','href','xlink:href','srcset','action','formaction','poster'].includes(attribute.name.toLowerCase()))
      assert.match(attribute.value, /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$/u, 'Only embedded images may have resource addresses');
    if (['clip-path','mask','filter'].includes(attribute.name)) assert.fail(`Forbidden rendering attribute ${attribute.name}`);
  }
  assert.ok(document.querySelector('details pre'), 'Viewer must show its receipt in collapsible provenance');
}
