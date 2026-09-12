/**
 * NAIF text kernel (KPL) parser for LSK, SCLK, PCK, FK and IK files. Only
 * `\begindata` blocks assign variables; `\begintext` is documentation. A value
 * is a number, a quoted string ('' escapes a quote), an @date token, or a
 * parenthesised list of those, possibly spanning lines. `+=` appends.
 */
export type KernelValue = number | string;
export interface KernelPool { readonly variables: ReadonlyMap<string, readonly KernelValue[]>; readonly sources: readonly string[] }

const months: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

/** @ date tokens in year-first (YYYY-MON-DD) or day-first (DD-MON-YYYY) order, with an optional time after `/`, `T`, `-` or a
 * space, B.C. years and numeric months, as seconds past J2000 on a uniform, leap-second free scale, which is how kernel
 * tables use them. Year 1 B.C. is astronomical year 0. */
export function parseDateToken(token: string): number {
  const body = token.slice(1);
  const time = /(?:^|[-/T ])(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/u.exec(body);
  const datePart = time ? body.slice(0, time.index) : body;
  const fields = datePart.split(/[-/ ]/u).filter(Boolean);
  if (fields.length !== 3) throw new Error(`Unsupported text kernel date token: ${token}`);
  const yearLike = (field: string) => /^\d{3,6}(B\.?C\.?)?$/iu.test(field);
  const [yearField, monthField, dayField] = yearLike(fields[0]) ? fields : yearLike(fields[2]) ? [fields[2], fields[1], fields[0]] : [];
  if (!yearField) throw new Error(`Unsupported text kernel date token: ${token}`);
  const month = /^\d+$/u.test(monthField) ? Number(monthField) : months[monthField.toUpperCase()];
  const bc = /B\.?C\.?$/iu.test(yearField), year = bc ? 1 - Number(yearField.replace(/B\.?C\.?$/iu, '')) : Number(yearField);
  if (!month || !Number.isInteger(year) || !/^\d{1,2}$/u.test(dayField)) throw new Error(`Unsupported text kernel date token: ${token}`);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, Number(dayField)); date.setUTCHours(Number(time?.[1] ?? 0), Number(time?.[2] ?? 0), 0, 0);
  return (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 1000 + Number(time?.[3] ?? 0);
}

function tokenize(block: string): string[] {
  const tokens: string[] = []; let i = 0;
  while (i < block.length) {
    const char = block[i];
    if (/\s/u.test(char) || char === ',') { i++; continue; }
    if (char === "'") {
      let value = ''; i++;
      while (i < block.length) {
        if (block[i] === "'") { if (block[i + 1] === "'") { value += "'"; i += 2; continue; } i++; break; }
        value += block[i++];
      }
      tokens.push(`'${value}`); continue;
    }
    if (char === '(' || char === ')') { tokens.push(char); i++; continue; }
    if (block.startsWith('+=', i)) { tokens.push('+='); i += 2; continue; }
    if (char === '=') { tokens.push('='); i++; continue; }
    let word = '';
    while (i < block.length && !/[\s,()=']/u.test(block[i])) word += block[i++];
    tokens.push(word);
  }
  return tokens;
}

function literal(token: string): KernelValue {
  if (token.startsWith("'")) return token.slice(1);
  if (token.startsWith('@')) return parseDateToken(token);
  const number = Number(token.replace(/[dD]/gu, 'e'));
  if (!Number.isFinite(number)) throw new Error(`Invalid text kernel value: ${token}`);
  return number;
}

/** Parse one kernel's text into the pool, honouring `=` and `+=`. */
export function parseTextKernel(text: string, source: string, pool?: KernelPool): KernelPool {
  const variables = new Map(pool?.variables ?? []);
  // Markers count only when they stand alone on a line; documentation may quote them.
  const blocks: string[] = []; let current: string[] | null = null;
  for (const line of text.replace(/\r\n?/gu, '\n').split('\n')) {
    const marker = line.trim();
    if (marker === '\\begindata') { current = []; blocks.push(''); continue; }
    if (marker === '\\begintext') { if (current) blocks[blocks.length - 1] = current.join('\n'); current = null; continue; }
    if (current) { current.push(line); blocks[blocks.length - 1] = current.join('\n'); }
  }
  for (const block of blocks) {
    const tokens = tokenize(block); let i = 0;
    while (i < tokens.length) {
      const name = tokens[i++], operator = tokens[i++];
      if (!/^[A-Za-z0-9_$/*.+\-]+$/u.test(name) || (operator !== '=' && operator !== '+=')) throw new Error(`Invalid text kernel assignment near ${JSON.stringify(name)} in ${source}.`);
      const values: KernelValue[] = [];
      if (tokens[i] === '(') { i++; while (tokens[i] !== ')') { if (i >= tokens.length) throw new Error(`Unterminated list for ${name} in ${source}.`); values.push(literal(tokens[i++])); } i++; }
      else values.push(literal(tokens[i++]));
      variables.set(name, operator === '+=' ? [...(variables.get(name) ?? []), ...values] : values);
    }
  }
  return { variables, sources: [...(pool?.sources ?? []), source] };
}

export function numbers(pool: KernelPool, name: string): number[] {
  const values = pool.variables.get(name);
  if (!values) throw new Error(`Kernel pool lacks ${name}.`);
  return values.map(value => { if (typeof value !== 'number') throw new Error(`${name} is not numeric.`); return value; });
}
export function strings(pool: KernelPool, name: string): string[] {
  const values = pool.variables.get(name);
  if (!values) throw new Error(`Kernel pool lacks ${name}.`);
  return values.map(value => { if (typeof value !== 'string') throw new Error(`${name} is not text.`); return value; });
}
export const number = (pool: KernelPool, name: string) => { const values = numbers(pool, name); if (values.length !== 1) throw new Error(`${name} is not a scalar.`); return values[0]; };
export const string = (pool: KernelPool, name: string) => { const values = strings(pool, name); if (values.length !== 1) throw new Error(`${name} is not a scalar.`); return values[0]; };
export const has = (pool: KernelPool, name: string) => pool.variables.has(name);
