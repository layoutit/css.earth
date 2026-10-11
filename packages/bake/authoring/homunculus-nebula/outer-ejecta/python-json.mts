/**
 * Python's `json.dump(value, file)` with its defaults, to the byte, and Python's `round(x, ndigits)`: the outer-ejecta
 * source records are written in this form, so a regenerated record shows no difference where the values agree.
 *
 * - Separators ', ' and ': ', no indentation, keys in insertion order (a Map keeps any key order; a plain object
 *   orders integer-like keys first, as JavaScript does).
 * - Strings with every character outside printable ASCII escaped as \uXXXX (lowercase hex, astral characters as
 *   surrogate pairs), and \" \\ \n \r \t \b \f as Python writes them.
 * - Numbers are Python floats (`repr`: the shortest digits that read back to the same double, '.0' on an integral
 *   value, the exponent form 1e-05 or 1e+16 below 1e-4 or from 1e16, NaN and Infinity as Python writes them).
 *   Integers are written as integers only when wrapped in `PyInt` (`pyInt(3)`).
 */

/** A Python int: written without a decimal point. */
export class PyInt {
  readonly value: bigint;
  constructor(value: number | bigint) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new RangeError(`PyInt: ${value} is not a safe integer.`);
    this.value = BigInt(value);
  }
}
export const pyInt = (value: number | bigint): PyInt => new PyInt(value);

export type PyJson = null | boolean | number | string | PyInt | readonly PyJson[] | ReadonlyMap<string, PyJson> | { readonly [key: string]: PyJson };

/** Python's `repr(float)`. */
export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Infinity';
  if (x === -Infinity) return '-Infinity';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  // The shortest round-trip digits and the decimal exponent (JavaScript and Python both take the digits closest to x).
  const [mantissa, exponentText] = Math.abs(x).toExponential().split('e') as [string, string];
  const digits = mantissa.replace('.', ''), decpt = Number(exponentText) + 1, sign = x < 0 ? '-' : '';
  if (decpt <= -4 || decpt > 16) {
    const exponent = decpt - 1;
    return `${sign}${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ''}e${exponent < 0 ? '-' : '+'}${String(Math.abs(exponent)).padStart(2, '0')}`;
  }
  if (decpt <= 0) return `${sign}0.${'0'.repeat(-decpt)}${digits}`;
  if (decpt >= digits.length) return `${sign}${digits}${'0'.repeat(decpt - digits.length)}.0`;
  return `${sign}${digits.slice(0, decpt)}.${digits.slice(decpt)}`;
}

const ESCAPES: Record<string, string> = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' };
/** A string as Python's json writes it with ensure_ascii. */
function pyString(text: string): string {
  let out = '"';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!, code = text.charCodeAt(i);
    out += ESCAPES[ch] ?? (code >= 0x20 && code <= 0x7e ? ch : `\\u${code.toString(16).padStart(4, '0')}`);
  }
  return `${out}"`;
}

/** `json.dumps(value)` as Python writes it. */
export function pythonJson(value: PyJson): string {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'number') return pyFloatRepr(value);
  if (typeof value === 'string') return pyString(value);
  if (value instanceof PyInt) return value.value.toString();
  if (Array.isArray(value)) return `[${(value as readonly PyJson[]).map(pythonJson).join(', ')}]`;
  const entries = value instanceof Map ? [...(value as ReadonlyMap<string, PyJson>).entries()] : Object.entries(value as { readonly [key: string]: PyJson });
  for (const [key] of entries) if (typeof key !== 'string') throw new TypeError(`A JSON object key must be a string; got ${String(key)}.`);
  return `{${entries.map(([key, item]) => `${pyString(key)}: ${pythonJson(item)}`).join(', ')}}`;
}

/**
 * Python's `round(x, ndigits)` for a float: the double nearest the decimal with `ndigits` places nearest x, ties (on
 * the exact binary value of x) to even, the sign kept (`round(-0.0001, 3)` is -0.0). Uses the exact decimal expansion of
 * x, which `toFixed` gives for |x| < 1e21 to 100 places.
 */
export function pyRound(x: number, ndigits: number): number {
  if (!Number.isInteger(ndigits) || ndigits < 0 || ndigits > 20) throw new RangeError(`pyRound: ndigits ${ndigits} is outside 0 to 20.`);
  if (!Number.isFinite(x) || x === 0 || Math.abs(x) >= 1e21) return x;
  const exact = Math.abs(x).toFixed(100), [whole, fraction] = exact.split('.') as [string, string];
  const kept = whole + fraction.slice(0, ndigits), rest = fraction.slice(ndigits);
  let up: boolean;
  if (rest[0]! > '5') up = true;
  else if (rest[0]! < '5') up = false;
  else up = /[1-9]/u.test(rest.slice(1)) || Number(kept[kept.length - 1]) % 2 === 1;
  let digits = kept;
  if (up) { const n = BigInt(kept) + 1n; digits = n.toString().padStart(kept.length, '0'); }
  const point = digits.length - ndigits, text = `${x < 0 ? '-' : ''}${digits.slice(0, point) || '0'}${ndigits ? `.${digits.slice(point)}` : ''}`;
  return Number(text);
}
