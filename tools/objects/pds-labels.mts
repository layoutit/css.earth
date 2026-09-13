/**
 * PDS label readers shared by the product decoders. A PDS4 label is XML read without entity expansion; a PDS3 label is
 * KEYWORD = value lines. Decoders compare what these return with their recipes and never guess a missing value.
 */
const escapeName = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every PDS4 element with this name: its opening tag and its content, which may hold nested elements. */
export function pds4Elements(xml: string, name: string) {
  return [...xml.matchAll(new RegExp(`(<${escapeName(name)}(?:\\s[^>]*)?>)([\\s\\S]*?)</${escapeName(name)}>`, 'g'))]
    .map(match => ({ tag: match[1], content: match[2] }));
}
export const pds4Blocks = (xml: string, name: string) => pds4Elements(xml, name).map(element => element.content);

/** Exactly one PDS4 element with this name, nested content allowed; its trimmed content. */
export function pds4Block(xml: string, name: string) {
  const elements = pds4Elements(xml, name);
  if (elements.length !== 1) throw new Error(`Missing or ambiguous PDS4 field: ${name}`);
  return elements[0].content.trim();
}

/** Exactly one text-only PDS4 element with this name; attributes are allowed. */
export function pds4Field(xml: string, name: string) {
  const hits = [...xml.matchAll(new RegExp(`<${escapeName(name)}(?:\\s[^>]*)?>([^<]*)</${escapeName(name)}>`, 'g'))];
  if (hits.length !== 1) throw new Error(`Expected one PDS4 label field: ${name}`);
  return hits[0][1].trim();
}

/** Exactly one numeric PDS4 element; with a unit, its opening tag must carry exactly that unit attribute. */
export function pds4Number(xml: string, name: string, unit?: string) {
  const value = Number(pds4Block(xml, name));
  if (!Number.isFinite(value) || (unit !== undefined && pds4Elements(xml, name)[0].tag !== `<${name} unit="${unit}">`)) throw new Error(`Invalid PDS4 number or unit: ${name}`);
  return value;
}

/** A PDS3 keyword on its own line: the value's items, without their quotes, from a parenthesised list or a single value. */
export function pds3Values(label: string, key: string) {
  const match = new RegExp(`^\\s*${escapeName(key)}\\s*=\\s*(.+?)\\s*$`, 'mu').exec(label);
  return match ? match[1].replace(/^\((.*)\)$/u, '$1').split(',').map(part => part.trim().replace(/^"(.*)"$/u, '$1').replace(/^'(.*)'$/u, '$1')) : undefined;
}

/** A PDS3 keyword's items joined by commas, the form recipes use for multi-valued keywords. */
export const pds3Keyword = (label: string, key: string) => pds3Values(label, key)?.join(',');
