"""Small synthetic format/math regressions, not independent pointing proof.

Run from any directory with Python's standard library. Real C/N center anchors
and denser exposure-time checks remain separate source-qualification evidence.
"""
import importlib.util
import math
from pathlib import Path
import struct
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[5]
SPEC = importlib.util.spec_from_file_location('vims_navigation', ROOT/'tools/objects/acquisition/cassini-vims-navigation.py')
nav = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(nav)


def table(rows):
    return {'rows': rows, 'times': tuple(row[-1] for row in rows)}


def fixture(directory, *, target='IAPETUS', channel='IR'):
    body_id, frame, radii = nav.QUALIFIED_NATIVE_FRAMES[target]
    instrument_frame = -82371 if channel == 'IR' else -82370
    width, height = 2, 2
    common = f'''
  Group = Instrument
    SpacecraftName = Cassini-Huygens
    InstrumentId = VIMS
    TargetName = {target}
    Channel = {channel}
    NativeStartTime = 1000.0
    NativeStopTime = 1001.0
    StartTime = synthetic-start
    StopTime = synthetic-stop
    ExposureDuration = (100 <IR>, 200 <VIS>)
    InterlineDelayDuration = 20
    XOffset = 32
    ZOffset = 32
    SwathWidth = 2
    SwathLength = 2
    SamplingMode = NORMAL
    ProductId = synthetic-test-only
    InstrumentModeId = IMAGE
    SpectralSummingFlag = OFF
    SpectralEditingFlag = OFF
  End_Group
  Group = Kernels
    NaifFrameCode = {instrument_frame}
    CameraVersion = 1
    ShapeModel = Null
  End_Group
'''
    raw_tables = []
    table_text = []
    offset = nav.LABEL_BYTES+width*height*6*4
    rotation_fields = ('J2000Q0', 'J2000Q1', 'J2000Q2', 'J2000Q3', 'AV1', 'AV2', 'AV3', 'ET')
    position_fields = ('J2000X', 'J2000Y', 'J2000Z', 'J2000XV', 'J2000YV', 'J2000ZV', 'ET')
    rows = ((1, 0, 0, 0, 0, 0, 0, 0), (1, 0, 0, 0, 0, 0, 0, 100))
    definitions = [
        ('InstrumentPointing', rotation_fields, rows,
         f'TimeDependentFrames = (-82000, 1)\nConstantFrames = ({instrument_frame}, -82000)\nConstantRotation = (1,0,0,0,1,0,0,0,1)'),
        ('BodyRotation', rotation_fields, rows, f'TimeDependentFrames = ({frame}, 1)'),
        ('InstrumentPosition', position_fields,
         ((0, 0, -1500, 0, 0, 0, 0), (0, 0, -1500, 0, 0, 0, 100)), 'CacheType = HermiteSpline'),
    ]
    for name, fields, data, extra in definitions:
        raw = b''.join(struct.pack('<'+'d'*len(row), *row) for row in data)
        text = (f'Object = Table\nName = {name}\nStartByte = {offset+1}\nBytes = {len(raw)}\n'
                f'Records = {len(data)}\nByteOrder = Lsb\n{extra}\n')
        for field in fields:
            text += f'Group = Field\nName = {field}\nType = Double\nSize = 1\nEnd_Group\n'
        text += 'End_Object\n'
        table_text.append(text)
        raw_tables.append(raw)
        offset += len(raw)
    naif = (f'Object = NaifKeywords\nBODY{body_id}_RADII = ({",".join(map(str,radii))})\n'
            f'BODY_FRAME_CODE = {frame}\nCLOCK_ET_-82_1000_COMPUTED = {struct.pack("<d",50.).hex()}\nEnd_Object\n')
    paths = []
    for prefix, bands in [('C', 256 if channel == 'IR' else 96), ('N', 6)]:
        header = (f'Object = IsisCube\nObject = Core\nStartByte = 65537\nFormat = Tile\n'
                  f'Samples = 2\nLines = 2\nBands = {bands}\nTileSamples = 2\nTileLines = 2\n'
                  'Type = Real\nByteOrder = Lsb\nBase = 0\nMultiplier = 1\nEnd_Object\n'+common)
        if prefix == 'N':
            header += 'Group = BandBin\nName = ('+', '.join('"'+name+'"' for name in nav.NAV_NAMES)+')\nEnd_Group\n'
        header += 'End_Object\n'+(''.join(table_text) if prefix == 'N' else '')+naif+'End\n'
        core = (b'\0'*(width*height*bands*4) if prefix == 'C' else
                b''.join(struct.pack('<4f', *([value]*4)) for value in [30., 10., 10., -90., 0., 1000.]))
        path = directory/(prefix+'synthetic.cub')
        path.write_bytes(header.encode('ascii').ljust(nav.LABEL_BYTES,b'\0')+core
                         +(b''.join(raw_tables) if prefix == 'N' else b''))
        paths.append(path)
    return paths


class NavigationTests(unittest.TestCase):
    def test_hermite_velocity_changes_midpoint_from_linear_position(self):
        curve = table(((0, 0, 0, 0, 0, 0, 0), (4, 0, 0, 4, 0, 0, 2)))
        self.assertEqual(nav.interpolate_position(curve, 1), (1., 0., 0.))
        with self.assertRaises(ValueError):
            nav.interpolate_position(curve, 3)

    def test_quaternion_half_turn_and_antipodal_representation(self):
        for end in ((0,0,0,1), (0,0,0,-1)):
            rotation = table(((1,0,0,0,0), (*end,2)))
            actual = nav.mv(nav.interpolate_rotation(rotation,1), (1,0,0))
            self.assertAlmostEqual(actual[0], 0, places=12)
            self.assertAlmostEqual(abs(actual[1]), 1, places=12)

    def test_front_ellipsoid_hit_and_away_ray(self):
        self.assertEqual(nav.intersect_ellipsoid((0,0,3),(0,0,-1),(2,2,1)), (0.,0.,1.))
        self.assertIsNone(nav.intersect_ellipsoid((0,0,3),(0,0,1),(2,2,1)))
        self.assertIsNone(nav.intersect_ellipsoid((0,0,0),(0,0,1),(2,2,1)))

    def test_hires_uses_integer_swath_offset_and_distinct_pitch(self):
        model = nav.sampling_model('HI-RES', 3, 5, 7)
        self.assertEqual(model, (.0002475,.000495,62.5,31.,6,4))
        self.assertEqual(nav.sampling_model('HI-RES',3,5,6,height=4,channel='VIS'),
                         (.00017,.00017,94.,94.,15,19))

    def test_pair_loader_timing_and_center_do_not_interpolate_scan_neighbors(self):
        with tempfile.TemporaryDirectory() as temporary:
            c, n = fixture(Path(temporary))
            camera = nav.Camera.from_pair(c,n,expected_target='IAPETUS',expected_radii_km=(747.4,747.4,712.4),expected_frame_id=10046)
            exposure, delay = .1*1.01725, .02*1.01725
            self.assertAlmostEqual(camera.pixel_time(1,1), 50+3.5*exposure+delay)
            self.assertLess(camera.center_residual(0,0)['lookErrorPixels'], 1e-8)
            with self.assertRaises(ValueError):
                camera.pixel_time(.5,0)
            with self.assertRaises(ValueError):
                camera.pixel_time(0,0,1.1)
            with self.assertRaises(ValueError):
                camera.state(101)

    def test_aperture_requires_policy_and_proves_off_center_half_support(self):
        with tempfile.TemporaryDirectory() as temporary:
            camera = nav.Camera.from_pair(*fixture(Path(temporary)),expected_target='IAPETUS',expected_radii_km=(747.4,747.4,712.4),expected_frame_id=10046)
            self.assertFalse(camera.footprint(0,0,maximum_center_error_pixels=.001)['supported'])
            footprint = camera.footprint(0,0,maximum_center_error_pixels=.001,aperture_policy=nav.APERTURE_POLICY,inset_radians=(1e-6,1e-6))
            self.assertTrue(footprint['supported'])
            self.assertEqual(len(footprint['orders']),2)
            self.assertEqual(footprint['nominalPhysicalApertureRadians'],(.00025,.0005))
            self.assertGreater(nav.footprint_margin(footprint['positiveSupportWitnessKilometers'],footprint),0)
            self.assertEqual(footprint['exposureMotion']['maximumObserverDisplacementMeters'],0)
            self.assertFalse(camera.footprint(0,0,maximum_center_error_pixels=.001,aperture_policy=nav.APERTURE_POLICY,inset_radians=(.000125,0))['supported'])
            with self.assertRaises(ValueError):
                camera.footprint(0,0,maximum_center_error_pixels=math.inf)

    def test_frame_mismatch_and_truncated_core_fail(self):
        with tempfile.TemporaryDirectory() as temporary:
            c,n = fixture(Path(temporary))
            with self.assertRaises(ValueError):
                nav.Camera.from_pair(c,n,expected_target='IAPETUS',expected_radii_km=(747.4,747.4,712.4),expected_frame_id=10041)
            c.write_bytes(c.read_bytes()[:nav.LABEL_BYTES])
            with self.assertRaises(ValueError):
                nav.Camera.from_pair(c,n,expected_target='IAPETUS',expected_radii_km=(747.4,747.4,712.4),expected_frame_id=10046)

    def test_phoebe_vis_is_ray_only_with_vis_exposure_timing(self):
        with tempfile.TemporaryDirectory() as temporary:
            c,n = fixture(Path(temporary),target='PHOEBE',channel='VIS')
            kwargs = dict(expected_target='PHOEBE',expected_radii_km=(115.,110.,105.),expected_frame_id=10047,expected_channel='VIS')
            with self.assertRaises(ValueError):
                nav.Camera.from_pair(c,n,**kwargs)
            camera = nav.Camera.from_pair(c,n,**kwargs,ray_only=True)
            self.assertAlmostEqual(camera.pixel_time(0,1),50+.1*1.01725+.2)
            self.assertEqual(camera.pixel_time(0,1),camera.pixel_time(1,1))
            self.assertFalse(camera.footprint(0,0,maximum_center_error_pixels=.001,aperture_policy=nav.APERTURE_POLICY)['supported'])


if __name__ == '__main__':
    unittest.main()
