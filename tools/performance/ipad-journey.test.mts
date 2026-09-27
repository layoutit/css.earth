import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { sourceTest } from '../../tests/objects/source-test.mts';
import { JOURNEY_INPUT_SOURCE, compileJourney, parseJourney, parseJourneyArgs } from './ipad-journey.mts';

const test = sourceTest();

test('a journey resolves displayed body names through the one object registry', () => {
  const journey = parseJourney({ start: 'Mars', actions: [{ fly: 'Moon' }, { screenshot: 'after-flight' }] });
  assert.deepEqual(journey, { start: 'mars', actions: [{ fly: 'moon' }, { screenshot: 'after-flight' }] });
  const steps = compileJourney(journey);
  assert.equal(steps.length, 3);
  assert.match((steps[0] as { script: string }).script, /__cssEarthControl/u);
  assert.match((steps[0] as { script: string }).script, /control\.fly\("moon"\)/u);
  assert.doesNotMatch((steps[0] as { script: string }).script, /data-atlas-object/u);
  assert.deepEqual(steps[1], { route: '/moon/' });
  assert.deepEqual(steps.at(-1), { screenshot: 'after-flight' });
  assert.equal(JOURNEY_INPUT_SOURCE, 'page-dispatched');
});

test('journey validation rejects unknown destinations and malformed ordered actions before capture', () => {
  assert.throws(() => parseJourney({ actions: [{ fly: 'not-a-body' }] }), /unknown cssEarth object/u);
  assert.throws(() => parseJourney({ actions: [{ drag: { from: [1, 2], to: [3, 4] } }] }), /from, to and seconds/u);
  assert.throws(() => parseJourney({ actions: [{ screenshot: '../escape' }] }), /lowercase/u);
  assert.throws(() => parseJourneyArgs(['--start', 'mars', '--tap', '[1]']), /\[x, y\]/u);
});

test('ordered flags preserve the user supplied sequence', () => {
  const journey = parseJourneyArgs(['--start', 'mars', '--zoom', '100', '--drag', '{"from":[1,2],"to":[3,4],"seconds":0.1}', '--probe', 'after-drag']);
  assert.deepEqual(journey, { start: 'mars', actions: [
    { zoom: 100 }, { drag: { from: [1, 2], to: [3, 4], seconds: 0.1 } }, { probe: 'after-drag' },
  ] });
});

test('live flights use the ordinary navigation event and require the app to accept it', async () => {
  const steps = compileJourney(parseJourney({ start: 'earth', actions: [{ fly: 'lutetia' }] }), 'objectnavigate');
  const step = steps[0];
  assert.ok(step && 'script' in step);
  assert.deepEqual(steps[1], { route: '/lutetia/' });
  const document = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    documentElement: { dataset: { ready: 'true' } },
    querySelector: () => ({ getAttribute: () => 'GitHub v0.3770' }),
  });
  document.addEventListener('objectnavigationquery', event => event.preventDefault());
  const context = { document, CustomEvent, location: { href: 'https://css.earth/earth/' } };
  await assert.rejects(runInNewContext(step.script, context), /did not accept navigation/u);
  let selections = 0;
  document.addEventListener('objectnavigate', event => { selections++; event.preventDefault(); });
  const result = await runInNewContext(step.script, context);
  assert.equal(selections, 1);
  assert.equal(result.source, 'objectnavigate');
  assert.equal(result.objectId, 'lutetia');
  assert.equal(result.version, 'GitHub v0.3770');
});
