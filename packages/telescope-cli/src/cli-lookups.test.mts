import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test, mock } from 'node:test';
import * as papersApi from './papers.mts';
import * as leadsApi from './simulations/leads.mts';
import * as starsApi from './stars/stars.mts';
import { papers, leads, stars } from './tui/fixtures/lookups.mts';
import { FakeTerminal } from './tui/fake-terminal.mts';
import type { Terminal } from './tui/terminal.mts';
import type { CliIo } from './cli/cli-io.mts';
import { lookupJson } from './cli/cli-summary.mts';
import { plain } from './tui/style.mts';
import { parseCli } from './cli/cli-arguments.mts';
import { helpText } from './help.mts';

const urls: string[] = [];
const requests: { command: string; directory?: string }[] = [];
let empty = false;
const sweep: papersApi.PaperSweep = {
  schema: papersApi.PAPERS_SWEEP_SCHEMA, instrument: null, requests: 2,
  targets: ['Betelgeuse', 'LMC'].map(name => ({ target: { id: name.toLowerCase(), name }, names: [name],
    source: 'arxiv', query: 'fixture', candidates: 1, works: [{ year: 2020, title: `${name} paper`, doi: `https://example.org/${name}` }] })),
};
mock.module('./tui/open.mts', { namedExports: { openExternal: (url: string) => { urls.push(url); } } });
mock.module('./papers.mts', { namedExports: { ...papersApi,
  searchPapers: async (_root: string, options: papersApi.PaperSearchOptions) => {
    requests.push({ command: 'papers', directory: options.directory }); options.progress?.('Searching papers…');
    return empty ? { ...papers, works: [] } : papers;
  },
  sweepPapers: async (_root: string, options: papersApi.PaperSweepOptions) => {
    requests.push({ command: 'sweep', directory: options.directory }); options.progress?.('Searching papers…'); return sweep;
  },
} });
mock.module('./simulations/leads.mts', { namedExports: { ...leadsApi,
  searchLeads: async (_root: string, options: Parameters<typeof leadsApi.searchLeads>[1]) => {
    requests.push({ command: 'leads', directory: options.directory }); options.progress?.('Searching leads…'); return leads;
  },
} });
mock.module('./stars/stars.mts', { namedExports: { ...starsApi,
  surveyStars: async (_root: string, options: starsApi.StarSurveyOptions) => {
    requests.push({ command: 'stars', directory: options.directory }); options.progress?.('Counting stars…'); return stars;
  },
} });
const { main } = await import('./cli.mts');

class ReadyTerminal extends FakeTerminal {
  private accept = () => {};
  readonly ready = new Promise<void>(resolve => { this.accept = resolve; });
  override listen(...args: Parameters<Terminal['listen']>) {
    const close = super.listen(...args); this.accept(); return close;
  }
}
function capture(stdinIsTTY = true, stdoutIsTTY = true, stderrIsTTY: boolean | undefined = true) {
  const terminal = new ReadyTerminal(160, 40), stdout: string[] = [], stderr: string[] = [];
  const io: CliIo = { stdinIsTTY, stdoutIsTTY, stderrIsTTY, terminal, write: text => stdout.push(text),
    error: text => stderr.push(text), question: async () => assert.fail('Unexpected prompt'), close: () => {} };
  return { terminal, stdout, stderr, io };
}
async function interactive(args: readonly string[]) {
  const screen = capture(), running = main(args, undefined, screen.io.write, screen.io);
  await Promise.race([screen.terminal.ready, running.then(code => assert.fail(`Exited before screen: ${code}: ${screen.stderr.join('')}`))]);
  return { ...screen, running };
}

test('papers, leads and stars preserve progress, draw only on stderr and stay open after Enter', { timeout: 10_000 }, async () => {
  urls.length = 0;
  for (const [command, target, progress] of [['papers', 'Betelgeuse', 'Searching papers…'],
    ['leads', 'Betelgeuse', 'Searching leads…'], ['stars', 'LMC', 'Counting stars…']] as const) {
    const screen = await interactive([command, target]);
    assert.deepEqual(screen.stderr, [`${progress}\n`]);
    assert.match(screen.terminal.screen[0]!, new RegExp(`telescope › ${command} › ${target}`, 'u'));
    await screen.terminal.press({ name: 'return' });
    assert.match(screen.terminal.screen.join('\n'), /✓> /u);
    assert.equal(screen.terminal.listening, true);
    await screen.terminal.press({ name: 'escape' });
    assert.equal(await screen.running, 0);
    assert.equal(screen.terminal.listening, false); assert.equal(screen.terminal.alternateScreen, false);
    assert.deepEqual(screen.stdout, []);
  }
  assert.deepEqual(urls, [papers.works[0]!.arxiv, leads.leads[0]!.url, stars.classes[0]!.papers[0]!.url]);
});

test('no-open is optional and command-specific, rejects repetition and suppresses all browser launches', { timeout: 10_000 }, async () => {
  urls.length = 0;
  for (const command of ['papers', 'leads', 'stars']) {
    assert.deepEqual(parseCli([command, 'target', '--no-open']), { ...parseCli([command, 'target']), noOpen: true });
    assert.throws(() => parseCli([command, 'target', '--no-open', '--no-open']), /Repeated option --no-open/u);
    assert.match(helpText(command), /--no-open disables opening the browser/u);
    const screen = await interactive([command, 'target', '--no-open']);
    await screen.terminal.press({ name: 'return' });
    assert.match(screen.terminal.screen.join('\n'), /not opened \(--no-open\)/u);
    await screen.terminal.press({ name: 'c', ctrl: true });
    assert.equal(await screen.running, 130);
    assert.deepEqual(screen.stdout, []);
  }
  assert.throws(() => parseCli(['simulations', 'target', '--no-open']), /Unknown/u);
  assert.deepEqual(urls, []);
});

test('sweeps browse every target and --out still reaches the search while replacing the unsaved hint', { timeout: 10_000 }, async () => {
  urls.length = 0; requests.length = 0;
  const screen = await interactive(['papers', 'Betelgeuse', 'LMC', '--out', 'saved']);
  assert.match(screen.terminal.screen[0]!, /papers › Betelgeuse, LMC/u);
  assert.match(screen.terminal.screen.join('\n'), /Betelgeuse paper/u);
  assert.match(screen.terminal.screen.join('\n'), /LMC paper/u);
  await screen.terminal.press({ name: 'down' }, { name: 'return' });
  assert.deepEqual(urls, ['https://example.org/LMC']);
  await screen.terminal.press({ name: 'escape' }); assert.equal(await screen.running, 0);
  assert.equal(plain(screen.terminal.writes.at(-1)!), `Saved: ${resolve('saved')}/papers.json\n`);
  assert.deepEqual(requests, [{ command: 'sweep', directory: resolve('saved') }]);
  for (const command of ['papers', 'leads', 'stars']) {
    const saved = await interactive([command, 'target', '--out', 'saved']);
    await saved.terminal.press({ name: 'escape' }); assert.equal(await saved.running, 0);
    assert.equal(plain(saved.terminal.writes.at(-1)!), `Saved: ${resolve('saved')}/${command}.json\n`);
    assert.deepEqual(requests.at(-1), { command, directory: resolve('saved') });
  }
});

test('every non-TTY surface and JSON keep the existing exact output with no screen or opener', { timeout: 10_000 }, async () => {
  urls.length = 0;
  for (const command of ['papers', 'leads', 'stars']) {
    const data = command === 'papers' ? papers : command === 'leads' ? leads : stars;
    const formatted = command === 'papers' ? papersApi.formatPapers(papers) : command === 'leads' ? leadsApi.formatLeads(leads) : starsApi.formatStars(stars);
    for (const [stdin, stdout, stderr, json] of [[false, true, true, false], [true, false, true, false],
      [true, true, false, false], [true, true, undefined, false], [true, true, true, true]] as const) {
      const screen = capture(stdin, stdout);
      screen.io = { ...screen.io, stderrIsTTY: stderr };
      screen.terminal.listen = () => assert.fail('A noninteractive command acquired the terminal');
      const code = await main([command, 'target', ...(json ? ['--json'] : [])], undefined, screen.io.write, screen.io);
      assert.equal(code, 0);
      assert.equal(screen.stdout.join(''), json ? await lookupJson(command, data) : formatted);
      assert.deepEqual(screen.terminal.writes, []);
      assert.doesNotMatch(screen.stdout.join('') + screen.stderr.join(''), /\x1b/u);
    }
  }
  const screen = capture(false, false);
  assert.equal(await main(['papers', 'Betelgeuse', 'LMC'], undefined, screen.io.write, screen.io), 0);
  assert.equal(screen.stdout.join(''), papersApi.formatSweep(sweep));
  assert.deepEqual(urls, []);
});

test('an empty papers result remains browsable, opens nothing and preserves exit code 3', { timeout: 5000 }, async () => {
  empty = true; urls.length = 0;
  try {
    const screen = await interactive(['papers', 'Betelgeuse']);
    assert.match(screen.terminal.screen.join('\n'), /no match/u);
    await screen.terminal.press({ name: 'return' }, { name: 'escape' });
    assert.equal(await screen.running, 3); assert.deepEqual(urls, []);
  } finally { empty = false; }
});
