import {requireRecord} from '../../../../tools/sources/source-values.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {readPreparedFixture} from '../../fixtures.mts';
const PREPARED_SATURN_PANEL=await readPreparedFixture('saturn','content');
const PREPARED_SATURN_TITLE=PREPARED_SATURN_PANEL.title;
const moonCatalog=JSON.parse(await readFile(new URL('../../../../src/objects/saturn/source/moons/saturn-moons.json',import.meta.url),'utf8'));

test("publishes the prepared Saturn shell content", async () => {
  assert.equal(PREPARED_SATURN_TITLE.label, "Saturn");
  assert.match(JSON.parse(await readFile(new URL('../../../../src/objects/saturn/prepared/text.json', import.meta.url), 'utf8')).card.text, /sixth planet from the Sun/u);
  assert.deepEqual(PREPARED_SATURN_PANEL.facts.map(({id,label,value})=>({id,label,value})), [
    { id: "distance-from-sun", label: "Solar semimajor axis", value: "9.537 AU" },
    { id: "radius", label: "Mean radius", value: "58,232 km" },
    { id: "orbital-period", label: "Orbital period", value: "29.45 years" },
    { id: "rotation-period", label: "Rotation period", value: "10.66 hours" },
    { id: "axial-tilt", label: "Axial tilt", value: "26.73°" },
    { id: "moon-count", label: "Known moons", value: "293 · Sep 2026" },
    { id: "ring-system", label: "Rings", value: "Present" },
  ]);
  assert.deepEqual(PREPARED_SATURN_PANEL.moreFacts.map(({id,label,value})=>({id,label,value})), [
    { id: "ring-span", label: "Main ring span", value: "About 282,000 km" },
    { id: "ring-thickness", label: "Typical ring thickness", value: "About 10 m" },
    { id:"mass",label:"Mass",value:"5.683 × 10²⁶ kg" },
    { id:"density",label:"Mean density",value:"0.687 g/cm³" },
    { id:"gravity",label:"Equatorial gravity",value:"10.44 m/s²" },
  ]);
  assert.equal(required(PREPARED_SATURN_PANEL.facts.find((fact: { id: string; })=>fact.id==='moon-count')).value,'293 · Sep 2026');
  assert.equal(moonCatalog.counts.confirmed,293);
});

test("publishes source-bound Saturn atmosphere chart artifacts", async () => {
  const [spectrum, profile] = await Promise.all([
    readFile(new URL(
      "../../../../public/scenes/saturn/saturn-atmosphere-spectrum.svg",
      import.meta.url,
    ), "utf8"),
    readFile(new URL(
      "../../../../public/scenes/saturn/saturn-temperature-pressure-profile.svg",
      import.meta.url,
    ), "utf8"),
  ]);
  const spectrumMetadata = metadata(spectrum);
  const profileMetadata = metadata(profile);

  assert.deepEqual(spectrumMetadata, {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 240",
    points: 253,
    rangeMicrometers: [0.35, 1],
    modeled: "2026-08-29",
  });
  assert.equal(profileMetadata.source, "NASA GSFC Planetary Spectrum Generator");
  assert.equal(profileMetadata.layers, 60);
  assert.deepEqual(profileMetadata.pressureRangeBar, [2e-9, 10]);
  assert.doesNotMatch(spectrum, /<rect[^>]+fill="#000"/u);
  assert.doesNotMatch(profile, /<rect[^>]+fill="#000"/u);
});

test("keeps the prepared NASA Science Saturn snapshot local and identified", async () => {
  const snapshot = JSON.parse(await readFile(
    new URL("../../../../data/planets/saturn.json", import.meta.url),
    "utf8",
  ));

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.id, "saturn");
  assert.equal(snapshot.planet, "Saturn");
  assert.equal(snapshot.title, "Saturn: Facts");
  assert.equal(snapshot.sourceId, 107933);
  assert.equal(snapshot.sourceUrl, "https://science.nasa.gov/saturn/facts/");
  assert.equal(snapshot.credit, "NASA Science");
  assert.match(snapshot.modified, /^\d{4}-\d{2}-\d{2}T/u);
  assert.match(snapshot.retrievedAt, /^\d{4}-\d{2}-\d{2}$/u);
  assert.equal(snapshot.sections.length, 12);
  const introduction = snapshot.sections.find(
    (entry:unknown) => requireRecord(entry).heading === "Introduction",
  );
  assert.ok(introduction.paragraphs[0].length > 150);
  assert.doesNotMatch(introduction.paragraphs[0], /<[^>]+>|&[a-z#0-9]+;/iu);
});

function metadata(svg: string) {
  const match = svg.match(/<metadata>([^<]+)<\/metadata>/u);
  assert.ok(match, "Prepared chart metadata is missing.");
  return JSON.parse(match[1]);
}
