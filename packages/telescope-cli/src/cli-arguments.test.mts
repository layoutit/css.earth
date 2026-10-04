import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { parseCli } from './cli-arguments.mts';

const common = { json: false, verbose: false };
const cases = [
  { args: ['fetch','input','--pick','1','--out','out'], option: '--pick', expected: { command:'fetch', archive:'keck', exploration:resolve('input'), pick:1, directory:resolve('out'), ...common } },
  { args: ['wwt-fits','input','--pick','1','--level','0','--x','2','--y','3','--out','out'], option: '--pick', expected: { command:'wwt-fits', exploration:resolve('input'), pick:1, level:0, x:2, y:3, directory:resolve('out'), ...common } },
  { args: ['wwt-image','input','--pick','1','--level','0','--out','out'], option: '--pick', expected: { command:'wwt-image', exploration:resolve('input'), pick:1, level:0, directory:resolve('out'), ...common } },
  { args: ['family-run','input','operation','--out','out'], option: '--out', expected: { command:'family-run', descriptor:resolve('input'), operationId:'operation', directory:resolve('out'), ...common } },
  { args: ['family-assess','request','descriptor','--out','out'], option: '--out', expected: { command:'family-assess', request:resolve('request'), descriptor:resolve('descriptor'), directory:resolve('out'), ...common } },
  { args: ['papers','input','--host','star'], option: '--host', expected: { command:'papers', targets:['input'], host:'star', ...common } },
  { args: ['simulations','input','--out','out'], option: '--out', expected: { command:'simulations', target:'input', directory:resolve('out'), ...common } },
  { args: ['leads','input','--out','out'], option: '--out', expected: { command:'leads', target:'input', directory:resolve('out'), ...common } },
  { args: ['leads','--class','exoplanet'], option: '--class', expected: { command:'leads', archiveClass:'exoplanet', ...common } },
  { args: ['candidates','input','--epoch','date','--out','out'], option: '--epoch', expected: { command:'candidates', system:'input', epoch:'date', directory:resolve('out'), fitAstrometry:false, fitOrbits:false, ...common } },
  { args: ['associate','input','--system','star','--out','out'], option: '--system', expected: { command:'associate', measurements:resolve('input'), system:'star', directory:resolve('out'), fitAstrometry:false, fitOrbits:false, ...common } },
  { args: ['import','input','--out','out'], option: '--out', expected: { command:'import', specification:resolve('input'), directory:resolve('out'), ...common } },
  { args: ['outputs','input','--structure','part'], option: '--structure', expected: { command:'outputs', result:resolve('input'), structure:'part', ...common } },
  { args: ['project','input','--geometry','file','--out','out'], option: '--geometry', expected: { command:'project', result:resolve('input'), geometry:resolve('file'), directory:resolve('out'), ...common } },
  { args: ['export','input','--output','image','--hdu','0','--out','out'], option: '--output', expected: { command:'export', result:resolve('input'), directory:resolve('out'), selection:{kind:'image',hdu:0}, ...common } },
];

for (const { args, option, expected } of cases) {
  const command = args[0]!;
  const period = ['outputs','project','export'].includes(command) ? '' : '.';
  const invalid = (arg: string) => command === 'family-assess' ? 'Use telescope family-assess REQUEST.json DESCRIPTOR.json --out DIRECTORY.' : `Unknown or repeated ${command} option ${arg}${period}`;
  test(`${command}: schema preserves results, switch handling and exact diagnostics`, () => {
    assert.deepEqual(parseCli(args), expected);
    assert.deepEqual(parseCli([...args, '--verbose','--json']), { ...expected, verbose:true, json:true });
    for (const flag of ['--json','--verbose']) assert.throws(() => parseCli([...args,flag,flag]), { name:'TypeError', message:`Repeated option ${flag}${period}` });
    for (const unknown of ['--unknown','-x','--out=dir']) assert.throws(() => parseCli([...args,unknown]), { name:'TypeError', message:invalid(unknown) });
    assert.throws(() => parseCli([...args,option,'again']), { name:'TypeError', message:invalid(option) });
    const at = args.indexOf(option);
    const prefix = args.slice(0,at+1);
    for (const tail of [[], [''], ['--json']]) assert.throws(() => parseCli([...prefix,...tail]), { name:'TypeError', message:`Missing value for ${option}${period}` });
    assert.deepEqual(parseCli([...args,'--help']), { command:'help' });
  });
}

test('leads takes one object or one class, never both and never neither', () => {
  const usage = { name:'TypeError', message:'Use telescope leads OBJECT [--json] [--out DIRECTORY] or telescope leads --class CLASS [--json] [--out DIRECTORY].' };
  for (const args of [['leads'], ['leads','input','--class','exoplanet'], ['leads','one','two']]) assert.throws(() => parseCli(args), usage);
});

test('selectors deliberately preserve lexical versus Number coercion policies', () => {
  for (const raw of ['1','01','+1','1.0','1e0','0x1',' 1 ']) {
    const coerced = parseCli(['wwt-image','input','--pick',raw,'--level','-0','--out','out']);
    assert.equal(coerced.command, 'wwt-image');
    if (coerced.command === 'wwt-image') { assert.equal(coerced.pick,1); assert.ok(Object.is(coerced.level,-0)); }
    const fetch = () => parseCli(['fetch','input','--pick',raw,'--out','out']);
    const fits = () => parseCli(['wwt-fits','input','--pick',raw,'--level','0','--x','0','--y','0','--out','out']);
    const exported = () => parseCli(['export','input','--output','image','--hdu',raw,'--out','out']);
    if (raw === '1' || raw === '01') { fetch(); fits(); exported(); }
    else {
      assert.throws(fetch, { message:'Use telescope fetch EXPLORE.json --pick N --out DIRECTORY.' });
      assert.throws(fits, { message:'--pick must be a nonnegative whole number.' });
      assert.throws(exported, { message:'Selectors must be nonnegative whole numbers' });
    }
  }
  for (const raw of ['0','-1','9007199254740992','NaN']) assert.throws(() => parseCli(['fetch','input','--pick',raw,'--out','out']));
  assert.throws(() => parseCli(['wwt-fits','input','--pick','9007199254740992','--level','0','--x','0','--y','0','--out','out']), { message:'--pick must be a nonnegative whole number.' });
  assert.throws(() => parseCli(['export','input','--output','image','--hdu','9007199254740992','--out','out']), { message:'Selectors must be nonnegative whole numbers' });
  for (const raw of ['9007199254740992', '9'.repeat(400)]) {
    assert.throws(() => parseCli(['candidates','star','--epoch','date','--out','out','--orbit-draws',raw]),
      { message: '--orbit-draws takes a whole number of posterior draws' });
    assert.throws(() => parseCli(['associate','input','--system','star','--out','out','--orbit-draws',raw]));
  }
  for (const raw of ['0', '01', '9007199254740991']) {
    const draws = parseCli(['candidates','star','--epoch','date','--out','out','--orbit-draws',raw]);
    assert.equal(draws.command, 'candidates');
    if (draws.command === 'candidates') assert.equal(draws.orbitDraws, Number(raw));
  }
});

test('value tokens with one hyphen are accepted; errors keep their original precedence', () => {
  assert.equal(parseCli(['papers','star','--host','-host']).command,'papers');
  assert.throws(() => parseCli(['wwt-fits','input','--pick','0','--level','bad','--x','0','--y','0','--out','out']), { message:'WWT FITS --pick must be positive.' });
  assert.throws(() => parseCli(['candidates','--figure-background','bad']), { message:'--figure-background takes transparent or opaque' });
  assert.deepEqual(parseCli(['wwt-fits','catalog','--set','name','--level','0','--x','0','--y','0','--out','out']),
    { command:'wwt-fits', catalog:resolve('catalog'), setName:'name', level:0, x:0, y:0, directory:resolve('out'), ...common });
});
