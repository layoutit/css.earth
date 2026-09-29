// Entry script: node .github/scripts/checks/check-no-hashes.mts [--prepared]
/**
 * The only hash this repository keeps is the R2 content address in `src/objects/<id>/inventory.json`: git identifies
 * every tracked byte, and our R2 copies are the reference for everything git does not hold. So no other tracked file
 * may contain a SHA-256 (64 lowercase hex digits): not as a pin, a receipt, an identity, a file name or prose.
 * `--prepared` also scans the baked JSON restored under `src/objects/<id>/prepared/`, which is published to R2.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const HASH = /(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/u;
const INVENTORY = /^src\/objects\/[^/]+\/inventory\.json$/u;

/** Each line of `text` holding a SHA-256, as `path:line: excerpt`; none for an inventory or a binary file. */
export function hashLines(path: string, bytes: Uint8Array): string[] {
  if (INVENTORY.test(path)) return [];
  // A NUL in the first 8 KB marks a binary file (an image, a compressed input); its bytes are not text to read.
  if (bytes.subarray(0, 8192).includes(0)) return [];
  const found: string[] = [];
  new TextDecoder().decode(bytes).split('\n').forEach((line, index) => {
    const match = HASH.exec(line);
    if (match) found.push(`${path}:${index + 1}: ${line.slice(Math.max(0, match.index - 40), match.index + 80).trim()}`);
  });
  return found;
}

function preparedJson(root: string): string[] {
  const objects = resolve(root, 'src/objects'), files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.json')) files.push(relative(root, path));
    }
  };
  for (const id of readdirSync(objects)) {
    const prepared = join(objects, id, 'prepared');
    try { if (statSync(prepared).isDirectory()) walk(prepared); } catch { /* an object without baked files */ }
  }
  return files;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 }).split('\0').filter(Boolean);
  const files = [...tracked, ...(process.argv.includes('--prepared') ? preparedJson(root) : [])];
  const found = files.flatMap(path => {
    let bytes: Uint8Array;
    try { bytes = readFileSync(resolve(root, path)); } catch { return []; }
    return hashLines(path, bytes);
  });
  if (found.length) {
    console.error(`${found.length} line(s) hold a SHA-256 outside src/objects/<id>/inventory.json. Git identifies tracked bytes and ` +
      `inventory.json addresses R2; name files by path instead:\n${found.slice(0, 200).join('\n')}` +
      (found.length > 200 ? `\n… and ${found.length - 200} more` : ''));
    process.exit(1);
  }
  console.log(`No SHA-256 outside inventory.json in ${files.length} files.`);
}
