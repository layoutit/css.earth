"""Original byte-offset anchors independent of the production converter."""
import struct,math,json,argparse
from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import Window
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root',type=Path,default=Path.cwd())
parser.add_argument('--output-dir',type=Path,default=Path('output/b7-source-review'))
args=parser.parse_args();args.output_dir.mkdir(parents=True,exist_ok=True)
for body in ['dione','rhea']:
 root=args.repo_root/f'src/planets/{body}/source/vims'
 points={(x,y) for y in [0,15,40,89,104,150,179] for x in [0,1,45,90,179,180,247,283,359]}
 with (root/f'data/{body}/{body}_notnorm_pc_modified_2.img').open('rb') as stream:
  stream.seek(11*360*180*4); plane=np.frombuffer(stream.read(360*180*4),dtype='<f4').reshape(180,360)
  for condition in [plane==0,plane==-999]:
   yy,xx=np.nonzero(condition)
   for i in range(min(5,len(xx))):points.add((int(xx[i]),int(yy[i])))
  records=[]
  with rasterio.open(root/f'{body}-infrared.tif') as rgb,rasterio.open(root/f'{body}-water-ice.tif') as depth:
   for x,y in sorted(points):
    bands={}
    for b in [12,43,58,69,70,81]:
     stream.seek(((b-1)*180*360+y*360+x)*4);bands[b]=struct.unpack('<f',stream.read(4))[0]
    rgb_valid=all(math.isfinite(bands[b]) and bands[b]!=-999 for b in [69,43,12])
    expected_rgb=[int(math.floor(1+254*max(0,min(1,bands[b]/hi))+.5)) if rgb_valid else 0 for b,hi in zip([69,43,12],[.30,.45,.65])]
    depth_valid=all(math.isfinite(bands[b]) and bands[b]!=-999 for b in [58,70,81])
    w=(2.01788-1.82022)/(2.19970-1.82022); continuum=bands[58]*(1-w)+bands[81]*w
    expected_depth=struct.unpack('<f',struct.pack('<f',1-bands[70]/continuum))[0] if depth_valid and continuum>0 else -9999
    target_x=(x+180)%360; window=Window(target_x,y,1,1)
    observed_rgb=rgb.read(window=window)[:,0,0].tolist();observed_depth=float(depth.read(1,window=window)[0,0])
    assert observed_rgb==expected_rgb,(body,x,y,observed_rgb,expected_rgb)
    assert observed_depth==expected_depth,(body,x,y,observed_depth,expected_depth)
    records.append({'nativeIndex':[x,y],'canonicalIndex':[target_x,y],'longitudeEastDegrees':x+.5,'latitudeDegrees':89.5-y,'originalIF':bands,'rgb':observed_rgb,'depth':observed_depth})
 (args.output_dir/f'{body}-source-proof.json').write_text(json.dumps({'status':'PASS','body':body,'probes':records,'scope':'Original BSQ byte offsets, RGB quantization, continuum depth, neutral missing codes, native rows and canonical seam. This does not prove subpixel absolute registration.'},indent=2)+'\n')
 print(body,len(records),'PASS')
