import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeTerminal } from './fake-terminal.mts';
import { papers, leads, stars } from './fixtures/lookups.mts';
import { papersList, leadsList, starsList } from './lookups.mts';
import { listScreen, renderList, type ListSpec } from './list.mts';
import { bold, dim, plain } from './style.mts';
import { LEAVE_SCREEN } from './terminal.mts';

test('papers retains the approved title, columns, authors, mentions and figure panel from the real answer', () => {
  const spec = papersList(papers), row = spec.rows[0]!;
  assert.deepEqual(spec.crumbs, ['telescope', 'papers', 'Betelgeuse']);
  assert.equal(spec.title, bold('Betelgeuse') + ' · 2 papers ' + dim('· from arxiv · most mentions first'));
  assert.deepEqual(spec.columns.map(column => [column.head, column.width, column.get(row)]), [
    ['Year', 4, '2020'], ['Title', 46, 'Is Betelgeuse the Outcome of a Past Merger?'],
    ['First author', 18, 'E. Chatzopoulos et al.'], ['Mentions', 8, '   10'],
  ]);
  assert.deepEqual(spec.panel(row, 44).slice(0, 6), [bold('Is Betelgeuse the Outcome of a Past Merger?'),
    dim('E. Chatzopoulos, Juhan Frank, Dominic C. Ma…'), '',
    dim('names Betelgeuse 10 times · full text readable'), '', dim('Figures about it')]);
  assert.match(spec.text(row), /Evolution of the non–rotating/u);
  const frame = renderList(spec, { active: 0, query: '', opened: new Map() }, 160);
  assert.match(plain(frame[0]!), /^telescope › papers › Betelgeuse   v\d/u);
  assert.match(plain(frame[4]!), /Year  Title\s+First author\s+Mentions/u);
  assert.match(plain(frame[5]!), / > 2020  Is Betelgeuse the Outcome/u);
  assert.equal(frame.length, 20);
  assert.equal(spec.footer, 'Nothing saved. Keep this list with: telescope papers Betelgeuse --out DIRECTORY');
});

test('leads retains kind, publisher, license and stripped description, without an exit hint when unsaved', () => {
  const spec = leadsList(leads), row = spec.rows[0]!;
  assert.deepEqual(spec.crumbs, ['telescope', 'leads', 'Betelgeuse']);
  assert.equal(spec.title, bold('Betelgeuse') + ' · 2 published data and papers ' + dim('· from DataCite and arXiv'));
  assert.deepEqual(spec.columns.map(column => [column.head, column.width]), [['Year', 4], ['Kind', 6], ['Title', 48], ['Where', 14]]);
  assert.match(plain(spec.panel(row, 44).join('\n')), /data · Zenodo · 2025 · cc-by-4\.0/u);
  assert.match(plain(spec.panel({ ...row, description: '<p>Sky projections</p>' }, 44).join('\n')), /Sky projections/u);
  assert.doesNotMatch(spec.panel({ ...row, description: '<p>Sky projections</p>' }, 44).join(''), /<p>/u);
  assert.ok(spec.text(row).includes(row.description));
  assert.equal(spec.footer, undefined);
});

test('stars retains SIMBAD counts, radius, main catalogue, transient rows and catalogue-table count', () => {
  const spec = starsList(stars), row = spec.rows[0]!;
  assert.deepEqual(spec.crumbs, ['telescope', 'stars', 'LMC']);
  assert.equal(spec.title, bold('LMC') + ' · 177,014 stars of 195,152 objects in SIMBAD ' + dim('· radius 2.7°'));
  assert.deepEqual(spec.columns.map(column => [column.head, column.width, column.get(row)]), [
    ['Kind of star', 26, 'Cepheids'], ['Count', 8, '   3,055'],
    ['Main catalogue', 36, 'The OGLE Collection of Variable Stars. Classical Cepheids in the Magellanic System.'],
  ]);
  const panel = plain(spec.panel(row, 44).join('\n'));
  assert.match(panel, /2,866 stars · 2015AcA\.\.\.\.65\.\.297S/u);
  assert.match(panel, /2 catalogue tables with positions/u);
  assert.equal(spec.rows[1]?.label, 'novae');
  assert.match(plain(spec.panel(spec.rows[1]!, 44).join('\n')), /no catalogue paper listed/u);
  assert.equal(spec.enter.label, 'open its paper');
  assert.equal(spec.footer, undefined);
});

test('real-answer screens open the selected URL, mark it green and keep the list searchable until Escape', async () => {
  const urls: string[] = [], open = (url: string) => { urls.push(url); };
  async function browse<Row>(spec: ListSpec<Row>) {
    const terminal = new FakeTerminal(160, 40);
    const running = listScreen(spec, terminal);
    await terminal.press({ name: 'return' });
    assert.match(terminal.screen.join('\n'), /✓> /u);
    assert.match(terminal.writes.at(-1)!, /\x1b\[32mopened https:/u);
    assert.equal(terminal.listening, true);
    await terminal.press({ text: 'missing' });
    assert.match(terminal.screen.join('\n'), /no match/u);
    await terminal.press({ name: 'escape' });
    assert.equal(await running, 0); assert.equal(terminal.listening, false);
    assert.equal(terminal.alternateScreen, false);
  }
  await browse(papersList(papers, {}, open));
  await browse(leadsList(leads, {}, open));
  await browse(starsList(stars, {}, open));
  assert.deepEqual(urls, [papers.works[0]!.arxiv, leads.leads[0]!.url, stars.classes[0]!.papers[0]!.url]);
});

test('no-open suppresses every opener and papers use DOI, open-access or index URLs when arXiv is absent', () => {
  const urls: string[] = [], open = (url: string) => { urls.push(url); };
  const paper = papersList(papers, { noOpen: true }, open);
  const lead = leadsList(leads, { noOpen: true }, open);
  const star = starsList(stars, { noOpen: true }, open);
  assert.equal(paper.enter.run(paper.rows[0]!), 'not opened (--no-open)');
  assert.equal(lead.enter.run(lead.rows[0]!), 'not opened (--no-open)');
  assert.equal(star.enter.run(star.rows[0]!), 'not opened (--no-open)');
  assert.deepEqual(urls, []);
  const enabled = papersList(papers, {}, open), row = enabled.rows[0]!;
  enabled.enter.run({ ...row, arxiv: undefined });
  enabled.enter.run({ ...row, arxiv: undefined, doi: null });
  enabled.enter.run({ ...row, arxiv: undefined, doi: null, openAccessUrl: null, openAlex: 'https://openalex.org/W1' });
  assert.deepEqual(urls, [row.doi, row.openAccessUrl, 'https://openalex.org/W1']);
  assert.equal(enabled.enter.run({ title: 'No URL', year: null, doi: null, target: 'Betelgeuse' }), 'no paper to open');
  assert.equal(star.enter.run(star.rows[1]!), 'no paper to open');
});

test('Ctrl-C restores the list session and saved lists print their actual file instead of nothing saved', async () => {
  for (const [spec, filename] of [[papersList(papers, { directory: '/saved' }), 'papers.json'],
    [leadsList(leads, { directory: '/saved' }), 'leads.json'], [starsList(stars, { directory: '/saved' }), 'stars.json']] as const) {
    assert.equal(spec.footer, `Saved: /saved/${filename}`);
  }
  const terminal = new FakeTerminal();
  const running = listScreen(papersList(papers, { directory: '/saved' }), terminal);
  await terminal.press({ name: 'c', ctrl: true });
  assert.equal(await running, 130);
  assert.equal(terminal.writes.at(-2), LEAVE_SCREEN);
  assert.equal(plain(terminal.writes.at(-1)!), 'Saved: /saved/papers.json\n');
});
