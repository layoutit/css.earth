import { relative, sep } from 'node:path';
import type { CSSOptions } from 'vite';

type InlinePostcss = Exclude<CSSOptions['postcss'], string | undefined>;
type Plugin = NonNullable<InlinePostcss['plugins']>[number];

/** Authored scene motion is an input to baking. The prepared runtime owns its
 * keyframes and disables CSS animation on both SSR and mounted scene nodes.
 * Shipping those definitions again also makes a newly inserted sheet invalidate
 * the whole document in WebKit, even when no element uses its animation names. */
export function preparedMotionCss(root: string): Plugin {
  return {
    postcssPlugin: 'cssearth-prepared-motion',
    Once(sheet) {
      const file = sheet.source?.input.file;
      if (!file || !relative(root, file).startsWith(`src${sep}`)) return;
      sheet.walkAtRules(/^(?:-webkit-)?keyframes$/iu, rule => { rule.remove(); });
      sheet.walkDecls(/^(?:-webkit-)?animation(?:-.+)?$/iu, declaration => { declaration.remove(); });
    },
  };
}
