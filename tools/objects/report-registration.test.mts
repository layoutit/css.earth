import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGISTRATION_BLOCK_BEGIN, REGISTRATION_BLOCK_END, registrationBlock, registrationBlockFor, registrationVerdict, withRegistrationBlock } from './report-registration.mts';
import { COMPARISON_EVIDENCE_SCHEMA, COMPARISON_SPEC_FILE, parseComparisonSpec } from './surface-observations/published-comparison.mts';
import { OBSERVER_CAMERAS_FILE, parseObserverCameras } from './terrestrial-layers/observer-cameras.mts';

const OBJECTS = resolve(import.meta.dirname, '../../src/objects');

const surfaces = (lenses: unknown[]) => ({ objectId: 'x', surfaces: lenses });
const staged = (id: string, silhouette: Record<string, unknown>, reference: Record<string, unknown>) =>
  ({ id, observation: { registration: { stage: 'cssearth-registration-stage@1', silhouette: { frames: [{}, {}, {}], scored: 2, rmsDegrees: 3.28, noiseFloorDegrees: 3.41, systematicDegrees: 0, ...silhouette }, reference: { kind: 'frames', referenceFrames: 3, frames: [{}, {}, {}], decisive: 3, medianOffsetDegrees: -0.5, rule: { minimumFrames: 3 }, ...reference }, relief: { rule: { minimumFrames: 3 }, frames: [{}, {}, {}], decisive: 3, medianOffsetDegrees: 0.75 } } } });

test('the block states every staged lens and nothing for a body without one', () => {
  assert.equal(registrationBlock(surfaces([{ id: 'shape' }, { id: 'map', observation: { frames: [] } }])), null);
  const block = registrationBlock(surfaces([{ id: 'shape' }, staged('zimpol', {}, {}), staged('iss', { scored: 0, rmsDegrees: null, noiseFloorDegrees: null, systematicDegrees: null }, { kind: 'observation', observation: 'normal', decisive: 1, medianOffsetDegrees: 1.25, frames: [{}] })]));
  assert.ok(block);
  assert.match(block, /\| `zimpol` \| 3 \| 2 \| 3\.28° \| 3\.41° \| 0\.00° \| its other 3 frames \| 3 of 3 \| -0\.50° \| 3 of 3, 0\.75° \| — \| — \| registered \|/);
  assert.match(block, /\| `iss` \| 3 \| 0 \| — \| — \| — \| the `normal` map \| 1 of 1 \| — \| 3 of 3, 0\.75° \| — \| — \| registered \|/, 'one decisive frame states no median');
  assert.ok(!block.includes('shape'));
});

test('a lens registers only when every measurement that reached a verdict is within three degrees', () => {
  const verdict = (silhouette: Record<string, unknown>, reference: Record<string, unknown>) => registrationVerdict(staged('x', silhouette, reference).observation.registration);
  assert.equal(verdict({}, {}), 'registered', 'the outline scored two frames and is no verdict; frames and relief agree');
  assert.equal(verdict({ scored: 3, systematicDegrees: 7.3 }, {}), 'conflict', 'an outline 7.3 degrees off is not outvoted by agreeing references');
  assert.equal(verdict({}, { decisive: 2 }), 'registered', 'two decisive frames reach no verdict');
  // A median is a location, not a measurement: offsets that disagree by more than the gate have placed nothing.
  const sweep = (offsets: number[]) => ({ rule: { minimumFrames: 3 }, decisive: offsets.length,
    medianOffsetDegrees: [...offsets].sort((a, b) => a - b)[Math.floor(offsets.length / 2)],
    frames: offsets.map(offsetDegrees => ({ decisive: true, exact: { offsetDegrees } })) });
  const judge = (silhouette: Record<string, unknown>, relief: Record<string, unknown>) => registrationVerdict({
    stage: 'cssearth-registration-stage@1', silhouette: { frames: [{}, {}, {}], scored: 0, systematicDegrees: null, ...silhouette },
    reference: { kind: 'frames', rule: { minimumFrames: 3 }, decisive: 0, medianOffsetDegrees: null, frames: [] }, relief });
  const spread = [-9.5, -8.25, 9.5], tight = [7, 7.5, 8];
  assert.equal(judge({}, sweep(spread)), 'no verdict', 'decisive offsets 19 degrees apart reach no verdict rather than a conflict');
  assert.equal(judge({ scored: 3, systematicDegrees: 1.65 }, sweep(spread)), 'registered', 'a disagreeing sweep does not outvote an outline that agrees');
  assert.equal(judge({ scored: 3, systematicDegrees: 1.65 }, sweep(tight)), 'conflict', 'decisive offsets that agree on 7.5 degrees are a conflict');
});

// Shipped lenses whose measurements disagree, which ship by decision rather than by rule. Empty: the two that stood
// here, Helene and Prometheus, were the case the agreement rule now measures — a relief sweep whose own decisive
// offsets disagree reaches no verdict, so it no longer contradicts frames that do agree with the camera.
const KNOWN_CONFLICTS = new Set<string>([]);

/** The published comparison a body's ground-based lens ships on, from its observer-cameras record, or null. */
function publishedComparison(id: string) {
  const path = resolve(OBJECTS, id, 'source', OBSERVER_CAMERAS_FILE);
  if (!existsSync(path)) return null;
  const record = parseObserverCameras(JSON.parse(readFileSync(path, 'utf8')));
  return record.publishedComparison ? { lensId: record.lensId, ...record.publishedComparison } : null;
}

test('no shipped lens contradicts its own registration unless it is a named known conflict or ships on its published comparison', () => {
  const conflicts: string[] = [];
  for (const id of readdirSync(OBJECTS)) {
    const prepared = resolve(OBJECTS, id, 'prepared/surfaces.json');
    if (!existsSync(prepared)) continue;
    for (const lens of (JSON.parse(readFileSync(prepared, 'utf8')) as { surfaces: { id: string; observation?: { registration?: Record<string, unknown> } }[] }).surfaces) {
      const registration = lens.observation?.registration;
      if (registration?.stage === undefined || registrationVerdict(registration) !== 'conflict') continue;
      // A ground-based lens that reproduces its paper's comparison figure ships on that comparison; its verdict is reported, not a gate.
      if (publishedComparison(id)?.lensId === lens.id) continue;
      conflicts.push(`${id}/${lens.id}`);
    }
  }
  assert.deepEqual(conflicts.sort(), [...KNOWN_CONFLICTS].sort());
});

test('a lens that ships on its published comparison has its figure, its measurements and an included ledger entry', () => {
  let shipped = 0;
  for (const id of readdirSync(OBJECTS)) {
    const comparison = publishedComparison(id);
    if (!comparison) continue;
    shipped++;
    const spec = parseComparisonSpec(JSON.parse(readFileSync(resolve(OBJECTS, id, 'source', COMPARISON_SPEC_FILE), 'utf8')));
    assert.equal(spec.lensId, comparison.lensId, `${id}: the comparison spec names the lens the observer cameras derive`);
    const prepared = resolve(OBJECTS, id, 'prepared/surfaces.json');
    assert.ok(existsSync(prepared) && (JSON.parse(readFileSync(prepared, 'utf8')) as { surfaces: { id: string }[] }).surfaces.some(lens => lens.id === spec.lensId), `${id}: the ${spec.lensId} lens is prepared`);
    const evidence = JSON.parse(readFileSync(resolve(OBJECTS, id, 'evidence/published-comparison.json'), 'utf8')) as Record<string, any>;
    assert.equal(evidence.schema, COMPARISON_EVIDENCE_SCHEMA);
    assert.deepEqual([evidence.lensId, evidence.source, evidence.figure, evidence.document?.object, evidence.document?.pixels], [spec.lensId, spec.source, spec.figure, spec.document.object, spec.document.sha256],
      `${id}: evidence/published-comparison.json measures the figure the spec names; run node tools/objects/published-comparison.mts ${id} --write`);
    assert.equal(evidence.columns?.length, spec.columns.filter(column => column.frame !== null).length, `${id}: every figure column with a lens frame is measured`);
    const ledger = JSON.parse(readFileSync(resolve(OBJECTS, id, 'investigations.json'), 'utf8')) as { entries: { id: string; status: string; evidence?: string[] }[] };
    const entry = ledger.entries.find(candidate => candidate.id === comparison.ledgerEntry);
    assert.ok(entry, `${id}: investigations.json holds ${comparison.ledgerEntry}`);
    assert.equal(entry.status, 'included', `${id}: ${comparison.ledgerEntry} is an included decision`);
    assert.ok(entry.evidence?.includes(spec.source), `${id}: ${comparison.ledgerEntry} cites ${spec.source}`);
  }
  assert.ok(shipped >= 1, 'at least one lens ships on its published comparison');
});

test('the block goes between the markers and leaves a README without them alone', () => {
  const readme = `# Body\n\n${REGISTRATION_BLOCK_BEGIN}\nold\n${REGISTRATION_BLOCK_END}\n\nMore.`;
  const { readme: written, replaced } = withRegistrationBlock(readme, 'new block');
  assert.equal(replaced, true);
  assert.equal(written, `# Body\n\n${REGISTRATION_BLOCK_BEGIN}\nnew block\n${REGISTRATION_BLOCK_END}\n\nMore.`);
  assert.deepEqual(withRegistrationBlock('# Body', 'new block'), { readme: '# Body', replaced: false });
});

test('every README that carries the markers states exactly what its prepared report gives', async () => {
  let carried = 0;
  for (const id of readdirSync(OBJECTS)) {
    const path = resolve(OBJECTS, id, 'README.md'), prepared = resolve(OBJECTS, id, 'prepared/surfaces.json');
    if (!existsSync(path)) continue;
    const readme = readFileSync(path, 'utf8');
    if (!readme.includes(REGISTRATION_BLOCK_BEGIN)) continue;
    carried++;
    assert.ok(existsSync(prepared), `${id}: a README with registration markers has a prepared surfaces report`);
    const block = await registrationBlockFor(resolve(OBJECTS, id));
    const { readme: expected } = withRegistrationBlock(readme, block);
    assert.equal(readme, expected, `${id}/README.md: the registration block differs from the prepared report; run node tools/objects/report-registration.mts ${id} --write`);
  }
  assert.ok(carried >= 1, 'at least one body carries the generated block');
});
