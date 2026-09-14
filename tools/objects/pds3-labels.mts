/**
 * Bounded PDS3 label subset for preparation: scalar text, flat lists, comments,
 * and OBJECT/GROUP scopes. Values stay text (including units and line breaks);
 * this is not a general PVL value converter. See docs/pds-labels.md.
 */
const MAX_LABEL_CHARACTERS = 8 * 1024 * 1024;
const MAX_NESTING = 64;
const identifier = /^\^?[A-Z][A-Z0-9_]*(?::[A-Z][A-Z0-9_]*)?$/i;

/** Split physical records only outside quoted text, lists and unit expressions. */
function* statements(label: string): Generator<string> {
  if (label.length > MAX_LABEL_CHARACTERS) throw new Error('PDS3 label exceeds the 8,388,608 character limit.');
  let text = '', quote = '';
  const closing: string[] = [];
  for (let i = 0; i < label.length; i++) {
    const c = label[i];
    if (quote) {
      text += c;
      if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") { quote = c; text += c; continue; }
    if (c === '/' && label[i + 1] === '*') {
      const end = label.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated PDS3 comment.');
      // PDS3 ignores the rest of a comment's physical line, too (SR 12.4.1).
      i = end + 1;
      while (i + 1 < label.length && !/[\r\n\f\v]/.test(label[i + 1])) i++;
      text += ' ';
      continue;
    }
    if ('({<'.includes(c)) {
      closing.push(c === '(' ? ')' : c === '{' ? '}' : '>');
      if (closing.length > MAX_NESTING) throw new Error('PDS3 value nesting exceeds 64 levels.');
    } else if (')}>'.includes(c) && closing.pop() !== c) throw new Error('Unbalanced PDS3 value delimiters.');
    if (/[\r\n\f\v]/.test(c) && closing.length === 0 && !text.trimEnd().endsWith('=')) {
      if (text.trim()) yield text.trim();
      text = '';
    } else text += c;
  }
  if (quote || closing.length) throw new Error('Unterminated PDS3 quoted text or value.');
  if (text.trim()) yield text.trim();
}

type Scope = { kind: string; name: string; values: Map<string, string[]>; children: Scope[] };

function readLabel(label: string): Scope {
  const root: Scope = { kind: 'ROOT', name: '', values: new Map(), children: [] }, stack = [root];
  for (const statement of statements(label)) {
    const current = stack[stack.length - 1];
    if (/^END$/i.test(statement)) {
      if (stack.length !== 1) throw new Error('PDS3 END inside an unclosed scope.');
      return root; // Attached data or record padding after END is not a label.
    }
    const end = /^(END_OBJECT|END_GROUP)(?:\s*=\s*([A-Z][A-Z0-9_]*))?$/i.exec(statement);
    if (end) {
      if (stack.length === 1 || current.kind !== end[1].slice(4).toUpperCase() ||
          (end[2] !== undefined && current.name !== end[2].toUpperCase())) throw new Error('Mismatched PDS3 scope terminator.');
      stack.pop();
      continue;
    }
    const assignment = /^([^\s=]+)\s*=\s*([\s\S]+)$/.exec(statement);
    if (!assignment || !identifier.test(assignment[1]) || !assignment[2].trim()) throw new Error('Invalid PDS3 assignment.');
    const key = assignment[1].toUpperCase(), value = assignment[2].trim();
    if (key === 'OBJECT' || key === 'GROUP') {
      if (!/^[A-Z][A-Z0-9_]*$/i.test(value)) throw new Error('Invalid PDS3 scope name.');
      const child: Scope = { kind: key, name: value.toUpperCase(), values: new Map(), children: [] };
      current.children.push(child); stack.push(child);
      if (stack.length > MAX_NESTING + 1) throw new Error('PDS3 scope nesting exceeds 64 levels.');
    } else {
      if (['END', 'END_OBJECT', 'END_GROUP'].includes(key)) throw new Error('Invalid PDS3 terminator.');
      const previous = current.values.get(key) ?? [];
      previous.push(value); current.values.set(key, previous);
    }
  }
  if (stack.length !== 1) throw new Error('Unclosed PDS3 scope.');
  return root; // Balanced fragments are useful to callers and fixtures, too.
}

function scalar(text: string): string {
  const value = text.trim();
  if (value[0] === '"' || value[0] === "'") {
    if (value.length < 2 || value.at(-1) !== value[0] || value.slice(1, -1).includes(value[0])) throw new Error('Invalid PDS3 quoted scalar.');
    return value.slice(1, -1);
  }
  // Keep numeric units opaque; do not split their parentheses as a sequence.
  if (!/^[^\s,(){}<>"'=;&]+(?:\s*<[^<>]+>)?$/.test(value)) throw new Error('Unsupported or empty PDS3 scalar.');
  return value;
}

function values(text: string): string[] {
  if (!['(', '{'].includes(text[0])) return [scalar(text)];
  if (text.at(-1) !== (text[0] === '(' ? ')' : '}')) throw new Error('Invalid PDS3 list.');
  const result: string[] = [];
  let start = 1, quote = '', unit = false;
  for (let i = 1; i < text.length - 1; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '<') { unit = true; continue; }
    if (c === '>') { unit = false; continue; }
    if (unit) continue;
    if ('(){}'.includes(c)) throw new Error('Nested PDS3 lists are unsupported.');
    if (c === ',') { result.push(scalar(text.slice(start, i))); start = i + 1; }
  }
  result.push(scalar(text.slice(start, -1)));
  return result;
}

/**
 * Read one unambiguous keyword. Without scope, search all scopes and reject
 * multiple matches. An explicit path selects direct children; [] means root.
 * Repeated OBJECT/GROUP names are ambiguous, never selected by file order.
 */
export function pds3Values(label: string, key: string, scope?: readonly string[]): string[] | undefined {
  if (!identifier.test(key)) throw new Error(`Invalid PDS3 keyword: ${key}.`);
  const root = readLabel(label);
  let scopes = [root];
  if (scope !== undefined) {
    for (const name of scope) {
      if (!/^[A-Z][A-Z0-9_]*$/i.test(name)) throw new Error('Invalid PDS3 scope selector.');
      scopes = scopes.flatMap(parent => parent.children.filter(child => child.name === name.toUpperCase()));
      if (scopes.length > 1) throw new Error(`Ambiguous PDS3 scope: ${name}.`);
    }
  } else {
    for (let i = 0; i < scopes.length; i++) for (const child of scopes[i].children) scopes.push(child);
  }
  const matches = scopes.flatMap(node => {
    const value = node.values.get(key.toUpperCase());
    if (value !== undefined && value.length > 1) throw new Error(`Duplicate PDS3 keyword ${key} in ${node.name || 'root'}.`);
    return value ?? [];
  });
  if (matches.length > 1) throw new Error(`Ambiguous PDS3 keyword: ${key}; select its scope.`);
  return matches.length ? values(matches[0]) : undefined;
}

/** Preserve the existing comma-joined recipe representation for flat lists. */
export const pds3Keyword = (label: string, key: string, scope?: readonly string[]) => pds3Values(label, key, scope)?.join(',');
