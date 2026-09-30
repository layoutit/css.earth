import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { contextAnnotationOpacity } from './marker-presentation.js';

// The world context marks each body's annotation strength with a prepared level attribute, and world-context.css holds
// the final opacity of every level: no custom property carries it. Every level the rule can return needs its rule.
test('every annotation strength the rule returns has its final opacity in the world-context stylesheet', () => {
  const css = readFileSync(new URL('../styles/world-context.css', import.meta.url), 'utf8');
  const classifications = ['star', 'planet', 'satellite', 'dwarf-planet', 'asteroid', 'comet', 'trans-neptunian', 'interstellar', 'galaxy', 'nebula'];
  const short = (value: number) => String(value).replace(/^0\./, '.');
  for (const { line, label } of classifications.map(contextAnnotationOpacity)) {
    if (line !== .65) {
      expect(css).toContain(`[data-context-line-alpha="${line}"]::before`);
      expect(css).toContain(`[data-context-line-alpha="${line}"] > .context-locator { opacity: ${short(line)}; }`);
    }
    if (label !== .65) expect(css).toContain(`[data-context-label-alpha="${label}"] > .context-caption::after { opacity: ${short(label)}; }`);
  }
  expect(css).not.toMatch(/--context-(?:line|label)-alpha/);
});
