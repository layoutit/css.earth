import importlib.util
import tempfile
import unittest
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('ghrm',Path(__file__).with_name('diviner-ghrm.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class GhrmTests(unittest.TestCase):
    def test_quantity_specific_validity(self):
        x=np.array([np.nan,np.inf,-np.inf,-.1,0,.03,1,1.01])
        self.assertEqual(m.valid_values(x,'rock-area-fraction').tolist(),[False,False,False,False,True,True,True,False])
        self.assertEqual(m.valid_values(x,'bolometric-temperature-anomaly').tolist(),[False,False,False,True,True,True,True,True])
        self.assertFalse(m.valid_values(np.array([-1]),'bolometric-temperature')[0])
    def test_pds_longitude_seam_and_missing_poles(self):
        x,y,supported=m.source_indices(8,4)
        # Canonical -157.5° is 202.5°E; +22.5° maps to the first eastern quadrant.
        self.assertEqual(x.tolist(),[25920,31680,37440,43200,2880,8640,14400,20160])
        self.assertEqual(y.tolist(),[320,6080,11840,17600])
        self.assertTrue(supported.all())
        _,_,supported=m.source_indices(32,16)
        self.assertEqual(supported.tolist(),[False,False]+[True]*12+[False,False])
    def test_compact_signed_encoding_preserves_anomaly_and_zero_rocks(self):
        values=np.array([np.nan,-12.347,0,7.856,100.001],dtype='float32')
        valid=np.isfinite(values)
        out=m.encode(values,valid,.01,0)
        self.assertEqual(out[0],m.NODATA)
        self.assertLessEqual(float(np.max(np.abs(out[valid]*.01-values[valid]))),.0050001)
        self.assertLess(out[1],0);self.assertEqual(out[2],0)
        with self.assertRaisesRegex(ValueError,'exceed'):
            m.encode(np.array([400.0]),np.array([True]),.01,0)
    def test_label_rejects_shifted_coordinates_or_wrong_numeric_type(self):
        label=Path('src/objects/moon/source/science/diviner-ghrm/dghrm_tbol_m_70s70n_img.xml')
        m.validate_label(label,'dghrm_tbol_m_70s70n_img')
        for original,replacement in [('>360</cart:east_bounding_coordinate>','>180</cart:east_bounding_coordinate>'),('IEEE754LSBSingle','SignedLSB2'),('>NaN<','>-9999<')]:
            with tempfile.TemporaryDirectory() as d:
                p=Path(d)/'label.xml';p.write_text(label.read_text().replace(original,replacement))
                with self.assertRaises(ValueError):m.validate_label(p,'dghrm_tbol_m_70s70n_img')

if __name__=='__main__':unittest.main()
