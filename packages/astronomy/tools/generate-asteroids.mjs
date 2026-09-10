#!/usr/bin/env node
// Single-epoch osculating elements and independent Horizons vector fixtures.
import { readFileSync, writeFileSync } from 'node:fs';
import { elementsUrl, vectorsUrl, horizons, parseElements, parseVectors } from './lib/horizons.mjs';

const epochJdTt = 2461286.5;
const bodies = [["vesta","4;"],["eros","433;"],["itokawa","25143;"],["bennu","101955;"],["ryugu","162173;"],["ida","243;"],["gaspra","951;"],["mathilde","253;"],["lutetia","21;"],["steins","2867;"],["didymos","65803;"],["kleopatra","216;"],["toutatis","4179;"],["pallas","2;"],["hygiea","10;"],["juno","3;"],["psyche","16;"],["interamnia","704;"],["davida","511;"],["sylvia","87;"],["eunomia","15;"],["euphrosyne","31;"],["bamberga","324;"],["fortuna","19;"],["themis","24;"],["amphitrite","29;"],["egeria","13;"],["elektra","130;"],["iris","7;"],["hebe","6;"],["eugenia","45;"],["daphne","41;"],["eleonora","354;"],["nemesis","128;"],["kalliope","22;"],["nemausa","51;"],["parthenope","11;"],["melpomene","18;"],["julia","89;"],["victoria","12;"],["urania","30;"],["flora","8;"],["europa-52","52;"],["metis-9","9;"],["camilla","107;"],["thisbe","88;"],["doris","48;"],["hermione","121;"],["diotima","423;"],["herculina","532;"],["nausikaa","192;"],["astraea","5;"],["irene","14;"],["nysa","44;"],["sappho","80;"],["betulia","1580;"],["castalia","4769;"],["asteroid-1998-wt24","33342;"],["asteroid-1994-cc","136617;"],["fides","37;"],["penelope","201;"],["alphonsina","925;"],["angelina","64;"],["ganymed","1036;"],["moshup","66391;"],["cybele","65;"],["aurora","94;"],["palma","372;"],["thule","279;"],["hektor","624;"],["hekate","100;"],["phaethon","3200;"],["harmonia","40;"],["panopaea","70;"],["desdemona-666","666;"],["asteroid-1950-da","29075;"],["apophis","99942;"],["donaldjohanson","52246;"],["geographos","1620;"],["bacchus","2063;"],["mithra","4486;"],["nereus","4660;"],["golevka","6489;"],["yorp","54509;"],["asteroid-1996-hw1","8567;"],["asteroid-2008-ev5","341843;"],["ra-shalom","2100;"],["asteroid-1992-sk","10115;"],["asteroid-1998-ml14","52760;"],["asteroid-2002-ce26","276049;"],["dike","99;"],["massalia","20;"],["proserpina","26;"],["polyhymnia","33;"],["leukothea","35;"],["virginia","50;"],["echo","60;"],["maja","66;"],["juewa","139;"],["bertha","154;"],["lucia","222;"],["brucia","323;"],["badenia","333;"],["ducrosa","400;"],["gyptis","444;"],["petrina","482;"],["veritas","490;"],["gryphia","496;"],["selinur","500;"],["achilles","588;"],["musa","600;"],["auravictrix","700;"],["transvaalia","715;"],["moskva","787;"],["kressmannia","800;"],["parysatis","888;"],["rosalinde","900;"],["susi","933;"],["hidalgo","944;"],["zachia","999;"],["piazzia","1000;"],["tulipa","1095;"],["reinmuthia","1111;"],["china","1125;"],["crimea","1140;"],["rusthawelia","1171;"],["schorria","1235;"],["silvretta","1317;"],["virtanen","1449;"],["mr-spock","2309;"],["educatio","2440;"],["hopi","2938;"],["schaber","3333;"],["iau","5000;"],["united-nations","6000;"],["tartaglia","8888;"],["raup","9165;"],["asteroid-2001-qw16","77777;"],["asteroid-1999-fr33","80000;"],["patroclus","920000617"],["polymele","15094;"],["leucus","11351;"],["orus","21900;"],["eurybates","3548;"],["thetis","17;"],["thalia","23;"],["phocaea","25;"],["euterpe","27;"],["bellona","28;"],["pomona","32;"],["circe","34;"],["atalante","36;"],["leda-38","38;"],["laetitia","39;"],["isis","42;"],["ariadne","43;"],["hestia","46;"],["aglaja","47;"],["pales","49;"],["kalypso","53;"],["alexandra","54;"],["pandora-55","55;"],["melete","56;"],["elpis","59;"],["erato","62;"],["ausonia","63;"],["asia","67;"],["leto","68;"],["hesperia","69;"],["niobe","71;"],["feronia","72;"],["klytia","73;"],["galatea-74","74;"],["freia","76;"],["eurynome","79;"],["alkmene","82;"],["beatrix","83;"],["klio","84;"],["io-85","85;"],["semele","86;"],["aegina","91;"],["minerva","93;"],["arethusa","95;"],["klotho","97;"],["ianthe","98;"],["hera","103;"],["klymene","104;"],["artemis","105;"],["dione-106","106;"],["felicitas","109;"],["lydia","110;"],["iphigenia","112;"],["thyra","115;"],["lomia","117;"],["peitho","118;"],["althaea","119;"],["lachesis","120;"],["gerda","122;"],["brunhild","123;"],["alkeste","124;"],["liberatrix","125;"],["velleda","126;"],["johanna","127;"],["antigone","129;"],["cyrene","133;"],["sophrosyne","134;"],["hertha","135;"],["meliboea","137;"],["siwa","140;"],["vibilia","144;"],["lucina","146;"],["protogeneia","147;"],["gallia","148;"],["medusa","149;"],["nuwa","150;"],["abundantia","151;"],["scylla","155;"],["xanthippe","156;"],["dejanira","157;"],["aemilia","159;"],["una","160;"],["athor","161;"],["laurentia","162;"],["erigone","163;"],["eva","164;"],["loreley","165;"],["rhodope","166;"],["urda","167;"],["sibylla","168;"],["baucis","172;"],["ino","173;"],["phaedra","174;"],["dejopeja","184;"],["lamberta","187;"],["menippe","188;"],["kolga","191;"],["ambrosia","193;"],["eurykleia","195;"],["byblis","199;"],["kallisto","204;"],["hersilia","206;"],["hedda","207;"],["dido","209;"],["isabella","210;"],["medea","212;"],["lilaea","213;"],["aschera","214;"],["oenone","215;"],["eudora","217;"],["stephania","220;"],["eos","221;"],["henrietta","225;"],["weringia","226;"],["philosophia","227;"],["athamantis","230;"],["vindobona","231;"],["asterope","233;"],["coelestina","237;"],["hypatia","238;"],["vanadis","240;"],["kriemhild","242;"],["vera","245;"],["asporina","246;"],["eukrate","247;"],["ilse","249;"],["bettina","250;"],["clementina","252;"],["augusta","254;"],["silesia","257;"],["tyche","258;"],["huberta","260;"],["dresda","263;"],["libussa","264;"],["anna","265;"],["anahita","270;"],["penthesilea","271;"],["antonia","272;"],["philagoria","274;"],["sapientia","275;"],["adelheid","276;"],["emma","283;"],["iclea","286;"],["bavaria","301;"],["clarissa","302;"],["unitas","306;"],["annefrank","5535;"],["braille","9969;"],["diomedes","1437;"],["ajax","1404;"],["ilioneus","5130;"],["pyrrhus","5283;"],["eumelos","5436;"],["lycomedes","9694;"],["demodokus","11429;"],["menelaus","1647;"],["agenor","1873;"],["mentor","3451;"],["chariklo","10199;"],["bienor","54598;"],["ivar","1627;"],["toro","1685;"],["cerberus","1865;"],["tantalus","2102;"],["aethra","132;"],["lyyli","2204;"],["hela","699;"],["kemi","1508;"],["taurinensis","512;"],["asteroid-2001-sn263","153591;"]];
const formatOnly = process.argv.includes('--format-only');
const selected = new Set(process.argv.slice(2).filter(arg => arg !== '--format-only').map(arg => {
  if (!/^--object=[a-z][a-z0-9-]*$/.test(arg)) throw new Error('Use --object=id');
  const id = arg.slice(9);
  if (!bodies.some(row => row[0] === id)) throw new Error(`Unknown asteroid ${id}`);
  return id;
}));
const readChecked = (path, symbol) => {
  const text = readFileSync(new URL(path, import.meta.url), 'utf8');
  return JSON.parse(text.split(`export const ${symbol} = `)[1].replace(/ (?:satisfies|as const)[\s\S]*$/, ''));
};
if (formatOnly && selected.size) throw new Error('--format-only cannot select or fetch bodies');
const readFixtures = () => {
  const destination = new URL('../src/__fixtures__/horizons.asteroids.ts', import.meta.url);
  const index = readFileSync(destination, 'utf8');
  const sections = [...index.matchAll(/^import \{ ASTEROID_FIXTURES_(\d+) \} from '\.\/(horizons\.asteroids-\d+)\.js'$/gm)];
  if (!sections.length) return readChecked('../src/__fixtures__/horizons.asteroids.ts', 'ASTEROID_FIXTURES');
  const records = {};
  for (const [, part, file] of sections) {
    const section = readChecked(`../src/__fixtures__/${file}.ts`, `ASTEROID_FIXTURES_${part}`);
    for (const [id, record] of Object.entries(section)) {
      if (Object.hasOwn(records, id)) throw new Error(`Duplicate asteroid fixture ${id}`);
      records[id] = record;
    }
  }
  return records;
};
const readElements = () => {
  const index = readFileSync(new URL('../src/data/asteroidElements.data.ts', import.meta.url), 'utf8');
  const sections = [...index.matchAll(/^import \{ ASTEROID_ELEMENTS_(\d+) \} from '\.\/(asteroidElements-\d+\.data)\.js'$/gm)];
  if (!sections.length) return readChecked('../src/data/asteroidElements.data.ts', 'ASTEROID_ELEMENTS');
  const records = {};
  for (const [, part, file] of sections) {
    const section = readChecked(`../src/data/${file}.ts`, `ASTEROID_ELEMENTS_${part}`);
    for (const [id, record] of Object.entries(section)) {
      if (Object.hasOwn(records, id)) throw new Error(`Duplicate asteroid elements ${id}`);
      records[id] = record;
    }
  }
  return records;
};
const records = selected.size || formatOnly ? readElements() : {};
const fixtures = selected.size || formatOnly ? readFixtures() : {};
for (const [id, command] of bodies.filter(([id]) => !formatOnly && (!selected.size || selected.has(id)))) {
  const query = elementsUrl({ command, center: '500@10', startJd: epochJdTt, stopJd: epochJdTt + 1, stepDays: 1 });
  const row = parseElements(await horizons(query, `asteroid-elements-${id}`), id)[0];
  const rad = Math.PI / 180;
  records[id] = { query, elements: { epochJdTt,
    semiMajorAxisKm: row.semiMajorAxisKm, eccentricity: row.eccentricity,
    inclinationRad: row.inclinationDeg * rad, ascendingNodeRad: row.nodeDeg * rad,
    argumentOfPeriapsisRad: row.periapsisDeg * rad, meanAnomalyAtEpochRad: row.meanAnomalyDeg * rad,
    meanMotionRadPerDay: row.meanMotionDegPerDay * rad } };
  const vectorQuery = vectorsUrl({ command, center: '500@10', epochsJdTdb: [epochJdTt - 30, epochJdTt, epochJdTt + 30], outUnits: 'KM-D' });
  fixtures[id] = { query: vectorQuery, rows: parseVectors(await horizons(vectorQuery, `asteroid-vectors-${id}`), id) };
}
const header = '// Generated by tools/generate-asteroids.mjs. Do not edit.\n' +
  '// JPL Horizons, heliocentric ICRF; epoch 2026-09-03. TDB is approximated as TT (under 2 ms).\n';
const elementHeader = header + "import type { KeplerianElements } from '../kepler.js'\n";
const elementType = ' satisfies Record<string, {query: string; elements: KeplerianElements}>\n';
const serializeElements = value => JSON.stringify(value, null, 2)
  .replace(/\"elements\": \{\n([\s\S]*?)\n    \}/g, (_, fields) => '\"elements\": { ' + fields.trim().replace(/\n\s*/g, ' ') + ' }');
const elementEntries = Object.entries(records), elementImports = [], elementSpreads = [], elementOutputs = [];
for (let start = 0; start < elementEntries.length; start += 80) {
  const part = start / 80 + 1, name = `ASTEROID_ELEMENTS_${part}`, file = `asteroidElements-${part}.data.ts`;
  elementOutputs.push([file, elementHeader + `export const ${name} = ${serializeElements(Object.fromEntries(elementEntries.slice(start, start + 80)))}` + elementType]);
  elementImports.push(`import { ${name} } from './${file.replace(/\.ts$/, '.js')}'`);
  elementSpreads.push(`  ...${name},`);
}
elementOutputs.push(['asteroidElements.data.ts', elementHeader + elementImports.join('\n') +
  `\n\nexport const ASTEROID_ELEMENTS = {\n${elementSpreads.join('\n')}\n}` + elementType]);
for (const [file, text] of elementOutputs) {
  if (text.trimEnd().split('\n').length > 600) throw new Error(`Generated ${file} exceeds 600 lines`);
}
for (const [file, text] of elementOutputs) writeFileSync(new URL(`../src/data/${file}`, import.meta.url), text);
// Bound whole fixture records without changing the public ASTEROID_FIXTURES API.
// --format-only applies this same writer to retained records without network access.
const serializeFixtures = value => JSON.stringify(value, null, 2)
  .replace(/\{\n\s+"jd":([\s\S]*?)\n\s+\}/g, (_, fields) => '{ "jd":' + fields.trim().replace(/\s*\n\s*/g, ' ') + ' }')
  .replace(/"rows": \[\n\s+/g, '"rows": [ ').replace(/ \}\n    \]/g, ' } ]');
const entries = Object.entries(fixtures);
const imports = [], spreads = [];
const outputs = [];
for (let start = 0; start < entries.length; start += 80) {
  const part = start / 80 + 1;
  const name = `ASTEROID_FIXTURES_${part}`;
  const file = `horizons.asteroids-${part}.ts`;
  const text = header + `export const ${name} = ${serializeFixtures(Object.fromEntries(entries.slice(start, start + 80)))} as const\n`;
  outputs.push([file, text]);
  imports.push(`import { ${name} } from './${file.replace(/\.ts$/, '.js')}'`);
  spreads.push(`  ...${name},`);
}
outputs.push(['horizons.asteroids.ts', header + imports.join('\n') +
  `\n\nexport const ASTEROID_FIXTURES = {\n${spreads.join('\n')}\n} as const\n`]);
for (const [file, text] of outputs) {
  if (text.trimEnd().split('\n').length > 600) throw new Error(`Generated ${file} exceeds 600 lines`);
}
for (const [file, text] of outputs) writeFileSync(new URL(`../src/__fixtures__/${file}`, import.meta.url), text);
