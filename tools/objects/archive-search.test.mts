import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { archiveLeads, dataciteDeposits, nameMatch, parseJmdc, summariseAlma, summariseEsoRaw, summariseMast } from './archive-search.mts';



test('a name search tries each name as written, upper and lower case, and refuses names too short to mean anything', () => {
  assert.equal(nameMatch('object', ['Haumea', '2003EL61']), "(object LIKE '%Haumea%' OR object LIKE '%HAUMEA%' OR object LIKE '%haumea%' OR object LIKE '%2003EL61%' OR object LIKE '%2003el61%')");
  assert.equal(nameMatch('target_name', ["O'Neil"]).includes("'%O''Neil%'"), true, 'quotes are escaped');
  assert.throws(() => nameMatch('object', ['Io']), /three characters/u);
});

// ALMA obscore rows measured for R Doradus (RA 69.18996, Dec -62.07717) on 2026-09-16, abridged.
const R_DOR_ALMA = [
  { proposal_id: '2022.1.01071.S', band_list: '7', target_name: 'R_Dor', spatial_resolution: '0.014900', t_min: '60133.4', data_rights: 'Public', first_author: 'Khouri, T. Vlemmings, Wouter' },
  { proposal_id: '2022.1.01071.S', band_list: '7', target_name: 'R_Dor', spatial_resolution: '0.016100', t_min: '60133.6', data_rights: 'Public', first_author: 'Khouri, T. Vlemmings, Wouter' },
  { proposal_id: '2023.1.00697.S', band_list: '4', target_name: 'R_Dor', spatial_resolution: '0.083600', t_min: '60400.1', data_rights: 'Public', first_author: '' },
  { proposal_id: '2017.1.00595.S', band_list: '6', target_name: 'R_Dor', spatial_resolution: '5.301900', t_min: '58100.0', data_rights: 'Public', first_author: 'Andriantsaralaza, M.' },
  { proposal_id: '2025.1.00001.S', band_list: '7', target_name: 'R_Dor', spatial_resolution: '0.012000', t_min: '61000.0', data_rights: 'Proprietary', first_author: 'Someone' },
];

test('ALMA rows group by project and band, finest first, with the disc in beams when its diameter is known', () => {
  const groups = summariseAlma(R_DOR_ALMA, 57);
  assert.deepEqual(groups.map(group => [group.proposal, group.band, group.observations]), [['2025.1.00001.S', '7', 1], ['2022.1.01071.S', '7', 2], ['2023.1.00697.S', '4', 1], ['2017.1.00595.S', '6', 1]]);
  const vlemmings = groups[1]!;
  assert.equal(vlemmings.bestResolutionArcsec, 0.0149);
  assert.ok(Math.abs(vlemmings.resolutionElementsAcross! - 57 / 14.9) < 1e-9);
  assert.equal(vlemmings.firstDate, '2023-07-08');
  assert.equal(summariseAlma(R_DOR_ALMA)[1]!.resolutionElementsAcross, null, 'no diameter, no beam count');
});

test('ESO raw frames group by instrument with interferometers and adaptive-optics imagers first', () => {
  // Grouped rows as the query returns them for R Doradus, 2026-09-16.
  const groups = summariseEsoRaw([
    { instrument: 'APEXHET', frames: '1631', first_date: '2005-07-14T09:13:41', last_date: '2023-05-18T12:32:04', first_release: '2006-06-22T00:00:00Z' },
    { instrument: 'SPHERE', frames: '1613', first_date: '2014-12-10T05:44:49', last_date: '2023-08-27T08:23:32', first_release: '2014-12-10T06:11:10Z' },
    { instrument: 'AMBER', frames: '707', first_date: '2012-06-21T09:54:55', last_date: '2014-01-08T08:15:48', first_release: '2013-06-21T09:54:55Z' },
    { instrument: 'MATISSE', frames: '949', first_date: '2019-12-16T01:30:05', last_date: '2020-02-07T03:40:55', first_release: '2020-12-16T01:44:59Z' }]);
  assert.deepEqual(groups.map(group => [group.instrument, group.kind, group.frames]), [['MATISSE', 'interferometer', 949], ['AMBER', 'interferometer', 707], ['SPHERE', 'adaptive-optics', 1613], ['APEXHET', 'other', 1631]]);
  assert.equal(groups[2]!.lastDate, '2023-08-27');
});

test('MAST rows group by collection, instrument and product, imaging first, with their proposals', () => {
  const groups = summariseMast([
    { obs_collection: 'HST', instrument_name: 'WFC3/UVIS', dataproduct_type: 'image', proposal_id: '12243', target_name: 'HAUMEA' },
    { obs_collection: 'HST', instrument_name: 'WFC3/UVIS', dataproduct_type: 'image', proposal_id: '18002', target_name: 'HAUMEA' },
    { obs_collection: 'TESS', instrument_name: 'Photometer', dataproduct_type: 'timeseries', proposal_id: null, target_name: 'x' },
    { obs_collection: 'TESS', instrument_name: 'Photometer', dataproduct_type: 'timeseries', proposal_id: '', target_name: 'x' },
    { obs_collection: 'TESS', instrument_name: 'Photometer', dataproduct_type: 'timeseries', proposal_id: '', target_name: 'x' }]);
  assert.deepEqual(groups.map(group => [group.collection, group.productType, group.observations, group.proposals]), [['HST', 'image', 2, ['12243', '18002']], ['TESS', 'timeseries', 3, []]]);
});

test('a DataCite record is the paper\'s deposit when its description or a supplement relation names the paper; a citing record or the preprint is not', () => {
  // DataCite records measured 2026-09-16, abridged: the Psyche maps name their paper only in the description; the figshare file lists an
  // A&A paper among its References; the preprint is text.
  const psyche = { data: [
    { id: '10.48550/arxiv.2402.03422', attributes: { publisher: 'arXiv', types: { resourceTypeGeneral: 'Text' }, titles: [{ title: 'The Heterogeneous Surface of Asteroid (16) Psyche' }] } },
    { id: '10.5281/zenodo.6321314', attributes: { publisher: 'Zenodo', types: { resourceTypeGeneral: 'Dataset' }, titles: [{ title: 'Maps of thermal inertia' }],
      descriptions: [{ description: 'please cite the above article as doi: 10.1029/2021JE007091' }],
      relatedIdentifiers: [{ relationType: 'HasVersion', relatedIdentifier: '10.5281/zenodo.6321315' }] } }] };
  const deposits = dataciteDeposits(psyche, '10.1029/2021JE007091');
  assert.deepEqual(deposits.map(deposit => [deposit.doi, deposit.resourceType, deposit.versions]), [['10.5281/zenodo.6321314', 'Dataset', ['10.5281/zenodo.6321315']]]);
  assert.equal(deposits[0]!.url, 'https://doi.org/10.5281/zenodo.6321314');
  const citing = { data: [{ id: '10.6084/m9.figshare.19568752', attributes: { publisher: 'figshare', types: { resourceTypeGeneral: 'JournalArticle' }, titles: [{ title: 'Additional file 1' }],
    relatedIdentifiers: [{ relationType: 'References', relatedIdentifier: '10.1051/0004-6361/202038785' }] } }] };
  assert.deepEqual(dataciteDeposits(citing, '10.1051/0004-6361/202038785'), []);
  const supplement = { data: [{ id: '10.5281/zenodo.1', attributes: { publisher: 'Zenodo', types: { resourceTypeGeneral: 'Dataset' }, titles: [{ title: 'Images' }],
    relatedIdentifiers: [{ relationType: 'IsSupplementTo', relatedIdentifier: '10.1051/0004-6361/202038785' }] } }] };
  assert.equal(dataciteDeposits(supplement, '10.1051/0004-6361/202038785').length, 1);
});

test('JMDC diameters keep every measurement and use the largest disc', () => {
  assert.deepEqual(parseJmdc([[57, null, '1.25', '1997MNRAS.286..957B']]), { measurements: [{ uniformDiskMas: 57, limbDarkenedMas: null, band: '1.25', bibcode: '1997MNRAS.286..957B' }], largestMas: 57 });
  assert.equal(parseJmdc([[40, 42.5, 'K', 'a'], [null, 44.1, 'H', 'b'], ['', '', 'V', 'c']]).largestMas, 44.1);
  assert.equal(parseJmdc([]).largestMas, null);
});

test('leads name deposits, public ALMA projects that resolve the disc, resolving ESO instruments and space-telescope imaging', () => {
  const alma = summariseAlma(R_DOR_ALMA, 57);
  const eso = summariseEsoRaw([{ instrument: 'SPHERE', frames: '10', first_date: '2020-01-01', last_date: '2020-01-02', first_release: '2021-01-01' }, { instrument: 'UVES', frames: '50', first_date: '2002-12-28', last_date: '2023-09-03', first_release: '2004-02-25' }]);
  const mast = summariseMast([{ obs_collection: 'HST', instrument_name: 'WFC3/UVIS', dataproduct_type: 'image', proposal_id: '12243' }, { obs_collection: 'TESS', instrument_name: 'Photometer', dataproduct_type: 'image', proposal_id: '' }]);
  const versions = [1, 2].map(n => ({ doi: `10.5281/zenodo.${n}`, publisher: 'Zenodo', title: 'Animation package', resourceType: 'Dataset', cites: '10.3847/x', url: `https://doi.org/10.5281/zenodo.${n}`, versions: [] }));
  assert.deepEqual(archiveLeads({ alma: [], eso: [], mast: [], deposits: versions }), ['deposit https://doi.org/10.5281/zenodo.1, https://doi.org/10.5281/zenodo.2 (Zenodo, Dataset) for 10.3847/x: Animation package; inspect its files']);
  const leads = archiveLeads({ alma, eso, mast, deposits: [] });
  assert.equal(leads.filter(lead => lead.startsWith('ALMA')).length, 1, 'proprietary data and projects under three beams across are not leads');
  assert.match(leads.find(lead => lead.startsWith('ALMA'))!, /2022\.1\.01071\.S band 7: 2 observations 2023-07-08.*14\.9 mas, 3\.8 beams across/u);
  assert.deepEqual(leads.filter(lead => !lead.startsWith('ALMA')), ['ESO SPHERE (adaptive-optics): 10 raw frames 2020-01-01–2020-01-02', 'MAST HST WFC3/UVIS: 1 images, proposals 12243']);
  assert.equal(archiveLeads({ alma: summariseAlma(R_DOR_ALMA), eso: [], mast: [], deposits: [] }).filter(lead => lead.startsWith('ALMA')).length, 3, 'with no diameter every public project is a lead');
});
