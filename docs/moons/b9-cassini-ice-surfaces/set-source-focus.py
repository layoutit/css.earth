"""Use existing lens navigation for a measured portion of each regional map."""
import json
from pathlib import Path
import numpy as np
import rasterio
ROOT=Path(__file__).resolve().parents[3]
report=[]
for body in ['tethys','iapetus','phoebe']:
 source=ROOT/'src/planets'/body/'source';r=source/'cassini-ice';p=json.loads((r/'prepare.json').read_text());path=source/'preparation/terrestrial.json';config=json.loads(path.read_text())
 for group,kind,lens in [('observations','rgb','infrared'),('scientific','depth','ice-absorption')]:
  output=r/p['outputs'][kind];owner=output.with_name(output.stem+'-observation.tif')
  with rasterio.open(owner) as d:a=d.read(1)
  y,x=np.nonzero(a>0);lat=np.radians(90-(y+.5)*180/p['height']);lon=np.radians(-180+(x+.5)*360/p['width']);v=np.stack([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)],axis=-1)
  center=(v*np.cos(lat)[:,None]).sum(axis=0);center/=np.linalg.norm(center);i=(v@center).argmax()
  focus={'longitudeDegrees':round(float(np.degrees(lon[i]))%360,5),'latitudeDegrees':round(float(np.degrees(lat[i])),5),'zoom':2 if body=='phoebe' else 1.15}
  next(e for e in config['raster'][group] if e['id']==lens)['focus']=focus
  report.append({'body':body,'lens':lens,'focus':focus,'method':'Nearest supported map center to the area-weighted directional centroid; existing shared lens navigation.'})
 path.write_text(json.dumps(config,indent=2,ensure_ascii=False)+'\n')
(ROOT/'docs/moons/b9-cassini-ice-surfaces/source-review/lens-focus.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
