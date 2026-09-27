"""Small independent edge cases for offline scientific intake; no archive download."""
import importlib.util
from pathlib import Path
import json
import tempfile
import unittest

import numpy as np
from rasterio.transform import from_origin
from affine import Affine

ROOT=Path(__file__).parent

def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/(name+'.py'))
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

geo=module('geology-grid');coordinates=module('coordinate-tiff-grid');nims=module('nims-composite')

def polygon(w,s,e,n,holes=()):
    return dict(type='Polygon',coordinates=[[(w,s),(w,n),(e,n),(e,s),(w,s)],*holes])

class GeologyTests(unittest.TestCase):
    def test_separate_unit_layers_share_one_conflict_mask(self):
        import shapefile
        import rasterio
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            layers=[]
            # Two original unit files overlap across one quarter of the map.
            for name,unit,bounds in [('west','A',(-180,-90,0,90)),
                                     ('middle','B',(-90,-90,90,90))]:
                with shapefile.Writer(str(root/name)) as writer:
                    writer.field('UNIT','C')
                    writer.poly(polygon(*bounds)['coordinates'])
                    writer.record(unit)
                layers.append(dict(shapePath=name+'.shp',attributePath=name+'.dbf',expectedRecords=1))
            (root/'source.prj').write_text('pinned test projection')
            plan=dict(pins={},projectionPath='source.prj',projectionWkt='pinned test projection',
                width=32,height=16,radiusMeters=2575000,coordinateUnits='degrees',
                field='UNIT',unknownValues=[],categories=[dict(value='A'),dict(value='B')],
                layers=layers,output='units.tif',receipt='receipt.json')
            (root/'plan.json').write_text(json.dumps(plan))
            geo.prepare(root/'plan.json')
            with rasterio.open(root/'units.tif') as image:
                actual=image.read(1)
            np.testing.assert_array_equal(actual[:,:8],0)
            np.testing.assert_array_equal(actual[:,8:16],-32768)
            np.testing.assert_array_equal(actual[:,16:24],1)
            np.testing.assert_array_equal(actual[:,24:],-32768)
            receipt=json.loads((root/'receipt.json').read_text())
            self.assertEqual(receipt['sourceRecords'],{'A':1,'B':1})
            self.assertEqual(receipt['unknownOrConflictingPixels'],128)

    def test_holes_clipping_and_conflicts(self):
        grid=np.full((6,6),-1,dtype='int16');transform=from_origin(0,6,1,1)
        hole=[(2,2),(4,2),(4,4),(2,4),(2,2)]
        geo.paint_polygon(grid,polygon(-.01,-.01,6.01,6.01,[hole]),[-.01,-.01,6.01,6.01],transform,0)
        self.assertTrue((grid[2:4,2:4]==-1).all());self.assertEqual(int((grid==0).sum()),32)
        geo.paint_polygon(grid,polygon(0,0,3,6),[0,0,3,6],transform,1)
        self.assertTrue((grid[:2,:3]==-2).all());self.assertTrue((grid[2:4,2]==1).all())
        geo.paint_polygon(grid,polygon(0,0,6,6),[0,0,6,6],transform,0)
        self.assertTrue((grid[:2,:3]==-2).all(),'conflicts must not be repainted as known')
    def test_pixel_centers_do_not_include_every_touched_cell(self):
        grid=np.full((4,4),-1,dtype='int16')
        geo.paint_polygon(grid,polygon(.9,0,1.1,4),[.9,0,1.1,4],from_origin(0,4,1,1),0)
        self.assertTrue((grid==-1).all())

class CoordinateTests(unittest.TestCase):
    def test_irregular_published_axes_and_ties(self):
        # Dimensions alone would place different centers; use the actual axes.
        result=coordinates.nearest(np.array([-180,-2,1,180]),np.array([-179,-.5,0,170]))
        np.testing.assert_array_equal(result,[0,1,2,3])

class NimsTests(unittest.TestCase):
    def test_callisto_limb_does_not_borrow_an_adjacent_measurement(self):
        # Registered G8CNGLOBAL02A native window: rows 8..10, columns 53..55.
        # At -5.009765625 E, 80.068359375 N the containing native cell is
        # missing. The former GDAL warp selected the measured next row.
        values=np.full((3,3,3),np.nan,dtype='float32')
        values[:,2,:]=np.array([[.29566878,.29566878,1.1674058],
                               [.2828705,.2828705,1.0770508],
                               [.11471148,.11471148,.42846683]],dtype='float32')
        native=Affine(48998.5907088568,0,-2721698.0776368743,
                      0,-45653.6492994997,2827573.7575767287)*Affine.translation(53,8)
        projected=nims.project_native_cells(values,
            '+proj=ortho +lat_0=-6.1 +lon_0=1.7 +a=2409400 +b=2409300 +units=m',
            native,2048,1024)
        self.assertTrue(np.isnan(projected[:,56,995]).all())
        self.assertTrue(np.isfinite(projected).any(),'The actual measured row remains available')
    def test_all_bands_required_and_noise_not_missing(self):
        values=np.array([[[-.2,.5,1e38,np.nan]],[[.5,.5,.5,.5]],[[.5,.5,.5,.5]]],dtype='float32')
        rgb,valid=nims.display(values,[[0,1]]*3)
        np.testing.assert_array_equal(valid,[[True,True,False,False]])
        np.testing.assert_array_equal(rgb[:,0,0],[1,128,128])
        self.assertTrue((rgb[:,:,2:]==0).all())
    def test_fixed_ranges_do_not_equalize_observations(self):
        v=np.array([[[.25,.5]],[[.25,.5]],[[.25,.5]]],dtype='float32')
        a,_=nims.display(v,[[0,1]]*3);b,_=nims.display(v*2,[[0,1]]*3)
        self.assertTrue((b>a).all())
        with self.assertRaises(ValueError):nims.display(v,[[1,1]]*3)

if __name__=='__main__':unittest.main()
