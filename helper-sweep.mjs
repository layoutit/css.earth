// Replace local copies of dot / clamp / isRecord whose one-line body exactly matches the shared helper's.
import { execFileSync } from 'node:child_process'; import { readFileSync, writeFileSync } from 'node:fs'; import { relative, dirname } from 'node:path';
const files = execFileSync('git', ['ls-files', '-z', '--', 'site/*.ts', 'site/*.mts', 'src/*.ts', 'src/*.mts', 'tools/*.ts', 'tools/*.mts'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\0').filter(f => f && !/\/dist\/|\.d\.ts$|^src\/platform\/(vector3|records)\.mts$|^src\/platform\/math\/scalar\.mts$/.test(f));
const P = String.raw`\s*(\w+)\s*:\s*[\w\[\]<>. ]+?\s*`;             // one typed parameter
const idx = (x, i) => String.raw`${x}\[${i}\]!?`;
const three = (a, b) => [0, 1, 2].map(i => String.raw`${idx(a, i)}\s*\*\s*${idx(b, i)}`).join(String.raw`\s*\+\s*`);
const helpers = [
  { name: 'dot', shared: 'dot3', module: 'src/platform/vector3.mts', patterns: [
    new RegExp(String.raw`^\s*const dot = \(${P},${P}\)\s*(?::\s*number\s*)?=>\s*${three('\\1', '\\2')};?\s*$`),
    new RegExp(String.raw`^\s*function dot\(${P},${P}\)\s*(?::\s*number\s*)?\{\s*return ${three('\\1', '\\2')};\s*\}\s*$`)] },
  { name: 'dot', shared: 'dotN', module: 'src/platform/vector3.mts', patterns: [
    new RegExp(String.raw`^\s*const dot = \(${P},${P}\)\s*(?::\s*number\s*)?=>\s*\1\.reduce\(\((\w+),\s*(\w+),\s*(\w+)\)\s*=>\s*\3\s*\+\s*\4\s*\*\s*\2\[\5\]!?,\s*0\);?\s*$`),
    new RegExp(String.raw`^\s*function dot\(${P},${P}\)\s*(?::\s*number\s*)?\{\s*return \1\.reduce\(\((\w+),\s*(\w+),\s*(\w+)\)\s*=>\s*\3\s*\+\s*\4\s*\*\s*\2\[\5\]!?,\s*0\);\s*\}\s*$`)] },
  { name: 'clamp', shared: 'clamp', module: 'src/platform/math/scalar.mts', patterns: [
    new RegExp(String.raw`^\s*const clamp = \(${P},${P},${P}\)\s*(?::\s*number\s*)?=>\s*Math\.max\(\2,\s*Math\.min\(\3,\s*\1\)\);?\s*$`),
    new RegExp(String.raw`^\s*function clamp\(${P},${P},${P}\)\s*(?::\s*number\s*)?\{\s*return Math\.max\(\2,\s*Math\.min\(\3,\s*\1\)\);\s*\}\s*$`)] },
  { name: 'isRecord', shared: 'isRecord', module: 'src/platform/records.mts', patterns: [
    new RegExp(String.raw`^\s*const isRecord = \((\w+): unknown\): \1 is Record<string, unknown> => (?:typeof \1 === 'object' && \1 !== null|\1 !== null && typeof \1 === 'object'|!!\1 && typeof \1 === 'object') && !Array\.isArray\(\1\);?\s*$`),
    new RegExp(String.raw`^\s*function isRecord\((\w+): unknown\): \1 is Record<string, unknown> \{ return (?:typeof \1 === 'object' && \1 !== null|\1 !== null && typeof \1 === 'object') && !Array\.isArray\(\1\); \}\s*$`)] },
];
const report = [], skipped = [];
for (const file of files) {
  let text = readFileSync(file, 'utf8'); const original = text; const imports = [];
  for (const { name } of new Set(helpers.map(h => ({ name: h.name })).map(JSON.stringify))) {}
  for (const name of ['dot', 'clamp', 'isRecord']) {
    const lines = text.split('\n');
    const declarations = lines.map((line, i) => [line, i]).filter(([line]) => new RegExp(String.raw`(^|[^.\w])(const|let|var|function)\s+${name}\b|[(,]\s*${name}\s*[:,)=]`).test(line));
    if (!declarations.length) continue;
    const matches = declarations.map(([line, i]) => ({ i, helper: helpers.find(h => h.name === name && h.patterns.some(p => p.test(line))) }));
    if (matches.some(m => !m.helper) || new Set(matches.map(m => m.helper.shared)).size !== 1) { if (matches.some(m => m.helper)) skipped.push(`${file}: ${name} has other bindings or mixed kinds`); continue; }
    if (new RegExp(String.raw`import[^;]*\b${name}\b[^;]*from`).test(text)) { skipped.push(`${file}: ${name} already imported`); continue; }
    const helper = matches[0].helper;
    for (const { i } of [...matches].sort((a, b) => b.i - a.i)) lines.splice(i, i > 0 && !lines[i - 1].trim() && !(lines[i + 1] ?? 'x').trim() ? 2 : 1);
    text = lines.join('\n');
    imports.push({ helper, local: name });
    report.push(`${file}: ${name} -> ${helper.shared} (${matches.length})`);
  }
  if (!imports.length) continue;
  const lines = text.split('\n');
  let last = -1; lines.forEach((line, i) => { if (/^import\b/.test(line) || (last === i - 1 && /^\s+[\w{}, ]*(from\s+['"].*['"];?)?$/.test(line) && lines[last] && !/;\s*$/.test(lines[last]))) last = i; });
  const byModule = new Map();
  for (const { helper, local } of imports) byModule.set(helper.module, [...byModule.get(helper.module) ?? [], helper.shared === local ? local : `${helper.shared} as ${local}`]);
  let spec = m => { let r = relative(dirname(file), m); return r.startsWith('.') ? r : `./${r}`; };
  const statements = [...byModule].map(([m, names]) => `import { ${names.join(', ')} } from '${spec(m)}';`);
  lines.splice(last + 1, 0, ...statements);
  writeFileSync(file, lines.join('\n'));
}
console.log(report.join('\n')); console.log('--- replaced', report.length, 'skipped', skipped.length); console.log(skipped.join('\n'));
