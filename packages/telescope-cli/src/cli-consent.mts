/** CLI consent UI; acquisition owners provide metadata before transferring bytes. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { DownloadCancelledError, USER_ROOT, type TransferConsent } from '@cssearth/telescope-core/node';
import { archiveLabel } from './cli-archive.mts';
import { displayPath } from './cli-format.mts';
import { createInstallScreen, installFreeGb } from './tui/install.mts';
import { processTerminal } from './tui/terminal.mts';
import type { CliIo } from './cli-io.mts';

export type DownloadInfo = Extract<TransferConsent, { kind: 'download' }>;
export interface ConsentState { download?: DownloadInfo; archive?: string; cancelled?: boolean; install?: ReturnType<typeof createInstallScreen>; installController?: AbortController; toolchainDeclined?: boolean; declinedToolchain?: string; screen?: { pause(): void; resume(): void } }
const sizeText = (bytes: number | null) => bytes === null ? 'size unknown' : `${Math.ceil(bytes / 1e6)} MB`;
const folder = (path: string) => `${displayPath(path).replace(/\/$/u, '')}/`;

export function consentHandler(io: CliIo, options: { readonly json: boolean; readonly yes?: boolean }, state: ConsentState) {
  return async (info: TransferConsent): Promise<void> => {
    if (state.cancelled) throw new DownloadCancelledError();
    if (info.kind === 'toolchain' && !options.json && io.stdinIsTTY && io.stdoutIsTTY && io.stderrIsTTY === true) {
      await io.flush?.();
      const free = await installFreeGb(USER_ROOT);
      state.installController ??= new AbortController();
      state.screen?.pause();
      state.install = createInstallScreen(io.terminal ?? processTerminal(), state.installController, info.name);
      if (!await state.install.consent(free, options.yes)) {
        state.cancelled = true; state.toolchainDeclined = true; state.declinedToolchain = info.name;
        throw new DownloadCancelledError();
      }
      return;
    }
    if (info.kind === 'download') {
      info = { ...info, archive: state.archive ?? info.archive };
      state.download = info;
      io.error(`Download: ${sizeText(info.bytes)} from ${info.archive} → ${folder(info.destination)}${info.cache ? ` (cache: ${folder(info.cache)})` : ''}\n`);
    } else {
      io.error(`Install: ${info.packages.join(', ')} (${info.bytes === null ? 'size unknown' : `approximately ${sizeText(info.bytes)}`}) → ${folder(info.destination)}\n`);
    }
    if (!options.yes && !options.json && io.stdinIsTTY && io.stdoutIsTTY &&
        (info.kind === 'toolchain' || info.bytes === null || info.bytes >= 100_000_000)) {
      await io.flush?.();
      const answer = await io.question('Continue? [Y/n] ');
      if (answer === undefined || /^n(?:o)?$/iu.test(answer.trim())) {
        state.cancelled = true;
        throw new DownloadCancelledError();
      }
    }
  };
}

/** Saved archive size is an estimate, independent of the hard transfer limit. */
export function choiceDownload(choice: Record<string, unknown>, directory: string, pick: number): DownloadInfo {
  const display = choice.display === undefined ? undefined : requireRecord(choice.display, 'saved display');
  const kilobytes = display?.advertisedKilobytes;
  const telescope = requireString(choice.telescope, 'saved telescope');
  const archiveService = typeof choice.archiveService === 'string' ? choice.archiveService : undefined;
  const named=archiveLabel({ telescope, archiveService });
  const archive = /^https?:/u.test(named) ? new URL(named).hostname : named;
  return { kind: 'download', bytes: typeof kilobytes === 'number' && Number.isFinite(kilobytes) && kilobytes >= 0 ? Math.ceil(kilobytes * 1000) : null,
    archive, destination: resolve(directory, `pick-${pick}`) };
}

export async function savedDownload(directory: string, pick: number): Promise<DownloadInfo> {
  let bytes: string;
  try { bytes = await readFile(resolve(directory, 'explore.json'), 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    bytes = await readFile(resolve(directory, 'query.json'), 'utf8');
  }
  const session = requireRecord(JSON.parse(bytes), 'saved run');
  const choice = requireArray(session.choices, 'saved choices')[pick - 1];
  return choiceDownload(requireRecord(choice, 'saved choice'), directory, pick);
}
