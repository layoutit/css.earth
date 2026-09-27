/** Fetch only the FITS members of Perry's 2.8 GB release, using its ZIP directory.
 * curl uses the host trust store; 7z reads the nested .7z and .zip archives.
 * No provider code is executed. Archive CRCs verify transport; recipes name products.
 */
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { crc32, inflateRawSync } from 'node:zlib';

function range(url: string, requested: string, limit: number) {
  return execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--retry', '2', '--max-time', '180',
    '--max-filesize', String(limit), '--range', requested, url], { maxBuffer: limit + 1 });
}

export async function fetchFits(archive: string, orbits: readonly number[], directory: string) {
  await mkdir(directory, { recursive: true });
  const tail = range(archive, '-65557', 65557);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { end = i; break; }
  if (end < 0 || tail.readUInt16LE(end + 4) !== 0 || tail.readUInt16LE(end + 6) !== 0) throw new Error('Expected a single-disk ZIP release.');
  const offset = tail.readUInt32LE(end + 16), size = tail.readUInt32LE(end + 12), count = tail.readUInt16LE(end + 10);
  if (offset === 0xffffffff || size > 4e6 || count === 0xffff) throw new Error('Unsupported ZIP directory.');
  const central = range(archive, `${offset}-${offset + size - 1}`, size);
  const members: { name: string; orbit: number; offset: number; compressed: number; bytes: number; crc: number }[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > central.length || central.readUInt32LE(at) !== 0x02014b50) throw new Error('Truncated ZIP directory.');
    const n = central.readUInt16LE(at + 28), x = central.readUInt16LE(at + 30), c = central.readUInt16LE(at + 32);
    const name = central.toString('utf8', at + 46, at + 46 + n), match = /^perry_etal_2025\/PJ(\d{2})\/PJ\1_FITS[ _]files(?:_80)?\.(?:7z|zip)$/u.exec(name);
    if (match && orbits.includes(Number(match[1]))) {
      const compressed = central.readUInt32LE(at + 20), bytes = central.readUInt32LE(at + 24);
      if (central.readUInt16LE(at + 8) & 1 || central.readUInt16LE(at + 10) !== 8 || compressed > 150e6 || bytes > 150e6) throw new Error('Unsupported FITS archive member.');
      members.push({ name, orbit: Number(match[1]), offset: central.readUInt32LE(at + 42), compressed, bytes, crc: central.readUInt32LE(at + 16) });
    }
    at += 46 + n + x + c;
  }
  if (at !== central.length || members.length !== orbits.length || new Set(members.map(m => m.orbit)).size !== orbits.length) throw new Error('FITS members differ from requested orbits.');
  for (const member of members) {
    const file = join(directory, member.name.split('/').at(-1)!);
    let bytes = await readFile(file).catch(() => undefined);
    if (!bytes) {
      const part = range(archive, `${member.offset}-${member.offset + member.compressed + 1023}`, member.compressed + 1024);
      if (part.readUInt32LE(0) !== 0x04034b50 || part.readUInt16LE(8) !== 8) throw new Error('Invalid FITS local ZIP header.');
      const start = 30 + part.readUInt16LE(26) + part.readUInt16LE(28);
      if (part.toString('utf8', 30, 30 + part.readUInt16LE(26)) !== member.name || start + member.compressed > part.length) throw new Error('ZIP member identity mismatch.');
      bytes = inflateRawSync(part.subarray(start, start + member.compressed), { maxOutputLength: member.bytes });
    }
    if (bytes.length !== member.bytes || crc32(bytes) !== member.crc) throw new Error(`FITS member CRC mismatch: ${member.name}`);
    await writeFile(file, bytes);
    const destination = join(directory, `PJ${String(member.orbit).padStart(2, '0')}`);
    await mkdir(destination, { recursive: true });
    execFileSync('7z', ['e', '-y', '-bso0', '-bsp0', file, `-o${destination}`, '-r', 'JIR_IMG_RDR_*_M_*.fits']);
    await access(destination);
    console.error(`Restored ${member.name}`);
  }
}
