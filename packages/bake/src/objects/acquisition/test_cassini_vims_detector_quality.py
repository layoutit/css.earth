"""Small synthetic byte-format tests for original VIMS detector provenance."""
import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('quality',Path(__file__).with_name('cassini-vims-detector-quality.py'))
Q = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(Q)


def fixture(directory, filtered=False, changes=None, background_changes=None):
    w=h=9
    changes, background_changes = changes or {}, background_changes or {}
    offset=8192
    stride=352*(2*w+4)+4*(w+1)*4
    raw=bytearray(((offset+h*stride+511)//512)*512)
    header=f'''RECORD_BYTES = 512
FILE_RECORDS = {len(raw)//512}
^QUBE = 17
CORE_ITEMS = (9,352,9)
AXIS_NAME = (SAMPLE,BAND,LINE)
SUFFIX_ITEMS = (1,4,0)
CORE_ITEM_TYPE = SUN_INTEGER
CORE_ITEM_BYTES = 2
CORE_BASE = 0.0
CORE_MULTIPLIER = 1.0
CORE_VALID_MINIMUM = -4095
CORE_NULL = -8192
CORE_LOW_REPR_SATURATION = -32767
CORE_LOW_INSTR_SATURATION = -32766
CORE_HIGH_REPR_SATURATION = -32764
CORE_HIGH_INSTR_SATURATION = -32765
SUFFIX_BYTES = 4
SAMPLE_SUFFIX_NAME = BACKGROUND
SAMPLE_SUFFIX_ITEM_TYPE = SUN_INTEGER
SAMPLE_SUFFIX_ITEM_BYTES = 4
SAMPLE_SUFFIX_BASE = 0.0
SAMPLE_SUFFIX_MULTIPLIER = 1.0
SAMPLE_SUFFIX_VALID_MINIMUM = 0
SPECTRAL_EDITING_FLAG = OFF
SPECTRAL_SUMMING_FLAG = OFF
PACKING = OFF
COMPRESSOR_ID = 1
BACKGROUND_SAMPLING_MODE_ID = (SINGLE,ZERO_SUB)
BAND_BIN_ORIGINAL_BAND = ({','.join(str(i) for i in range(1,353))})
TARGET_NAME = TETHYS
PRODUCT_ID = 1_123.1
NATIVE_START_TIME = 123.1
NATIVE_STOP_TIME = 124.2
START_TIME = 2012-001T00:00:00.000Z
STOP_TIME = 2012-001T00:00:01.000Z
SAMPLING_MODE_ID = (HI-RES,NORMAL)
EXPOSURE_DURATION = (160.0,1000.0)
'''
    raw[:len(header)]=header.encode()
    side=bytearray()
    for y in range(h):
        for band in range(1,353):
            ir=band-96
            bg=background_changes.get((ir,y),200)
            start=offset+y*stride+(band-1)*(2*w+4)
            for x in range(w):
                struct.pack_into('>h',raw,start+2*x,changes.get((ir,x,y),0))
            struct.pack_into('>i',raw,start+2*w,bg)
            if ir>0:
                side.extend(struct.pack('<iii',y+1,ir,bg))
    history=''.join(f'Object = {name}\nEnd_Object\n' for name in ['vims2isis','spiceinit','vimscal'])
    if filtered:
        history+='''Object = noisefilter
TOLDEF = stddev
REPLACE = null
SAMPLES = 5
LINES = 5
NULLISNOISE = FALSE
HISISNOISE = FALSE
HRSISNOISE = FALSE
LISISNOISE = FALSE
LRSISNOISE = FALSE
End_Object
Object = lowpass
SAMPLES = 3
LINES = 3
FILTER = outside
NULL = yes
HRS = no
HIS = no
LRS = no
LIS = TRUE
REPLACEMENT = center
End_Object
'''
    side_start=65536+w*h*256*4
    history_start=side_start+len(side)
    c=f'''Samples = 9
Lines = 9
Bands = 256
Type = Real
ByteOrder = Lsb
Base = 0.0
Multiplier = 1.0
TileSamples = 9
TileLines = 9
Channel = IR
CompressorId = 1
OriginalBand = ({','.join(str(i) for i in range(97,353))})
TargetName = TETHYS
ProductId = 1_123.1
NativeStartTime = 123.1
NativeStopTime = 124.2
StartTime = 2012-001T00:00:00.000
StopTime = 2012-001T00:00:01.000
SamplingMode = HI-RES
ExposureDuration = (160.0 <IR>,1000.0 <VIS>)
CalibrationVersion = RC19
OutputUnits = I/F
SideplaneCorrection = "Fit Delta"
Object = Table
Name = SideplaneIr
StartByte = {side_start+1}
Bytes = {len(side)}
Records = {h*256}
ByteOrder = Lsb
End_Object
Object = History
StartByte = {history_start+1}
Bytes = {len(history)}
End_Object
'''.encode()
    cal=c+b'\0'*(side_start-len(c))+side+history.encode()
    rp,cp=Path(directory)/'v123_1.qub',Path(directory)/'C123_1_ir.cub'
    rp.write_bytes(raw);cp.write_bytes(cal)
    return rp,cp


class QualityTests(unittest.TestCase):
    def evaluate(self,**kwargs):
        with tempfile.TemporaryDirectory() as directory:
            raw,cal=fixture(directory,**kwargs)
            return Q.quality_for_pair(raw,cal,[25,44])

    def test_background_reconstruction_preserves_dark_values(self):
        r=self.evaluate(changes={(25,0,0):-1,(25,1,0):-200,(25,2,0):0})
        self.assertTrue(all(r['validByBand'][25]))

    def test_clipped_count_hidden_by_background(self):
        r=self.evaluate(changes={(25,4,4):3895})
        self.assertEqual(sum(r['validByBand'][25]),80)
        self.assertFalse(r['validByBand'][25][40])
        self.assertTrue(all(r['validByBand'][44]))

    def test_composed_filter_dependency_radius(self):
        r=self.evaluate(filtered=True,changes={(25,4,4):3895})
        self.assertEqual(sum(r['validByBand'][25]),32)
        self.assertTrue(r['validByBand'][25][0])
        self.assertFalse(r['validByBand'][25][10])
        self.assertEqual(r['report']['filterDependencies']['radiusSamples'],3)

    def test_missing_background_is_skipped_by_historical_fit(self):
        r=self.evaluate(background_changes={(25,4):57344})
        self.assertEqual(sum(r['validByBand'][25]),72)
        self.assertEqual(r['report']['bands']['25']['backgroundRowsSkippedByIsisFit'],[4])
        self.assertFalse(r['report']['bands']['25']['wholeBandBackgroundRejected'])

    def test_other_invalid_background_rejects_entire_fit(self):
        r=self.evaluate(background_changes={(25,4):4095})
        self.assertFalse(any(r['validByBand'][25]))
        self.assertTrue(all(r['validByBand'][44]))

    def test_original_special_and_bad_adc_withheld(self):
        r=self.evaluate(changes={(25,0,0):-8192,(25,1,0):-201})
        self.assertEqual(sum(r['validByBand'][25]),79)

    def test_identity_and_background_mismatch_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            raw,cal=fixture(d)
            cal.write_bytes(cal.read_bytes().replace(b'ProductId = 1_123.1',b'ProductId = 1_999.1'))
            with self.assertRaisesRegex(ValueError,'identity'):
                Q.quality_for_pair(raw,cal,[25])
            raw,cal=fixture(d)
            b=bytearray(raw.read_bytes());struct.pack_into('>i',b,8192+120*22+18,201);raw.write_bytes(b)
            with self.assertRaisesRegex(ValueError,'background values mismatch'):
                Q.quality_for_pair(raw,cal,[25])

    def test_unqualified_history_rejected(self):
        with self.assertRaisesRegex(ValueError,'history'):
            Q.filter_dependency('Object = crop\nEnd_Object\n')


if __name__=='__main__':
    unittest.main()
