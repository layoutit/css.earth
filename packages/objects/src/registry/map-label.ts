/** The digits of a long catalogue number a map caption keeps. */
const KEPT_DIGITS = 7;
/** A name's number this long or longer is a source identifier, not something a reader reads (a Gaia DR3 source_id has 18 or 19
 * digits); the nine digits of an EPIC, TIC or KIC number stay whole. */
const LONG_NUMBER = /\d{12,}/gu;

/** A body's caption on the map: its name, with a long catalogue number cut to its last seven digits ("Gaia DR3 …8825600" for
 * "Gaia DR3 1003193721988825600"). The card, the page title and search keep the whole name; a package's own `context.name`
 * replaces this. Seven digits tell apart every such star packaged on 2026-10-01 (194 of 194). */
export function mapLabel(name: string): string {
  return name.replace(LONG_NUMBER, digits => `…${digits.slice(-KEPT_DIGITS)}`);
}
