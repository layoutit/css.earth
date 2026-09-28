/** Text for catalogue values and references: source strings are rearranged, never recomputed. */

/** "Braga-Ribas, F., R. Vieira-Martius, ..., 2014, Title" → "Braga-Ribas et al. 2014". */
export function shortReference(full: string | undefined, fallback: string, yearAt: 'first' | 'last' = 'first'): string {
  if (!full) return fallback;
  const years = [...full.matchAll(/(?<![\d/.-])(1[89]\d\d|20\d\d)[a-z]?(?![\d/-])/g)].map(match => match[1]!);
  const surname = /^([^,]+),/.exec(full)?.[1]?.trim(), year = yearAt === 'first' ? years[0] : years.at(-1);
  if (!surname || !year) return fallback;
  // Authors precede the year in the TNO, binary and mass references; the NEOWISE references end with the year.
  const authors = (yearAt === 'first' ? full.slice(0, full.indexOf(year)) : full).slice(surname.length + 1);
  const several = yearAt === 'first' ? /\band\b|&|et al|\.,\s*[A-Z]\.\s*[A-Z]?\.?\s*[A-Z][a-z]/.test(authors) : /\.,\s*[A-Z]\.|\bet al\b|\d+ others/.test(authors);
  return `${surname}${several ? ' et al.' : ''} ${year}`;
}


export const SUPERSCRIPT: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** "9.35E+20" → "9.35 × 10²⁰"; an exponent from −3 to 5 is written out by moving the decimal point ("1.957E+04" → "19570"). */
export function scientific(text: string): string {
  const match = /^([+-]?)(\d*)\.?(\d*)[Ee]([+-]?\d+)$/.exec(text);
  if (!match) return text;
  const [, sign, whole, fraction, power] = match, exponent = Number(power);
  if (exponent < -3 || exponent > 5) return `${sign}${whole}${fraction ? `.${fraction}` : ''} × 10${String(exponent).split('').map(char => SUPERSCRIPT[char]).join('')}`;
  const digits = `${whole}${fraction}`, point = whole!.length + exponent;
  const shifted = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? `${digits}${'0'.repeat(point - digits.length)}` : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return `${sign}${shifted.replace(/^0+(?=\d)/, '')}`;
}
export const interval = (center: string, upper?: string, lower?: string) =>
  upper === undefined ? center : lower === undefined || Number(lower) === Number(upper) ? `${center} ± ${upper}` : `${center} +${upper}/−${lower}`;
export const decimals = (text: string) => (/\.(\d+)/.exec(text)?.[1] ?? '').length;
export const halfUnit = (text: string) => 0.5 * 10 ** -decimals(text);
