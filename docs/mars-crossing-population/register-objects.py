from pathlib import Path
import json
bodies=json.loads(Path('docs/mars-crossing-population/inputs.json').read_text())
p=Path('site/objects.mjs');s=p.read_text()
for b in bodies:
 id,name=b['id'],b['displayName']
 if f'object("{id}",' in s:continue
 s=f'import {id}Descriptor from "../src/planets/{id}/object.json" with {{ type: "json" }};\n'+s
 entry=f'''  object("{id}", "{name}", "asteroid", "#aaaaaa", {b['distanceAu']},
    "Explore {name}, a Mars-crossing asteroid, with its published shape model at an approximate thermal scale.", packaged({id}Descriptor), {id}Descriptor.properties.worldFrame),
'''
 s=s.replace(']);\n\nexport function requireObject',entry+']);\n\nexport function requireObject',1)
p.write_text(s)
