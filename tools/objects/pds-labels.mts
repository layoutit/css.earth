/**
 * PDS label readers shared by product decoders. The PDS4 helpers read the pinned
 * tag spellings without entity expansion; PDS3 uses a scoped label reader.
 * Decoders compare these values with their recipes and never guess a missing value.
 */
export { pds3Keyword, pds3Values } from './pds3-labels.mts';
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
  const text = pds4Block(xml, name), value = Number(text);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(value) ||
      (unit !== undefined && pds4Elements(xml, name)[0].tag !== `<${name} unit="${unit}">`)) throw new Error(`Invalid PDS4 number or unit: ${name}`);
  return value;
}

/** Product identity excludes version numbers belonging to modification-history entries. */
export function pds4ProductIdentity(xml: string) {
  const area = pds4Block(xml, 'Identification_Area').replace(/<Modification_History(?:\s[^>]*)?>[\s\S]*?<\/Modification_History>/gu, '');
  return { logical_identifier: pds4Field(area, 'logical_identifier'), version_id: pds4Field(area, 'version_id') };
}

/** PDS UTC calendar or ordinal dates; reject day-of-year rollover. */
export function pds3TimeIso(value: string): string {
  const ordinal=/^(\d{4})-(\d{3})T(.*)$/u.exec(value);
  if(ordinal){const year=Number(ordinal[1]),day=Number(ordinal[2]),date=new Date(Date.UTC(year,0,day));
    if(day<1||date.getUTCFullYear()!==year)throw new Error('Invalid PDS day of year');
    value=`${date.toISOString().slice(0,10)}T${ordinal[3]}`;
  }
  const date=new Date(/[zZ]|[+-]\d\d:\d\d$/u.test(value)?value:`${value}Z`);
  if(!Number.isFinite(date.valueOf()))throw new Error('Invalid PDS UTC time');
  return date.toISOString();
}
