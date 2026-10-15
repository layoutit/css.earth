import { basename } from 'node:path';
import type { ExploreChoice, SavedExploration } from './explore.mts';
import type { PreviewState } from '../previews/index.mts';
import { renderPreview } from '../previews/index.mts';
import type { ProviderProgress } from '../vo/bridge.mts';
import { archiveLabel } from '../cli-archive.mts';
import { wavelengthText } from '../cli-table.mts';
import { oneLine } from '../cli-summary.mts';
import { bold, breadcrumb, clipLine, cut, dim, green, inverse, pad, red, yellow } from './style.mts';

export const EXPLORE_PAGE = 12, TABLE_COLUMNS = 78, PANEL_COLUMNS = 40;
export const PREVIEW_MINIMUM_COLUMNS = TABLE_COLUMNS + 4 + PANEL_COLUMNS;
const gap = '    ', spinner = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
export interface PickStatus { readonly state: 'done' | 'partial'; readonly bytes: number; readonly resultPath?: string }
export interface MakeChoice { readonly name: string; readonly description: string; readonly parameters?: readonly string[] }
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
  return [String(choice.pick).padStart(2), cut(oneLine(archiveLabel(choice)), 8), cut(oneLine(choice.display.instrument), 13),
    observationStart(choice).padEnd(16), cut(oneLine(choice.display.productKind ?? '—'), 8), wavelengthText(choice.display.wavelengthsMicrometres)].join('  ');
}
export function exploreSelection(state: ExploreState) {
  const terms = state.query.trim().toLowerCase().split(/\s+/u);
  const shown = (state.session?.choices ?? []).filter(choice => terms.every(term => `${exploreLabel(choice)} ${choice.telescope}`.toLowerCase().includes(term)));
  const active = Math.max(0, Math.min(state.active, shown.length - 1));
  const start = Math.max(0, Math.min(active - Math.floor(EXPLORE_PAGE / 2), shown.length - EXPLORE_PAGE));
  return { shown, active, start, current: shown[active], rows: shown.slice(start, start + EXPLORE_PAGE) };
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
  return oneLine(archiveLabel({ telescope: name, archiveService: name })).replace('MAST HST', 'MAST/HST')
    .replace('Keck Observatory Archive', 'Keck').replace('Gemini at CADC', 'Gemini').replace('Chandra Data Archive', 'Chandra').replace('Spitzer Heritage Archive', 'Spitzer');
}
function providerReason(reason: string): string {
  if (/timed?\s*out|timeout/iu.test(reason)) return 'timed out';
  if (/refused|forbidden|unauthori[sz]ed|\b40[13]\b/iu.test(reason)) return 'refused';
  if (/no answer|did not answer|not answer|no response|unreachable|ENOTFOUND|EAI_AGAIN/iu.test(reason)) return 'no answer';
  return 'error';
}
function table(state: ExploreState, columns: number): string[] {
  const { shown, current, start, rows } = exploreSelection(state), session = state.session!;
  const got = [...state.statuses.values()].filter(status => status.state === 'done').length;
  const issues = session.answer.services.filter(service => service.state === 'unavailable' || service.state === 'overflow');
  const failures = issues.map(service => `${providerName(service.service)} ${service.reason.length <= 32 ? oneLine(service.reason) : /timed? ?out|timeout/iu.test(service.reason) ? 'timed out' : service.state === 'overflow' ? 'search limit reached' : 'no answer'}`);
  const title = `${bold(state.target)} · ${session.choices.length} observations${got ? ` · ${green(`${got} downloaded`)}` : ''}` +
    (session.answer.outcome.coverage === 'incomplete' ? ` · ${yellow('incomplete')}${failures.length ? ` ${dim(`(${failures.join(', ')})`)}` : ''}` : '');
  const left = [dim('    #  Archive   Instrument     Start (UTC)       Kind      Wavelength'),
    ...(rows.length ? rows.map(choice => `${mark(state.statuses.get(choice.pick))}${choice === current ? bold(`> ${exploreLabel(choice)}`) : `  ${exploreLabel(choice)}`}`) : [dim('   no match')])];
  while (left.length < EXPLORE_PAGE + 1) left.push('');
  const count = shown.length < session.choices.length ? `${shown.length} match · ` : '';
  const range = shown.length ? `${start + 1}–${start + rows.length} of ${shown.length}` : '0';
  return [...header([state.target], title), ...beside(left, current ? panel(current, state) : [], columns), '',
    `/ ${state.query}${inverse(' ')}   ${dim(`${count}${range} · ↑↓ scroll · enter choose · esc quit`)}`];
}
function confirm(state: ExploreState, columns: number): string[] {
  const choice = state.selected!, status = state.statuses.get(choice.pick), remaining = state.size === null ? null : Math.max(0, state.size - (status?.bytes ?? 0));
  const what = archiveLabel(choice) === 'ALMA' ? 'the whole ALMA delivery for this observation (all its spectral windows)' : 'one data file';
  const facts = [bold(`#${choice.pick}  ${oneLine(archiveLabel(choice))} · ${oneLine(choice.display.instrument)}`), '',
    `  Start       ${choice.display.observationTime.startIso ? `${observationStart(choice)} UTC` : 'unknown'}`,
    `  Kind        ${oneLine(choice.display.productKind ?? '—')}`, `  Wavelength  ${wavelengthText(choice.display.wavelengthsMicrometres)}`, ''];
  const free = byteSize(state.free);
  const ask = status?.state === 'done' ? [`  ${green('✓ Already downloaded')} ${dim(`${byteSize(state.size)} · ${state.session!.directory}/pick-${choice.pick}/`)}`, '',
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
export function renderExplore(state: ExploreState, columns: number): string[] {
  if (state.view === 'picker') return [...header([`explore “${state.requested}”`, 'did you mean'], `${yellow('No object named')} ${bold(`“${oneLine(state.requested)}”`)}`),
    'Did you mean:', '', ...state.candidates.map((candidate, index) =>
      (index === state.active ? bold(`> ${oneLine(candidate.name).padEnd(28)}`) : `  ${oneLine(candidate.name).padEnd(28)}`) + dim(oneLine(candidate.archiveClass ?? ''))), '', dim('↑↓ choose · enter explore it · esc quit')];
  if (state.view === 'search') return [...header([state.target, 'searching'], `${bold(oneLine(state.target))} · searching archives…`),
    ...state.providers.map(provider => `  ${providerName(provider.archive).padEnd(10)}${provider.state === 'searching' ? dim(`${spinner[state.tick % spinner.length]} searching`)
      : provider.reason ? yellow(providerReason(provider.reason)) : provider.count ? green(`${provider.count} found`) : dim('none')}`)];
  if (state.view === 'table') return table(state, columns);
  if (state.view === 'confirm') return confirm(state, columns);
  if (state.view === 'download') return download(state);
  const choice = state.selected!, dir = `${state.session!.directory}/pick-${choice.pick}`;
  return [...header([state.target, `#${choice.pick} ${choice.display.instrument}`, 'make'], `${green('✓')} ${bold(`#${choice.pick} ${oneLine(archiveLabel(choice))} ${oneLine(choice.display.instrument)}`)} ${dim(`${dir}/`)}`),
    'What do you want to make?', '', ...state.outputs.map((output, index) => {
      const made = state.made.get(index);
      return (index === state.active ? bold(`> ${output.name.padEnd(18)}${output.description}`) : `  ${output.name.padEnd(18)}${dim(output.description)}`) +
        (made ? green(`  ✓ ${basename(made.file)}${made.opened ? ' · opened' : ''}`) : '');
    }), ...(state.parameter ? ['', `${state.parameter.name}: ${state.parameter.value}${inverse(' ')}  ${dim('enter accept · esc cancel')}`] : []),
    ...(state.notice ? ['', red(oneLine(state.notice))] : []), ...(state.making ? ['', dim('Making…')] : []),
    '', dim('↑↓ choose · enter make and open · esc back to the list · q quit')];
}
