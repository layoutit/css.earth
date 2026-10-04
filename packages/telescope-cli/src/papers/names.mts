/** How the literature writes a target and a subject, and the boolean phrases the paper indexes are asked with. An index matches a
 * quoted phrase exactly, without stemming, so every written form is asked for by name. */

/** Every way a paper writes a catalogue designation: "NGC 4303" and "NGC4303", "M 61" and "M61", "3C 273" and "3C273". A name that
 * is not letters followed by a number ("Io", "Sgr A*", "GN-z11") is kept as written. */
export const spellings = (names: readonly string[]): string[] => [...new Set(names.flatMap(name => {
  const match = /^([A-Za-z\d]{0,7}[A-Za-z])\s*(\d[\d.+-]*[A-Za-z]?)$/u.exec(name.trim());
  return match ? [`${match[1]} ${match[2]}`, `${match[1]}${match[2]}`] : [name.trim()];
}).filter(Boolean))];

/** A phrase and its plural: a paper about "Cepheids" is one about a "Cepheid". */
export const forms = (phrases: readonly string[]): string[] => [...new Set(phrases.map(phrase => phrase.trim()).filter(Boolean)
  .flatMap(phrase => /s$/iu.test(phrase) ? [phrase] : [phrase, `${phrase}s`]))];

/** Filter syntax (`,` `:` `|`), quotes, brackets and the `*` wildcard, which OpenAlex rejects with HTTP 400 ("Sagittarius A*"),
 * become spaces. */
export const searchText = (value: string): string => value.replace(/[,:|*"()]/gu, ' ').replace(/\s+/gu, ' ').trim();

/** Any one of the phrases, each exact: `("NGC 4303" OR "NGC4303")`, or `"Io"` alone. `field` prefixes each phrase (arXiv's `all:`). */
export function anyOf(values: readonly string[], field = ''): string {
  const phrases = [...new Set(values.map(searchText).filter(Boolean))].map(value => `${field}"${value}"`);
  if (!phrases.length) throw new TypeError('A paper search needs at least one name.');
  return phrases.length === 1 ? phrases[0]! : `(${phrases.join(' OR ')})`;
}
