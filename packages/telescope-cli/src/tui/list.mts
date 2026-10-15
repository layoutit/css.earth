import { bold, breadcrumb, cut, dim, green, inverse, pad, plain } from './style.mts';
import { screenFrame } from './screen.mts';
import type { ScreenKey, Terminal } from './terminal.mts';
import { processTerminal } from './terminal.mts';
import type { CliIo } from '../cli-io.mts';

export interface ListSpec<Row> {
  readonly crumbs: readonly string[];
  readonly title: string;
  readonly columns: readonly { readonly head: string; readonly width: number; readonly get: (row: Row) => string }[];
  readonly rows: readonly Row[];
  readonly text: (row: Row) => string;
  readonly panel: (row: Row, width: number) => readonly string[];
  readonly enter: { readonly label: string; readonly run: (row: Row) => string | Promise<string> };
  readonly plain: (row: Row) => string;
  readonly footer?: string;
}
export interface ListState<Row> {
  readonly query: string;
  readonly active: number;
  readonly opened: ReadonlyMap<Row, string>;
}
const maximumPage = 12, panelWidth = 44, maximumPanelHeight = 14, gap = '    ';
// Six chrome rows, a column heading, one item, and the cursor row below the block.
export const LIST_MINIMUM_ROWS = 9;
const pageSize = (rows: number) => Math.max(1, Math.min(maximumPage, rows - 8));
function selection<Row>(spec: ListSpec<Row>, state: ListState<Row>, page: number) {
  const terms = state.query.trim().toLowerCase().split(/\s+/u);
  const shown = spec.rows.filter(row => terms.every(term => spec.text(row).toLowerCase().includes(term)));
  const active = Math.max(0, Math.min(state.active, shown.length - 1));
  const start = Math.max(0, Math.min(active - Math.floor(page / 2), shown.length - page));
  return { shown, active, start, current: shown[active], rows: shown.slice(start, start + page) };
}
export function renderList<Row>(spec: ListSpec<Row>, state: ListState<Row>, columns: number, height = 24): string[] {
  if (height < LIST_MINIMUM_ROWS) return [`make the window taller: needs ${LIST_MINIMUM_ROWS} rows`];
  const page = pageSize(height);
  const { shown, start, current, rows } = selection(spec, state, page);
  const panelHeight = Math.min(maximumPanelHeight, height - 7);
  const tableWidth = 2 + spec.columns.reduce((sum, column) => sum + column.width + 2, 0);
  const wide = columns >= tableWidth + gap.length + panelWidth;
  const cells = (row: Row) => spec.columns.map(column => cut(column.get(row), column.width)).join('  ');
  const left = [dim(`    ${spec.columns.map(column => cut(column.head, column.width)).join('  ')}`),
    ...rows.map(row => `${state.opened.has(row) ? green('✓') : ' '}${row === current ? bold(`> ${cells(row)}`) : `  ${cells(row)}`}`)];
  if (!rows.length) left.push(dim('   no match'));
  while (left.length < page + 1) left.push('');
  const right = current !== undefined && wide ? spec.panel(current, panelWidth).slice(0, panelHeight) : [];
  while (right.length && right.length < panelHeight) right.push('');
  const body = wide ? Array.from({ length: Math.max(left.length, right.length) }, (_, index) =>
    pad(left[index] ?? '', tableWidth) + gap + (right[index] ?? '')) : left;
  const where = [...spec.crumbs, ...(state.query ? [`“${state.query}”`] : [])];
  const status = current !== undefined && state.opened.has(current) ? `  ${green(state.opened.get(current)!)}` : '';
  const count = shown.length < spec.rows.length ? `${shown.length} match · ` : '';
  const range = shown.length ? `${start + 1}–${start + rows.length} of ${shown.length}` : '0';
  return [breadcrumb(where), '', spec.title, '', ...body, '',
    `/ ${state.query}${inverse(' ')}   ${dim(`${count}${range} · ↑↓ scroll · enter ${spec.enter.label} · esc quit`)}${status}`];
}

/** Resolves on Escape/Ctrl-C; Enter performs an action and leaves the same list mounted. */
export async function listScreen<Row>(spec: ListSpec<Row>, terminal: Terminal): Promise<number> {
  const opened = new Map<Row, string>();
  let state: ListState<Row> = { query: '', active: 0, opened };
  const draw = () => terminal.write(screenFrame(renderList(spec, state, terminal.columns, terminal.rows), terminal.columns, terminal.rows));
  let close = () => {};
  try {
    return await new Promise<number>((resolve, reject) => {
      let stopped = false, pending = Promise.resolve();
      const keypress = async (key: ScreenKey) => {
        if (stopped) return;
        if (terminal.rows < LIST_MINIMUM_ROWS) return;
        const page = pageSize(terminal.rows);
        const { shown, active, current } = selection(spec, state, page);
        if (key.name === 'return' && current !== undefined) opened.set(current, await spec.enter.run(current));
        else if (key.name === 'up') state = { ...state, active: Math.max(0, active - 1) };
        else if (key.name === 'down') state = { ...state, active: Math.min(shown.length - 1, active + 1) };
        else if (key.name === 'pageup') state = { ...state, active: Math.max(0, active - page) };
        else if (key.name === 'pagedown') state = { ...state, active: Math.min(shown.length - 1, active + page) };
        else if (key.name === 'backspace') state = { ...state, query: Array.from(state.query).slice(0, -1).join(''), active: 0 };
        else if (key.text && !key.ctrl && !key.meta && key.text >= ' ') state = { ...state, query: state.query + key.text, active: 0 };
        if (!stopped) draw();
      };
      close = terminal.listen(key => {
        if (key.name === 'escape' || key.ctrl && key.name === 'c') {
          stopped = true; resolve(key.ctrl ? 130 : 0); return;
        }
        pending = pending.then(() => keypress(key)).catch(error => { stopped = true; reject(error); });
      }, () => {
        try { draw(); }
        catch (error) { stopped = true; reject(error); }
      }, { alternateScreen: true });
      draw();
    });
  } finally {
    close();
    if (spec.footer) terminal.write(`${dim(spec.footer)}\n`);
  }
}

export async function writeList<Row>(spec: ListSpec<Row>, io: CliIo, json: boolean): Promise<number> {
  if (io.stdinIsTTY && io.stdoutIsTTY && io.stderrIsTTY === true && !json) return listScreen(spec, io.terminal ?? processTerminal());
  io.write([plain(spec.title), ...spec.rows.map(spec.plain)].join('\n') + '\n');
  return 0;
}
