import { basename } from 'node:path';
import type { ExplorationChoice, ExplorationRequest, ExplorationOutcome } from '../exploration.mts';
import type { ExplorationSession } from '../session.mts';
import type { PreviewState } from '../previews/index.mts';
import { PREVIEW_ROWS, renderPreview } from '../previews/index.mts';
import type { ProviderProgress } from '../vo/bridge.mts';
import { archiveLabel } from '../cli-archive.mts';
import { ARCHIVES } from '../archives/archives.mts';
import { SEARCH as SPITZER_SEARCH } from '../archives/spitzer/archive.mts';
import { OPUS_SERVICE } from '../archive-adapters/opus.mts';
import { wavelengthText } from '../cli-table.mts';
import { oneLine } from '../cli-summary.mts';
import { LIST_MINIMUM_ROWS, listPageSize } from './list.mts';
import { bold, breadcrumb, clipLine, cut, dim, green, inverse, pad, red, yellow } from './style.mts';

export type ExploreChoice = Pick<ExplorationChoice, 'pick' | 'telescope' | 'archiveService' | 'observation' | 'reference' | 'display'>;
/** Saved screens read display and preview facts; get revalidates the original record before retrieval. */
export type SavedExploration = Pick<ExplorationSession, 'schema' | 'createdAt' | 'arguments' | 'target'> & {
  readonly directory: string;
  readonly choices: readonly ExploreChoice[];
  readonly answer: {
    readonly request: ExplorationRequest;
    readonly targetResolution: { readonly status: string; readonly canonical?: { readonly name: string } };
    readonly outcome: ExplorationOutcome;
    readonly services: readonly { readonly service: string; readonly state: string; readonly reason: string }[];
  };
};

export const EXPLORE_PAGE = 12, TABLE_COLUMNS = 78, PANEL_COLUMNS = 40;
export const PREVIEW_MINIMUM_COLUMNS = TABLE_COLUMNS + 4 + PANEL_COLUMNS;
const gap = '    ', spinner = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
export interface PickStatus { readonly state: 'done' | 'partial'; readonly bytes: number; readonly resultPath?: string }
export interface MakeChoice { readonly name: string; readonly description: string; readonly parameters?: readonly string[]; readonly available?: boolean }
export interface MadeFile { readonly file: string; readonly opened: boolean }
export type ExploreView = 'picker' | 'search' | 'table' | 'confirm' | 'download' | 'make';
export interface ExploreState {
  readonly view: ExploreView;
  readonly target: string;
  readonly requested: string;
  readonly candidates: readonly { readonly id: string; readonly name: string; readonly archiveClass?: string }[];
  readonly session?: SavedExploration;
  readonly query: string;
  readonly active: number;
  readonly selected?: ExploreChoice;
  readonly statuses: ReadonlyMap<number, PickStatus>;
  readonly providers: readonly ProviderProgress[];
  readonly tick: number;
  readonly preview: PreviewState;
  readonly size: number | null;
  readonly singleCube?: boolean;
  readonly free?: number;
  readonly received: number;
  readonly total?: number;
  readonly checking: boolean;
  readonly checked?: boolean;
  readonly failure?: string;
  readonly outputs: readonly MakeChoice[];
  readonly made: ReadonlyMap<number, MadeFile>;
  readonly making: boolean;
  readonly parameter?: { readonly name: string; readonly value: string };
  readonly notice?: string;
}
export function byteSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return 'size unknown';
  const kb = Math.round(bytes / 1024);
  return kb >= 1024 ** 2 ? `${(kb / 1024 ** 2).toFixed(1)} GB` : kb >= 1024
    ? `${kb < 10240 ? (kb / 1024).toFixed(1) : Math.round(kb / 1024)} MB` : `${kb} KB`;
}
export const observationStart = (choice: ExploreChoice): string => choice.display.observationTime.startIso?.slice(0, 16).replace('T', ' ') ?? 'date ?';
export function exploreLabel(choice: ExploreChoice): string {
  const local = choice.telescope === 'Source archive';
  const kind = oneLine(choice.display.productKind ?? '');
  const family = oneLine(choice.reference.kind === 'indexed-observation' ? choice.reference.mode.split('/')[0] ?? '' : '');
  const instrument = local ? [kind, family].find(label => label && label.length <= 13) ?? '—' : choice.display.instrument;
  return [String(choice.pick).padStart(2), cut(oneLine(local ? 'Local' : archiveLabel(choice)), 8), cut(oneLine(instrument), 13),
    observationStart(choice).padEnd(16), cut(oneLine(choice.display.productKind ?? '—'), 8), wavelengthText(choice.display.wavelengthsMicrometres)].join('  ');
}
export function exploreSelection(state: ExploreState, page = EXPLORE_PAGE) {
  const terms = state.query.trim().toLowerCase().split(/\s+/u);
  const shown = (state.session?.choices ?? []).filter(choice => terms.every(term => `${exploreLabel(choice)} ${choice.telescope}`.toLowerCase().includes(term)));
  const active = Math.max(0, Math.min(state.active, shown.length - 1));
  const start = Math.max(0, Math.min(active - Math.floor(page / 2), shown.length - page));
  return { shown, active, start, current: shown[active], rows: shown.slice(start, start + page) };
}
function panel(choice: ExploreChoice, state: ExploreState): string[] {
  return [dim(`preview · #${choice.pick} ${oneLine(choice.display.instrument)}`), ...renderPreview(state.preview).map(dim)];
}
function beside(left: readonly string[], right: readonly string[], columns: number): string[] {
  return columns < PREVIEW_MINIMUM_COLUMNS ? [...left]
    : Array.from({ length: Math.max(left.length, right.length) }, (_, index) => pad(clipLine(left[index] ?? '', TABLE_COLUMNS), TABLE_COLUMNS) + gap + (right[index] ?? ''));
}
const header = (trail: readonly string[], sub: string) => [breadcrumb(['telescope', ...trail.map(oneLine)]), '', sub, ''];
const mark = (status: PickStatus | undefined) => status?.state === 'done' ? green('✓') : status?.state === 'partial' ? yellow('◐') : ' ';
function providerName(name: string): string {
  const archive = ARCHIVES.find(entry => entry.id === name.toLowerCase() || entry.name === name || entry.displayName === name || entry.registry?.address === name);
  const label = name === SPITZER_SEARCH ? 'Spitzer' : name === OPUS_SERVICE ? 'OPUS'
    : archive?.displayName ?? archive?.name ?? (name.includes('://') ? 'Archive' : name);
  return oneLine(label).replace('MAST HST', 'MAST/HST')
    .replace('Keck Observatory Archive', 'Keck').replace('Gemini at CADC', 'Gemini').replace('Chandra Data Archive', 'Chandra').replace('Spitzer Heritage Archive', 'Spitzer');
}
function providerReason(reason: string): string {
  if (/timed?\s*out|timeout/iu.test(reason)) return 'timed out';
  if (/refused|forbidden|unauthori[sz]ed|\b40[13]\b/iu.test(reason)) return 'refused';
  if (/no answer|did not answer|not answer|no response|unreachable|ENOTFOUND|EAI_AGAIN/iu.test(reason)) return 'no answer';
  return 'error';
}
function table(state: ExploreState, columns: number, height: number): string[] {
  const page = listPageSize(height), { shown, current, start, rows } = exploreSelection(state, page), session = state.session!;
  const got = [...state.statuses.values()].filter(status => status.state === 'done').length;
  const issues = session.answer.services.filter(service => service.state === 'unavailable' || service.state === 'overflow');
  const failures = new Map<string, Set<string>>();
  for (const service of issues) {
    const reason = service.state === 'overflow' ? 'hit their result limit' : providerReason(service.reason);
    const archives = failures.get(reason) ?? new Set<string>();
    archives.add(providerName(service.service)); failures.set(reason, archives);
  }
  const title = `${bold(state.target)} · ${session.choices.length} observations${got ? ` · ${green(`${got} downloaded`)}` : ''}` +
    (session.answer.outcome.coverage === 'incomplete' ? ` · ${yellow('incomplete')}${[...failures].map(([reason, archives]) => ` · ${dim(`${[...archives].join(', ')} ${reason}`)}`).join('')}` : '');
  const left = [dim('    #  Archive   Instrument     Start (UTC)       Kind      Wavelength'),
    ...(rows.length ? rows.map(choice => `${mark(state.statuses.get(choice.pick))}${choice === current ? bold(`> ${exploreLabel(choice)}`) : `  ${exploreLabel(choice)}`}`) : [dim('   no match')])];
  while (left.length < page + 1) left.push('');
  const count = shown.length < session.choices.length ? `${shown.length} match · ` : '';
  const range = shown.length ? `${start + 1}–${start + rows.length} of ${shown.length}` : '0';
  return [...header([state.target], clipLine(title, columns)), ...beside(left, current && height >= PREVIEW_ROWS + 8 ? panel(current, state) : [], columns), '',
    `/ ${state.query}${inverse(' ')}   ${dim(`${count}${range} · ↑↓ scroll · enter choose · esc quit`)}`];
}
function confirm(state: ExploreState, columns: number): string[] {
  const choice = state.selected!, status = state.statuses.get(choice.pick), remaining = state.size === null ? null : Math.max(0, state.size - (status?.bytes ?? 0));
  // Retrieval's own plan decides the scope: whole-delivery wording only when it really falls back to the delivery.
  const what = state.singleCube === true ? 'the cube for this spectral window' : state.singleCube === false ? 'the whole ALMA delivery for this observation (all its spectral windows)' : 'one data file';
  const facts = [bold(`#${choice.pick}  ${oneLine(archiveLabel(choice))} · ${oneLine(choice.display.instrument)}`), '',
    `  Start       ${choice.display.observationTime.startIso ? `${observationStart(choice)} UTC` : 'unknown'}`,
    `  Kind        ${oneLine(choice.display.productKind ?? '—')}`, `  Wavelength  ${wavelengthText(choice.display.wavelengthsMicrometres)}`, ''];
  const free = byteSize(state.free);
  const ask = status?.state === 'done' ? [`  ${green('✓ Already downloaded')} ${dim(`${byteSize(status.bytes || state.size)} · ${state.session!.directory}/pick-${choice.pick}/`)}`, '',
    `  ${bold('Make something from it?')}  ${dim('enter yes · esc back to the list')}`]
    : state.free === undefined ? [dim('  Checking size and free space…'), dim('  esc back to the list')]
      : remaining !== null && remaining > state.free ? [`  Download    ${bold(byteSize(state.size))}`, `  ${dim(what)}`, '',
        `  ${red(`Not enough space: needs ${byteSize(remaining)}, ${free} free`)}`, `  ${dim('free some space, or get it into another folder with --out DIRECTORY')}`, '', dim('  esc back to the list')]
        : status?.state === 'partial' ? [`  Download    ${bold(byteSize(state.size))}  ${yellow(`◐ ${byteSize(status.bytes)} already here`)}`, `  ${dim(what)}`, '',
          `  ${bold(`Resume? ${byteSize(remaining)} left`)}  ${dim(`enter yes · esc back to the list · ${free} free`)}`]
          : [`  Download    ${bold(byteSize(state.size))}`, `  ${dim(what)}`, '', `  ${bold('Download it?')}  ${dim(`enter yes · esc back to the list · ${free} free`)}`];
  return [...header([state.target, `#${choice.pick} ${choice.display.instrument}`], `${bold(state.target)} · get an observation`),
    ...beside([...facts, ...ask, ...(state.notice ? ['', red(state.notice)] : [])], panel(choice, state), columns)];
}
function download(state: ExploreState): string[] {
  const choice = state.selected!, total = state.total ?? state.size;
  const fraction = total ? Math.max(0, Math.min(1, state.received / total)) : undefined;
  const filled = Math.round((fraction ?? 0) * 24);
  const progress = fraction === undefined ? dim(`${spinner[state.tick % spinner.length]} ${byteSize(state.received)} of size unknown`)
    : `${'━'.repeat(filled)}${dim('─'.repeat(24 - filled))} ${Math.round(fraction * 100)}%  ${dim(`${byteSize(state.received)} of ${byteSize(total)}`)}`;
  const lines = header([state.target, `#${choice.pick} ${choice.display.instrument}`, 'download'], `${bold('Getting')} #${choice.pick} · ${oneLine(archiveLabel(choice))} ${oneLine(choice.display.instrument)}`);
  return state.failure ? [...lines, `  ${'Download'.padEnd(26)}${yellow(`stopped at ${byteSize(state.received)} of ${byteSize(total)}`)} ${dim(`· ${oneLine(state.failure)}`)}`, '',
    `  ${bold('Resume from there?')}  ${dim('enter resume · esc back to the list (the part stays, marked ◐)')}`]
    : [...lines, `  ${'Download'.padEnd(26)}${state.checking ? green('done') : progress}`,
      `  ${'Check headers and units'.padEnd(26)}${state.checked ? green('done') : dim(state.checking ? `${spinner[state.tick % spinner.length]} checking` : 'waiting')}`];
}
export function renderExplore(state: ExploreState, columns: number, height = 40): string[] {
  if (height < LIST_MINIMUM_ROWS) return [`make the window taller: needs ${LIST_MINIMUM_ROWS} rows`];
  const lines = exploreLines(state, columns, height);
  return lines.length >= height ? [`make the window taller: needs ${lines.length + 1} rows`] : lines;
}
function exploreLines(state: ExploreState, columns: number, height: number): string[] {
  const page = Math.max(1, Math.min(EXPLORE_PAGE, height - 9 - (state.parameter ? 2 : 0) - (state.notice ? 2 : 0) - (state.making ? 2 : 0)));
  const start = (length: number) => Math.max(0, Math.min(state.active - Math.floor(page / 2), length - page));
  if (state.view === 'picker') return [...header([`explore “${state.requested}”`, 'did you mean'], `${yellow('No object named')} ${bold(`“${oneLine(state.requested)}”`)}`),
    'Did you mean:', '', ...state.candidates.slice(start(state.candidates.length), start(state.candidates.length) + page).map((candidate, index) =>
      (index + start(state.candidates.length) === state.active ? bold(`> ${oneLine(candidate.name).padEnd(28)}`) : `  ${oneLine(candidate.name).padEnd(28)}`) + dim(oneLine(candidate.archiveClass ?? ''))), '', dim('↑↓ choose · enter explore it · esc quit')];
  if (state.view === 'search') return [...header([state.target, 'searching'], `${bold(oneLine(state.target))} · searching archives…`),
    ...state.providers.map(provider => `  ${providerName(provider.archive).padEnd(10)}${provider.state === 'searching' ? dim(`${spinner[state.tick % spinner.length]} searching`)
      : provider.reason ? yellow(providerReason(provider.reason)) : provider.count ? green(`${provider.count} found`) : dim('none')}`)];
  if (state.view === 'table') return table(state, columns, height);
  if (state.view === 'confirm') return confirm(state, columns);
  if (state.view === 'download') return download(state);
  const choice = state.selected!, dir = `${state.session!.directory}/pick-${choice.pick}`;
  return [...header([state.target, `#${choice.pick} ${choice.display.instrument}`, 'make'], `${green('✓')} ${bold(`#${choice.pick} ${oneLine(archiveLabel(choice))} ${oneLine(choice.display.instrument)}`)} ${dim(`${dir}/`)}`),
    'What do you want to make?', '', ...state.outputs.slice(start(state.outputs.length), start(state.outputs.length) + page).map((output, offset) => {
      const index = offset + start(state.outputs.length);
      const made = state.made.get(index);
      return (output.available === false ? dim(`  ${output.name.padEnd(18)}${output.description}`) : index === state.active ? bold(`> ${output.name.padEnd(18)}${output.description}`) : `  ${output.name.padEnd(18)}${dim(output.description)}`) +
        (made ? green(`  ✓ ${basename(made.file)}${made.opened ? ' · opened' : ''}`) : '');
    }), ...(state.parameter ? ['', `${state.parameter.name}: ${state.parameter.value}${inverse(' ')}  ${dim('enter accept · esc cancel')}`] : []),
    ...(state.notice ? ['', red(oneLine(state.notice))] : []), ...(state.making ? ['', dim('Making…')] : []),
    '', dim('↑↓ choose · enter make and open · esc back to the list · q quit')];
}
