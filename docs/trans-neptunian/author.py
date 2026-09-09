"""Author sources only; the shared terrestrial recipe owns all scene preparation.

Run from repository root. Existing package values are used only for shared
contract structure. The inputs file supplies every physical claim.
"""
from pathlib import Path
import copy, hashlib, json, math, shutil, subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'src/planets/annefrank'
CACHE = ROOT / 'output/population-prs/trans-neptunian'
TEMPLATE_COMMIT = '1fb76e44d6bf831e7ebcf0516b83c0b10e1716da'
INPUTS = json.loads((ROOT / 'docs/trans-neptunian/inputs.json').read_text())

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def pin(path):
    data = path.read_bytes()
    return dict(expectedBytes=len(data), expectedSha256=hashlib.sha256(data).hexdigest())

def verify_record(path, record):
    actual = pin(path)
    if actual['expectedBytes'] != record['bytes'] or actual['expectedSha256'] != record['sha256']:
        raise ValueError(f'Source bytes differ from the retained archive receipt: {path}')

def original(path):
    return subprocess.check_output(['git', 'show', f'{TEMPLATE_COMMIT}:{path}'], cwd=ROOT).decode()

def template(path, body):
    return json.loads(original('src/planets/annefrank/' + path).replace('annefrank', body['id']).replace('Annefrank', body['name']))

def copy_file(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != destination.resolve(): shutil.copyfile(source, destination)

def restored(cache, destination):
    if cache.exists(): copy_file(cache, destination)
    elif not destination.exists(): raise FileNotFoundError(f'Restore source using the pinned acquisition plan first: {destination}')

for body in INPUTS['bodies']:
    ident, name = body['id'], body['name']
    package = ROOT / 'src/planets' / ident
    source = package / 'source'
    radius = body['radiusKm']
    description = body['shapeMeaning'] + ' ' + body['orientationMeaning'] + ' The grid marks unmapped terrain.'
    config = template('source/preparation/terrestrial.json', body)
    config['distanceAu'] = body['distanceAu']
    config['geometry']['radiusKm'] = radius
    config['geometry']['camera']['framingScale'] = min(1, radius / (body['fullAxesKm'][0] / 2))
    terrain = config['geometry']['radialTerrain']
    terrain['simplification']['maximumErrorMeters'] = radius * 25
    config['raster']['observations'][0]['metadata']['coverage'] = description
    config['celestial']['sunSource'] = 'JPL Horizons fixed 2026-09-03 epoch. ' + body['orientationMeaning']
    manifest = template('source/manifest.json', body)
    manifest['documents'] = []
    manifest['generatedIntermediates'] = []
    manifest['inputs'] = manifest['inputs'][:2]
    acquisition = template('source/preparation/acquisition.json', body)
    if ident == 'arrokoth':
        terrain.update(path='shape/arrokoth_porter_2024_v01.obj', format='wavefront-obj', grid=dict(metersPerUnit=1000, expectedVertices=20484, expectedFaces=40960))
        terrain['simplification'].update(targetFaces=1000, maximumErrorMeters=250)
        terrain['tileSize'] = 96
        for record in json.loads((ROOT / 'docs/trans-neptunian/arrokoth-downloads.json').read_text()):
            filename = record['file']
            folder = 'shape' if filename.endswith('.obj') else 'science' if filename.startswith('albedo_') else 'reference'
            path = folder + '/' + filename
            restored(CACHE / 'arrokoth' / filename, source / path)
            verify_record(source / path, record)
            acquisition['operations'].append(dict(kind='download', groups=['restore', 'refresh'], path=path, url=record['url']))
            if filename.endswith('.obj'):
                manifest['inputs'].append(dict(id='published-shape', path=path, **pin(source / path), origin=record['url'], credit=body['credit'], license='NASA PDS scientific data; retain attribution', licenseEvidence=[body['source']], consumers=['shape'], coverage=description, projection=dict(type='body-fixed-cartesian-mesh', units='km', metersPerUnit=1000)))
        copy_file(ROOT / 'docs/trans-neptunian/arrokoth-numeric-audit.json', source / 'reference/numeric-audit.json')
        # The source is centred on its adopted physical origin, not its bounding-box midpoint.
        # Fit its farthest source vertex; half an axis extent would crop the longer lobe.
        vertices = [tuple(map(float, line.split()[1:4])) for line in (source / terrain['path']).read_text().splitlines() if line.startswith('v ')]
        config['geometry']['camera']['framingScale'] = min(1, radius / max(math.hypot(*v) for v in vertices))
    else:
        # Same documented radial ellipsoid equation used by Lucy/Hi'iaka.
        axes = [n / 2 for n in body['fullAxesKm']]
        lines = []
        for lat in range(-90, 91, 5):
            for lon in range(0, 361, 5):
                p, l = math.radians(lat), math.radians(lon)
                r = 1 / math.sqrt((math.cos(p)*math.cos(l)/axes[0])**2 + (math.cos(p)*math.sin(l)/axes[1])**2 + (math.sin(p)/axes[2])**2)
                lines.append(f'{lon} {lat} {r:.12f}')
        write(source / 'shape/ellipsoid.tab', '\n'.join(lines) + '\n')
        manifest['inputs'].append(dict(id='published-shape', path='shape/ellipsoid.tab', **pin(source / 'shape/ellipsoid.tab'), origin=body['source'], credit=body['credit'], license='MIT authored numerical extraction of published scientific facts', licenseEvidence=[body['source']], consumers=['shape'], coverage=description, projection=dict(type='equirectangular', longitudeDirection='east-positive', referenceRadiusMeters=radius*1000)))
        paper = 'gkunhomdima-2026.pdf' if ident == 'gkunhomdima' else 'quaoar-2026.html'
        restored(CACHE / paper, source / 'reference' / paper)
        record = next(r for r in json.loads((ROOT / 'docs/trans-neptunian/paper-downloads.json').read_text()) if r['file'] == paper)
        verify_record(source / 'reference' / paper, record)
        paper_url = 'https://arxiv.org/pdf/2605.28636' if ident == 'gkunhomdima' else 'https://arxiv.org/html/2607.06450v1'
        acquisition['operations'].append(dict(kind='download', groups=['restore', 'refresh'], path='reference/' + paper, url=paper_url))
    if ident == 'quaoar':
        # Published tenuous Q1R width 76.4 km at the Gemini z' chord;
        # the repeated circular band is explicitly schematic in the panel.
        qualification = 'Circular schematic at measured radius. Q1R uses the 76.4 km Gemini chord width; true width varies with azimuth and its dense arc is not reconstructed. Uniform gray and display alpha are illustrative, not measured reflectance or optical depth.'
        config['rings'] = dict(textureSize=2048, bands=[dict(id='q1r', innerRadiusKm=4057.2-76.4/2, outerRadiusKm=4057.2+76.4/2, segments=128, displayValue=160, displayOpacity=.4, qualification=qualification), dict(id='q2r', innerRadiusKm=2515, outerRadiusKm=2525, segments=128, displayValue=160, displayOpacity=.4, qualification='Circular schematic at radius 2520 km and typical width 10 km; uniform gray and display alpha are illustrative, not measured brightness or optical depth.')])
        config['geometry']['camera']['framingScale'] = radius / (4057.2+76.4/2)
    content = template('source/content/object.json', body)
    content['panel']['introduction'] = body['introduction']
    content['panel']['facts'] = [dict(id='shape', label='Shape evidence', value='New Horizons model' if ident=='arrokoth' else 'Published occultation model'), dict(id='dimensions', label='Model extents', value=' × '.join(f'{x:g}' for x in body['fullAxesKm'])+' km'), dict(id='rotation', label='Rotation', value=body['periodText']), dict(id='class', label='Population', value=body['population'])]
    content['panel']['moreFacts'] = [dict(id='uncertainty', label='Shape interpretation', value=body['shapeMeaning'])]
    if ident == 'quaoar':
        content['panel']['moreFacts'].append(dict(id='rings', label='Ring interpretation', value=qualification+' Q2R radius 2520 km, typical width 10 km.'))
    lens = content['lenses']['controls'][0]
    lens.update(description=description, title='Published New Horizons shape' if ident=='arrokoth' else 'Published occultation shape model', detail='Source shape · unmapped surface grid')
    lens['source'].update(id='published-shape', url=body['source'])
    for control in content['settings']['controls']:
        if control['name'] in ['shadows', 'orbit']: control['checked'] = False
    if ident == 'arrokoth':
        albedo = json.loads((ROOT / 'docs/trans-neptunian/arrokoth-albedo.json').read_text())
        config['raster']['scientific'] = [albedo['recipe']]
        content['lenses']['labels']['albedo'] = albedo['content']['label']
        content['lenses']['controls'].append(albedo['content'])
        content['panel']['moreFacts'].append(dict(id='albedo-coverage', label='Albedo coverage', value=albedo['content']['description']))
        manifest['inputs'].append(dict(**albedo['input'], **pin(source / albedo['input']['path'])))
    content['resources'] = [dict(label='Shape source', role='surface', description=body['credit'], href=body['source'])] + [dict(label='Scientific source', role='facts', description='Published data and interpretation', href=url) for url in body['papers']] + [content['resources'][-1]]
    for kind in ['editorial', 'physical']:
        content['provenance'][kind]['credit'] = body['credit']
    content['provenance']['editorial']['url'] = body['source']
    write(source / 'content/object.json', content)
    write(source / 'preparation/terrestrial.json', config)
    write(source / 'preparation/rotation.json', dict(schema='cssearth-display-orientation@1', rightAscensionDegrees=body['poleIcrfDegrees'][0], declinationDegrees=body['poleIcrfDegrees'][1], displayMeridianDegrees=0, phase='arbitrary-display-phase', source=body['source'], qualification=body['orientationMeaning']))
    for kind in ['elements', 'vectors']:
        restored(ROOT / 'packages/astronomy/tools/.cache/horizons' / f'asteroid-{kind}-{ident}.txt', source / 'reference' / f'horizons-{kind}.txt')
    write(source / 'measurements.json', dict(schema='cssearth-trans-neptunian-source@1', **body, checkedOn=INPUTS['checkedOn']))
    write(source / 'preparation/acquisition.json', acquisition)
    for file in ['stars/ESO-IMAGE-LICENSE.md', 'stars/LICENSE.md', 'stars/hyg-v41-field.json', 'presentation/minimap.json']:
        write(source / file, original('src/planets/annefrank/source/' + file))
    # Common inputs must be restored from their pinned acquisition records.
    for file in ['material/neutral.png','stars/eso0932a.tif','presentation/InterVariable.ttf']:
        restored(BASE / 'source' / file, source / file)
    manifest['inputs'].append(dict(id='model-surface', path='material/neutral.png', **pin(source/'material/neutral.png'), origin='https://github.com/layoutit/cssEarth', credit='cssEarth missing-coverage grid', license='MIT', consumers=['surfaces'], width=64,height=32,lensId='model',label='Shape model',falseColor=False,coverage='Authored neutral material; no observed imagery.',projection=dict(type='equirectangular',longitudeDirection='east-positive',referenceRadiusMeters=radius*1000)))
    write(source / 'manifest.json', manifest)
    descriptor = template('object.json', body)
    descriptor['properties'].pop('worldFrame', None)
    descriptor['properties']['page'] = dict(stylesheets=[f'src/renderers/css/styles/{ident}-surfaces.css'])
    descriptor['properties']['recipe']['shape']['radiusKm'] = radius
    if ident == 'arrokoth': descriptor['properties']['recipe']['surfaces'][0]['lenses'].append(dict(id='albedo', source='content', material='lighting'))
    if ident == 'quaoar': descriptor['properties']['recipe']['rings'] = dict(source='terrestrial')
    descriptor['prepared']['sha256'] = '0' * 64
    write(package / 'object.json', descriptor)
    for file in ['src/renderers/css/styles/annefrank-surfaces.css','tests/objects/browser/annefrank/browser-profile.mjs']:
        write(ROOT / file.replace('annefrank',ident), original(file).replace('annefrank',ident).replace('Annefrank',name))
    write(package / 'SOURCE.md', f'# {name}\n\n{body["introduction"]}\n\n{description}\n\nSource: [{body["credit"]}]({body["source"]}). Checked {INPUTS["checkedOn"]}. The source recipe pins units, model assumptions and numerical axes. Shadows and Orbit default off. Rendering uses the generic retained PolyCSS native u raster path. No runtime geometry is generated.\n\n## Source survey\n\n'+'\n'.join('- Unresolved: '+item for item in body['unresolved'])+'\n\nSurface spectra and unresolved observations are not reconstructed surface textures. Reproduce source extraction with `python3 docs/trans-neptunian/author.py`; the existing preparation owners produce scene assets.\n')
    write(package / 'NOTICE.md', f'# {name}: credits\n\n{body["credit"]}: {body["source"]}. Numerical source constraints are attributed; papers are not relicensed. Prepared representation: cssEarth MIT. The grid is an authored missing-data indication. ESO/S. Brunier panorama CC BY4.0; Inter SIL OFL1.1; HYG source license in source/stars.\n')
    print(ident, 'source-authored')
