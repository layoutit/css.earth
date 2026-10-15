import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exploreScreen, type ExploreServices } from './explore.mts';
import { FakeTerminal } from './fake-terminal.mts';
import { LEAVE_SCREEN } from './terminal.mts';
import { plain, visibleWidth } from './style.mts';
import { exploreLabel, renderExplore, type ExploreState, type PickStatus } from './explore-render.mts';
import { exploreSession } from './fixtures/explore.mts';
import { ARCHIVES } from '../archives/archives.mts';
import { SEARCH as SPITZER_SEARCH } from '../archives/spitzer/archive.mts';
import { OPUS_SERVICE } from '../archive-adapters/opus.mts';

class ExploreTerminal extends FakeTerminal {
  private waits: { milliseconds: number; resolve: () => void; signal: AbortSignal }[] = [];
  override delay(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.delays.push(milliseconds);
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const abort = () => { this.waits = this.waits.filter(item => item.signal !== signal); reject(signal.reason); };
      signal.addEventListener('abort', abort, { once: true });
      this.waits.push({ milliseconds, signal, resolve: () => { signal.removeEventListener('abort', abort); resolve(); } });
    });
  }
  async advance(milliseconds: number): Promise<void> {
    const ready = this.waits.filter(wait => wait.milliseconds === milliseconds);
    this.waits = this.waits.filter(wait => !ready.includes(wait));
    for (const wait of ready) wait.resolve();
    await tick();
  }
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function until(condition: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!condition()) { if (Date.now() > deadline) assert.fail('screen did not reach its expected state'); await tick(); }
}
const current = (terminal: FakeTerminal) => terminal.screen.join('\n');
const history = (terminal: FakeTerminal) => plain(terminal.writes.join(''));

function fixture() {
  let transfers = 0, exports = 0, free = 1e12;
  const statuses = new Map<number, PickStatus>(), previews: number[] = [], previewSignals: AbortSignal[] = [], opened: string[] = [], targets: (string | undefined)[] = [];
  const services: ExploreServices = {
    catalogue: async () => [{ id: 'star', name: 'Star', aliases: ['HD 1'], archiveClass: 'star' }],
    resolve: async () => false,
    search: async (target, report) => {
      targets.push(target); report({ archive: 'ALMA', state: 'searching' }); await tick();
      report({ archive: 'ALMA', state: 'done', count: 2 }); report({ archive: 'Gemini', state: 'done', count: 0 });
      report({ archive: 'Keck', state: 'done', reason: 'timed out' }); await tick(); return exploreSession();
    },
    statuses: async () => statuses,
    size: async () => 2 * 1024 ** 2,
    free: async () => free,
    get: async (choice, _session, report) => {
      transfers++; report({ received: 1024 ** 2, total: 2 * 1024 ** 2 }); await tick();
      if (transfers === 1) { statuses.set(choice.pick, { state: 'partial', bytes: 1024 ** 2 }); throw new Error('connection reset by the archive'); }
      report({ received: 2 * 1024 ** 2, total: 2 * 1024 ** 2, checking: true }); await tick();
      statuses.set(choice.pick, { state: 'done', bytes: 2 * 1024 ** 2, resultPath: '/run/pick-1/result.json' }); return '/run/pick-1/result.json';
    },
    outputs: async () => [{ name: 'Image', description: 'PNG with a scale bar', run: async () => { exports++; return 'figure.png'; } },
      { name: 'Viewer', description: 'HTML page you can pan and zoom', run: async () => { exports++; return 'viewer.html'; } }],
    preview: async (choice, _session, signal) => { previews.push(choice.pick); previewSignals.push(signal); return { kind: 'none', reason: 'the archive has no preview for this one' }; },
    open: file => { opened.push(file); },
  };
  return { services, statuses, previews, previewSignals, opened, targets, setFree: (bytes: number) => { free = bytes; }, transfers: () => transfers, exports: () => exports };
}

test('whole explore flow selects a suggestion, confirms, fails, resumes, makes twice and keeps table state', async () => {
  const terminal = new ExploreTerminal(150), f = fixture();
  const running = exploreScreen('starr', f.services, terminal);
  await until(() => current(terminal).includes('Did you mean:'));
  assert.match(current(terminal), /telescope › explore “starr” › did you mean/u);
  assert.match(current(terminal), /> Star\s+star/u); assert.deepEqual(f.targets, []);
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('Start (UTC)'));
  assert.deepEqual(f.targets, ['star']);
  assert.match(history(terminal), /⠋ searching/u); assert.match(history(terminal), /2 found/u); assert.match(history(terminal), /none/u);
  assert.match(current(terminal), /incomplete.*Keck timed out/u); assert.match(current(terminal), /2025-01-02 03:04/u); assert.match(current(terminal), /date \?/u);
  assert.equal(f.transfers(), 0); assert.deepEqual(f.previews, []);
  await terminal.advance(250); assert.deepEqual(f.previews, [1]);
  await terminal.press({ name: 'down' }); assert.equal(f.previewSignals[0]!.aborted, true);
  await terminal.press({ name: 'up' }, { text: 'ALMA' }); await terminal.advance(250);
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('Download it?'));
  assert.match(current(terminal), /the whole ALMA delivery.*all its spectral windows/u); assert.match(current(terminal), /2\.0 MB/u);
  assert.equal(f.transfers(), 0);
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('Resume from there?'));
  assert.match(current(terminal), /stopped at 1\.0 MB of 2\.0 MB/u);
  await terminal.press({ name: 'escape' }); assert.match(current(terminal), /◐>.*ALMA/u); assert.match(current(terminal), /\/ ALMA/u);
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('Resume? 1.0 MB left'));
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('What do you want to make?'));
  assert.equal(f.transfers(), 2); assert.match(history(terminal), /Check headers and units\s+⠋ checking/u);
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('✓ figure.png · opened'));
  await terminal.press({ name: 'down' }, { name: 'return' }); await until(() => current(terminal).includes('✓ viewer.html · opened'));
  assert.deepEqual(f.opened, ['figure.png', 'viewer.html']); assert.equal(f.exports(), 2); assert.equal(terminal.listening, true);
  await terminal.press({ name: 'escape' }); assert.match(current(terminal), /1 downloaded/u); assert.match(current(terminal), /✓>.*ALMA/u); assert.match(current(terminal), /\/ ALMA/u);
  await terminal.press({ name: 'return' }); assert.match(current(terminal), /Already downloaded/u);
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('What do you want to make?'));
  assert.equal(f.transfers(), 2); await terminal.press({ text: 'q' });
  assert.deepEqual(await running, { code: 0, line: 'Kept /run/pick-1/ · made figure.png, viewer.html' });
  assert.equal(terminal.listening, false); assert.equal(terminal.writes.at(-1), LEAVE_SCREEN); assert.doesNotMatch(terminal.writes.join(''), /\x1b\[2J/u);
});

test('exact aliases skip the picker, a narrow window skips previews, disk refusal blocks Enter and no-open stays in make', async () => {
  const terminal = new ExploreTerminal(100), f = fixture(); f.setFree(1);
  const running = exploreScreen('HD 1', f.services, terminal, true);
  await until(() => current(terminal).includes('Start (UTC)'));
  assert.doesNotMatch(history(terminal), /Did you mean:|preview ·/u); assert.deepEqual(f.targets, ['HD 1']);
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('Not enough space:'));
  await terminal.press({ name: 'return' }); assert.equal(f.transfers(), 0);
  f.setFree(1e12);
  f.statuses.set(1, { state: 'done', bytes: 100, resultPath: '/run/pick-1/result.json' });
  await terminal.press({ name: 'escape' }, { name: 'return' }); await until(() => current(terminal).includes('Already downloaded'));
  // Refresh status is read when returning to the table.
  await terminal.press({ name: 'escape' }, { name: 'return' }, { name: 'return' }); await until(() => current(terminal).includes('What do you want to make?'));
  await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('✓ figure.png'));
  assert.deepEqual(f.opened, []); assert.doesNotMatch(current(terminal), /· opened/u);
  await terminal.press({ name: 'escape' }, { name: 'escape' }); assert.deepEqual(await running, { code: 0, line: 'Saved /run · reopen it with: telescope open' });
  assert.deepEqual(f.previews, []);
});

test('Escape on suggestions searches nothing; Ctrl-C aborts downloads and restores the terminal', async () => {
  for (const phase of ['picker', 'download'] as const) {
    const terminal = new ExploreTerminal(), f = fixture(); let aborted = false;
    const services: ExploreServices = { ...f.services, get: async (_choice, _session, _report, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    }) };
    const running = exploreScreen(phase === 'picker' ? 'missing' : 'star', services, terminal);
    if (phase === 'picker') { await until(() => current(terminal).includes('Did you mean:')); await terminal.press({ name: 'escape' }); assert.equal((await running).line, 'Nothing searched.'); assert.deepEqual(f.targets, []); }
    else {
      await until(() => current(terminal).includes('Start (UTC)')); await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('Download it?'));
      await terminal.press({ name: 'return' }); await until(() => current(terminal).includes('Check headers'));
      await terminal.press({ name: 'c', ctrl: true }); assert.equal((await running).code, 130); assert.equal(aborted, true);
    }
    assert.equal(terminal.listening, false); assert.equal(terminal.writes.at(-1), LEAVE_SCREEN);
  }
});

test('an aborted debounce cannot fetch the old row, and a failing exporter stays in make', async () => {
  const terminal = new ExploreTerminal(140), f = fixture();
  f.statuses.set(2, { state: 'done', bytes: 1, resultPath: '/run/pick-2/result.json' });
  const running = exploreScreen('star', { ...f.services, outputs: async () => [{ name: 'Image', description: 'PNG', parameters: ['plane'], run: async values => {
    assert.equal(values.get('plane'), '3'); throw new Error('export failed');
  } }] }, terminal);
  await until(() => current(terminal).includes('Start (UTC)'));
  await terminal.press({ name: 'down' }); await terminal.advance(250); assert.deepEqual(f.previews, [2]);
  await terminal.press({ name: 'return' }, { name: 'return' }); await until(() => current(terminal).includes('What do you want to make?'));
  await terminal.press({ name: 'return' }); assert.match(current(terminal), /plane:/u);
  await terminal.press({ text: '3' }, { name: 'return' }); await until(() => current(terminal).includes('export failed'));
  assert.equal(terminal.listening, true); assert.deepEqual(f.opened, []);
  await terminal.press({ name: 'c', ctrl: true }); assert.equal((await running).code, 130);
});


test('output inspection failure belongs to make, never reports an interrupted download', async () => {
  const terminal = new ExploreTerminal(140), f = fixture();
  f.statuses.set(1, { state: 'done', bytes: 1, resultPath: '/run/pick-1/result.json' });
  const running = exploreScreen('star', { ...f.services, outputs: async () => { throw new Error('unsupported output metadata'); } }, terminal);
  await until(() => current(terminal).includes('Start (UTC)'));
  await terminal.press({ name: 'return' }, { name: 'return' }); await until(() => current(terminal).includes('unsupported output metadata'));
  assert.match(current(terminal), /› make/u); assert.doesNotMatch(current(terminal), /Resume from there|stopped at/u);
  assert.equal(f.transfers(), 0); await terminal.press({ name: 'escape' }, { name: 'escape' }); assert.equal((await running).code, 0);
});

test('archive search renders only short reasons without altering saved evidence', () => {
  const cases = [
    ['The Heritage Archive did not answer aorByPosition in 1 attempts: Error: socket hang up', 'no answer'],
    ['Error: request timeout after 15000 ms', 'timed out'],
    ['Error: connect ECONNREFUSED archive.example', 'refused'],
    ['HTTP 403 Forbidden: private archive', 'refused'],
    ['Error: invalid archive response with a very long diagnostic', 'error'],
  ];
  const session = exploreSession();
  const state: ExploreState = { view: 'search', target: 'Star', requested: 'star', candidates: [], session, query: '', active: 0,
    statuses: new Map(), providers: [], tick: 0, preview: { kind: 'loading' }, size: null, received: 0, checking: false, outputs: [], made: new Map(), making: false };
  for (const [reason, short] of cases) {
    const provider = { archive: 'Spitzer', state: 'done' as const, reason: reason! };
    const lines = renderExplore({ ...state, providers: [provider] }, 150).map(plain);
    assert.equal(lines.at(-1), `  Spitzer   ${short}`);
    assert.equal(provider.reason, reason);
    assert.equal(state.session, session);
  }
});

test('table title groups short archive names by reason, clips only when needed and preserves evidence', () => {
  const session = exploreSession();
  const services = [
    { service: SPITZER_SEARCH, state: 'unavailable' as const, scope: 'fixture', reason: 'The Heritage Archive did not answer aorByPosition: https://private.example/diagnostic' },
    { service: 'https://almascience.eso.org/tap', state: 'overflow' as const, scope: 'fixture', reason: 'Raw access-description limit details' },
    { service: 'MAST HST', state: 'overflow' as const, scope: 'fixture', reason: 'Full instrument facet diagnostics' },
    { service: 'MAST HST', state: 'overflow' as const, scope: 'another search', reason: 'Another instrument reached its limit' },
  ];
  const state: ExploreState = { view: 'table', target: 'Star', requested: 'star', candidates: [], session: { ...session, answer: { ...session.answer, services } },
    query: '', active: 0, statuses: new Map(), providers: [], tick: 0, preview: { kind: 'loading' }, size: null, received: 0, checking: false, outputs: [], made: new Map(), making: false };
  const saved = structuredClone(state.session);
  const title = 'Star · 2 observations · incomplete · Spitzer no answer · ALMA, MAST/HST hit their result limit';
  assert.equal(plain(renderExplore(state, 150)[2]!), title);
  assert.equal(plain(renderExplore(state, visibleWidth(title))[2]!), title);
  const clipped = renderExplore(state, 80)[2]!;
  assert.equal(visibleWidth(clipped), 80); assert.equal(plain(clipped), title.slice(0, 79) + '…');
  const providerNames = [['eso', 'ESO'], ['keck', 'Keck'], ['gemini', 'Gemini'], ['chandra', 'Chandra']].map(([id, label]) => {
    const address = ARCHIVES.find(archive => archive.id === id)?.registry?.address;
    assert.ok(address); assert.ok(label); return [address, label] as const;
  });
  for (const [service, label] of [...providerNames, [OPUS_SERVICE, 'OPUS'] as const, ['https://unknown.example/service', 'Archive'] as const]) {
    const issue = { service, state: 'unavailable' as const, scope: 'fixture', reason: 'timeout at https://private.example/error' };
    const answer = { ...session.answer, services: [issue] };
    assert.equal(plain(renderExplore({ ...state, session: { ...session, answer } }, 150)[2]!), `Star · 2 observations · incomplete · ${label} timed out`);
    assert.equal(plain(renderExplore({ ...state, view: 'search', providers: [{ archive: service, state: 'done', reason: issue.reason }] }, 150).at(-1)!), `  ${label.padEnd(10)}timed out`);
  }
  assert.deepEqual(state.session, saved);
  assert.equal(plain(renderExplore({ ...state, session: { ...session, answer: { ...session.answer, outcome: { selection: 'available', coverage: 'bounded' } } } }, 150)[2]!), 'Star · 2 observations');
});

test('package-owned source rows show Local and a fitting product kind or family without changing choices', () => {
  const session = exploreSession(), base = session.choices[0]!;
  for (const productKind of ['image', 'spectrum', 'time-series', 'long product kind that cannot fit', null]) {
    const choice = { ...base, telescope: 'Source archive', mode: 'FITS/image',
      reference: { kind: 'indexed-observation' as const, telescope: 'Source archive', mode: 'FITS/image', observation: base.observation, programme: base.program },
      display: { ...base.display, instrument: 'Source archive / FITS/image', productKind } };
    const saved = structuredClone(choice), label = exploreLabel(choice);
    assert.equal(label.slice(4, 12).trim(), 'Local');
    assert.equal(label.slice(14, 27).trim(), productKind && productKind.length <= 13 ? productKind : 'FITS');
    assert.doesNotMatch(label.slice(0, 27), /Source|…/u);
    assert.deepEqual(choice, saved);
  }
  assert.equal(exploreLabel(base).slice(4, 12).trim(), 'ALMA');
  assert.equal(exploreLabel(base).slice(14, 27).trim(), 'ALMA');
});

test('EOF exits picker, search, table, confirmation, download and make, retaining saved work', async () => {
  for (const phase of ['picker', 'search', 'table', 'confirm', 'download', 'make'] as const) {
    const terminal = new ExploreTerminal(), f = fixture(); let aborted = false;
    const wait = (signal: AbortSignal) => new Promise<never>((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    });
    const services: ExploreServices = { ...f.services,
      search: phase === 'search' ? async (_target, _report, signal) => wait(signal) : f.services.search,
      get: async (_choice, _session, _report, signal) => wait(signal) };
    if (phase === 'make') f.statuses.set(1, { state: 'done', bytes: 100, resultPath: '/run/pick-1/result.json' });
    const running = exploreScreen(phase === 'picker' ? 'missing' : 'star', services, terminal);
    if (phase === 'picker') await until(() => current(terminal).includes('Did you mean:'));
    else if (phase === 'search') await until(() => current(terminal).includes('searching archives'));
    else {
      await until(() => current(terminal).includes('Start (UTC)'));
      if (phase !== 'table') {
        await terminal.press({ name: 'return' }); await until(() => current(terminal).includes(phase === 'make' ? 'Already downloaded' : 'Download it?'));
        if (phase === 'download' || phase === 'make') {
          await terminal.press({ name: 'return' }); await until(() => current(terminal).includes(phase === 'make' ? 'What do you want to make?' : 'Check headers'));
        }
      }
    }
    await terminal.press({ name: 'eof' });
    assert.deepEqual(await running, { code: 0, line: phase === 'picker' || phase === 'search' ? 'Nothing searched.' : 'Saved /run' });
    assert.equal(terminal.listening, false); assert.equal(terminal.writes.at(-1), LEAVE_SCREEN);
    if (phase === 'download' || phase === 'search') assert.equal(aborted, true);
    if (phase === 'make') assert.equal(f.statuses.get(1)?.state, 'done');
  }
});

test('a valid star absent from the catalogue resolves before searching, including an empty catalogue', async () => {
  for (const empty of [false, true]) {
    const terminal = new ExploreTerminal(100, 18), f = fixture(), resolved: string[] = [];
    const running = exploreScreen('Sgr A*', { ...f.services,
      catalogue: empty ? async () => [] : f.services.catalogue,
      resolve: async name => { resolved.push(name); return true; },
    }, terminal);
    await until(() => current(terminal).includes('Start (UTC)'));
    assert.deepEqual(resolved, ['Sgr A*']); assert.deepEqual(f.targets, ['Sgr A*']);
    assert.doesNotMatch(history(terminal), /Did you mean:/u);
    assert.match(current(terminal), /enter choose · esc quit/u);
    await terminal.press({ name: 'escape' }); assert.equal((await running).code, 0);
  }
});

test('a failed resolution without suggestions reports the name and exits without an empty picker', async () => {
  const terminal = new ExploreTerminal(), f = fixture();
  assert.deepEqual(await exploreScreen('missing', { ...f.services, catalogue: async () => [] }, terminal),
    { code: 3, line: 'No object named “missing”' });
  assert.deepEqual(f.targets, []); assert.doesNotMatch(history(terminal), /Did you mean:/u);
  assert.equal(terminal.listening, false); assert.equal(terminal.writes.at(-1), LEAVE_SCREEN);
});

test('explore stays visible at 100×18, pages by height and recovers after shrinking below minimum', async () => {
  const terminal = new ExploreTerminal(100, 18), f = fixture(), session = exploreSession();
  const choices = Array.from({ length: 30 }, (_, index) => ({ ...session.choices[0]!, pick: index + 1 }));
  const saved = { ...session, choices };
  const running = exploreScreen(undefined, f.services, terminal, false, saved);
  await until(() => current(terminal).includes('Start (UTC)'));
  assert.equal(terminal.alternateScreen, true); assert.match(current(terminal), /1–10 of 30/u);
  assert.match(current(terminal), />\s+1\s+ALMA/u);
  await terminal.press({ name: 'pagedown' }); assert.match(current(terminal), />\s+11\s+ALMA/u);
  terminal.resize(100, 5); assert.equal(terminal.screen[0], 'make the window taller: needs 9 rows');
  await terminal.press({ name: 'return' }, { name: 'down' }); assert.equal(f.transfers(), 0);
  terminal.resize(150, 18); assert.match(current(terminal), />\s+11\s+ALMA/u);
  assert.match(current(terminal), /enter choose · esc quit/u); assert.equal(terminal.wraps, 0);
  await terminal.press({ name: 'escape' }); assert.equal((await running).code, 0);
  assert.equal(terminal.alternateScreen, false);
});
