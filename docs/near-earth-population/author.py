from pathlib import Path
import json,hashlib,math,shutil,re,copy,argparse
ROOT=Path('docs/near-earth-population'); CACHE=Path('output/population-prs/near-earth/research'); BASE=Path('src/planets/dike')
def read(p):return json.loads(p.read_text())
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
def pin(p):return dict(expectedBytes=p.stat().st_size,expectedSha256=hashlib.sha256(p.read_bytes()).hexdigest())
def copyto(a,b):b.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(a,b)
def replace(v,id,name):return json.loads(json.dumps(v,ensure_ascii=False).replace('dike',id).replace('Dike',name))
all_bodies=read(ROOT/'inputs.json'); bodies=all_bodies; source_ids=set(re.findall(r'object\("([^"\n]+)"',Path('site/objects.mjs').read_text()))
elements={}
for part in Path('packages/astronomy/src/data').glob('asteroidElements-*.data.ts'):
 text=part.read_text(); elements.update(json.loads(text.split(' = ',1)[1].split(' satisfies ',1)[0]))

for b in bodies:
 id=b['id'];name=b['displayName'];num=b['number'];mid=b['modelId'];url=b['modelUrl']; diameter=b['diameterKm'];radius=diameter/2;scale=b['scaleKmPerSourceUnit'];shape=f'shape/model-{mid}.txt';root=Path('src/planets')/id;s=root/'source'
 assert id not in source_ids and not root.exists(),f'{id}: refusing to overwrite an existing or registered object'
 for target in [Path('src/renderers/css/styles')/(id+'-surfaces.css'),Path('tests/objects/unit')/id,Path('tests/objects/browser')/id]:
  assert not target.exists(),f'{target}: refusing to overwrite existing files'
 assert b.get('shapeKind') and isinstance(b.get('calibration'),dict) and b.get('selectionNotes'),f'{id}: missing qualified shape/calibration/selection metadata'
 assert b['calibration']['diameterKm']==diameter and b['calibration']['scaleKmPerSourceUnit']==scale,f'{id}: calibration and intake disagree'
 assert elements.get(id),f'{id}: generated Horizons elements are required'
 assert hashlib.sha256((CACHE/f'shape-{mid}.txt').read_bytes()).hexdigest()==b['shapeSha256'],f'{id}: original source bytes changed'
 for sub in ['preparation','reference','shape','presentation','content','stars']: (s/sub).mkdir(parents=True,exist_ok=True)
 for file in ['stars/eso0932a.tif','stars/ESO-IMAGE-LICENSE.md','stars/LICENSE.md','stars/hyg-v41-field.json','presentation/InterVariable.ttf','presentation/LICENSE.INTER-OFL']:
  original=BASE/'source'/file
  if not original.exists():original=Path('src/planets/earth/source')/file
  copyto(original,s/file)
 star_path=s/'stars/hyg-v41-field.json'; star_text=star_path.read_text(); assert read(star_path)['schema']=='cssdike-prepared-star-source@1'; star_path.write_text(star_text.replace('cssdike-prepared-star-source@1','css'+id+'-prepared-star-source@1',1))
 for file in ['documentation.html']:
  copyto(Path('src/planets/proserpina/source/reference')/file,s/'reference'/file)
 copyto(CACHE/f'shape-{mid}.txt',s/shape);copyto(CACHE/f'model-{mid}.html',s/f'reference/model-{mid}.html')
 if b['spinUrl']:copyto(CACHE/f'spin-{mid}.txt',s/f'reference/{mid}-IAUspin.txt')
 for ref in b['references']+b.get('upstreamShapeReferences',[]):copyto(CACHE/ref['file'],s/'reference'/ref['file'])
 for paper in b.get('papers',[]):copyto(CACHE/paper['file'],s/'reference'/paper['file'])
 for file in ['elements','vectors']:
  cache=Path('packages/astronomy/tools/.cache/horizons')/f'asteroid-{file}-{id}.txt'
  copyto(cache,s/f'reference/horizons-{file}.txt')
 b['distanceAu']=elements[id]['elements']['semiMajorAxisKm']/149597870.7
 b['orbitalPeriodYears']=2*math.pi/elements[id]['elements']['meanMotionRadPerDay']/365.25
 authors=', '.join(ref['label'] for ref in b['references']) or 'DAMIT archive (no linked publication in this model record)'
 credit=f'DAMIT, Astronomical Institute of Charles University; {authors}; model {mid}, version {b["version"]}.'
 kind=b['shapeKind']; calibration=copy.deepcopy(b['calibration']); desc=calibration['visibleDescription']; limits=calibration['limitations']
 assert calibration['metersPerSourceUnit']==scale*1000
 write(s/'reference/calibration.json',calibration)
 model={**b,'sourceFields':b['fields'],'originalUnits':'km according to DAMIT calibrated-size flag; reconciled to declared equivalent diameter' if b.get('archiveCalibrated',b['calibrated']) else 'dimensionless uncalibrated DAMIT coordinates; physical scale from the documented calibration'}
 write(s/'reference/damit-model.json',model)
 low,high=[v*scale-radius for v in b['radialRangeSourceUnits']];step=10**math.floor(math.log10(max(abs(low),abs(high))))
 extent=math.ceil(max(abs(low),abs(high))/step)*step
 config=replace(read(BASE/'source/preparation/terrestrial.json'),id,name)
 config['distanceAu']=b['distanceAu'];config['geometry']['radiusKm']=radius
 if id in ['ivar','cerberus']:
  config['geometry']['camera']['framingScale']=min(1,radius/(b['radialRangeSourceUnits'][1]*scale))
 grid=dict(metersPerUnit=scale*1000,expectedVertices=b['vertices'],expectedFaces=b['faces'],indexBase=1)
 radial=config['geometry']['radialTerrain'];radial.update(path=shape,grid=grid);radial['simplification']['maximumErrorMeters']=diameter*10
 scientific=config['raster']['scientific'][0];scientific.update(path=shape,grid=grid,minimum=-extent,maximum=extent,valueTransform=dict(scale=.001,offset=-radius))
 scientific['relief']['referenceRadiusMeters']=radius*1000;scientific['surfaceSampling']['maximumDistanceMeters']=diameter*10
 config['celestial']['sunSource']=f'DAMIT model {mid} pole and period with JPL Horizons fixed-epoch heliocentric elements. Absolute body phase is illustrative.'
 write(s/'preparation/terrestrial.json',config)
 lam,beta,obl=map(math.radians,[b['lambda'],b['beta'],23.439291111]);eq=[math.cos(beta)*math.cos(lam),math.cos(beta)*math.sin(lam)*math.cos(obl)-math.sin(beta)*math.sin(obl),math.cos(beta)*math.sin(lam)*math.sin(obl)+math.sin(beta)*math.cos(obl)]
 rotation=read(BASE/'source/preparation/rotation.json');rotation.update(rightAscensionDegrees=math.degrees(math.atan2(eq[1],eq[0])),declinationDegrees=math.degrees(math.asin(eq[2])),periodHours=b['periodHours'],source=f'DAMIT model {mid}, version {b["version"]}: ecliptic J2000 pole ({b["lambda"]:g}, {b["beta"]:g}) degrees and sidereal period {b["periodHours"]:g} h. Equatorial conversion uses obliquity 23.439291111 degrees. Absolute phase is arbitrary.')
 write(s/'preparation/rotation.json',rotation)
 content=replace(read(BASE/'source/content/object.json'),id,name);content.pop('title')
 content['panel']['introduction']=kind+'. The grid marks unavailable surface imagery.'
 facts=content['panel']['facts'];facts[0].update(value=f'{radius:g} km ({"uncertain archive scale" if not b["calibrated"] else "size-calibrated model"})');facts[0]['source'].update(url=calibration['sourceUrl'],label=calibration['sourceLabel'],checked='2026-09-09')
 facts[1]['value']=f'{b["distanceAu"]:.3f} AU';facts[2]['value']=f'{b["orbitalPeriodYears"]:.2f} years';facts[3]['value']=f'{b["periodHours"]:g} hours';facts[3]['source'].update(url=url,label=f'DAMIT model {mid}',checked='2026-09-09')
 for fact in facts[1:3]:fact['source']=dict(url=elements[id]['query'],label='JPL Horizons, 2026-09-03 epoch',checked='2026-09-09',path='source/reference/horizons-elements.txt')
 shape_control,elev=content['lenses']['controls'];shape_control.update(description=desc,title=f'{name} · DAMIT shape model {mid}',detail='Published shape · grid marks missing imagery')
 elevdesc=f'Radius on the shape model minus a {radius:g} km reference sphere, in false color. Heights inherit the size uncertainty; this is not independent topography or gravitational height.'
 elev.update(description=elevdesc,title=f'{name} · radius relative to the {radius:g} km reference sphere');elev['legend'].update(labels=[f'{-extent:g}','0',f'{extent:g}'],meta=f'km · {radius:g} km reference sphere',sourceUrl=url)
 content['resources']=[dict(label='Model record',role='terrain',description=f'DAMIT model {mid}, version {b["version"]}',href=url),dict(label='Size calibration' if b['calibrated'] else 'Archive size estimate',role='facts',description=calibration['sourceLabel'],href=calibration['sourceUrl']),dict(label='Rotation',role='rotation',description='Published pole and period; arbitrary display phase',href=url),content['resources'][-1]]
 content['provenance']['editorial']=dict(url=url,credit=credit)
 for control in content['settings']['controls']:
  if control.get('name') in ['shadows','orbit']:control['checked']=False
 write(s/'content/object.json',content)
 props=dict(source=url,modelId=mid,modelVersion=b['version'],diameterKm=diameter,diameterInterpretation=desc,calibration=calibration,periodHours=b['periodHours'],poleEclipticJ2000Degrees=[b['lambda'],b['beta']],modelLimitations=limits,
  shape=dict(source=b['shapeUrl'],vertices=b['vertices'],faces=b['faces'],originalUnits=model['originalUnits'],metersPerUnit=scale*1000,firstVertexKm=[v*scale for v in b['firstVertex']],firstFaceZeroBased=[i-1 for i in b['firstFace']],extentsKm=[(hi-lo)*scale for lo,hi in b['extentsSourceUnits']],volumeCubicKm=b['signedVolume']*scale**3,volumeEquivalentRadiusKm=radius,radialRangeKm=[r*scale for r in b['radialRangeSourceUnits']]),elevation=[-extent,extent])
 write(s/'reference/model-properties.json',props)
 manifest=replace(read(BASE/'source/manifest.json'),id,name);manifest['documents']=[];manifest['generatedIntermediates']=[]
 manifest['inputs'][1]['acquisition']='Restore the original counted triangle table through the pinned acquisition recipe; retain its original coordinates and declared scale interpretation.'
 manifest['inputs'][1].update(id=id+'-shape',path=shape,origin=b['shapeUrl'],credit=credit,coverage=desc+' '+limits,projection=dict(kind='body-fixed-cartesian-triangular-mesh',longitudeDirection='east',latitudeType='planetocentric',units=model['originalUnits'],metersPerUnit=scale*1000,referenceRadiusMeters=radius*1000),**pin(s/shape))
 acquisition=read(BASE/'source/preparation/acquisition.json');acquisition['operations']=acquisition['operations'][:2]
 restore_entries=[(shape,b['shapeUrl']),(f'reference/model-{mid}.html',url),('reference/documentation.html','https://damit.cuni.cz/projects/damit/pages/documentation')]
 if b['spinUrl']:restore_entries.append((f'reference/{mid}-IAUspin.txt',b['spinUrl']))
 restore_entries += [('reference/'+ref['file'],ref['url']) for ref in b['references']+b.get('upstreamShapeReferences',[])]+[('reference/'+paper['file'],paper['url']) for paper in b.get('papers',[])]
 seen_paths={operation.get('path') for operation in acquisition['operations']}
 for path,origin in restore_entries:
  if path in seen_paths:continue
  seen_paths.add(path);acquisition['operations'].append(dict(kind='download',groups=['restore','refresh'],path=path,url=origin))
 write(s/'preparation/acquisition.json',acquisition);write(s/'manifest.json',manifest)
 # Title/context pins are finalized through their existing owners in finalize-sources.mjs.
 descriptor=replace(read(BASE/'object.json'),id,name);descriptor['properties']['recipe']['shape']['radiusKm']=radius;descriptor['properties'].pop('worldFrame',None);descriptor.pop('prepared',None);write(root/'object.json',descriptor)
 css=Path('src/renderers/css/styles')/(id+'-surfaces.css');css.write_text(Path('src/renderers/css/styles/dike-surfaces.css').read_text().replace('dike',id))
 test=Path('tests/objects/unit')/id/'source.test.mjs';expected={k:b[k] for k in ['modelId','shapeSha256','vertices','faces','firstVertex','firstFace','signedVolume','diameterKm','uncertaintyKm','lambda','beta','periodHours']};expected.update(name=name,modelVersion=b['version'])
 test.parent.mkdir(parents=True,exist_ok=True);test.write_text("import {test} from 'node:test';\nimport {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';\n\n// Original publisher-coordinate anchors and independent signed-volume intake.\nconst independentExpected = "+json.dumps(expected,indent=2)+f';\n\ntest("{name} preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("{id}", independentExpected));\n')
 profile=Path('tests/objects/browser')/id/'browser-profile.mjs';profile.parent.mkdir(parents=True,exist_ok=True);profile.write_text(Path('tests/objects/browser/dike/browser-profile.mjs').read_text().replace('dike',id))
 refs='\n'.join(f'- [{r["label"]}]({r["url"]}) — original model publication record.' for r in b['references'])
 alternatives='; '.join(f'model {a["modelId"]}, pole {a["pole"]}, {a["url"]}' for a in b['alternatives']) or 'None listed for this target.'
 paper_notes='\n'.join(f'- [{paper["label"]}]({paper["url"]}) — retained primary publication; see the body-specific selection and calibration above.' for paper in b.get('papers',[]))
 notes=f'''# ({num}) {b['name']}: source and interpretation

Checked 2026-09-09. Selected DAMIT model **{mid}**, version **{b['version']}**. {credit}

## Shape, scale and orientation

{desc}

{limits}

The unmodified source has {b['vertices']} vertices and {b['faces']} triangles. Its signed tetrahedral volume is {b['signedVolume']:.17g} source units³; an independent triangle-centroid divergence sum gives {b['independentSignedVolume']:.17g}. The existing recipe applies one uniform scale of {scale:.17g} km per source unit so its volume-equivalent diameter is {diameter:g} km. No unit-volume assumption is made. Radius above a {radius:g} km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 ({b['lambda']:g}°, {b['beta']:g}°), with sidereal period {b['periodHours']:g} h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model]({url}) and [original counted mesh]({b['shapeUrl']}) — included unchanged. {kind}; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
{refs}
{paper_notes}

{b['selectionNotes']}

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: {alternatives}

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is {diameter*10:g} m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
'''
 (root/'SOURCE.md').write_text(notes);(root/'NOTICE.md').write_text(f'# {name}: notices\n\n{credit}\n\nShape and derived geometry: DAMIT CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Original source and selected record: {url}.\n\nBackground: ESO/S. Brunier, CC BY 4.0. Star data: HYG, see source/stars/LICENSE.md. Title: Inter Project Authors / Rasmus Andersson, SIL Open Font License 1.1.\n')
 # Pin authored source files now; the title/context finalizer will reseal its own changes.
 special={entry['path'] for entry in manifest['inputs']+manifest['generatedIntermediates']}
 manifest['documents']=[dict(path=str(file.relative_to(s)),purpose='Pinned original source record or authored scientific preparation input.',**pin(file)) for file in sorted(s.rglob('*')) if file.is_file() and file.name!='manifest.json' and str(file.relative_to(s)) not in special]
 write(s/'manifest.json',manifest)
 print(id,'authored',flush=True)
write(ROOT/'inputs.json',all_bodies)
