/** Edits one number of a tracked JSON recipe in place: only that number's characters change, so the checkout's diff
 * is the edit and nothing else (a recipe may spell a number as 1e-06, which a rewrite through JSON.stringify would
 * respell). */
export function numberSpan(text: string, path: readonly string[]): [number, number] {
  let at = 0;
  const fail = (message: string): never => { throw new TypeError(`${path.join('.')}: ${message} at character ${at}.`); };
  const space = () => { while (/\s/.test(text[at] ?? '')) at++; };
  const string = () => {
    if (text[at] !== '"') fail('expected a string');
    const start = at++;
    while (text[at] !== '"') { if (at >= text.length) fail('unterminated string'); if (text[at] === '\\') at++; at++; }
    at++;
    return JSON.parse(text.slice(start, at)) as string;
  };
  /** Reads a value. `rest` is the remaining path when the value is on it, or null when it is skipped. Returns the
   * span of the number the path names. */
  const value = (rest: readonly string[] | null): [number, number] | null => {
    space();
    const char = text[at];
    if (char === '{' || char === '[') {
      const object = char === '{', close = object ? '}' : ']';
      at++; space();
      let index = 0, found: [number, number] | null = null;
      if (text[at] !== close) for (;;) {
        let member = String(index++);
        if (object) { space(); member = string(); space(); if (text[at] !== ':') fail('expected :'); at++; }
        const onPath = rest !== null && rest.length > 0 && rest[0] === member;
        const hit = value(onPath ? rest!.slice(1) : null);
        if (onPath) found = hit;
        space();
        if (text[at] === ',') { at++; continue; }
        if (text[at] === close) break;
        fail(`expected , or ${close}`);
      }
      at++;
      return found;
    }
    if (char === '"') { string(); return null; }
    const match = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(at));
    if (!match) return fail('expected a value');
    const span: [number, number] = [at, at + match[0].length];
    at = span[1];
    return rest !== null && rest.length === 0 && /^-?\d/.test(match[0]) ? span : null;
  };
  const found = value(path);
  if (!found) throw new TypeError(`${path.join('.')} is not a number in the recipe.`);
  return found;
}
export function setRecipeNumber(text: string, dotted: string, number: number): string {
  if (!Number.isFinite(number)) throw new TypeError('A recipe number must be finite.');
  const [start, end] = numberSpan(text, dotted.split('.'));
  const next = text.slice(0, start) + JSON.stringify(number) + text.slice(end);
  JSON.parse(next);
  return next;
}
