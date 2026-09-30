import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

/** Rules that declare `translate`, `scale` or `rotate` beside `transform`. lightningcss 1.33 (Vite's CSS minifier) drops the
 * individual properties from such a rule as overridden, although they compose with `transform`: the built page then differs
 * from the dev page (the selected-body locator sat 8px up-left of its body on css.earth, 2026-09-30). */
export function mixedTransformRules(file: string, css: string): string[] {
  const offenders: string[] = [];
  for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const properties = new Set([...body!.matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)].map(match => match[1]));
    const individual = ['translate', 'scale', 'rotate'].filter(name => properties.has(name));
    if (properties.has('transform') && individual.length) offenders.push(`${file}: ${selector!.trim().replace(/\s+/g, ' ')} (${individual.join(', ')})`);
  }
  return offenders;
}

test('a rule with transform declares no translate, scale or rotate', () => {
  assert.deepEqual(mixedTransformRules('a.css', '.a { translate: 8px 8px; scale: 1; transform: translate(-50%, -50%); }'),
    ['a.css: .a (translate, scale)']);
  assert.deepEqual(mixedTransformRules('a.css', '.a { translate: 8px 8px; } .a { transform: scale(2); } /* .b { scale: 1; transform: none } */'), []);
  const files = execFileSync('git', ['ls-files', '*.css', '*.astro'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(files.flatMap(file => {
    const text = readFileSync(root + file, 'utf8');
    return mixedTransformRules(file, file.endsWith('.astro') ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n') : text);
  }), []);
});
