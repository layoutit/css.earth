import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { BANNER } from './banner.mts';
import { HELP_COMMANDS, SHORT_HELP, helpCommand, helpText } from './help.mts';

const published = readFileSync(new URL('./fixtures/help-reference.txt', import.meta.url), 'utf8');

test('all core and useful usages have descriptions in one column, including long usages', () => {
  const lines = SHORT_HELP.split('\n').filter(line => line.startsWith('  telescope '));
  assert.equal(lines.length, 9);
  const columns = lines.map(line => {
    const match = /^  telescope .+? {2,}(\S.*)$/u.exec(line);
    assert.ok(match, `Missing description: ${line}`);
    return line.length - match[1]!.length;
  });
  assert.equal(new Set(columns).size, 1, `Description columns: ${columns.join(', ')}`);
  assert.match(SHORT_HELP, /export RESULT --output TYPE \[--out DIRECTORY\] {2,}Export/u);
  assert.match(SHORT_HELP, /skill install --provider NAME {2,}Install/u);
});

test('short help stays within one screen after a TTY-only ASCII banner', () => {
  assert.ok(SHORT_HELP.trimEnd().split('\n').length <= 25);
  for (const command of ['explore', 'get', 'outputs', 'export', 'papers', 'leads', 'stars', 'skill', 'toolchain']) {
    assert.ok(SHORT_HELP.includes(`telescope ${command} `), command);
  }
  assert.match(SHORT_HELP, /css\.earth development:.*new-object.*bake/u);
  assert.match(SHORT_HELP, /--json.*scripts and agents/u);
  assert.match(SHORT_HELP, /telescope help COMMAND/u);
  assert.equal(helpText('', false), SHORT_HELP);
  assert.equal(helpText('', true), `${BANNER}\n${SHORT_HELP}`);
  assert.ok([...BANNER].every(character => character.charCodeAt(0) < 128));
  for (const command of [...HELP_COMMANDS, 'all']) assert.equal(helpText(command, true), helpText(command, false));
});

test('every published reference line survives in help all, independently of the implementation', () => {
  assert.equal(helpText('all').slice(0, published.length), published);
  assert.match(helpText('all'), /Current human and agent output:/u);
});

test('every published command gets its own usage page, flags and associated explanation', () => {
  const usages = published.split('\n').filter(line => /^  telescope [a-z-]+ /u.test(line));
  const commands = [...new Set(usages.map(line => line.split(' ')[3]!))];
  assert.deepEqual([...HELP_COMMANDS].sort(), commands.sort());
  for (const command of commands) {
    const text = helpText(command);
    for (const line of usages.filter(line => line.startsWith(`  telescope ${command} `))) assert.ok(text.includes(line), line);
    assert.match(text, /--json.*JSON-only stdout; progress on stderr/u);
    assert.match(text, /--verbose/u);
    assert.match(text, /Exit codes:/u);
  }
  for (const [command, sentence] of [
    ['explore', 'Exploration does not state scientific acceptance criteria.'],
    ['get', 'revalidates the exact saved identity, qualifies it if needed, and exports pinned data and evidence'],
    ['outputs', 'Press Enter at any prompt to cancel before an export'],
    ['export', 'Band images are wavelength-weighted means. Feature maps integrate a continuum residual.'],
    ['new-object', '--from-pulsation drafts a pulsating star'],
    ['papers', 'Each work then lists what else was published under its'],
    ['fetch', 'Use the printed resume command, including --out with the actual run directory'],
  ]) assert.ok(helpText(command).includes(sentence), command);
  assert.doesNotMatch(helpText('explore'), /--from-apokasc/u);
  for (const command of ['explore', 'get', 'outputs', 'export']) assert.match(helpText(command), /\[--verbose\] \[--json\]/u);
  assert.match(helpText('explore'), /cssearth-telescope-explore-summary@1/u);
  assert.match(helpText('explore'), /--all.*Show every saved choice/u);
  assert.throws(() => helpText('unknown'), /Unknown help command unknown/u);
});

test('all help entry forms resolve before argument validation', () => {
  for (const args of [[], ['--help'], ['-h'], ['help']]) assert.equal(helpCommand(args), '');
  for (const command of [...HELP_COMMANDS, 'all']) {
    assert.equal(helpCommand(['help', command]), command);
    assert.equal(helpCommand([command, '--help']), command);
    assert.equal(helpCommand([command, 'incomplete', '-h']), command);
  }
  assert.equal(helpCommand(['explore', 'Betelgeuse']), undefined);
});

test('the installed command entry prints short or command help without a banner when piped', () => {
  const entry = new URL('./bin.mts', import.meta.url).pathname;
  for (const [args, command] of [
    [[], ''], [['--help'], ''], [['-h'], ''], [['help'], ''],
    [['help', 'all'], 'all'], [['help', 'explore'], 'explore'], [['explore', '--help'], 'explore'],
  ] as const) {
    const result = spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, helpText(command, false));
    assert.equal(result.stderr, '');
    assert.ok(!result.stdout.includes(BANNER));
  }
});

test('exploration help names cwd storage, compact JSON and consistent RUN arguments',()=>{
  for(const command of ['explore','all']){
    const text=helpText(command);assert.match(text,/under \.\/telescope-runs\/ in the current working directory/u);
    assert.match(text,/compact summary as JSON; the complete record stays on disk/u);
    assert.doesNotMatch(text,/under the user root’s telescope-runs|writes the saved exploration as JSON/u);
  }
  for(const command of ['', 'get','all']){
    const text=helpText(command);assert.match(text,/telescope get RUN --pick N/u);
    assert.doesNotMatch(text,/telescope get DIRECTORY/u);
  }
});

test('the shared command guide links to the implementation in its actual package',()=>{
  const guide=readFileSync(new URL('../../../docs/telescope-commands.md',import.meta.url),'utf8');
  assert.match(guide,/\[`packages\/telescope-cli\/src\/`\]\(\.\.\/packages\/telescope-cli\/src\/\)/u);
  assert.doesNotMatch(guide,/implementation is this package's `src\/`/u);
});

test('get, fetch and implicit Python consent are documented in help, Quick Start and the shipped skill',()=>{
  for(const command of ['get','fetch']){
    const text=helpText(command);
    assert.match(text,/--yes \(-y\) skips/u);
    assert.match(text,/100 MB/u);
    assert.match(text,/Continue\? \[Y\/n\]/u);
    assert.match(text,/download metadata/u);
  }
  assert.match(helpText('explore'),/managed Python.*packages, approximate size and toolchains/u);
  const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
  assert.match(readme,/`--yes` \(`-y`\) skips terminal consent/u);
  const skill=readFileSync(new URL('../skills/telescope/SKILL.md',import.meta.url),'utf8');
  assert.match(skill,/`--yes` \(`-y`\)/u);
  assert.match(skill,/`download: \{ bytes, archive, destination \}`/u);
});


test('cwd runs and central toolchain management are documented consistently',()=>{
  const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
  const skill=readFileSync(new URL('../skills/telescope/SKILL.md',import.meta.url),'utf8');
  const guide=readFileSync(new URL('../../../docs/telescope-commands.md',import.meta.url),'utf8');
  assert.ok(readme.split('\n').length<=100,'npm README stays short');
  for(const text of [readme,skill,guide]){
    assert.match(text,/\.\/telescope-runs\//u);assert.match(text,/telescope toolchain list/u);assert.match(text,/telescope toolchain remove NAME/u);
  }
  for(const topic of ['toolchain','all']){
    const text=helpText(topic);assert.match(text,/toolchain list \[--json\]/u);assert.match(text,/toolchain remove NAME \[--json\]/u);
    assert.match(text,/size on disk and folder/u);assert.match(text,/active install locks/u);
  }
});

test('outputs documentation promises the persisted inspection and existing-run summary contract',()=>{
  const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
  const skill=readFileSync(new URL('../skills/telescope/SKILL.md',import.meta.url),'utf8');
  const guide=readFileSync(new URL('../../../docs/telescope-commands.md',import.meta.url),'utf8');
  for(const text of [readme,skill,guide,helpText('outputs'),helpText('all')]) {
    const plain=text.replaceAll('`','');
    assert.match(plain,/saves the complete inspection as outputs\.json inside the existing run and prints a summary naming savedPath; it never creates a new run/iu);
    assert.match(plain,/--out.*existing subfolder inside that run/u);
    assert.doesNotMatch(plain,/outputs prints complete JSON without saving|outputs.*without --out save under/u);
  }
});
