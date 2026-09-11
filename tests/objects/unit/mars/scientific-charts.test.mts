import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const spectrumPath = new URL(
  "../../../../public/scenes/mars/mars-reflectance-spectrum.svg",
  import.meta.url,
);
const profilePath = new URL(
  "../../../../public/scenes/mars/mars-temperature-pressure-profile.svg",
  import.meta.url,
);

test("prepares the full NASA PSG Mars reflectance spectrum", async () => {
  const [preparer, svg] = await Promise.all([
    readFile(new URL("../../../../src/planets/mars/source/content/charts.json", import.meta.url),
      "utf8"),
    readFile(spectrumPath, "utf8"),
  ]);
  assert.equal(JSON.parse(preparer).charts.find((c: { kind: string; })=>c.kind==='spectrum').pointCount,253);
  assert.match(preparer, /I\/F \[apparent albedo\]/u);
  assert.equal(JSON.parse(preparer).charts.find((c: { kind: string; })=>c.kind==='spectrum').format,'numeric-lines');
  assert.doesNotMatch(preparer, /<svg/u);
  assert.match(svg,
    /<title id="mars-reflectance-title">Mars modeled disk reflectance<\/title>/u);
  assert.match(svg, /"measurement":"I\/F apparent albedo"/u);
  assert.match(svg, /"points":253/u);
  assert.match(svg, /<path class="planet-chart-line" d="M[^"]+L[^"]+"/u);
  assert.match(svg, /stroke="#b8bbc4"/u);
  assert.match(svg, /<rect x="0" y="8" width="306" height="1"\/>[\s\S]*?<rect x="0" y="55" width="306" height="1"\/>/u);
  assert.doesNotMatch(svg, />I\/F<|axis-maximum|axis-midpoint/u);
  assert.match(svg, /<desc[^>]*>Full 253-point NASA PSG/u);
});

test("prepares the 49-layer NASA PSG Mars temperature-pressure profile",
  async () => {
    const [preparer, svg] = await Promise.all([
      readFile(new URL("../../../../src/planets/mars/source/content/charts.json", import.meta.url),
        "utf8"),
      readFile(profilePath, "utf8"),
    ]);
    assert.equal(JSON.parse(preparer).charts.find((c: { kind: string; })=>c.kind==='pressure').layerCount,49);
    assert.match(preparer, /Mars MCD5\.3/u);
    assert.equal(JSON.parse(preparer).charts.find((c: { kind: string; })=>c.kind==='pressure').source,'atmosphere/psg-mars-20260829.cfg');
    assert.doesNotMatch(preparer, /<svg/u);
    assert.match(svg,
      /<title id="mars-temperature-pressure-title">Mars temperature and pressure profile<\/title>/u);
    assert.match(svg, /"layers":49/u);
    assert.match(svg, /"pressureRangeBar":\[2\.0223e-13,0\.0073085\]/u);
    assert.match(svg,
      /<path class="planet-chart-line" d="M[^"]+ 122\.00[^"]+L[^"]+ 8\.00"/u);
    assert.match(svg, /stroke="#b8bbc4"/u);
    assert.doesNotMatch(svg, />Bar<|axis-pressure/u);
    assert.match(svg, /244 kilometers/u);
  });

test("keeps both chart assets static and accessible", async () => {
  for (const svg of await Promise.all([
    readFile(spectrumPath, "utf8"),
    readFile(profilePath, "utf8"),
  ])) {
    assert.match(svg, /role="img" aria-labelledby=/u);
    assert.match(svg, /<title id=/u);
    assert.match(svg, /<desc id=/u);
    assert.match(svg, /<metadata>/u);
    assert.doesNotMatch(svg, /<rect width="320" height="166" fill="#000"\/>/u);
    assert.doesNotMatch(svg, /<script|onload=|onclick=/iu);
  }
});
