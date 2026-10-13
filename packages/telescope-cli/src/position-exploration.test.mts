import './test-support/index.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { jsonValue, type DiscoverySnapshot, type MetadataResponse } from '@cssearth/objects';
import { USER_ROOT, writeProductRecord } from '@cssearth/telescope-core/node';
import { explorationAnswer, parseExplorationArguments, skyTargetRequest } from './exploration.mts';
import { normalizeSnapshot, SERVICES, targetQuery } from './vo/discovery.mts';
import { loadVoInputs } from './vo/bridge.mts';
import { binaryTableHdu, primaryHdu } from '@cssearth/bake/objects/raster';
import { executeFamilyOperation } from './family-operation.mts';
import { acquisitionName, planAccess, type AcquisitionSpec } from './vo/access.mts';
import { formatExploration, artifactScreen, formatArtifact } from './cli-format.mts';
import { saveExploration, getSession, type SessionServices } from './session.mts';
import { loadQualifiedObservations } from './qualification/qualified-observations.mts';
import { listArtifactOutputs } from './delivery/artifact-outputs.mts';
import { exportOutput } from './delivery/outputs.mts';
import { qualifyVoProduct } from './vo/qualify.mts';

const args = ['--icrs-circle', '83.82,-5.39,0.1'], request = parseExplorationArguments(args), profile = SERVICES[0]!;
async function fieldFixture(root: string, options: { archiveTargetName: string | null | undefined; kind?: 'table' | 'spectrum' } = { archiveTargetName: 'Orion field' }) {
  const raw = { path: resolve(root, 'metadata.xml'), bytes: 10 }; await writeFile(raw.path, '<VOTABLE/>');
  const response: MetadataResponse = { schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw, effectiveUrl: profile.service,
    fetchedAt: '2026-10-13T00:00:00Z', httpStatus: 200, queryStatus: 'OK', fields: [], resources: [], coordinateSystems: [], timeSystems: [], issues: [], bindings: [], times: [{}],
    rows: [{ obs_publisher_did: 'ivo://fixture/field', obs_id: options.archiveTargetName === null ? 'field-image-null' : options.archiveTargetName === undefined ? 'field-image-absent' : 'field-image', ...(options.archiveTargetName === undefined ? {} : { target_name: options.archiveTargetName }), dataproduct_type: options.kind ?? 'image', access_url: 'https://example.org/science.fits', access_format: 'image/fits' }] };
  const snapshot: DiscoverySnapshot = { schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model,
    request: jsonValue(request), query: targetQuery(profile, [], 50, request), scope: 'Fixture ICRS footprint search', sampleLimit: 50, completeness: 'bounded-sample', response };
  const observation = normalizeSnapshot(snapshot, profile, undefined, [])[0]!;
  const plan = await planAccess(root, observation, snapshot, request);
  return { snapshot, observation, plan };
}

async function seedAcquisition(spec: AcquisitionSpec, bytes: Buffer) {
  const outputRoot = resolve(USER_ROOT, 'output/telescopes/vo/acquired', spec.key);
  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, 'science.fits'), bytes);
  await writeFile(resolve(outputRoot, 'content.json'), JSON.stringify({ schema: 'cssearth-vo-content@2',
    archiveProposal: { kind: spec.kind, decoder: spec.decoder },
    ...(spec.decoder === 'fits-raster' ? { legacyRasterMember: 'science.fits' } : { members: [{ member: 'science.fits', profile: 'fits-bintable@1' }] }) }));
  await writeFile(resolve(outputRoot, 'origin.json'), '{}');
  await writeProductRecord(resolve(outputRoot, 'acquisition.json'), { telescope: spec.observation.service, stage: 'archive-acquisition',
    inputs: spec.metadata.map(pin => ({ identity: pin.path.split('/').at(-1)!, role: 'archive metadata response', bytes: pin.bytes })),
    parameters: { acquisition: spec.identity, parent: spec.observation.identities, operation: spec.operation, format: spec.format, limits: spec.limits }, software: [{ name: 'PyVO', version: '1.9.1' }] },
    ['science.fits', 'content.json', 'origin.json'].map(path => ({ path, file: resolve(outputRoot, path) })));
}

test('a field fixture lists in-field choices without an identity and exposes all skipped name searches', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-field-'));
  try {
    const { snapshot, observation, plan } = await fieldFixture(root);
    assert.equal(plan.products.length, 1, 'a field search does not request a cutout of a direct product');
    const wider = parseExplorationArguments(['--icrs-circle', '83.82,-5.39,0.2']);
    const wideSnapshot = { ...snapshot, request: jsonValue(wider), query: targetQuery(profile, [], 50, wider) };
    const wideObservation = normalizeSnapshot(wideSnapshot, profile, undefined, [])[0]!;
    const widePlan = await planAccess(root, wideObservation, wideSnapshot, wider);
    assert.notEqual(plan.products[0]!.key, widePlan.products[0]!.key, 'distinct fields cannot reuse a qualification of another circle');
    assert.notEqual(plan.products[0]!.key, acquisitionName(observation, plan.products[0]!.operation), 'field products cannot collide with a previous named acquisition');
    assert.equal(observation.target.status, 'in-field'); assert.equal(observation.target.target, undefined);
    assert.doesNotMatch(snapshot.query, /target_name IN/u);
    const answer = explorationAnswer(request, { ledgers: [], capabilities: [], targetCatalogue: [], targetAssociations: [], bodyMaps: [], vo: { records: [{ snapshot, observation, ...plan }], services: [] } });
    assert.equal(answer.target, undefined); assert.equal(answer.targetResolution.status, 'position'); assert.equal(answer.request.search, 'position');
    assert.equal(answer.choices.length, 1); assert.equal(answer.choices[0]!.target, undefined); assert.equal(answer.choices[0]!.archiveTargetName, 'Orion field');
    assert.deepEqual(answer.outcome, { selection: 'available', coverage: 'incomplete' });
    assert.ok(answer.coverage.some(limit => limit.ledger === 'pds' && limit.state === 'not-searched' && limit.reason === 'not searched: needs a name'));
    assert.ok(answer.coverage.some(limit => limit.ledger === 'psa'));
    assert.ok(answer.coverage.some(limit => limit.ledger === 'opus'));
    const screen = formatExploration({ schema: answer.schema, createdAt: '', arguments: args, choices: answer.choices, answer, directory: root }, true);
    assert.match(screen, /^Field RA 83\.82°, Dec −5\.39°, radius 0\.1°/u); assert.match(screen, /not searched: needs a name/u);
    const unlocated = normalizeSnapshot({ ...snapshot, query: 'SELECT TOP 50 * FROM ivoa.ObsCore' }, profile, undefined, [])[0]!;
    assert.equal(unlocated.target.status, 'unmatched');
    assert.equal(explorationAnswer(request, { ledgers: [], capabilities: [], targetCatalogue: [], targetAssociations: [], bodyMaps: [], vo: { records: [{ snapshot, observation: unlocated, ...plan }], services: [] } }).choices.length, 0);
    const sky = await skyTargetRequest(root, request, async () => { throw new Error('A field must never resolve a name.'); });
    assert.deepEqual(sky, { request, simbadMiss: false });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('position VO discovery searches every celestial profile with no name clause and skips body coordinates', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-field-vo-'));
  try {
    const { snapshot } = await fieldFixture(root), asked: string[] = [];
    const inputs = await loadVoInputs(root, request, [], undefined, async (_root, selected, current, names) => {
      assert.deepEqual(names, []); assert.equal(current.target, undefined); asked.push(selected.label ?? selected.service);
      const spatialSelection = selected.spatialMatch === 'mast-api-cone' ? { method: 'mast-filtered-position@1' as const, region: request.footprint!, collection: selected.collections![0]!, ids: ['field-image'], complete: true, pin: snapshot.response.raw } : undefined;
      return { ...snapshot, service: selected.service, table: selected.table, model: selected.model, query: targetQuery(selected, names, 50, current, spatialSelection?.ids), ...(spatialSelection ? { spatialSelection } : {}) };
    });
    assert.equal(asked.length, SERVICES.filter(service => service.model === 'obscore-1.1').length);
    assert.equal(inputs.records.length, asked.length); assert.ok(inputs.records.every(record => record.observation.target.status === 'in-field'));
    assert.ok(inputs.records.every(record => record.products.length === 1));
    assert.throws(() => targetQuery(SERVICES[2]!, [], 50, request), /needs a name/u);
    assert.match(targetQuery(profile, ['Orion'], 50, { target: 'orion', region: request.footprint }), /target_name IN \('Orion'\) OR 1=INTERSECTS/u);
    assert.match(targetQuery(SERVICES[3]!, [], 50, request), /WHERE 1=0/u, 'an empty MAST positional result cannot search by name');
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const archiveTargetName of ['Orion field', null, undefined]) test(`a saved field choice with archive name ${String(archiveTargetName)} qualifies, delivers, replays offline and exports`, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-field-session-'));
  try {
    const { snapshot, observation, plan } = await fieldFixture(root, { archiveTargetName });
    const expectedTarget = archiveTargetName ?? null;
    assert.equal(observation.rawTarget, expectedTarget);
    let qualified = false;
    const api: SessionServices = { load: async () => { throw new Error('No named query allowed.'); },
      explore: async (_root, current, selected, _progress, selection) => {
        assert.equal(current.target, undefined);
        if (selected) { assert.equal(selected, observation.key); assert.deepEqual(selection, { archiveService: profile.service }); }
        return explorationAnswer(current, { ledgers: [], capabilities: [], targetCatalogue: [], targetAssociations: [], bodyMaps: [], qualifiedProducts: await loadQualifiedObservations(root, expectedTarget), vo: { records: [{ snapshot, observation, ...plan }], services: [] } });
      }, qualify: async (_root, selected) => {
        assert.equal(selected.configuration.kind, 'archive-acquisition');
        if (selected.configuration.kind !== 'archive-acquisition') throw new Error('Wrong route.');
        assert.equal(selected.configuration.request.target, undefined); assert.equal(selected.target, expectedTarget); qualified = true;
        const spec = plan.products[0]!, outputRoot = resolve(USER_ROOT, 'output/telescopes/vo/acquired', spec.key);
        await mkdir(outputRoot, { recursive: true });
        const cards = ["SIMPLE  =                    T", "BITPIX  =                  -32", "NAXIS   =                    2", "NAXIS1  =                    2", "NAXIS2  =                    2", ...(archiveTargetName === undefined ? [] : ["OBJECT  = 'Independent FITS label'"]), "CTYPE1  = 'RA---TAN'", "CTYPE2  = 'DEC--TAN'", "CRVAL1  =                83.82", "CRVAL2  =                -5.39", "CRPIX1  =                  1.5", "CRPIX2  =                  1.5", "CDELT1  =                -0.01", "CDELT2  =                 0.01", "END"];
        const data = Buffer.alloc(2880); for (let i = 0; i < 4; i++) data.writeFloatBE(i + 1, i * 4);
        const product = resolve(outputRoot, 'science.fits');
        await writeFile(product, Buffer.concat([Buffer.from(cards.map(card => card.padEnd(80)).join('').padEnd(2880)), data]));
        await seedAcquisition(spec, await readFile(product));
        const qualifiedProduct = await qualifyVoProduct(root, spec);
        assert.equal(qualifiedProduct.facts.regionCoverage?.usablePixelCenters, 4);
        assert.equal(qualifiedProduct.target, expectedTarget); assert.equal(qualifiedProduct.facts.target, expectedTarget);
        const receipt = JSON.parse(await readFile(qualifiedProduct.receipt, 'utf8'));
        assert.equal(receipt.identity.archiveTargetName, expectedTarget);
        assert.equal(receipt.identity.headerObject, archiveTargetName === undefined ? undefined : 'Independent FITS label');
        assert.doesNotMatch(receipt.acceptance, /matching FITS OBJECT/u);

      } };
    const saved = await saveExploration(root, args, resolve(root, 'run'), api);
    const raw = JSON.parse(await readFile(resolve(saved.directory, 'explore.json'), 'utf8'));
    assert.equal(Object.hasOwn(raw, 'target'), false); assert.equal(Object.hasOwn(raw.answer.request, 'target'), false); assert.equal(Object.hasOwn(raw.choices[0], 'target'), false);
    assert.equal(raw.choices[0].archiveTargetName, expectedTarget);
    const result = await getSession(root, saved.directory, 1, () => {}, api); assert.equal(qualified, true);
    const delivered = JSON.parse(await readFile(result.resultPath, 'utf8'));
    assert.equal(delivered.context.target, expectedTarget); assert.equal(delivered.facts.target, expectedTarget);
    assert.equal(delivered.sourceQuestion.target, expectedTarget); assert.equal(delivered.sourceQuestion.archiveTargetName, expectedTarget);
    const outputs = await listArtifactOutputs(result.resultPath);
    assert.ok(outputs.outputs.some(output => output.kind === 'image' && output.available));
    assert.match(formatArtifact(artifactScreen(outputs, result.resultPath)), /^Field RA 83\.82°, Dec −5\.39°, radius 0\.1°/u);
    const exported = await exportOutput(result.resultPath, { kind: 'image', hdu: 0 }, resolve(root, 'export'));
    assert.ok((await readFile(exported.data)).length > 0); assert.ok((await readFile(exported.figure)).length > 0);
    const replay = await getSession(root, saved.directory, 1, () => {}, api, { offline: true }); assert.equal(replay.reused, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const kind of ['table', 'spectrum'] as const) for (const archiveTargetName of [null, undefined])
  test(`nameless ${kind} (${String(archiveTargetName)}) reaches get, native qualification and family export`, async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'telescope-field-family-'));
    try {
      const current = { ...request, kind }, familyArgs = [...args, '--kind', kind];
      const fixture = await fieldFixture(root, { archiveTargetName, kind });
      const snapshot = { ...fixture.snapshot, request: jsonValue(current) };
      const observation = normalizeSnapshot(snapshot, profile, undefined, [])[0]!;
      const plan = await planAccess(root, observation, snapshot, current), spec = plan.products[0]!;
      const bytes = kind === 'table' ? Buffer.concat([primaryHdu([]),
        binaryTableHdu('CATALOG', [{ name: 'FLUX', form: 'E' }], [[1.5], [2.5]], [])])
        : await readFile(resolve(import.meta.dirname, 'vo/fixtures/telescope-vo/eso-spectrum/espresso-excerpt.fits'));
      let qualified = false;
      const api: SessionServices = { load: async () => { throw new Error('No named query allowed.'); },
        explore: async (_root, searched) => explorationAnswer(searched, { ledgers: [], capabilities: [], targetCatalogue: [], targetAssociations: [], bodyMaps: [],
          qualifiedProducts: await loadQualifiedObservations(root, null), vo: { records: [{ snapshot, observation, ...plan }], services: [] } }),
        qualify: async () => { qualified = true; await seedAcquisition(spec, bytes); return qualifyVoProduct(root, spec); } };
      const saved = await saveExploration(root, familyArgs, resolve(root, 'run'), api);
      assert.equal(saved.choices[0]!.archiveTargetName, null);
      const result = await getSession(root, saved.directory, 1, () => {}, api);
      assert.equal(qualified, true);
      const raw = JSON.parse(await readFile(result.resultPath, 'utf8'));
      assert.equal(raw.facts.target, null); assert.equal(raw.context.target, null); assert.equal(raw.sourceQuestion.archiveTargetName, null);
      const outputs = await listArtifactOutputs(result.resultPath);
      assert.ok(outputs.familyOperations?.some(operation => operation.id === `${kind}-export`));
      const exported = await executeFamilyOperation(String(outputs.source), { operationId: `${kind}-export` }, resolve(root, 'export'));
      assert.ok((await readFile(exported.product)).length > 0);
      const receipt = JSON.parse(await readFile((await loadQualifiedObservations(root, null)).find(product => product.program === spec.key)!.receipt, 'utf8'));
      assert.equal(receipt.identity.archiveTargetName, null); assert.doesNotMatch(receipt.acceptance, /name matches FITS OBJECT/u);
      assert.equal((await getSession(root, saved.directory, 1, () => {}, api, { offline: true })).reused, true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

test('named qualification still requires an archive name and matching FITS OBJECT', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-named-identity-'));
  try {
    const fixture = await fieldFixture(root), namedRequest = { target: 'orion-field' };
    const target = { id: namedRequest.target, names: ['Orion field'] };
    const snapshot = { ...fixture.snapshot, request: jsonValue(namedRequest) };
    const observation = normalizeSnapshot(snapshot, profile, target, [target])[0]!;
    const spec = (await planAccess(root, observation, snapshot, namedRequest)).products[0]!;
    assert.equal(observation.target.status, 'confirmed');
    await assert.rejects(qualifyVoProduct(root, { ...spec, observation: { ...observation, rawTarget: null } }), /does not establish the requested target/u);
    const header = ["SIMPLE  =                    T", "BITPIX  =                  -32", "NAXIS   =                    2", "NAXIS1  =                    1", "NAXIS2  =                    1", "OBJECT  = 'Different field'", "END"];
    const data = Buffer.alloc(2880); data.writeFloatBE(1);
    await seedAcquisition(spec, Buffer.concat([Buffer.from(header.map(card => card.padEnd(80)).join('').padEnd(2880)), data]));
    await assert.rejects(qualifyVoProduct(root, spec), /OBJECT/u);
    await assert.rejects(qualifyVoProduct(root, { ...fixture.plan.products[0]!, request: { search: 'position' } }), /circle that selected it/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
