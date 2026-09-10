#!/usr/bin/env python3
"""Reproduce coarse regional checks; does not prove absolute registration."""
import importlib.util
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
spec=importlib.util.spec_from_file_location('planes',HERE/'inspect-spectral-planes.py')
planes=importlib.util.module_from_spec(spec)
spec.loader.exec_module(planes)

records=[]
for ident in ['1561668191_1','1660463972_1','1719613772_1','1719616836_1']:
    path=ROOT/'output/b9-source-intake/tethys/native'/f'N{ident}_ir.cub'
    _,w,h,nav=planes.read(path,range(1,7))
    locations=[(i,nav[4][i],nav[5][i]) for i in range(w*h)
               if all(planes.valid(nav[b][i]) for b in nav)]
    landmark=((32.8,231.1) if ident.startswith('171961') else
              (0,330) if ident.startswith('156166') else (-25,150))
    def angle(lat,lon):
        a,b,c,d=map(math.radians,[lat,lon,*landmark])
        dot=math.sin(a)*math.sin(c)+math.cos(a)*math.cos(c)*math.cos(b-d)
        return math.degrees(math.acos(max(-1,min(1,dot))))
    closest=sorted(locations,key=lambda p:angle(p[1],p[2]))[:3]
    records.append(dict(id=ident,referenceLatitude=landmark[0],referenceEastLongitude=landmark[1],
        referenceQualification=('Published Odysseus center' if ident.startswith('171961') else
                                'Regional context only, not a measured landmark'),
        nearest=[dict(x=i%w,y=i//w,latitude=lat,eastLongitude=lon,
                      separationDegrees=angle(lat,lon),phase=nav[1][i],
                      incidenceOrEmission=[nav[2][i],nav[3][i]]) for i,lat,lon in closest]))
(HERE/'regional-framing-check.json').write_text(json.dumps(records,indent=2)+'\n')
