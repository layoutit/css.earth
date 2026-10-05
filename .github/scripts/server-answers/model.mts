/** Deterministic answer format and validation shared by the offline safety check. */
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
export type Target = 'preview' | 'netlify' | 'cloudflare';
export interface AnswerRequest { id: string; path: string; method?: string; headers?: Record<string, string>; body?: string; expected?: number; title?: string; html?: boolean; conditional?: 'etag' | 'modified'; }
export interface Answer { id: string; status: number; headers: Record<string, string>; body: unknown; }
export const normalisations = [
  'Only explorer-brand-version link text and its GitHub aria-label counter become vPINNED; commit counts change build version.',
  'HTML and catalogue /_astro/<name>.<hash>.<ext> addresses retain name, extension and byte-size class, not hash; browser bundle contents belong to L3.',
  'HTML retains rewritten marker regions and static page/remainder lengths plus md5; unchanged regions reference the static file.',
  'Repository source-link commit ids become 40 zeros in all recorded text; build provenance is not server behavior, paths remain exact.',
  'JSON object keys sorted recursively; array order preserved.',
  'All headers retained except date, server, connection, keep-alive and host-derived provider/request identifiers.',
  'ETag retains presence and weak/strong kind; values contain file timestamps and can change between recordings of the same build.',
  'Content-Length reduced to absent/zero/nonzero: exact body size is retained in the body.',
  'Loopback origins in retained header values replaced with https://answers.invalid; ephemeral port is not build behavior.',
];
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new TypeError('Expected an object');
  return value;
}
export function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, item]) => [key, sorted(item)]));
}
export const serialise = (value: unknown) => JSON.stringify(sorted(value), null, 2) + '\n';
export function canonicalSourceLinks(value: string): string {
  return value.replace(/https:\/\/github\.com\/layoutit\/cssEarth\/blob\/[0-9a-f]{40}\//gu,
    'https://github.com/layoutit/cssEarth/blob/' + '0'.repeat(40) + '/');
}
function canonicalJson(value: unknown): unknown {
  if (typeof value === 'string') return canonicalSourceLinks(value);
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canonicalJson(item)]));
}
const astroClasses = new Map<string, string>();
/** A name+extension+byte-size class distinguishes same-name chunks without retaining a content hash. */
export async function prepareAstroClasses(dist: string): Promise<void> {
  astroClasses.clear();
  for (const filename of await readdir(resolve(dist, '_astro'))) {
    const match = /^(.*)\.[A-Za-z0-9_-]+\.(js|css|mjs)$/u.exec(filename);
    if (match) astroClasses.set(`/_astro/${filename}`, `/_astro/${match[1]}.SIZE${(await stat(resolve(dist, '_astro', filename))).size}.${match[2]}`);
  }
}
export function canonicalHtml(value: string): string {
  const chunks = new Map<string, string>();
  const classes = new Map<string, number>();
  return canonicalSourceLinks(value).replace(/<a\b[^>]*\bclass="explorer-brand-version"[^>]*>v\d+\.\d+<\/a>/gu,
    link => link.replace(/aria-label="GitHub v\d+\.\d+"/u, 'aria-label="GitHub vPINNED"').replace(/>v\d+\.\d+<\/a>$/u, '>vPINNED</a>'))
    .replace(/\/_astro\/([^/\s"'<>?]+)\.[A-Za-z0-9_-]+\.(js|css|mjs)(?=[\s"'<>?]|$)/gu, (url, name: string, extension: string) => {
      const known = astroClasses.get(url); if (known) return known;
      const previous = chunks.get(url); if (previous) return previous;
      const key = `${name}.${extension}`, ordinal = (classes.get(key) ?? 0) + 1; classes.set(key, ordinal);
      const placeholder = `/_astro/${name}.HASH${ordinal}.${extension}`; chunks.set(url, placeholder); return placeholder;
    });
}
export const byteSummary = (value: string | Buffer) => {
  const bytes = typeof value === 'string' ? Buffer.from(value) : value;
  return { length: bytes.length, md5: createHash('md5').update(bytes).digest('hex') };
};
const regionNames = ['search-shell', 'prepared-scene'] as const;
function splitRegions(html: string) {
  const regions: Record<string, string> = {};
  const cuts: { start: number; end: number }[] = [];
  for (const name of regionNames) {
    const marker = `<!--${name}:start-->`, start = html.indexOf(marker);
    const end = html.indexOf(`<!--${name}:end-->`);
    if (start < 0 && end < 0) continue;
    if (start < 0 || end < start + marker.length) throw new Error(`Invalid HTML rewrite region ${name}`);
    regions[name] = html.slice(start + marker.length, end);
    cuts.push({ start: start + marker.length, end });
  }
  cuts.sort((a, b) => a.start - b.start);
  let offset = 0, remainder = '';
  for (const cut of cuts) { if (cut.start < offset) throw new Error('Overlapping HTML regions'); remainder += html.slice(offset, cut.start); offset = cut.end; }
  return { regions, remainder: remainder + html.slice(offset) };
}
export function compactHtml(value: string, staticHtml: string, file: string, request?: AnswerRequest): unknown {
  const actual = canonicalHtml(value), baseline = canonicalHtml(staticHtml);
  const answer = splitRegions(actual), page = splitRegions(baseline);
  const regions: Record<string, unknown> = {};
  for (const name of new Set([...Object.keys(answer.regions), ...Object.keys(page.regions)])) {
    regions[name] = answer.regions[name] === page.regions[name] ? { kind: 'static' } : { kind: 'rewritten', encoding: 'gzip-base64', value: answer.regions[name] === undefined ? null : gzipSync(answer.regions[name], { level: 6 }).toString('base64') };
  }
  return { kind: 'html', static: { file, ...byteSummary(baseline) }, outside: { equal: answer.remainder === page.remainder, ...byteSummary(answer.remainder) }, regions,
    titlePresent: request?.title ? value.includes(request.title) : true,
    firstView: /data-startup-discovery|data-prepared-descriptor/u.test(value), searchSubmitted: value.includes('data-search-submitted') };
}
// Provider clocks and routing/request identifiers describe the host, not the application.
export const volatileHeaders = new Set(['date', 'server', 'connection', 'keep-alive', 'host', 'x-nf-request-id', 'cf-ray', 'cf-cache-status', 'age', 'server-timing', 'x-served-by', 'x-cache', 'x-cache-hits', 'via']);
export async function recordAnswer(id: string, response: Response, origin: string, page?: { html: string; file: string; request: AnswerRequest }): Promise<Answer> {
  const headers: Record<string, string> = {};
  for (const [name, value] of response.headers) {
    if (volatileHeaders.has(name)) continue;
    headers[name] = canonicalSourceLinks(value.replaceAll(origin, 'https://answers.invalid'));
    if (name === 'last-modified') headers[name] = 'present';
    if (name === 'expires') headers[name] = 'present';
    if (name === 'etag') headers[name] = /^W\//u.test(value) ? 'present:weak' : 'present:strong';
    if (id.startsWith('static-') && name === 'content-range') headers[name] = value.replace(/\/\d+$/u, '/BUNDLE_LENGTH');
    if (name === 'content-length') headers[name] = value === '0' ? 'zero' : 'nonzero';
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get('content-type') ?? '';
  let body: unknown;
  if (bytes.length && type.includes('json')) body = { kind: 'json', value: sorted(canonicalJson(JSON.parse(bytes.toString('utf8')))) };
  else if (!bytes.length || /text\/|xml|javascript|svg/u.test(type)) {
    const value = canonicalSourceLinks(bytes.toString('utf8'));
    body = type.includes('text/html') && page && bytes.length ? compactHtml(value, page.html, page.file, page.request) : { kind: 'text', value: type.includes('text/html') ? canonicalHtml(value) : value };
  }
  else body = { kind: 'binary', ...byteSummary(bytes), prefix: bytes.subarray(0, 64).toString('hex') };
  if (id.startsWith('static-') && /javascript/u.test(type)) body = { kind: 'bundle', present: bytes.length > 0, ...(id === 'static-range' ? { rangeLength: bytes.length } : {}) };
  return { id, status: response.status, headers, body };
}
/** Compact large JSON answers without losing their sorted, parsed values on replay. */
export function storedAnswer(answer: Answer): Answer {
  const body = object(answer.body);
  if (body.kind !== 'json') return answer;
  const value = JSON.stringify(sorted(body.value));
  return value.length < 4096 ? answer : { ...answer, body: { kind: 'json', encoding: 'gzip-base64', value: gzipSync(value, { level: 6 }).toString('base64') } };
}
export async function readRecording(dir: string): Promise<Map<string, unknown>> {
  const result = new Map<string, unknown>();
  for (const file of (await readdir(dir)).filter(name => name.endsWith('.json')).sort()) result.set(file, JSON.parse(await readFile(resolve(dir, file), 'utf8')));
  if (!result.has('index.json') || !result.has('closure.json')) throw new Error('Recording lacks index.json or closure.json');
  const index = object(result.get('index.json'));
  if (!Array.isArray(index.requests) || !index.requests.every(id => typeof id === 'string' && /^[a-z0-9-]+$/u.test(id))) throw new Error('Invalid request index');
  for (const id of index.requests) {
    const answer = object(result.get(`${id}.json`));
    if (answer.id !== id || !Number.isInteger(answer.status) || typeof answer.status !== 'number' || answer.status < 100 || answer.status > 599) throw new Error(`Invalid answer ${id}`);
    const headers = object(answer.headers);
    if (!Object.values(headers).every(value => typeof value === 'string')) throw new Error(`Invalid headers ${id}`);
    const body = object(answer.body);
    if (body.kind === 'text') { if (typeof body.value !== 'string') throw new Error(`Invalid text body ${id}`); }
    else if (body.kind === 'bundle') { if (typeof body.present !== 'boolean' || ('rangeLength' in body && body.rangeLength !== 64)) throw new Error(`Invalid bundle probe ${id}`); }
    else if (body.kind === 'html') {
      const page = object(body.static), outside = object(body.outside); object(body.regions);
      for (const part of [page, outside]) if (!Number.isInteger(part.length) || typeof part.length !== 'number' || part.length < 0 || typeof part.md5 !== 'string' || !/^[0-9a-f]{32}$/u.test(part.md5)) throw new Error(`Invalid HTML summary ${id}`);
      if (typeof page.file !== 'string' || typeof outside.equal !== 'boolean' || ![body.titlePresent, body.firstView, body.searchSubmitted].every(value => typeof value === 'boolean')) throw new Error(`Invalid HTML attestation ${id}`);
      for (const item of Object.values(object(body.regions))) { const region = object(item); if (region.kind !== 'static' && !(region.kind === 'rewritten' && region.encoding === 'gzip-base64' && (typeof region.value === 'string' || region.value === null))) throw new Error(`Invalid HTML region ${id}`); if (region.kind === 'rewritten') { if (typeof region.value === 'string') region.value = gunzipSync(Buffer.from(region.value, 'base64')).toString('utf8'); delete region.encoding; } }
    }
    else if (body.kind === 'json') { if (!('value' in body)) throw new Error(`Missing JSON body ${id}`); if (body.encoding !== undefined) { if (body.encoding !== 'gzip-base64' || typeof body.value !== 'string') throw new Error(`Invalid compressed JSON ${id}`); body.value = JSON.parse(gunzipSync(Buffer.from(body.value, 'base64')).toString('utf8')); delete body.encoding; } }
    else if (body.kind === 'binary') {
      if (!Number.isInteger(body.length) || typeof body.length !== 'number' || body.length < 0 || typeof body.prefix !== 'string' || !/^(?:[0-9a-f]{2}){0,64}$/u.test(body.prefix) || typeof body.md5 !== 'string' || !/^[0-9a-f]{32}$/u.test(body.md5)) throw new Error(`Invalid binary body ${id}`);
    } else throw new Error(`Invalid body kind ${id}`);
  }
  return result;
}

/** Fail before normalizing a missing or escaping browser asset reference. */
export async function validateAstroReferences(value: string, dist: string): Promise<void> {
  for (const match of value.matchAll(/\/_astro\/[^\s"'<>?]+/gu)) {
    const file = resolve(dist, `.${match[0]}`);
    if (!file.startsWith(resolve(dist, '_astro') + '/')) throw new Error(`Unsafe asset reference: ${match[0]}`);
    await readFile(file);
  }
}
