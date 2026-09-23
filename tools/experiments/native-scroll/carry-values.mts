/** The camera publishes its values once, on `.object-viewport`, and registers them not to inherit,
 * so a camera change restyles only the elements that read them. Each reader, and every ancestor
 * between it and the viewport, receives an explicit `inherit` for exactly the values used below it.
 * Declarations and computed values are unchanged; only the inheritance path is narrower. */
interface StyleRule { readonly selector: string; readonly declarations: string; readonly container: string | null }
interface PropertyRule { readonly name: string; readonly body: string }

export function carryViewportValues(document: Document, css: string): { readonly values: number; readonly elements: number } {
  const viewport = document.querySelector('.object-viewport');
  if (!viewport) throw new TypeError('The native camera viewport is missing.');
  const { styles, properties } = parseCss(css);
  const nonInheriting = new Set(properties.filter(rule => /inherits\s*:\s*false/u.test(rule.body)).map(rule => rule.name));
  const carried = new Set<string>();
  for (const rule of styles) {
    if (!selectorList(rule.selector).includes('.object-viewport')) continue;
    for (const name of declaredNames(rule.declarations)) if (nonInheriting.has(name)) carried.add(name);
  }
  const used = (text: string) => [...text.matchAll(/var\(\s*(--[\w-]+)/gu)].map(match => match[1]!).filter(name => carried.has(name));
  const own = (text: string) => declaredNames(text).filter(name => carried.has(name));
  const reads = new Map<Element, Set<string>>(), declares = new Map<Element, Set<string>>();
  const note = (map: Map<Element, Set<string>>, element: Element, names: readonly string[]) => {
    if (!names.length || element === viewport || !viewport.contains(element)) return;
    const set = map.get(element) ?? new Set<string>();
    for (const name of names) set.add(name);
    map.set(element, set);
  };
  for (const element of viewport.querySelectorAll('[style]')) {
    const text = element.getAttribute('style') ?? '';
    note(reads, element, used(text));
    note(declares, element, own(text));
  }
  for (const rule of styles) {
    const reading = used(rule.declarations), declaring = own(rule.declarations);
    const queried = rule.container ? [...rule.container.matchAll(/style\(\s*(--[\w-]+)/gu)].map(match => match[1]!).filter(name => carried.has(name)) : [];
    if (!reading.length && !declaring.length && !queried.length) continue;
    // An unnamed style query reads the subject's parent, the nearest style container.
    if (queried.length && !/^@container\s+(?:style|not|\()/u.test(rule.container!)) {
      throw new TypeError(`A named container query reads carried camera values: ${rule.container}`);
    }
    for (const selector of selectorList(rule.selector)) {
      if (selector === '.object-viewport') continue;
      const subject = selector.replace(/::?(?:hover|active|focus-visible|focus-within|focus|before|after|-webkit-[\w-]+)/gu, '').trim();
      if (!subject) throw new TypeError(`Cannot find the readers of camera values for selector ${selector}`);
      let matches: Element[];
      try { matches = [...document.querySelectorAll(subject)]; }
      catch { throw new TypeError(`Cannot find the readers of camera values for selector ${selector}`); }
      for (const element of matches) {
        note(reads, element, reading);
        note(declares, element, declaring);
        if (queried.length && element.parentElement) note(reads, element.parentElement, queried);
      }
    }
  }
  const carry = new Map<Element, Set<string>>();
  for (const [reader, names] of reads) {
    for (const name of names) {
      for (let node: Element | null = reader; node && node !== viewport; node = node.parentElement) {
        // An element that declares the value itself supplies it to the readers below.
        if (declares.get(node)?.has(name)) break;
        const set = carry.get(node) ?? new Set<string>();
        set.add(name);
        carry.set(node, set);
      }
    }
  }
  for (const [element, names] of carry) {
    const style = (element.getAttribute('style') ?? '').trim();
    const separator = style && !style.endsWith(';') ? ';' : '';
    element.setAttribute('style', `${style}${separator}${[...names].sort().map(name => `${name}:inherit`).join(';')}`);
  }
  return { values: carried.size, elements: carry.size };
}

const declaredNames = (declarations: string) => [...declarations.matchAll(/(?:^|[;{])\s*(--[\w-]+)\s*:/gu)].map(match => match[1]!);

function selectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < selector.length; i++) {
    const character = selector[i];
    if (character === '(' || character === '[') depth++;
    else if (character === ')' || character === ']') depth--;
    else if (character === ',' && depth === 0) { parts.push(selector.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(selector.slice(start).trim());
  return parts.filter(Boolean);
}

function parseCss(css: string): { styles: StyleRule[]; properties: PropertyRule[] } {
  const styles: StyleRule[] = [], properties: PropertyRule[] = [];
  const stack: { prelude: string; start: number }[] = [];
  let boundary = 0;
  for (let i = 0; i < css.length; i++) {
    const character = css[i];
    if (character === '"' || character === "'") {
      const end = css.indexOf(character, i + 1);
      i = end < 0 ? css.length : end;
      continue;
    }
    if (character === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 1;
      boundary = i + 1;
      continue;
    }
    if (character === '{') {
      stack.push({ prelude: css.slice(boundary, i).trim(), start: i + 1 });
      boundary = i + 1;
    } else if (character === '}') {
      const frame = stack.pop();
      if (!frame) throw new TypeError('The native camera stylesheet has unbalanced braces.');
      const body = css.slice(frame.start, i);
      if (frame.prelude.startsWith('@property')) properties.push({ name: frame.prelude.slice('@property'.length).trim(), body });
      else if (!frame.prelude.startsWith('@') && !stack.some(parent => /^@(?:-webkit-)?keyframes|^@property/u.test(parent.prelude))) {
        const container = [...stack].reverse().find(parent => parent.prelude.startsWith('@container'))?.prelude ?? null;
        styles.push({ selector: frame.prelude, declarations: body, container });
      }
      boundary = i + 1;
    } else if (character === ';' && stack.length === 0) boundary = i + 1;
  }
  if (stack.length) throw new TypeError('The native camera stylesheet has unbalanced braces.');
  return { styles, properties };
}
