#!/usr/bin/env node
/** Asset-free documentation audit. PRs own changed files and newly introduced findings. */
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {posix, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export interface Finding {file: string; target?: string; reason: string}
interface Snapshot {known: Set<string>; contents: Map<string, string>}
interface Link {target: string; path: string; fragment: string}
interface Audit {
  markdownFiles: number;
  localLinksChecked: number;
  errors: Finding[];
  documentation: {guides: number; reachableGuides: number; illustrations: number; usedIllustrations: number};
}
export interface DocumentationReport extends Audit {
  base: string | null;
  unchangedFindings: number;
  scope: string;
}

const scope = 'Checks inline Markdown, used reference links, HTML a/img targets, Markdown heading anchors, docs placement and duplicate body accounts. Excludes fenced examples, external URL availability and content quality. --base rejects findings in changed files and new findings anywhere (including unchanged inbound links); unrelated baseline findings remain nonblocking. --all rejects every finding.';

function git(root: string, args: string[], input?: string): Buffer {
  return execFileSync('git', args, {cwd: root, input, maxBuffer: 128 * 1024 * 1024});
}

function paths(buffer: Buffer): string[] {return buffer.toString('utf8').split('\0').filter(Boolean);}

/** Read by object id, in one Git invocation: sparse checkouts need no materialized body assets. */
function committed(root: string, revision: string): Snapshot {
  const known = new Set<string>();
  const markdown: {path: string; oid: string}[] = [];
  for (const entry of paths(git(root, ['ls-tree', '-r', '-z', '--full-tree', revision]))) {
    const match = /^\d+ (blob|commit) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error(`Unexpected Git tree entry: ${entry}`);
    const [, type, oid, path] = match;
    if (!oid || !path) throw new Error('Incomplete Git tree entry');
    known.add(path);
    if (type === 'blob' && path.endsWith('.md')) markdown.push({path, oid});
  }
  const contents = new Map<string, string>();
  if (!markdown.length) return {known, contents};
  const output = git(root, ['cat-file', '--batch'], markdown.map(({oid}) => oid).join('\n') + '\n');
  let offset = 0;
  for (const {path, oid} of markdown) {
    const end = output.indexOf(10, offset);
    if (end < 0) throw new Error(`Missing Git blob header for ${path}`);
    const header = /^([a-f0-9]+) blob (\d+)$/.exec(output.subarray(offset, end).toString('utf8'));
    const size = Number(header?.[2]);
    if (!header || header[1] !== oid || !Number.isSafeInteger(size) || size < 0 || end + 1 + size >= output.length) {
      throw new Error(`Invalid Git blob for ${path}`);
    }
    contents.set(path, output.subarray(end + 1, end + 1 + size).toString('utf8'));
    offset = end + 1 + size + 1;
  }
  return {known, contents};
}

function workingTree(root: string, head: Snapshot): Snapshot {
  const known = new Set(paths(git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])));
  // Git distinguishes deliberately deleted files from absent skip-worktree entries.
  for (const path of paths(git(root, ['diff', '--name-only', '--diff-filter=D', '--no-renames', '-z', 'HEAD']))) known.delete(path);
  const contents = new Map<string, string>();
  for (const path of known) {
    if (!path.endsWith('.md')) continue;
    const absolute = resolve(root, path);
    const content = existsSync(absolute) && statSync(absolute).isFile() ? readFileSync(absolute, 'utf8') : head.contents.get(path);
    if (content === undefined) throw new Error(`Cannot read Markdown file: ${path}`);
    contents.set(path, content);
  }
  return {known, contents};
}

export function withoutFences(text: string): string {
  const result: string[] = [];
  let fence: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (!fence) result.push(line);
  }
  return result.join('\n').replace(/<!--[\s\S]*?(?:-->|$)/g, '');
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0'};
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity: string, key: string) => {
    if (!key.startsWith('#')) return named[key] ?? entity;
    const point = key[1]?.toLowerCase() === 'x' ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\ufffd';
  });
}

function htmlTags(source: string): {tag: string; attributes: Map<string, string>}[] {
  const tags: {tag: string; attributes: Map<string, string>}[] = [];
  for (const match of source.matchAll(/<([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)) {
    const attributes = new Map<string, string>();
    for (const attribute of (match[2] ?? '').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = attribute[1];
      if (name) attributes.set(name.toLowerCase(), decodeHtml(attribute[2] ?? attribute[3] ?? attribute[4] ?? ''));
    }
    tags.push({tag: (match[1] ?? '').toLowerCase(), attributes});
  }
  return tags;
}

export function anchors(text: string): Set<string> {
  const source = withoutFences(text);
  const result = new Set<string>();
  for (const {attributes} of htmlTags(source)) for (const name of ['id', 'name']) {
    const value = attributes.get(name);
    if (value) result.add(value);
  }
  const seen = new Map<string, number>();
  for (const match of source.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const heading = (match[1] ?? '').replace(/<[^>]+>/g, '').toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replaceAll(' ', '-');
    const occurrence = seen.get(heading) ?? 0;
    seen.set(heading, occurrence + 1);
    result.add(heading + (occurrence ? `-${occurrence}` : ''));
  }
  return result;
}

function decodeUrl(value: string): string {
  try {return decodeURIComponent(value);} catch {return value;}
}

export function localLinks(file: string, text: string): Link[] {
  const source = withoutFences(text);
  const targets = [...source.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/g)].map(match => match[1] ?? '');
  const key = (label: string): string => label.trim().replace(/\s+/g, ' ').toLowerCase();
  const references = new Map<string, string>();
  for (const match of source.matchAll(/^ {0,3}\[([^\]\n]+)\]:\s*(<[^>\n]+>|\S+)/gm)) references.set(key(match[1] ?? ''), match[2] ?? '');
  for (const match of source.matchAll(/!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?(?![(:])/g)) {
    const target = references.get(key(match[2] || match[1] || ''));
    if (target) targets.push(target);
  }
  for (const {tag, attributes} of htmlTags(source)) {
    const target = attributes.get(tag === 'a' ? 'href' : tag === 'img' ? 'src' : '');
    if (target) targets.push(target);
  }
  const links: Link[] = [];
  for (let target of targets) {
    target = target.trim();
    target = target.startsWith('<') ? target.slice(1, target.indexOf('>')) : target.split(/\s+["'(]/, 1)[0] ?? '';
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(target)) continue;
    const hash = target.indexOf('#');
    const beforeFragment = hash < 0 ? target : target.slice(0, hash);
    const query = beforeFragment.indexOf('?');
    const path = decodeUrl(query < 0 ? beforeFragment : beforeFragment.slice(0, query));
    links.push({target, path: path ? posix.normalize(path.startsWith('/') ? path : posix.join(posix.dirname(file), path)) : file, fragment: hash < 0 ? '' : decodeUrl(target.slice(hash + 1))});
  }
  return links;
}

// `prepared/provenance.json` and `prepared/page.json` are build outputs, never committed: the
// contract in CLAUDE.md says `prepare-provenance.mts` and `restore-object-json.mts` write them in
// `predev`/`prebuild`. A checkout therefore never holds one, so a body README that cites its own
// generated contract file is describing the record correctly, not linking at nothing. Accept the
// path only where the object's tracked `prepared/` directory proves the object exists.
const BUILD_OUTPUTS = new Set(['prepared/provenance.json', 'prepared/page.json']);
function buildOutput(path: string, known: ReadonlySet<string>): boolean {
  const directory = posix.dirname(posix.dirname(path));
  return BUILD_OUTPUTS.has(path.slice(directory.length + 1)) && known.has(`${directory}/inventory.json`);
}

function audit(snapshot: Snapshot): Audit {
  const {known, contents} = snapshot;
  const errors: Finding[] = [];
  let localLinksChecked = 0;
  const markdown = [...known].filter(path => path.endsWith('.md')).sort();
  const directories = new Set<string>();
  for (const file of known) {
    let directory = posix.dirname(file);
    while (directory !== '.' && directory !== '/') {directories.add(directory); directory = posix.dirname(directory);}
  }
  const links = new Map(markdown.map(file => [file, localLinks(file, contents.get(file) ?? '')]));
  const headingAnchors = new Map<string, Set<string>>();
  for (const file of markdown) for (const {target, path, fragment} of links.get(file) ?? []) {
    localLinksChecked++;
    if (!known.has(path) && !buildOutput(path, known) && !directories.has(path.replace(/\/$/, ''))) errors.push({file, target, reason: 'missing repository path'});
    else if (fragment && path.endsWith('.md') && known.has(path)) {
      let found = headingAnchors.get(path);
      if (!found) {found = anchors(contents.get(path) ?? ''); headingAnchors.set(path, found);}
      if (!found.has(fragment)) errors.push({file, target, reason: 'missing Markdown anchor'});
    }
  }
  const docs = [...known].filter(path => path.startsWith('docs/')).sort();
  const guides = new Set(docs.filter(path => path.endsWith('.md')));
  const illustrations = new Set(docs.filter(path => path.startsWith('docs/images/') && /\.(png|jpg|jpeg|webp|avif|gif|svg)$/i.test(path)));
  for (const file of docs) if (!guides.has(file) && !illustrations.has(file)) errors.push({file, reason: 'docs/ accepts Markdown guides and illustrations under docs/images/; move code, fixtures and raw output to their owner'});
  const index = 'docs/README.md';
  if (!guides.has(index)) errors.push({file: index, reason: 'missing documentation index'});
  const pending = guides.has(index) ? [index] : [];
  const reachable = new Set<string>();
  const used = new Set<string>();
  while (pending.length) {
    const file = pending.pop();
    if (!file || reachable.has(file)) continue;
    reachable.add(file);
    for (const {path} of links.get(file) ?? []) {
      if (guides.has(path)) pending.push(path);
      else if (illustrations.has(path)) used.add(path);
    }
  }
  for (const file of guides) if (!reachable.has(file)) errors.push({file, reason: 'guide is not reachable through links from docs/README.md'});
  for (const file of illustrations) if (!used.has(file)) errors.push({file, reason: 'illustration is not linked from a guide reachable from docs/README.md'});
  for (const file of [...known].sort()) if (/^src\/objects\/[^/]+\/(SOURCE|EVIDENCE|USAGE)\.md$/i.test(file)) errors.push({file, reason: 'use the body README for sources and evidence; shared guides cover usage'});
  return {markdownFiles: markdown.length, localLinksChecked, errors, documentation: {guides: guides.size, reachableGuides: reachable.size, illustrations: illustrations.size, usedIllustrations: used.size}};
}

export function checkDocumentation(root: string, baseRef: string | null): DocumentationReport {
  const base = baseRef === null ? null : git(root, ['rev-parse', '--verify', `${baseRef}^{commit}`]).toString('utf8').trim();
  const head = committed(root, 'HEAD');
  const current = audit(workingTree(root, head));
  if (base === null) return {...current, base, unchangedFindings: 0, scope};
  const changed = new Set([
    ...paths(git(root, ['diff', '--name-only', '--no-renames', '-z', base])),
    ...paths(git(root, ['ls-files', '--others', '--exclude-standard', '-z'])),
  ]);
  const baseline = audit(committed(root, base));
  const findingKey = ({file, target, reason}: Finding): string => JSON.stringify([file, target, reason]);
  const previous = new Set(baseline.errors.map(findingKey));
  const errors = current.errors.filter(error => changed.has(error.file) || !previous.has(findingKey(error)));
  return {...current, errors, base, unchangedFindings: current.errors.length - errors.length, scope};
}

function main(args: string[]): void {
  const all = args.length === 1 && args[0] === '--all';
  const base = args.length === 2 && args[0] === '--base' ? args[1] : undefined;
  if (!all && !base) throw new Error('Usage: node tools/audits/check-documentation-links.mts --all | --base <ref>');
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).toString('utf8').trim();
  if (realpathSync(root) !== realpathSync(process.cwd())) throw new Error('Run from the repository root');
  const result = checkDocumentation(root, base ?? null);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.errors.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {main(process.argv.slice(2));} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
