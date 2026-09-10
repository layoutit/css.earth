"""Extract the selected published numeric models; shared preparers own rendering.

Run from the repository root after restoring pinned source inputs. This is the
same radial ellipsoid extraction used by tools/objects/source-authoring/trans-neptunian/author.py.
"""
from pathlib import Path
import hashlib, json, math, shutil, subprocess, sys

ROOT = Path(__file__).resolve().parents[4]
BASE = '8666462797772dc50bbebecd8618014f5e7bd16c'
INPUT_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('tools/objects/source-authoring/distant-worlds/inputs.json')
INPUTS = json.loads((ROOT / INPUT_PATH).read_text())
REFERENCE_ROOT = ROOT / INPUTS.get('referenceDirectory', 'output/distant-worlds/references')

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def pin(path):
    data = path.read_bytes()
    return dict(expectedBytes=len(data), expectedSha256=hashlib.sha256(data).hexdigest())

def original(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT).decode()

def template(path, body):
    return json.loads(original('src/planets/gkunhomdima/' + path).replace('gkunhomdima', body['id']).replace('Gǃkúnǁʼhòmdímà', body['name']))

for body in INPUTS['bodies']:
    ident, name, radius = body['id'], body['name'], body['radiusKm']
    package = ROOT / 'src/planets' / ident
    source = package / 'source'
    description = body['shapeMeaning'] + ' ' + body['orientationMeaning'] + ' The grid marks unmapped terrain.'
    config = template('source/preparation/terrestrial.json', body)
    config['distanceAu'] = body['distanceAu']
    config['geometry']['radiusKm'] = radius
    config['geometry']['camera']['framingScale'] = min(1, 2 * radius / max(body['fullAxesKm']))
    terrain = config['geometry']['radialTerrain']
    terrain['simplification']['maximumErrorMeters'] = radius * 25
    config['raster']['observations'][0]['metadata']['coverage'] = description
    config['celestial']['sunSource'] = 'JPL Horizons fixed 2026-09-03 epoch. ' + body['orientationMeaning']
    manifest = template('source/manifest.json', body)
    manifest['schema'] = f'css{ident}-authoritative-sources@1'
    manifest['documents'], manifest['generatedIntermediates'] = [], []
    manifest['inputs'] = manifest['inputs'][:2]
    acquisition = template('source/preparation/acquisition.json', body)
    acquisition['operations'] = acquisition['operations'][:2]
    for op in acquisition['operations']: op['groups'] = ['restore', 'refresh']
    axes = [value / 2 for value in body['fullAxesKm']]
    assert abs(math.prod(axes) ** (1/3) - radius) < max(radius * 1e-8, 1e-9)
    lines = []
    for lat in range(-90, 91, 5):
        for lon in range(0, 361, 5):
            p, l = math.radians(lat), math.radians(lon)
            r = 1 / math.sqrt((math.cos(p)*math.cos(l)/axes[0])**2 + (math.cos(p)*math.sin(l)/axes[1])**2 + (math.sin(p)/axes[2])**2)
            lines.append(f'{lon} {lat} {r:.12f}')
    write(source / 'shape/ellipsoid.tab', '\n'.join(lines) + '\n')
    manifest['inputs'].append(dict(id='published-shape', path='shape/ellipsoid.tab', **pin(source/'shape/ellipsoid.tab'), origin=body['source'], credit=body['credit'], license='MIT numeric extraction of published scientific facts', licenseEvidence=[body['source']], consumers=['shape'], coverage=description, projection=dict(type='equirectangular',longitudeDirection='east-positive',referenceRadiusMeters=radius*1000)))
    content = template('source/content/object.json', body)
    content['panel']['introduction'] = body['introduction']
    dimension_text = ' × '.join(f'{x*1000:g}' for x in body['fullAxesKm'])+' m' if radius < 1 else ' × '.join(f'{x:.0f}' for x in body['fullAxesKm'])+' km'
    content['panel']['facts'] = [dict(id='shape',label='Shape evidence',value=body['shapeLabel']), dict(id='dimensions',label='Display model extents',value=dimension_text), dict(id='rotation',label='Rotation',value=body['periodText']), dict(id='class',label='Population',value=body['population'])]
    content['panel']['moreFacts'] = [dict(id='uncertainty',label='Shape interpretation',value=body['shapeMeaning'])]
    lens = content['lenses']['controls'][0]
    lens.update(description=description, title=body['shapeLabel'], detail='Inferred shape · unmapped surface grid')
    lens['source'].update(id='published-shape',url=body['source'])
    for control in content['settings']['controls']:
        if control['name'] in ['shadows','orbit']: control['checked'] = False
    content['resources'] = [dict(label='Shape source',role='surface',description=body['credit'],href=body['source'])] + [dict(label='Scientific source',role='facts',description='Published observations and interpretation',href=url) for url in body['papers']] + [content['resources'][-1]]
    content['provenance']['editorial'] = dict(url=body['source'],credit=body['credit'])
    content['provenance']['physical'] = dict(path='../measurements.json',credit=body['credit'])
    content['displayName'] = body.get('titleLabel', name)
    write(source/'content/object.json',content)
    write(source/'preparation/terrestrial.json',config)
    write(source/'preparation/rotation.json',dict(schema='cssearth-display-orientation@1',rightAscensionDegrees=body['poleIcrfDegrees'][0],declinationDegrees=body['poleIcrfDegrees'][1],displayMeridianDegrees=0,phase='arbitrary-display-phase',source=body['source'],qualification=body['orientationMeaning']))
    write(source/'measurements.json',dict(schema='cssearth-distant-world-model@1',checkedOn=INPUTS['checkedOn'],**body))
    for kind in ['elements','vectors']:
        record = ROOT / 'packages/astronomy/tools/.cache/horizons' / f'asteroid-{kind}-{ident}.txt'
        if record.exists():
            write(source/'reference'/f'horizons-{kind}.txt',record.read_text())
    # Citations do not need downloaded pages. Only explicit file inputs are restored.
    for ref in body.get('references',[]):
        if not ref.get('file'): continue
        target = source / 'reference' / ref['file']
        cached = REFERENCE_ROOT / ref['file']
        if cached.exists():
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(cached,target)
        if not target.exists(): raise FileNotFoundError(target)
        actual=pin(target)
        if ref.get('sha256') and actual['expectedSha256'] != ref['sha256']: raise ValueError(f'Changed reference: {target}')
        if not ref.get('retainOriginal'):
            acquisition['operations'].append(dict(kind='download',groups=['restore','refresh'],path='reference/'+ref['file'],url=ref['url']))
    write(source/'preparation/acquisition.json',acquisition)
    for file in ['stars/ESO-IMAGE-LICENSE.md','stars/LICENSE.md','stars/hyg-v41-field.json','presentation/minimap.json']:
        write(source/file, original('src/planets/gkunhomdima/source/'+file).replace('gkunhomdima',ident))
    for file in ['material/neutral.png','stars/eso0932a.tif','presentation/InterVariable.ttf']:
        target=source/file
        if not target.exists():
            available=ROOT/'src/planets/annefrank/source'/file
            if not available.exists(): raise FileNotFoundError(f'Restore common input: {available}')
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(available,target)
    manifest['inputs'].append(dict(id='model-surface',path='material/neutral.png',**pin(source/'material/neutral.png'),origin='https://github.com/layoutit/cssEarth',credit='cssEarth missing-coverage grid',license='MIT',consumers=['surfaces'],width=64,height=32,lensId='model',label='Shape model',falseColor=False,coverage='Authored neutral material; no observed imagery.',projection=dict(type='equirectangular',longitudeDirection='east-positive',referenceRadiusMeters=radius*1000)))
    for entry in manifest['inputs']:
        # Preserve the historical recipe text when reproducing its pinned bytes.
        # The maintained helper location is documented in this directory's README.
        entry.setdefault('acquisition',INPUTS.get('acquisitionNote','Restore pinned originals through acquisition; reproduce authored numbers with docs/distant-worlds/author.py.'))
        entry.setdefault('redistribution','Retain source attribution and model qualifications; upstream papers are not relicensed.')
    write(source/'manifest.json',manifest)
    descriptor=template('object.json',body)
    descriptor['properties'].pop('worldFrame',None)
    descriptor['properties']['page']=dict(stylesheets=[f'src/renderers/css/styles/{ident}-surfaces.css'])
    descriptor['properties']['recipe']['shape']['radiusKm']=radius
    descriptor['prepared']['sha256']='0'*64
    write(package/'object.json',descriptor)
    for file in ['src/renderers/css/styles/gkunhomdima-surfaces.css','tests/objects/browser/gkunhomdima/browser-profile.mjs']:
        write(ROOT/file.replace('gkunhomdima',ident), original(file).replace('gkunhomdima',ident).replace('Gǃkúnǁʼhòmdímà',name))
    print(ident,'source-authored')
