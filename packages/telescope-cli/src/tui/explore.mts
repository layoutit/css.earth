import { basename } from 'node:path';
import type { TargetCatalogueEntry } from '@cssearth/telescope-core';
import { resolveTarget } from '@cssearth/telescope-core';
import type { ExplorationChoice } from '../exploration.mts';
import type { ExplorationSession } from '../session.mts';
import type { ProviderProgress, ProviderReporter } from '../vo/bridge.mts';
import type { DownloadProgress } from '@cssearth/telescope-core/node';
import type { PreviewState } from '../previews/index.mts';
import { liveBlock } from './live-block.mts';
import { EXPLORE_PAGE, PREVIEW_MINIMUM_COLUMNS, exploreSelection, renderExplore, type ExploreState, type MakeChoice, type MadeFile, type PickStatus } from './explore-render.mts';
import type { ScreenKey, Terminal } from './terminal.mts';
import { plain } from './style.mts';

export type SavedExploration = ExplorationSession & { readonly directory: string };
export interface ExploreOutput extends MakeChoice { readonly run: (parameters: ReadonlyMap<string, string>) => Promise<string> }
export interface ExploreServices {
  readonly catalogue: () => Promise<readonly TargetCatalogueEntry[]>;
  readonly search: (target: string | undefined, report: ProviderReporter, signal: AbortSignal) => Promise<SavedExploration>;
  readonly statuses: (session: SavedExploration) => Promise<ReadonlyMap<number, PickStatus>>;
  readonly size: (choice: ExplorationChoice, session: SavedExploration, signal: AbortSignal) => Promise<number | null>;
  readonly free: (directory: string) => Promise<number>;
  readonly get: (choice: ExplorationChoice, session: SavedExploration, report: (event: DownloadProgress) => void, signal: AbortSignal) => Promise<string>;
  readonly outputs: (resultPath: string, pick: number) => Promise<readonly ExploreOutput[]>;
  readonly preview: (choice: ExplorationChoice, session: SavedExploration, signal: AbortSignal) => Promise<PreviewState>;
  readonly open: (file: string) => void | Promise<void>;
  readonly screen?: (control: { pause(): void; resume(): void } | undefined) => void;
}
export interface ExploreExit { readonly code: number; readonly line: string }

/** One listener and one retained block cover the whole transaction; services own all IO. */
export async function exploreScreen(requested: string | undefined, services: ExploreServices, terminal: Terminal, noOpen = false): Promise<ExploreExit> {
  const catalogue = await services.catalogue();
  let state: ExploreState = { view: 'search', requested: requested ?? 'Field', target: requested ?? 'Field', candidates: [], query: '', active: 0,
    statuses: new Map(), providers: [], tick: 0, preview: { kind: 'loading' }, size: null, received: 0, checking: false, outputs: [], made: new Map(), making: false };
  const lifetime = new AbortController();
  let block = liveBlock(terminal), close = () => {}, closed = false, paused = false, busy = false;
  let preview: AbortController | undefined, previewPick: number | undefined, confirmation: AbortController | undefined;
  let outputs: readonly ExploreOutput[] = [], parameters = new Map<string, string>();
  const madeByPick = new Map<number, Map<number, MadeFile>>();
  let accept: (value: ExploreExit) => void = () => {}, reject: (error: unknown) => void = () => {};
  const done = new Promise<ExploreExit>((resolve, fail) => { accept = resolve; reject = fail; });
  const draw = () => { if (!closed && !paused) block.draw(renderExplore(state, terminal.columns)); };
  const finish = (exit?: ExploreExit, error?: unknown) => {
    if (closed) return;
    closed = true; lifetime.abort(); preview?.abort(); confirmation?.abort();
    services.screen?.(undefined);
    try { block.done(renderExplore(state, terminal.columns).map(plain)); }
    finally { close(); }
    if (error !== undefined) reject(error); else accept(exit ?? { code: 0, line: '' });
  };
  const animate = async (work: () => Promise<void>) => {
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, lifetime.signal]);
    const animation = (async () => {
      try { while (!signal.aborted) { await terminal.delay(80, signal); await new Promise<void>(resolve => setImmediate(resolve)); if (signal.aborted) break; state = { ...state, tick: state.tick + 1 }; draw(); } }
      catch (error) { if (!signal.aborted) throw error; }
    })();
    try { await work(); } finally { controller.abort(); await animation; }
  };
  const updatePreview = () => {
    const choice = state.view === 'table' ? exploreSelection(state).current : state.selected;
    if (terminal.columns < PREVIEW_MINIMUM_COLUMNS || !choice || !['table', 'confirm'].includes(state.view)) {
      preview?.abort(); previewPick = undefined; return;
    }
    if (previewPick === choice.pick && preview && !preview.signal.aborted) return;
    preview?.abort(); preview = new AbortController(); previewPick = choice.pick;
    const signal = AbortSignal.any([preview.signal, lifetime.signal]);
    state = { ...state, preview: { kind: 'loading' } };
    void (async () => {
      try {
        await terminal.delay(250, signal); signal.throwIfAborted();
        const data = await services.preview(choice, state.session!, signal);
        if (!signal.aborted) { state = { ...state, preview: data }; draw(); }
      } catch (error) {
        if (!signal.aborted) { state = { ...state, preview: { kind: 'failed', reason: error instanceof Error ? error.message : String(error) } }; draw(); }
      }
    })();
  };
  const browse = async () => {
    confirmation?.abort();
    const statuses = await services.statuses(state.session!);
    if (closed) return;
    state = { ...state, view: 'table', active: tableActive, statuses: new Map(statuses), notice: undefined, failure: undefined };
    busy = false; updatePreview(); draw();
  };
  let tableActive = 0;
  const search = async (target: string | undefined) => {
    busy = true; state = { ...state, view: 'search', target: target ?? state.target, providers: [], active: 0 }; draw();
    await animate(async () => {
      const providers = new Map<string, ProviderProgress>();
      const session = await services.search(target, event => {
        providers.set(event.archive, event); state = { ...state, providers: [...providers.values()] }; draw();
      }, lifetime.signal);
      if (closed) return;
      const resolution = session.answer.targetResolution;
      state = { ...state, session, target: resolution.status === 'resolved' ? resolution.canonical.name : session.target ?? state.target };
    });
    if (!closed) await browse();
  };
  const confirm = async (choice: ExplorationChoice) => {
    tableActive = exploreSelection(state).active; confirmation?.abort(); confirmation = new AbortController();
    const signal = AbortSignal.any([confirmation.signal, lifetime.signal]);
    state = { ...state, view: 'confirm', selected: choice, free: undefined, size: choice.display.advertisedKilobytes === null ? null : choice.display.advertisedKilobytes * 1000, notice: undefined };
    updatePreview(); draw();
    try {
      const [size, free] = await Promise.all([services.size(choice, state.session!, signal), services.free(state.session!.directory)]);
      if (!signal.aborted) { state = { ...state, size, free }; draw(); }
    } catch (error) { if (!signal.aborted) { state = { ...state, notice: error instanceof Error ? error.message : String(error) }; draw(); } }
  };
  const make = async (resultPath: string) => {
    busy = true; preview?.abort(); previewPick = undefined;
    const made = madeByPick.get(state.selected!.pick) ?? new Map<number, MadeFile>();
    madeByPick.set(state.selected!.pick, made);
    state = { ...state, view: 'make', active: 0, outputs: [], made, making: true, notice: undefined }; draw();
    try {
      outputs = await services.outputs(resultPath, state.selected!.pick);
      if (!closed) state = { ...state, outputs, notice: outputs.length ? undefined : 'No supported outputs for this pick.' };
    } catch (error) { if (paused) finish(undefined, error); else { outputs = []; state = { ...state, notice: error instanceof Error ? error.message : String(error) }; } }
    finally { busy = false; state = { ...state, making: false }; draw(); }
  };

  const retrieve = async () => {
    busy = true; preview?.abort(); previewPick = undefined;
    const choice = state.selected!, status = state.statuses.get(choice.pick);
    state = { ...state, view: 'download', received: status?.bytes ?? 0, total: undefined, checking: false, checked: false, failure: undefined }; draw();
    try {
      let resultPath = '';
      await animate(async () => {
        resultPath = await services.get(choice, state.session!, event => {
          state = { ...state, received: event.received, total: event.total ?? state.total, checking: event.checking ?? state.checking }; draw();
        }, lifetime.signal);
      });
      if (!closed) {
        state = { ...state, checking: true, checked: true, statuses: new Map(state.statuses).set(choice.pick, { state: 'done', bytes: state.received, resultPath }) };
        draw(); await make(resultPath);
      }
    } catch (error) {
      if (closed) return;
      if (paused) { finish(undefined, error); return; }
      const statuses = await services.statuses(state.session!);
      state = { ...state, statuses, received: statuses.get(choice.pick)?.bytes ?? state.received, failure: error instanceof Error ? error.message : String(error) };
      busy = false; draw();
    }
  };
  const exportSelected = async () => {
    const output = outputs[state.active]; if (!output) return;
    const missing = state.made.has(state.active) ? undefined : output.parameters?.find(name => !parameters.has(name));
    if (missing) { state = { ...state, parameter: { name: missing, value: '' }, notice: undefined }; draw(); return; }
    busy = true; state = { ...state, making: true, notice: undefined }; draw();
    try {
      const file = state.made.get(state.active)?.file ?? await output.run(parameters);
      if (closed) return;
      const made = new Map(state.made); made.set(state.active, { file, opened: false });
      state = { ...state, made }; madeByPick.set(state.selected!.pick, made);
      if (!noOpen) { await services.open(file); if (!closed) made.set(state.active, { file, opened: true }); }
    } catch (error) { if (paused) finish(undefined, error); else state = { ...state, notice: error instanceof Error ? error.message : String(error) }; }
    finally { parameters = new Map(); state = { ...state, making: false }; busy = false; draw(); }
  };
  const handle = async (key: ScreenKey) => {
    if (closed || paused) return;
    if (key.ctrl && key.name === 'c') { finish({ code: 130, line: '' }); return; }
    if (busy) return;
    if (state.view === 'picker') {
      if (key.name === 'escape') { finish({ code: 0, line: 'Nothing searched.' }); return; }
      if (key.name === 'return') { const candidate = state.candidates[state.active]; if (candidate) await search(candidate.id); return; }
      if (key.name === 'up') state = { ...state, active: Math.max(0, state.active - 1) };
      if (key.name === 'down') state = { ...state, active: Math.min(state.candidates.length - 1, state.active + 1) };
    } else if (state.view === 'table') {
      if (key.name === 'escape') { finish({ code: state.session!.choices.length ? 0 : 3, line: `Saved ${state.session!.directory}` }); return; }
      const { shown, active, current } = exploreSelection(state);
      if (key.name === 'return') { if (current) await confirm(current); return; }
      if (key.name === 'up' || key.name === 'pageup') state = { ...state, active: Math.max(0, active - (key.name === 'up' ? 1 : EXPLORE_PAGE)) };
      else if (key.name === 'down' || key.name === 'pagedown') state = { ...state, active: Math.max(0, Math.min(shown.length - 1, active + (key.name === 'down' ? 1 : EXPLORE_PAGE))) };
      else if (key.name === 'backspace') state = { ...state, query: state.query.slice(0, -1), active: 0 };
      else if (key.text && !key.ctrl && !key.meta && !/[\p{Control}]/u.test(key.text)) state = { ...state, query: state.query + key.text, active: 0 };
      tableActive = state.active; updatePreview();
    } else if (state.view === 'confirm') {
      if (key.name === 'escape') { await browse(); return; }
      if (key.name === 'return') {
        const status = state.statuses.get(state.selected!.pick);
        if (status?.state === 'done' && status.resultPath) await make(status.resultPath);
        else if (state.free !== undefined && (state.size === null || state.size - (status?.bytes ?? 0) <= state.free)) await retrieve();
        return;
      }
    } else if (state.view === 'download' && state.failure) {
      if (key.name === 'escape') await browse();
      if (key.name === 'return') await retrieve();
      return;
    } else if (state.view === 'make') {
      if (state.parameter) {
        if (key.name === 'escape') { parameters = new Map(); state = { ...state, parameter: undefined }; }
        else if (key.name === 'return') { parameters.set(state.parameter.name, state.parameter.value); state = { ...state, parameter: undefined }; await exportSelected(); return; }
        else if (key.name === 'backspace') state = { ...state, parameter: { ...state.parameter, value: state.parameter.value.slice(0, -1) } };
        else if (key.text && !key.ctrl && !key.meta && !/[\p{Control}]/u.test(key.text)) state = { ...state, parameter: { ...state.parameter, value: state.parameter.value + key.text } };
      } else {
        if (key.name === 'escape') { await browse(); return; }
        if (key.text === 'q') { finish({ code: 0, line: `Kept ${state.session!.directory}/pick-${state.selected!.pick}/${state.made.size ? ` · made ${[...state.made.values()].map(made => basename(made.file)).join(', ')}` : ''}` }); return; }
        if (key.name === 'return') { parameters = new Map(); await exportSelected(); return; }
        if (key.name === 'up') state = { ...state, active: Math.max(0, state.active - 1) };
        if (key.name === 'down') state = { ...state, active: Math.min(outputs.length - 1, state.active + 1) };
      }
    }
    draw();
  };
  const listen = () => terminal.listen(key => { void handle(key).catch(error => finish(undefined, error)); }, () => { updatePreview(); draw(); });
  close = listen();
  services.screen?.({ pause() { if (closed || paused) return; paused = true; preview?.abort(); block.done(); close(); },
    resume() { if (closed || !paused) return; paused = false; block = liveBlock(terminal); close = listen(); draw(); } });
  try {
    const resolution = requested === undefined ? undefined : resolveTarget(requested, catalogue, { suggestionLimit: 6, nearest: true });
    if (resolution?.status === 'unknown' || resolution?.status === 'ambiguous') {
      const candidates = resolution.status === 'unknown' ? resolution.suggestions : resolution.candidates;
      state = { ...state, view: 'picker', candidates: candidates.map(candidate => ({ ...candidate, archiveClass: catalogue.find(entry => entry.id === candidate.id)?.archiveClass })) }; draw();
    } else void search(requested).catch(error => finish(undefined, error));
    return await done;
  } catch (error) { finish(undefined, error); return await done; }
}
