"""Independent point probes against original published data, not intake helpers.

Run one body at a time. GIS polygons use an even-odd ray crossing; NIMS uses
individual inverse-coordinate probes instead of the full-grid warp. Diviner
uses brute-force nearest coordinates; Charon compares every original byte.
"""
from pathlib import Path
import json
import hashlib
import math
import sys
import numpy as np
import rasterio
from rasterio.warp import transform
from rasterio.windows import Window
import shapefile

body = sys.argv[1]
if body not in ['moon', 'europa', 'callisto', 'charon']:
    raise ValueError('Select one B6 body')
root = Path('src/planets') / body / 'source'
report = {'body': body, 'status': 'RUNNING', 'products': []}


def grid_points(dataset):
    for latitude in [-80, -55, -25, 0, 25, 55, 80]:
        for longitude in [-165, -125, -85, -45, -5, 35, 75, 115, 155]:
            col = int((longitude+180)/360*dataset.width)
            row = int((90-latitude)/180*dataset.height)
            yield col, row, (col+.5)/dataset.width*360-180, 90-(row+.5)/dataset.height*180


def inside(shape, x, y):
    # All rings take part in the parity test, including holes and disjoint parts.
    result = False
    ends = list(shape.parts) + [len(shape.points)]
    for start, end in zip(ends, ends[1:]):
        ring = shape.points[start:end]
        for (ax, ay), (bx, by) in zip(ring, ring[1:]+ring[:1]):
            if (ay > y) != (by > y) and x < (bx-ax)*(y-ay)/(by-ay)+ax:
                result = not result
    return result


with rasterio.Env(GDAL_CACHEMAX=32*1024**2, GDAL_NUM_THREADS='1'):
    if body in ['moon', 'europa']:
        directory = root / 'geology'
        plan = json.loads((directory/'prepare-grid.json').read_text())
        categories = {c['value']: i for i, c in enumerate(plan['categories'])}
        with rasterio.open(directory/plan['output']) as output:
            points = list(grid_points(output)); owners = [set() for _ in points]
            with shapefile.Reader(shp=str(directory/plan['shapePath']), dbf=str(directory/plan['attributePath'])) as source:
                for feature in source.iterShapeRecords():
                    if not feature.shape.points:
                        continue
                    west, south, east, north = feature.shape.bbox
                    for index, (_, _, lon, lat) in enumerate(points):
                        scale = math.pi/180*plan['radiusMeters'] if plan['coordinateUnits']=='equirectangular-meters' else 1
                        x, y = lon*scale, lat*scale
                        if west <= x <= east and south <= y <= north and inside(feature.shape, x, y):
                            owners[index].add(categories.get(feature.record[plan['field']], -1))
            probes = []
            for (col, row, lon, lat), units in zip(points, owners):
                expected = next(iter(units)) if len(units)==1 and min(units)>=0 else -32768
                actual = int(output.read(1, window=Window(col,row,1,1))[0,0])
                assert actual == expected, (body, 'geology', lon, lat, actual, expected)
                probes.append({'longitude':lon,'latitude':lat,'unitIndex':actual})
            report['products'].append({'id':'geology','method':'Original polygon parity at output pixel centers','probes':probes})

    if body == 'moon':
        directory = root / 'science'
        plan = json.loads((directory/'prepare-cf-map.json').read_text())
        with rasterio.open(directory/plan['input']) as original, rasterio.open(directory/plan['longitude']) as longitude, rasterio.open(directory/plan['latitude']) as latitude, rasterio.open(directory/plan['output']) as output:
            xs = longitude.read(1,window=Window(0,0,longitude.width,1))[0]
            ys = latitude.read(1,window=Window(0,0,1,latitude.height))[:,0]
            probes=[]
            for col,row,lon,lat in grid_points(output):
                x=int(np.argmin(abs(xs.astype('float64')-lon))); y=int(np.argmin(abs(ys.astype('float64')-lat)))
                value=float(original.read(1,window=Window(x,y,1,1))[0,0])
                expected=value if -70<=lat<=70 and math.isfinite(value) and value>0 else -9999
                actual=float(output.read(1,window=Window(col,row,1,1))[0,0])
                assert actual==expected,('Diviner',lon,lat,actual,expected)
                probes.append({'longitude':lon,'latitude':lat,'sourceColumn':x,'sourceRow':y,'micrometers':None if expected==-9999 else expected})
            report['products'].append({'id':'silicate-signature','method':'Original scalar TIFF and published coordinate axes','probes':probes})

    if body in ['europa','callisto']:
        directory=root/'nims';plan=json.loads((directory/'prepare-composite.json').read_text())
        sources=[]
        try:
            for item in plan['observations']:
                source=rasterio.open(directory/item['path']);sources.append((source,source.read(item['bands']),item))
            with rasterio.open(directory/plan['output']) as output:
                probes=[]
                for col,row,lon,lat in grid_points(output):
                    expected=[0,0,0];owner=None;source_values=None
                    easting,northing=output.xy(row,col)
                    for source,data,item in sources:
                        try:
                            x,y=transform(output.crs,source.crs,[easting],[northing]);x,y=x[0],y[0]
                        except Exception as error:
                            if str(error) == 'Point outside of projection domain' or str(error).startswith('Reprojection failed, err = 2050,'):
                                continue
                            raise
                        if not math.isfinite(x) or not math.isfinite(y):continue
                        r,c=source.index(x,y)
                        if not 0<=r<source.height or not 0<=c<source.width:continue
                        values=data[:,r,c]
                        if not np.isfinite(values).all() or not (abs(values)<1e30).all():continue
                        expected=[int(math.floor(1+254*max(0,min(1,(float(value)-lo)/(hi-lo)))+.5)) for value,(lo,hi) in zip(values,plan['displayRanges'])]
                        owner=item['path'];source_values=[float(v) for v in values];break
                    actual=[int(v) for v in output.read(window=Window(col,row,1,1))[:,0,0]]
                    assert actual==expected,(body,lon,lat,actual,expected)
                    probes.append({'longitude':lon,'latitude':lat,'observation':owner,'IF':source_values,'rgb':actual})
                assert any(p['observation'] is None for p in probes) and any(p['observation'] for p in probes)
                report['products'].append({'id':'infrared','method':'Independent inverse-coordinate native cube probes, fixed RGB ranges','probes':probes})
        finally:
            for source,_,_ in sources:source.close()

    if body=='charon':
        directory=root/'science';plan=json.loads((directory/'prepare-bond-map.json').read_text())
        original=np.fromfile(directory/plan['input'],dtype='uint8').reshape(plan['shape'])
        with rasterio.open(directory/plan['output']) as output:
            assert np.array_equal(original,output.read(1))
            probes=[]
            for row,col in [(50,750),(200,300),(350,750),(500,1000),(650,750)]:
                x,y=output.xy(row,col);lon=x/606000*180/math.pi;lat=y/606000*180/math.pi
                dn=int(original[row,col]);probes.append({'longitude':lon,'latitude':lat,'DN':dn,'bondAlbedo':dn*plan['scale'] if dn else None})
            report['products'].append({'id':'albedo','method':'All 1062600 original PDS bytes equal GeoTIFF cells, with geographic/value anchors','probes':probes})

report['sourceManifestSha256']=hashlib.sha256((root/'manifest.json').read_bytes()).hexdigest()
report['scriptSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
report['rasterSha256s']={}
for pattern in ['geology/*-units.tif','science/*-georeferenced.tif','nims/*-rgb.tif']:
    for path in root.glob(pattern):
        report['rasterSha256s'][str(path.relative_to(root))]=hashlib.sha256(path.read_bytes()).hexdigest()
if (root/'nims/prepare-composite.json').exists():
    path=root/'nims'/json.loads((root/'nims/prepare-composite.json').read_text())['output']
    report['rasterSha256s'][str(path.relative_to(root))]=hashlib.sha256(path.read_bytes()).hexdigest()
report['status']='PASS'
out=Path('output/b6-source-proof');out.mkdir(parents=True,exist_ok=True)
(out/f'{body}.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'body':body,'status':'PASS','products':[p['id'] for p in report['products']]}))
