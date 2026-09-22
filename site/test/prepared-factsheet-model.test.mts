import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { orderFacts } from "../fact-order.mts";
import { requireArray, requireRecord, requireString } from "../../tools/sources/source-values.mts";

import PREPARED_EARTH_PANEL from "../../src/objects/earth/prepared/content.json" with { type: "json" };
import PREPARED_CERES_PANEL from "../../src/objects/ceres/prepared/content.json" with { type: "json" };
import PREPARED_JUPITER_PANEL from "../../src/objects/jupiter/prepared/content.json" with { type: "json" };
import PREPARED_MARS_PANEL from "../../src/objects/mars/prepared/content.json" with { type: "json" };
import PREPARED_MOON_PANEL from "../../src/objects/moon/prepared/content.json" with { type: "json" };
import PREPARED_NEPTUNE_PANEL from "../../src/objects/neptune/prepared/content.json" with { type: "json" };
import PREPARED_PLUTO_PANEL from "../../src/objects/pluto/prepared/content.json" with { type: "json" };
import PREPARED_SATURN_PANEL from "../../src/objects/saturn/prepared/content.json" with { type: "json" };
import PREPARED_SUN_PANEL from "../../src/objects/sun/prepared/content.json" with { type: "json" };
import PREPARED_URANUS_PANEL from "../../src/objects/uranus/prepared/content.json" with { type: "json" };

const mercurySource = JSON.parse(await readFile(
  new URL("../../src/objects/mercury/source/content/object.json", import.meta.url),
  "utf8",
));
const venusSource = JSON.parse(await readFile(
  new URL("../../src/objects/venus/source/content/object.json", import.meta.url),
  "utf8",
));
interface Fact { readonly id: string; readonly label: string; readonly value: string; readonly source?: { readonly url: string }; }
interface Panel { readonly planetId: string; readonly facts: readonly Fact[]; readonly moreFacts: readonly Fact[]; }
const fact = (value: unknown, label: string): Fact => {
  const entry = requireRecord(value, label);
  const source = entry.source === undefined ? undefined : requireRecord(entry.source, `${label} source`);
  return { id: requireString(entry.id, `${label} id`), label: requireString(entry.label, `${label} label`), value: requireString(entry.value, `${label} value`),
    ...(source === undefined ? {} : { source: { url: requireString(source.url, `${label} source URL`) } }) };
};
const panel = (value: unknown, planetId: string): Panel => {
  const input = requireRecord(value, `${planetId} panel`);
  const facts = requireArray(input.facts, `${planetId} facts`).map((entry, index) => fact(entry, `${planetId} fact ${index}`));
  const moreFacts = requireArray(input.moreFacts ?? [], `${planetId} more facts`).map((entry, index) => fact(entry, `${planetId} more fact ${index}`));
  return { planetId, facts, moreFacts };
};
const migratedPanel = (source: unknown): Panel => {
  const input = requireRecord(source, 'migrated panel source');
  const panelSource = requireRecord(input.panel, 'migrated panel');
  return panel({ facts: panelSource.facts, moreFacts: panelSource.moreFacts }, requireString(input.id, 'migrated panel id'));
};

const PLANET_PANELS = Object.freeze([
  migratedPanel(mercurySource),
  migratedPanel(venusSource),
  panel(PREPARED_EARTH_PANEL, 'earth'), panel(PREPARED_MARS_PANEL, 'mars'), panel(PREPARED_JUPITER_PANEL, 'jupiter'),
  panel(PREPARED_SATURN_PANEL, 'saturn'), panel(PREPARED_URANUS_PANEL, 'uranus'), panel(PREPARED_NEPTUNE_PANEL, 'neptune'),
]);
const CORE_PLANET_FACT_IDS = Object.freeze([
  "distance-from-sun",
  "radius",
  "orbital-period",
  "rotation-period",
  "axial-tilt",
  "moon-count",
  "ring-system",
]);

test("keeps every planet factsheet comparable and concise", () => {
  for (const panel of PLANET_PANELS) {
    assert.deepEqual(
      panel.facts.map(({ id }) => id),
      CORE_PLANET_FACT_IDS,
      `${panel.planetId} core facts`,
    );
    const ordered = orderFacts(panel.facts, panel.moreFacts);
    assert.deepEqual(ordered.slice(0, 4).map(fact => fact.id), CORE_PLANET_FACT_IDS.slice(0, 4));
    for (const id of ["mass", "density", "gravity"]) {
      assert.ok(panel.moreFacts.some(fact => fact.id === id && fact.source?.url), `${id} has a scientific reference`);
    }
    const radius = panel.facts.find(fact => fact.id === "radius");
    assert.ok(radius);
    assert.equal(radius.label, "Mean radius");
  }
});

test("uses unique semantic ids without hidden title-only content", () => {
  for (const factsheet of [...PLANET_PANELS, panel(PREPARED_MOON_PANEL, 'moon'), panel(PREPARED_PLUTO_PANEL, 'pluto'), panel(PREPARED_SUN_PANEL, 'sun'), panel(PREPARED_CERES_PANEL, 'ceres')]) {
    const facts = [...factsheet.facts, ...factsheet.moreFacts];
    const ids = facts.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!ids.includes("classification"), "classification belongs to the registry-backed title tag");
    for (const fact of facts) {
      assert.match(fact.id, /^[a-z]+(?:-[a-z]+)*$/u);
      assert.equal("title" in fact, false);
    }
  }
});

test("keeps Pluto concise and removes lens-presentation rows", () => {
  const pluto = panel(PREPARED_PLUTO_PANEL, 'pluto');
  const facts = [...pluto.facts, ...pluto.moreFacts];
  assert.ok(facts.some(fact => fact.id === "mass"));
  assert.ok(facts.some(fact => fact.id === "density"));
  assert.equal(facts[0].id, "distance-from-sun");
  assert.doesNotMatch(
    facts.map(({ label }) => label).join(" "),
    /grid|elevation colors/iu,
  );
});

test("keeps object-internal identifiers out of the Moon factsheet", () => {
  assert.doesNotMatch(
    panel(PREPARED_MOON_PANEL, 'moon').facts.map(({ label }) => label).join(" "),
    /NAIF|identifier/iu,
  );
});
