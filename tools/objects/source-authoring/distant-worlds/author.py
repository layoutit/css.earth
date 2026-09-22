"""Extract the selected published numeric models; shared preparers own rendering.

Run from the repository root after restoring pinned source inputs. This is the
radial ellipsoid extraction updates existing packages and their current bindings.
"""
from pathlib import Path
import hashlib, json, math, shutil, sys

ROOT = Path(__file__).resolve().parents[4]
INPUT_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('tools/objects/source-authoring/distant-worlds/inputs.json')
INPUTS = json.loads((ROOT / INPUT_PATH).read_text())
REFERENCE_ROOT = ROOT / INPUTS.get('referenceDirectory', 'output/distant-worlds/references')

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def pin(path):
    data = path.read_bytes()
    return dict()

def current(path, body):
    return json.loads((ROOT / 'src/objects' / body['id'] / path).read_text())

# Source identities are authored in the current package before extraction.
reviewed = {}
for body in INPUTS['bodies']:
    path = ROOT / 'src/objects' / body['id'] / 'source/manifest.json'
    if not path.exists():
        raise ValueError(f'Author source identities and bindings in {path} before extracting a new body.')
    manifest = json.loads(path.read_text())
    if manifest.get('schema') != f"css{body['id']}-authoritative-sources@2":
        raise ValueError(f'Update {path} to the current Sources contract before extraction.')
    expected_ids = [entry['id'] for entry in manifest['inputs']]
    expected_ids += ['published-shape', 'model-surface']
    existing_inputs = {entry['id']: entry for entry in manifest['inputs']}
    for local_id in expected_ids:
        if not existing_inputs.get(local_id, {}).get('sourceBinding'):
            raise ValueError(f'Author the source binding for {body["id"]}/{local_id} before extraction.')
    reviewed[body['id']] = manifest

for body in INPUTS['bodies']:
    ident, name, radius = body['id'], body['name'], body['radiusKm']
    package = ROOT / 'src/objects' / ident
    source = package / 'source'
    description = body['shapeMeaning'] + ' ' + body['orientationMeaning'] + ' The grid marks unmapped terrain.'
    config = current('source/preparation/terrestrial.json', body)
    config['geometry']['radiusKm'] = radius
    config['geometry']['camera']['framingScale'] = min(1, 2 * radius / max(body['fullAxesKm']))
    terrain = config['geometry']['radialTerrain']
    terrain['simplification']['maximumErrorMeters'] = radius * 25
    config['raster']['observations'][0]['metadata']['coverage'] = description
    config['celestial']['sunSource'] = 'JPL Horizons fixed 2026-09-03 epoch. ' + body['orientationMeaning']
    manifest = current('source/manifest.json', body)
    manifest['schema'] = f'css{ident}-authoritative-sources@2'
    manifest['documents'] = reviewed[ident]['documents']
    manifest['generatedIntermediates'] = reviewed[ident]['generatedIntermediates']
    manifest['inputs'] = [entry for entry in manifest['inputs'] if entry['id'] not in ['published-shape', 'model-surface']]
    acquisition = current('source/preparation/acquisition.json', body)
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
    content = current('source/content/object.json', body)
    binding = next(entry for entry in reviewed[ident]['inputs'] if entry['id'] == 'published-shape')['sourceBinding']
    catalogue_id = binding['references'][0]['catalogueId']
    km = lambda x: f'{x:.2f}' if x < 10 else f'{x:.0f}'
    dimension_text = ' × '.join(f'{x*1000:g}' for x in body['fullAxesKm'])+' m' if radius < 1 else ' × '.join(km(x) for x in body['fullAxesKm'])+' km'
    # Every published panel fact names its source record and the measurement it reads.
    doi = body['source'].split('doi.org/', 1)[1] if 'doi.org/' in body['source'] else None
    fact_source = lambda locator: dict(url=body['source'], label=f'Research publication · DOI {doi}' if doi else body['credit'], checked=INPUTS['checkedOn'],
        path='source/measurements.json', catalogueId=catalogue_id, locator=locator)
    content['panel']['facts'] = [dict(id='dimensions',label='Display model extents',value=dimension_text,source=fact_source('/fullAxesKm/0; /fullAxesKm/1; /fullAxesKm/2'))]
    if body.get('rotationFact'):
        content['panel']['facts'].append(dict(id='rotation',label='Rotation',value=body['periodText'],source=fact_source('/periodText')))
    content['panel']['moreFacts'] = []
    lens = content['lenses']['controls'][0]
    for key in ('description', 'title', 'detail', 'summary'): lens.pop(key, None)
    lens['source'].update(id='published-shape',url=body['source'])
    for control in content['settings']['controls']:
        if control['name'] == 'shadows': control['checked'] = False
    content['resources'] = [dict(label='Shape source',role='surface',description=body['credit'],href=body['source'])] + [dict(label='Scientific source',role='facts',description='Published observations and interpretation',href=url) for url in body['papers']] + [content['resources'][-1]]
    content['provenance']['editorial'] = dict(url=body['source'],credit=body['credit'])
    content['provenance']['physical'] = dict(path='../measurements.json',credit=body['credit'])
    content['displayName'] = body.get('titleLabel', name)
    write(source/'content/object.json',content)
    # Reader text stays outside source/; pnpm prepare:text checks it and flags filler for review.
    citation = dict(catalogueId=catalogue_id, url=body['source'], label=body['credit'], checked=INPUTS['checkedOn'])
    # Extra reader-text citations, such as an orbit fact quoted from JPL, come from the input table.
    text_sources = [*body.get('textCitations', []), citation]
    write(package/'text.json', dict(schema='cssearth-object-text@1', objectId=ident,
        card=dict(text=body.get('card', body['introduction']), sources=text_sources),
        introduction=dict(text=body['introduction'], sources=text_sources),
        datasets={lens['id']: dict(title=body['shapeLabel'], detail='Inferred shape', summary=body.get('datasetSummary', body['shapeMeaning']), sources=[citation])}))
    write(source/'preparation/terrestrial.json',config)
    write(source/'preparation/rotation.json',dict(schema='cssearth-display-orientation@1',rightAscensionDegrees=body['poleIcrfDegrees'][0],declinationDegrees=body['poleIcrfDegrees'][1],displayMeridianDegrees=0,phase='arbitrary-display-phase',source=body.get('poleSource',body['source']),qualification=body['orientationMeaning']))
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
        if not ref.get('retainOriginal'):
            operation = dict(kind='download',groups=['restore','refresh'],path='reference/'+ref['file'],url=ref['url'])
            acquisition['operations'] = [op for op in acquisition['operations'] if op.get('path') != operation['path']] + [operation]
    write(source/'preparation/acquisition.json',acquisition)
    for file in ['material/neutral.png','presentation/InterVariable.ttf']:
        target=source/file
        if not target.exists():
            available=ROOT/'src/objects/annefrank/source'/file
            if not available.exists(): raise FileNotFoundError(f'Restore common input: {available}')
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(available,target)
    manifest['inputs'].append(dict(id='model-surface',path='material/neutral.png',origin='https://github.com/layoutit/cssEarth',credit='cssEarth missing-coverage grid',license='MIT',consumers=['surfaces'],width=64,height=32,lensId='model',label='Shape model',falseColor=False,coverage='Authored neutral material; no observed imagery.',projection=dict(type='equirectangular',longitudeDirection='east-positive',referenceRadiusMeters=radius*1000)))
    for entry in manifest['inputs']:
        entry.setdefault('acquisition',INPUTS.get('acquisitionNote','Restore pinned originals through acquisition; reproduce authored numbers with tools/objects/source-authoring/distant-worlds/author.py.'))
        entry.setdefault('redistribution','Retain source attribution and model qualifications; upstream papers are not relicensed.')
    previous = {entry['id']: entry for entry in reviewed[ident]['inputs']}
    for entry in manifest['inputs']:
        if entry['id'] not in previous or 'sourceBinding' not in previous[entry['id']]:
            raise ValueError(f"Author the source binding for {ident}/{entry['id']} before extraction.")
    manifest['inputs'] = [{**previous[entry['id']], **entry,
        'sourceBinding': previous[entry['id']]['sourceBinding']} for entry in manifest['inputs']]
    write(source/'manifest.json',manifest)
    descriptor=current('object.json',body)
    descriptor['properties']['recipe']['shape']['radiusKm']=radius
    write(package/'object.json',descriptor)
    print(ident,'source-authored')
