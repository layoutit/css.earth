/**
 * One image from a PDF, read exactly: the stream of an image XObject found by its object number, inflated and checked
 * against its stated size. Only what published figures use is supported, FlateDecode without a predictor in eight-bit
 * DeviceRGB or DeviceGray, and anything else is refused by name rather than guessed at. A figure is pinned by the PDF's
 * own hash, the object number and the hash of the decoded pixels, so a changed or renumbered file is noticed.
 */
import { inflateSync } from 'node:zlib';

export interface PdfImage { width: number; height: number; channels: 1 | 3; data: Uint8Array }

type Value = number | string | { name: string } | { ref: number } | Value[] | Map<string, Value>;
const isName = (v: Value | undefined): v is { name: string } => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Map) && 'name' in v;
const isRef = (v: Value | undefined): v is { ref: number } => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Map) && 'ref' in v;

/** Parse one PDF object value starting at `at`; strings are skipped, as image dictionaries carry none that matter. */
function parseValue(text: string, at: number): [Value, number] {
  const skip = (i: number) => { while (i < text.length) { if (/\s/.test(text[i])) i++; else if (text[i] === '%') { while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++; } else break; } return i; };
  let i = skip(at);
  if (text.startsWith('<<', i)) {
    const dict = new Map<string, Value>(); i += 2;
    for (;;) {
      i = skip(i);
      if (text.startsWith('>>', i)) return [dict, i + 2];
      if (text[i] !== '/') throw new TypeError(`Malformed PDF dictionary at byte ${i}.`);
      const key = text.slice(i + 1).match(/^[^\s/<>[\]()%]+/)?.[0] ?? '';
      const [value, next] = parseValue(text, i + 1 + key.length); dict.set(key, value); i = next;
    }
  }
  if (text[i] === '[') {
    const list: Value[] = []; i++;
    for (;;) { i = skip(i); if (text[i] === ']') return [list, i + 1]; const [value, next] = parseValue(text, i); list.push(value); i = next; }
  }
  if (text[i] === '/') { const name = text.slice(i + 1).match(/^[^\s/<>[\]()%]*/)?.[0] ?? ''; return [{ name }, i + 1 + name.length]; }
  if (text[i] === '(') { let depth = 0; for (; i < text.length; i++) { if (text[i] === '\\') { i++; continue; } if (text[i] === '(') depth++; else if (text[i] === ')' && --depth === 0) return ['', i + 1]; } }
  if (text[i] === '<') { const end = text.indexOf('>', i); return ['', end + 1]; }
  const reference = text.slice(i).match(/^(\d+)\s+(\d+)\s+R\b/);
  if (reference) return [{ ref: Number(reference[1]) }, i + reference[0].length];
  const number = text.slice(i).match(/^[+-]?(?:\d+\.?\d*|\.\d+)/);
  if (number) return [Number(number[0]), i + number[0].length];
  const word = text.slice(i).match(/^[a-z]+/)?.[0];
  if (word === 'true' || word === 'false' || word === 'null') return [word, i + word.length];
  throw new TypeError(`Unsupported PDF token at byte ${i}.`);
}

/** Where object `n` starts: the last definition wins, as in an incrementally updated file. */
function objectStart(text: string, n: number) {
  const pattern = new RegExp(`(?:^|[\\r\\n\\s])${n}\\s+0\\s+obj\\b`, 'g');
  let last = -1;
  for (const match of text.matchAll(pattern)) last = match.index! + match[0].length;
  if (last < 0) throw new TypeError(`The PDF has no object ${n}; it may sit in a compressed object stream, which only non-stream objects can.`);
  return last;
}

export function readPdfImage(pdf: Uint8Array, objectNumber: number): PdfImage {
  if (!Number.isSafeInteger(objectNumber) || objectNumber < 1) throw new TypeError('An image is named by a positive object number.');
  const text = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength).toString('latin1');
  if (!text.startsWith('%PDF-')) throw new TypeError('Not a PDF file.');
  const [dict, dictEnd] = parseValue(text, objectStart(text, objectNumber));
  if (!(dict instanceof Map)) throw new TypeError(`Object ${objectNumber} is not a stream dictionary.`);
  const name = (key: string) => { const v = dict.get(key); return isName(v) ? v.name : Array.isArray(v) && v.length === 1 && isName(v[0]) ? v[0].name : undefined; };
  if (name('Subtype') !== 'Image') throw new TypeError(`Object ${objectNumber} is not an image XObject.`);
  const filter = name('Filter');
  if (filter !== 'FlateDecode') throw new TypeError(`Object ${objectNumber} uses ${filter ?? 'no or a chained'} filter; only FlateDecode is read.`);
  if (dict.has('DecodeParms')) throw new TypeError(`Object ${objectNumber} states decode parameters (a predictor); they are not read.`);
  const space = name('ColorSpace'), channels = space === 'DeviceRGB' ? 3 : space === 'DeviceGray' ? 1 : 0;
  if (!channels) throw new TypeError(`Object ${objectNumber} is in ${space ?? 'an indirect or indexed'} colour space; only DeviceRGB and DeviceGray are read.`);
  const width = dict.get('Width'), height = dict.get('Height');
  if (dict.get('BitsPerComponent') !== 8 || typeof width !== 'number' || typeof height !== 'number' || !(width > 0 && height > 0)) throw new TypeError(`Object ${objectNumber} is not an eight-bit image of stated size.`);
  const keyword = text.slice(dictEnd).match(/^\s*stream(\r\n|\n)/);
  if (!keyword) throw new TypeError(`Object ${objectNumber} has no stream.`);
  const dataStart = dictEnd + keyword[0].length;
  let length = dict.get('Length');
  if (isRef(length)) {
    const [resolved] = parseValue(text, objectStart(text, length.ref));
    length = typeof resolved === 'number' ? resolved : undefined;
  }
  let dataEnd = typeof length === 'number' ? dataStart + length : -1;
  if (dataEnd < 0 || !/^\s*endstream/.test(text.slice(dataEnd, dataEnd + 16))) {
    const end = text.indexOf('endstream', dataStart);
    if (end < 0) throw new TypeError(`Object ${objectNumber}'s stream does not end.`);
    dataEnd = end - (text[end - 2] === '\r' && text[end - 1] === '\n' ? 2 : /[\r\n]/.test(text[end - 1]) ? 1 : 0);
  }
  const data = new Uint8Array(inflateSync(pdf.subarray(dataStart, dataEnd)));
  if (data.length !== width * height * channels) throw new TypeError(`Object ${objectNumber} inflates to ${data.length} bytes, not the ${width * height * channels} its size states.`);
  return { width, height, channels: channels as 1 | 3, data };
}
