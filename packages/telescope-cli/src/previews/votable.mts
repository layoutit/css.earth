import { DOMParser, Element } from 'linkedom';

const isElement = (value: unknown): value is Element => value instanceof Element;
const localName = (element: Element): string => String(element.localName).split(':').at(-1)!.toUpperCase();
const attribute = (element: Element, name: string): string | null => {
  const value: unknown = element.getAttribute(name); return typeof value === 'string' ? value : null;
};
const children = (element: Element): Element[] => Array.from<unknown>(element.children).filter(isElement);

/** Archive responses here use TABLEDATA. Do not mistake an unsupported serialization for an empty answer. */
export function previewVotable(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new Error('Unsupported preview XML declaration.');
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const elements = Array.from<unknown>(document.querySelectorAll('*')).filter(isElement);
  const named = (name: string) => elements.filter(element => localName(element) === name);
  if (!named('VOTABLE').length || named('BINARY').length || named('BINARY2').length || named('FITS').length)
    throw new Error('Preview metadata requires VOTable TABLEDATA.');
  if (named('INFO').some(element => attribute(element, 'name') === 'QUERY_STATUS' && attribute(element, 'value') !== 'OK'))
    throw new Error('Preview archive query did not complete.');
  const rows: Record<string, string>[] = [];
  for (const table of named('TABLE')) {
    const fields = children(table).filter(element => localName(element) === 'FIELD').map(element => attribute(element, 'name') ?? '');
    if (!fields.length || fields.some(name => !name) || new Set(fields).size !== fields.length) throw new Error('Invalid preview metadata fields.');
    for (const row of Array.from<unknown>(table.querySelectorAll('*')).filter(isElement).filter(element => localName(element) === 'TR')) {
      const cells = children(row).map(cell => String(cell.textContent ?? '').trim());
      if (cells.length !== fields.length) throw new Error('Invalid preview metadata row width.');
      rows.push(Object.fromEntries(fields.map((field, i) => [field, cells[i]!])));
    }
  }
  const services = named('RESOURCE').flatMap(resource => {
    const params = children(resource).filter(element => localName(element) === 'PARAM');
    const value = (name: string) => { const param = params.find(param => attribute(param, 'name') === name); return param ? attribute(param, 'value') : null; };
    const url = value('accessURL'), standard = value('standardID'), id = attribute(resource, 'ID');
    return url && standard && id ? [{ id, url, standard }] : [];
  });
  return { rows, services };
}
