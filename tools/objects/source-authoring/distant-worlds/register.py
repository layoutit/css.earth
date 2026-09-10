"""Register the batch in individual object and astronomy records."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[4]
bodies = json.loads((ROOT / 'tools/objects/source-authoring/distant-worlds/inputs.json').read_text())['bodies']

def write(path, data):
    text = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
    if not path.exists() or path.read_text() != text:
        path.write_text(text)

for body in bodies:
    identifier = body['id']
    path = ROOT / f'src/planets/{identifier}/object.json'
    descriptor = json.loads(path.read_text())
    name = body['name'] + {'mani': ' (2002 MS4)', 'achlys': ' (2003 AZ84)'}.get(identifier, '')
    descriptor['properties'].setdefault('catalog', dict(name=name, classification=body['classification'],
        color='#aaaaaa', distanceAu=body['distanceAu'], description=body['introduction'], systemName='Solar System', context={}))
    write(path, descriptor)
    path = ROOT / f'packages/astronomy/data/bodies/{identifier}.json'
    if not path.exists():
        write(path, dict(id=identifier, classification=body['classification'], physical=dict(
            name=body['name'], horizonsCode=body['horizons'], meanRadiusKm=body['radiusKm'],
            gravitationalParameterKm3PerS2=0, parent='sun'),
            acquisition=dict(heliocentric=dict(target=body['horizons'], model='asteroid'))))
print(f'Registered {len(bodies)} destinations. Run pnpm prepare:catalog and acquire their astronomy records next.')
