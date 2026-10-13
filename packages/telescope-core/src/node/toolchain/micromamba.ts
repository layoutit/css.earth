/** One executable owner: an explicit override, PATH, or a verified official release in the user root. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, chmod, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { delimiter, isAbsolute, resolve } from 'node:path';
import { USER_ROOT } from '../paths/index.js';

export const MICROMAMBA_RELEASE = '2.9.0-0';
const VERSION = '2.9.0';
const RELEASES = 'https://github.com/mamba-org/micromamba-releases/releases/download';
export interface MicromambaOptions {
  readonly userRoot?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: string;
  readonly arch?: string;
  readonly fetcher?: (url: string, options: RequestInit) => Promise<Response>;
  readonly report?: (message: string) => void;
}

export function assertManagedPythonPlatform(platform: string = process.platform): void {
  if (platform === 'win32') throw new Error('managed Python toolchains need macOS or Linux; on Windows use WSL');
}

/** Only native architectures with an asset in the pinned release are admitted. */
export function micromambaAsset(platform: string, arch: string): string {
  assertManagedPythonPlatform(platform);
  const targets: Readonly<Record<string, string>> = {
    'darwin/x64': 'osx-64', 'darwin/arm64': 'osx-arm64',
    'linux/x64': 'linux-64', 'linux/arm64': 'linux-aarch64', 'linux/ppc64': 'linux-ppc64le',
  };
  const target = targets[`${platform}/${arch}`];
  if (!target) throw new Error(`No managed micromamba ${MICROMAMBA_RELEASE} for ${platform}/${arch}. Set CSSEARTH_TELESCOPE_MICROMAMBA to a compatible executable.`);
  return `micromamba-${target}`;
}

async function executable(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile() && await access(path, constants.X_OK).then(() => true, () => false); }
  catch { return false; }
}
async function onPath(name: string, env: NodeJS.ProcessEnv, platform: string): Promise<string | undefined> {
  for (const directory of (env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const suffix of platform === 'win32' ? ['', '.exe'] : ['']) {
      const path = resolve(directory, `${name}${suffix}`);
      if (await executable(path)) return path;
    }
  }
  return undefined;
}
function managedReady(path: string): boolean {
  const result = spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 10_000 });
  return !result.error && result.status === 0 && result.stdout.trim() === VERSION;
}

const pending = new Map<string, Promise<string>>();
function alive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return !(error instanceof Error && 'code' in error && error.code === 'ESRCH'); }
}
/** Staging names are never reused: reclaiming a dead process's directory cannot delete a new owner's files. */
async function discardAbandonedDownloads(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('download-')) continue;
    const staging = resolve(directory, entry.name), owner = await readFile(resolve(staging, 'owner'), 'utf8').catch(() => '');
    const details = await stat(staging).catch(() => null);
    if (details && !alive(Number(owner)) && (owner || Date.now() - details.mtimeMs > 30_000))
      await rm(staging, { recursive: true, force: true });
  }
}

async function responseFor(url: string, fetcher: NonNullable<MicromambaOptions['fetcher']>): Promise<Response> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error(`${url} answered HTTP ${response.status} without a usable download.`);
  return response;
}

/** Checksums are read and compared in memory only; no checksum/receipt is written. */
async function download(path: string, asset: string, fetcher: NonNullable<MicromambaOptions['fetcher']>, report: (message: string) => void): Promise<void> {
  const url = `${RELEASES}/${MICROMAMBA_RELEASE}/${asset}`;
  const checksumResponse = await responseFor(`${url}.sha256`, fetcher);
  const checksumBytes = await readSmallResponse(checksumResponse);
  const expected = new TextDecoder().decode(checksumBytes).trim();
  if (!/^[a-fA-F0-9]{64}$/u.test(expected)) throw new Error(`Invalid published checksum for ${asset}.`);
  const response = await responseFor(url, fetcher), length = response.headers.get('content-length');
  const size = length === null ? undefined : Number(length);
  if (size !== undefined && (!/^\d+$/u.test(length ?? '') || !Number.isSafeInteger(size) || size < 1 || size > 64 * 1024 * 1024))
    throw new Error(`Invalid download size for ${asset}.`);
  report(`Downloading micromamba ${MICROMAMBA_RELEASE}: ${url} (${size === undefined ? 'size not supplied' : `${size} bytes`})\n`);
  const file = await open(path, 'wx', 0o600), digest = createHash('sha256');
  let received = 0, lastReport = Date.now();
  const reader = response.body!.getReader();
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > 64 * 1024 * 1024) throw new Error(`Micromamba download exceeds the size limit for ${asset}.`);
      digest.update(chunk.value); await file.writeFile(chunk.value);
      if (Date.now() - lastReport >= 5_000) { report(`Micromamba: received ${received} bytes${size === undefined ? '' : ` / ${size}`}\n`); lastReport = Date.now(); }
    }
    if (!received || (size !== undefined && received !== size)) throw new Error(`Incomplete micromamba download for ${asset}: received ${received} bytes.`);
    if (digest.digest('hex') !== expected.toLowerCase()) throw new Error(`Micromamba checksum mismatch for ${asset}; the download was refused.`);
    await file.sync();
    report(`Micromamba: verified ${received} bytes.\n`);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); await file.close(); }
}
async function readSmallResponse(response: Response): Promise<Uint8Array> {
  const reader = response.body!.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4096) throw new Error('Published micromamba checksum exceeds its size limit.');
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function resolveMicromamba(options: MicromambaOptions = {}): Promise<string> {
  const env = options.env ?? process.env, platform = options.platform ?? process.platform, arch = options.arch ?? process.arch;
  assertManagedPythonPlatform(platform);
  const override = env.CSSEARTH_TELESCOPE_MICROMAMBA;
  if (override !== undefined) {
    const path = isAbsolute(override) || /[/\\]/u.test(override) ? resolve(override) : await onPath(override, env, platform);
    if (!override.trim() || !path || !await executable(path)) throw new Error(`CSSEARTH_TELESCOPE_MICROMAMBA=${override} is not an executable. Set it to an existing micromamba path and retry.`);
    return path;
  }
  const existing = await onPath('micromamba', env, platform);
  if (existing) return existing;
  const asset = micromambaAsset(platform, arch), directory = resolve(options.userRoot ?? USER_ROOT, 'micromamba', MICROMAMBA_RELEASE, asset);
  const path = resolve(directory, platform === 'win32' ? 'micromamba.exe' : 'micromamba');
  if (managedReady(path)) return path;
  const active = pending.get(path); if (active) return active;
  const report = options.report ?? (message => { process.stderr.write(message); });
  const work = (async () => {
    await mkdir(directory, { recursive: true });
    await discardAbandonedDownloads(directory);
    if (managedReady(path)) return path;
    const staging = await mkdtemp(resolve(directory, 'download-')), partial = resolve(staging, 'binary.partial');
    try {
      await writeFile(resolve(staging, 'owner'), String(process.pid));
      await download(partial, asset, options.fetcher ?? fetch, report);
      await chmod(partial, 0o755);
      if (!managedReady(partial)) throw new Error(`Downloaded micromamba does not run as ${VERSION} on ${platform}/${arch}.`);
      // Across processes, both contenders have verified the same pinned asset. One may publish first.
      try { await rename(partial, path); }
      catch (error) { if (!managedReady(path)) throw error; }
      return path;
    } catch (error) {
      throw new Error(`Missing managed micromamba ${MICROMAMBA_RELEASE} (${asset}) at ${path}; Python cannot be installed. ${error instanceof Error ? error.message : String(error)} Retry the same telescope command with network access, or set CSSEARTH_TELESCOPE_MICROMAMBA to an existing executable.`, { cause: error });
    } finally { await rm(staging, { recursive: true, force: true }); }
  })();
  pending.set(path, work);
  try { return await work; }
  finally { if (pending.get(path) === work) pending.delete(path); }
}
