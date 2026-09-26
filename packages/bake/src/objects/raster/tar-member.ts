/** One regular file from an uncompressed POSIX or ustar tar archive, so a data deposit can stay pinned exactly as published
 * while its members are read. Only regular-file entries are read; links, sparse files and long-name extensions are refused. */
export function readTarMember(archive: Uint8Array, name: string): Buffer {
  const bytes = Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
  const field = (block: Buffer, start: number, length: number) => { const raw = block.subarray(start, start + length), end = raw.indexOf(0); return raw.subarray(0, end < 0 ? length : end).toString('utf8'); };
  const octal = (block: Buffer, start: number, length: number) => { const text = field(block, start, length).trim(); if (!/^[0-7]+$/u.test(text)) throw new TypeError('Tar header number is not octal.'); return parseInt(text, 8); };
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i]!;
    if (checksum !== octal(header, 148, 8)) throw new TypeError(`Tar header checksum differs at byte ${offset}.`);
    const type = String.fromCharCode(header[156]!), prefix = field(header, 345, 155), entry = (prefix ? `${prefix}/` : '') + field(header, 0, 100);
    const size = octal(header, 124, 12), start = offset + 512;
    if (!['0', '\0', '5'].includes(type)) throw new TypeError(`Unsupported tar entry type ${JSON.stringify(type)} for ${entry}.`);
    if (start + size > bytes.length) throw new TypeError(`Tar member ${entry} is truncated.`);
    if (type !== '5' && entry === name) return Buffer.from(bytes.subarray(start, start + size));
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new TypeError(`The tar archive has no member ${name}.`);
}
