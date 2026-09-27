import importlib.util
import io
import pathlib
import unittest
import zipfile
import numpy as np
spec=importlib.util.spec_from_file_location('dsk_mesh',pathlib.Path(__file__).with_name('dsk-mesh.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class ExactWeldTest(unittest.TestCase):
    def test_duplicate_patch_boundary_preserves_coordinates_winding_and_map(self):
        vertices=np.array([[1.,0.,0.],[0.,1.,0.],[0.,0.,1.],[-1.,-1.,-1.],[1.,0.,0.]])
        plates=np.array([[1,2,3],[5,4,2],[2,4,3],[3,4,5]])
        recipe={'weldedVertices':4,'inputSha256':'0'*64,'inputBytes':1,'spiceypyVersion':'6.0.3','cspiceVersion':'CSPICE_N0067','member':'shape.obj'}
        a,receipt=module.archive_mesh(vertices,plates,recipe,{'frameId':10040})
        b,_=module.archive_mesh(vertices,plates,recipe,{'frameId':10040})
        self.assertEqual(a,b)
        with zipfile.ZipFile(io.BytesIO(a)) as z:
            self.assertEqual(np.frombuffer(z.read('source-vertex-to-output-vertex.u32le'),dtype='<u4').tolist(),[0,1,2,3,0])
            self.assertEqual(z.read('shape.obj').decode().splitlines()[-4:],['f 1 2 3','f 1 4 2','f 2 4 3','f 3 4 1'])
            self.assertEqual(z.getinfo('shape.obj').date_time,(1980,1,1,0,0,0))
        self.assertEqual(receipt['duplicateVertices'],1)
        near=vertices.copy();near[4,0]+=1e-12
        with self.assertRaisesRegex(ValueError,'duplicate count'):
            module.archive_mesh(near,plates,recipe,{})

if __name__=='__main__':unittest.main()
