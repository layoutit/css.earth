"""Register this batch through the existing catalogue, astronomy and scene owners."""
from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[4]
bodies=json.loads((ROOT/'tools/objects/source-authoring/distant-worlds/inputs.json').read_text())['bodies']
def update(path, transform):
    p=ROOT/path; old=p.read_text(); new=transform(old)
    if old!=new:p.write_text(new)
def add_line_entries(text,prefix,ids,union=False):
    line=next(line for line in text.splitlines() if line.startswith(prefix))
    missing=[id for id in ids if repr(id) not in line]
    if not missing:return text
    suffix=(' | ' if union else ', ').join(repr(id) for id in missing)
    return text.replace(line,line+' | '+suffix if union else line[:-1]+', '+suffix+']')

def register_types(s):
    ids=[b['id'] for b in bodies if b['classification']=='trans-neptunian']
    s=add_line_entries(s,'export type TransNeptunianId = ',ids,True)
    s=add_line_entries(s,'export const TRANS_NEPTUNIAN_IDS:',ids)
    if 'export type InterstellarId' not in s:
        s=s.replace('export type SmallBodyId = AsteroidId | TransNeptunianId',"export type InterstellarId = 'oumuamua'\nexport type SmallBodyId = AsteroidId | TransNeptunianId | InterstellarId")
        s=s.replace('| TransNeptunianId | CometId','| TransNeptunianId | InterstellarId | CometId')
        s=s.replace('export const SMALL_BODY_IDS:',"export const INTERSTELLAR_IDS: readonly InterstellarId[] = ['oumuamua']\nexport const SMALL_BODY_IDS:")
        s=s.replace('[...ASTEROID_IDS, ...TRANS_NEPTUNIAN_IDS]','[...ASTEROID_IDS, ...TRANS_NEPTUNIAN_IDS, ...INTERSTELLAR_IDS]')
    return s
update('packages/astronomy/src/body-types.ts',register_types)

def register_astronomy(s):
    for b in bodies:
        if f"  '{b['id']}': body(" in s:continue
        row=f"  '{b['id']}': body('{b['id']}', {json.dumps(b['name'],ensure_ascii=False)}, '{b['horizons']}', {b['radiusKm']}, 0, 'sun'),\n"
        s=s.replace('export const BODIES: Record<BodyId, BodyData> = {\n','export const BODIES: Record<BodyId, BodyData> = {\n'+row)
    return s
update('packages/astronomy/src/bodies.ts',register_astronomy)
def generator(s):
    match=re.search(r'const bodies(?:\s*:[^=]+)? = (\[.*?\]);',s); rows=json.loads(match[1]); ids={x[0] for x in rows}
    rows.extend([[b['id'],b['horizons']] for b in bodies if b['id'] not in ids])
    return s[:match.start(1)]+json.dumps(rows,separators=(',',':'))+s[match.end(1):]
update('packages/astronomy/tools/generate-asteroids.mts',generator)
def registry(s):
    for b in bodies:
        if f'object("{b["id"]}",' in s:continue
        ident=b['id'];desc=ident.replace('-','_')+'Descriptor'
        s=f'import {desc} from "../src/planets/{ident}/object.json" with {{ type: "json" }};\n'+s
        # Names with historical designations remain discoverable through the shared name search.
        name=b['name']+({'mani':' (2002 MS4)','achlys':' (2003 AZ84)'}.get(ident,''))
        row=f'  object({json.dumps(ident)}, {json.dumps(name,ensure_ascii=False)}, {json.dumps(b["classification"])}, "#aaaaaa", {b["distanceAu"]},\n    {json.dumps(b["introduction"],ensure_ascii=False)}, packaged({desc}), {desc}.properties.worldFrame),\n'
        s=s.replace('export const OBJECTS = defineObjects([\n','export const OBJECTS = defineObjects([\n'+row)
    return s
update('site/objects.mts',registry)
# The current shared dynamic route derives every page from OBJECTS.
universe=ROOT/'src/planets/sun/source/navigation/universe.json';data=json.loads(universe.read_text());ids={b['id'] for b in data['bodies']}
data['bodies'] += [dict(id=b['id'],name=b['name'],color='#aaaaaa') for b in bodies if b['id'] not in ids]
universe.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
print('Registered',len(bodies),'destinations')
