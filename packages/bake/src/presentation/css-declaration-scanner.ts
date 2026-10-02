/** Trimmed, nonempty declaration fragments outside quotes and parentheses.
 * Validation, property names and output shapes belong to each caller's adapter. */
export function* scanCssDeclarations(style: string): Generator<string> {
  let start = 0, depth = 0, quote = '';
  for (let at = 0; at <= style.length; at++) {
    const char = style[at];
    // Preserve #1152: a preceding backslash escapes a quote even when its run has even length.
    if (quote) { if (char === quote && style[at - 1] !== '\\') quote = ''; continue; }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth--;
    else if ((char === ';' || at === style.length) && depth === 0) {
      const text = style.slice(start, at).trim();
      if (text) yield text;
      start = at + 1;
    }
  }
}
