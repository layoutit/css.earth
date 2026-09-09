from pathlib import Path
import json,re
bodies=json.loads(Path('docs/mars-crossing-population/inputs.json').read_text())
p=Path('packages/astronomy/src/bodies.ts');s=p.read_text()
for prefix,end,separator in [('export type AsteroidId = ',None,' | '),('export const ASTEROID_IDS: readonly AsteroidId[] = ','];',', ')]:
 line=next(line for line in s.splitlines() if line.startswith(prefix));missing=[b['id'] for b in bodies if "'"+b['id']+"'" not in line]
 if missing:
  added=separator.join("'"+id+"'" for id in missing)
  changed=line+separator+added if end is None else line[:-1]+separator+added+']'
  # Existing TypeScript lists use no trailing semicolon.
  s=s.replace(line,changed)
for b in bodies:
 if not re.search(r"^  '"+re.escape(b['id'])+r"': body\(",s,re.M):
  row=f"  '{b['id']}': body('{b['id']}', '{b['displayName']}', '{b['number']};', {b['diameterKm']/2}, 0, 'sun'),\n"
  s=s.replace("  'dike': body(",row+"  'dike': body(",1)
p.write_text(s)
p=Path('packages/astronomy/tools/generate-asteroids.mjs');s=p.read_text();match=re.search(r'const bodies = (\[.*?\]);',s);values=json.loads(match[1]);existing={v[0] for v in values}
values.extend([[b['id'],str(b['number'])+';'] for b in bodies if b['id'] not in existing]);s=s[:match.start(1)]+json.dumps(values,separators=(',',':'))+s[match.end(1):];p.write_text(s)
