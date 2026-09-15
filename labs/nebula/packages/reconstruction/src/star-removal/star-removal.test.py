"""Small native-grid overlap proof; no ML fixture or source processing."""
import importlib.util,unittest
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('removal',Path(__file__).with_name('star-removal.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class NativeTiling(unittest.TestCase):
 def test_overlap_ignores_bad_edges_and_preserves_native_accounting(self):
  y,x=np.mgrid[:833,:1071];image=np.stack([80+x%100,90+y%100,100+(x+y)%100],axis=2).astype(np.uint8);baseline=image.copy();baseline[40:80,60:100]-=15
  def predict(tiles):
   values=np.stack(tiles).astype(np.float32)-10;values[:,:32]=255;values[:,-32:]=255;values[:,:,:32]=255;values[:,:,-32:]=255;return values
  diffuse,stars,mask,receipt=m.tiled_remove(image,predict,baseline,progress=lambda *args:None)
  expected=np.minimum(image-10,baseline)
  self.assertTrue(np.array_equal(diffuse,expected),'No tile border/flush seam may change a native pixel.')
  self.assertTrue(np.array_equal(diffuse.astype(np.uint16)+stars,image));self.assertTrue(np.all(diffuse<=baseline));self.assertTrue(np.all(mask==255));self.assertTrue(receipt['coverageComplete'])
 def test_identity_prediction_and_positive_clamp(self):
  image=np.full((541,637,3),100,np.uint8)
  for delta in [0,50]:
   diffuse,stars,mask,_=m.tiled_remove(image,lambda tiles:np.stack(tiles).astype(np.float32)+delta,progress=lambda *args:None)
   self.assertTrue(np.array_equal(diffuse,image));self.assertFalse(stars.any());self.assertFalse(mask.any())
if __name__=='__main__':unittest.main()
