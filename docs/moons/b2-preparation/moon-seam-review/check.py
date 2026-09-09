from pathlib import Path
import hashlib,json,math,subprocess
r=Path('/Users/ekrof/fed/cssEarth-pluto-small-moons')
base='98ef3269'
def old(p):return json.loads(subprocess.check_output(['git','-C',str(r),'show',base+':'+p]))
def current(p):return json.loads((r/p).read_text())
def digest(b):return hashlib.sha256(b).hexdigest()
p='src/planets/moon/prepared/runtime-assets.json';before={a['filename']:a for a in old(p)['assets']};after={a['filename']:a for a in current(p)['assets']}
records=[]
for name,a in after.items():
 if name.startswith(('moon-surface','moon-crustal-thickness','moon-curvature')):
  path=r/'public/scenes/moon'/name;b=path.read_bytes()
  records.append({'path':str(path.relative_to(r)),'bytes':len(b),'sha256':digest(b),'equalsBaselineRecord':before.get(name)==a,'matchesCurrentRecord':len(b)==a['bytes'] and digest(b)==a['sha256']})
sp='src/planets/moon/prepared/scene.json';bs,cs=old(sp),current(sp)
gp='src/planets/moon/source/preparation/geometry.json';g=current(gp);par=g['parameters']
i,j=6,7;o=par['surfaceOverlap'];latStep=180/par['latitudeSegments'];lonStep=360/par['longitudeSegments']
# Independent endpoint check: sourceRect remains one nominal cell while the
# geometric corner angles include overlap on both sides, as in the authored recipe.
lat0=-90+i*latStep;lat1=lat0+latStep;lon0=j*lonStep;lon1=lon0+lonStep
corners=[]
for lat,lon,slat,slon in [(lat0-o*latStep,lon0-o*lonStep,lat0,lon0),(lat0-o*latStep,lon1+o*lonStep,lat0,lon1),(lat1+o*latStep,lon1+o*lonStep,lat1,lon1),(lat1+o*latStep,lon0-o*lonStep,lat1,lon0)]:
 corners.append({'geometryLatitude':lat,'sourceLatitude':slat,'geometryLongitude':lon,'sourceLongitude':slon,'latitudeBiasDegrees':slat-lat,'longitudeBiasDegrees':slon-lon})
assert all(abs(abs(v['latitudeBiasDegrees'])-.09)<1e-12 and abs(abs(v['longitudeBiasDegrees'])-.09)<1e-12 for v in corners)
report={'schema':'cssearth-bounded-visual-source-review@1','head':subprocess.check_output(['git','-C',str(r),'rev-parse','HEAD'],text=True).strip(),'baseline':base,'scope':'Read-only existing captures, prepared geometry/material identity, small encoded pole assets and analytic corner coordinates. No browser, bake or aggregate tests.','baselineEquality':{'geometryRecipe':g==old(gp),'sceneBody':bs['body']==cs['body'],'camera':bs['camera']==cs['camera'],'retainedLeaves':sum(len(b['leaves']) for b in cs['body']['bands'])},'unchangedAssetCount':len(records),'assets':records,'captures':[{'path':'output/playwright/'+n,'sha256':digest((r/'output/playwright'/n).read_bytes())} for n in ['b2-moon-normal.png','b2-moon-elevation.png','b2-moon-rock-abundance.png']],'independentCornerCheck':{'latitudeIndex':i,'longitudeIndex':j,'overlap':o,'nominalCellSpanDegrees':[latStep,lonStep],'geometryCellSpanDegrees':[latStep*(1+2*o),lonStep*(1+2*o)],'cornerBiasDegrees':.09,'latitudeArcAtMoonRadiusKm':1737.4*math.radians(.09),'corners':corners,'limits':'Endpoint registration check only; does not measure browser raster seams or assert complete interpolation identity inside a planar face.'},'conclusion':'Existing geometry/source mapping limitation, not a demonstrated B2 regression. Rock-abundance polar graticule is explicit missing-data cartography. Residual CSS raster seam contribution was not isolated.'}
Path('/tmp/moon-seam-review/evidence.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'head':report['head'],'baselineEquality':report['baselineEquality'],'assetsMatch':all(a['equalsBaselineRecord'] and a['matchesCurrentRecord'] for a in records),'assetCount':len(records),'cornerBiasDegrees':.09,'evidence':'/tmp/moon-seam-review/evidence.json'},indent=2))
