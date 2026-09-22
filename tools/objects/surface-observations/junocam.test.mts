import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { validateSurfaceObservation } from './index.mts';

const geometry = { path: 'shape/iau-ellipsoid.tab', format: 'pds-radius-table', simplification: { method: 'source-mesh', maximumErrorMeters: 480 } };
const frame = (n: number, startTime: string) => ({ id: `jncr_2022272_45c0000${n}_v01`, path: `observations/junocam/JNCR_2022272_45C0000${n}_V01.IMG`, labelPath: `observations/junocam/JNCR_2022272_45C0000${n}_V01.LBL`, startTime });
/** Europa's lens as its package states it, with two of its four photographs. */
const lens = () => ({ id: 'junocam', format: 'junocam-camera', consumer: 'junocam-observation', metadata: { label: 'JunoCam', falseColor: true, coverage: 'Two colour photographs.' },
  frames: [frame(1, '2022-09-29T09:38:05.691Z'), frame(2, '2022-09-29T09:39:06.757Z')],
  spice: { kernelSet: 'juno', kernels: ['lsk/naif0012.tls', 'pck/pck00011.tpc', 'sclk/JNO_SCLKSCET.00211.tsc', 'fk/juno_v12.tf', 'ik/juno_junocam_v03.ti', 'spk/spk_rec_220909_221019_221027.bsp', 'ck/juno_sc_rec_220925_221001_v01.bc'],
    observer: -61, target: 502, targetName: 'EUROPA', bodyFrame: 'IAU_EUROPA', aberration: 'LT+S' },
  epochRefinement: { method: 'mesh-limb-epochs', maximumPointingSeconds: 0.05, maximumEphemerisSeconds: 2, maximumResidualPixels: 1.5, minimumControls: 64, maximumControls: 1500, searchPixels: 64 },
  selection: 'finest-resolution', levelMatching: { samplesPerTriangle: 8, minimumPairs: 128, maximumGain: 1.5, maximumAngleDegrees: 70 },
  transfer: { maximumSeparationFootprints: 2, maximumEmissionDegrees: 80, visibilityToleranceMeters: 0.5 },
  photometry: { model: 'retained-observation', referenceIncidenceDegrees: 0, referenceEmissionDegrees: 0, maximumIncidenceDegrees: 85, maximumEmissionDegrees: 80, maximumGain: 1 },
  display: { basis: 'authored', displayRange: [0, 0.35] } });
type Lens = ReturnType<typeof lens>;

test('a JunoCam lens validates, and every undeclared or contradictory statement is refused', () => {
  assert.doesNotThrow(() => validateSurfaceObservation(lens(), geometry));
  const refusals: [string, (recipe: Lens & Record<string, unknown>) => void][] = [
    ['an undeclared lens key', recipe => { recipe.filter = 'RGB'; }],
    ['a frame without its label', recipe => { delete (recipe.frames[0] as Partial<Lens['frames'][number]>).labelPath; }],
    ['a start time without its zone', recipe => { recipe.frames[0].startTime = '2022-09-29T09:38:05.691'; }],
    ['an undeclared spice key', recipe => { (recipe.spice as Record<string, unknown>).instrument = -61500; }],
    ['an unnamed target', recipe => { recipe.spice.targetName = ''; }],
    ['an unknown aberration', recipe => { recipe.spice.aberration = 'XCN'; }],
    ['kernels outside a bank', recipe => { recipe.spice.kernelSet = 'Juno Bank'; }],
    ['natural colour', recipe => { recipe.metadata.falseColor = false; }],
    ['a range that does not start at zero', recipe => { recipe.display.displayRange = [0.02, 0.35]; }],
    ['percentiles on band colour', recipe => { (recipe as Record<string, unknown>).display = { basis: 'authored', percentiles: [1, 99] }; }],
    ['another refinement method', recipe => { recipe.epochRefinement.method = 'mesh-limb'; }],
    ['an ephemeris budget beyond five seconds', recipe => { recipe.epochRefinement.maximumEphemerisSeconds = 8; }],
    ['a disk function with a retained gain', recipe => { recipe.photometry.model = 'lommel-seeliger'; recipe.photometry.maximumGain = 4; }],
    ['a Lunar-Lambert model without its weight', recipe => { recipe.photometry.model = 'lunar-lambert'; recipe.photometry.maximumGain = 2; }],
    ['photometry beyond the transfer emission limit', recipe => { recipe.photometry.maximumEmissionDegrees = 85; }],
    ['a mosaic without a selection', recipe => { delete (recipe as Partial<Lens>).selection; }],
    ['an edge-weighted average, which strips cannot weigh', recipe => { recipe.selection = 'edge-weighted-average'; }],
    ['a simplified mesh', () => { /* checked below with its own geometry */ }],
  ];
  for (const [name, change] of refusals.slice(0, -1)) { const recipe = lens() as Lens & Record<string, unknown>; change(recipe); assert.throws(() => validateSurfaceObservation(recipe, geometry), TypeError, `accepted ${name}`); }
  assert.throws(() => validateSurfaceObservation(lens(), { ...geometry, simplification: { method: 'quadric', maximumErrorMeters: 480 } }), TypeError, 'accepted a simplified mesh');
  const single = lens(); single.frames.length = 1; delete (single as Partial<Lens>).selection; delete (single as Partial<Lens>).levelMatching;
  assert.doesNotThrow(() => validateSurfaceObservation(single, geometry), 'one photograph names no selection and no level matching');
  const weighted = { ...lens(), photometry: { ...lens().photometry, model: 'lunar-lambert', weight: 0.3, maximumGain: 2 } };
  assert.doesNotThrow(() => validateSurfaceObservation(weighted, geometry));
});
