/** Decode the preserved JPEG from the publisher's jpeg2ps EPS, without resampling. */
export function extractJpegFromEps(source: string): Uint8Array {
  if (!source.includes('jpeg2ps') || !source.includes('/ASCII85Decode filter') || !source.includes('/DCTDecode filter'))
    throw new TypeError('Expected the publisher jpeg2ps source.');
  const start = source.indexOf('} exec\n');
  const end = source.indexOf('~>', start);
  if (start < 0 || end < 0) throw new TypeError('Missing ASCII85 image stream.');
  const data = source.slice(start + 7, end).replace(/\s/g, '');
  const bytes: number[] = []; let group: number[] = [];
  const decode = (count: number) => {
    while (group.length < 5) group.push(84);
    const value = group.reduce((sum, digit) => sum * 85 + digit, 0);
    if (value > 0xffffffff) throw new TypeError('Invalid ASCII85 group.');
    for (let i = 0; i < count - 1; i++) bytes.push(Math.floor(value / 256 ** (3 - i)) % 256);
    group = [];
  };
  for (const symbol of data) {
    if (symbol === 'z') { if (group.length) throw new TypeError('Invalid zero group.'); bytes.push(0, 0, 0, 0); continue; }
    const code = symbol.charCodeAt(0) - 33;
    if (code < 0 || code > 84) throw new TypeError('Invalid ASCII85 symbol.');
    group.push(code); if (group.length === 5) decode(5);
  }
  if (group.length === 1) throw new TypeError('Incomplete ASCII85 group.');
  if (group.length) decode(group.length);
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217)
    throw new TypeError('Decoded stream is not a complete JPEG.');
  return Uint8Array.from(bytes);
}
