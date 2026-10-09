// Entry script: node .github/scripts/checks/check-color-spelling.mts
/**
 * The repository spells "color" one way: in reader text, source records, identifiers, file names and comments. The
 * other spelling stays only where someone else wrote it: inside a URL, in the few proper names listed here, and in
 * the third-party files listed here, which are kept as their publishers wrote them.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OTHER = new RegExp('colo' + 'ur', 'iu');
/** A URL, the Giotto camera, ESA's page section and the cited CIE title keep their own spelling. */
const KEPT = new RegExp(`https?://[^\\s"'<>)\\]]+|Colo${'u'}rs & filters|Colo${'u'}r-matching functions of CIE 1931|Multicolo${'u'}r Camera`, 'gu');
/** Files this check does not own: the lockfile, WorldWide Telescope's imageset list, a publisher's page, a recorded answer of the
 * papers API with a paper's abstract in it, two pinned scripts, and the root README, which its author edits by hand. */
const THIRD_PARTY = new Set([
  'README.md',
  'pnpm-lock.yaml',
  'src/sources/wwt/core-imagesets.jsonl',
  'packages/telescope-cli/src/fixtures/telescope-papers/article.html',
  'packages/telescope-cli/src/fixtures/telescope-stars/served-m51.json',
  'src/objects/lmc-volume/source/candidates/source/wise-registration/validate-image-registration.pinned.py',
  'labs/nebula/packages/reconstruction/src/registration/validate-image-registration.py',
]);

/** Each line of a text file that spells it the other way, as `path:line: excerpt`; none for a binary or third-party file. */
export function otherSpellingLines(path: string, bytes: Uint8Array): string[] {
  if (THIRD_PARTY.has(path)) return [];
  // A NUL in the first 8 KB marks a binary file (an image, a database); its bytes are not text to read.
  if (bytes.subarray(0, 8192).includes(0)) return [];
  const found: string[] = [];
  new TextDecoder().decode(bytes).split('\n').forEach((line, index) => {
    const match = OTHER.exec(line.replace(KEPT, ''));
    if (match) found.push(`${path}:${index + 1}: ${line.trim().slice(0, 160)}`);
  });
  return found;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 }).split('\0').filter(Boolean);
  const found = tracked.flatMap(path => {
    const named = OTHER.test(path) && !THIRD_PARTY.has(path) ? [`${path}: the file name`] : [];
    let bytes: Uint8Array;
    try { bytes = readFileSync(resolve(root, path)); } catch { return named; }
    return [...named, ...otherSpellingLines(path, bytes)];
  });
  if (found.length) {
    console.error(`${found.length} place(s) spell "color" the other way. Write "color", or add a quoted proper name to ` +
      `KEPT in .github/scripts/checks/check-color-spelling.mts:\n${found.slice(0, 200).join('\n')}` +
      (found.length > 200 ? `\n… and ${found.length - 200} more` : ''));
    process.exit(1);
  }
  console.log(`"color" is spelled one way in ${tracked.length} files.`);
}
