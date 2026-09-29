// What a restored source file must start with, by its extension. A publisher landing page answers HTTP 200 with HTML, so
// the status alone never proves a download is the file its manifest path names.
import { open } from 'node:fs/promises';

/** Enough of a file's start to recognise its format, and an HTML page by its first tag. */
export const SOURCE_FORMAT_HEAD_BYTES = 1024;

const ascii = (text: string) => [...text].map(character => character.charCodeAt(0));
const FORMATS: readonly { readonly name: string; readonly extensions: readonly string[]; readonly signatures: readonly (readonly (number | null)[])[] }[] = [
  { name: 'a JPEG image', extensions: ['.jpg', '.jpeg'], signatures: [[0xff, 0xd8, 0xff]] },
  { name: 'a PNG image', extensions: ['.png'], signatures: [[0x89, ...ascii('PNG\r\n\x1a\n')]] },
  // RIFF, a four-byte chunk length, then WEBP.
  { name: 'a WebP image', extensions: ['.webp'], signatures: [[...ascii('RIFF'), null, null, null, null, ...ascii('WEBP')]] },
  // Little- and big-endian TIFF, then the same for BigTIFF.
  { name: 'a TIFF image', extensions: ['.tif', '.tiff'], signatures: [ascii('II*\0'), ascii('MM\0*'), ascii('II+\0'), ascii('MM\0+')] },
  // The first header card of every FITS file is SIMPLE, padded to eight columns, then the value indicator.
  { name: 'a FITS file', extensions: ['.fits', '.fit', '.fts'], signatures: [ascii('SIMPLE  =')] },
  { name: 'a gzip stream', extensions: ['.gz'], signatures: [[0x1f, 0x8b]] },
];

const matches = (head: Uint8Array, signature: readonly (number | null)[]) =>
  head.length >= signature.length && signature.every((byte, index) => byte === null || head[index] === byte);

function isHtml(head: Uint8Array): boolean {
  const text = Buffer.from(head).toString('latin1').replace(/^﻿|^\xef\xbb\xbf/u, '').trimStart().toLowerCase();
  return text.startsWith('<!doctype html') || text.startsWith('<html') || /^<!--[\s\S]*?-->\s*<(!doctype html|html)/u.test(text);
}
function isText(head: Uint8Array): boolean {
  return head.length > 0 && head.every(byte => byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte !== 0x7f));
}

/** What the bytes are, for a refusal: a known format, HTML, text, or their first bytes. */
function describe(head: Uint8Array, size: number): string {
  const bytes = `${size.toLocaleString('en-US')} bytes`;
  if (!size) return 'an empty file';
  const known = FORMATS.find(format => format.signatures.some(signature => matches(head, signature)));
  if (known) return `${known.name} (${bytes})`;
  if (isHtml(head)) return `an HTML document (${bytes})`;
  if (isText(head)) return `a text body (${bytes})`;
  return `unrecognised bytes starting ${Buffer.from(head.subarray(0, 8)).toString('hex')} (${bytes})`;
}

/**
 * Why `head` (the first bytes of a file `size` bytes long) is not the file `path` names, or null when it is. A path whose
 * extension names an image, FITS or gzip format must start with that format's signature. Any other path (a table, a
 * JSON record) may hold text, but never an HTML page, unless the path itself names HTML.
 */
export function sourceFormatProblem(path: string, head: Uint8Array, size = head.length): string | null {
  const name = path.toLowerCase();
  const expected = FORMATS.find(format => format.extensions.some(extension => name.endsWith(extension)));
  if (expected) return expected.signatures.some(signature => matches(head, signature)) ? null : `${describe(head, size)}, not ${expected.name}`;
  if (/\.x?html?$/u.test(name)) return null;
  return size && isHtml(head) ? `${describe(head, size)}, not a data file` : null;
}

/** The same check for a file on disk, reading only its start. */
export async function sourceFileFormatProblem(path: string, file: string): Promise<string | null> {
  const handle = await open(file, 'r');
  try {
    const { size } = await handle.stat(), head = Buffer.alloc(Math.min(size, SOURCE_FORMAT_HEAD_BYTES));
    await handle.read(head, 0, head.length, 0);
    return sourceFormatProblem(path, head, size);
  } finally { await handle.close(); }
}
