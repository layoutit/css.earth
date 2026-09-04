import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const spectrumPath = new URL(
  "../../../../public/scenes/jupiter/jupiter-reflectance-spectrum.svg",
  import.meta.url,
);
const profilePath = new URL(
  "../../../../public/scenes/jupiter/jupiter-temperature-pressure-profile.svg",
  import.meta.url,
);

test("prepares the full NASA PSG Jupiter reflectance spectrum", async () => {
  const [preparer, svg] = await Promise.all([
    readFile(new URL("../tools/prepare-atmosphere-spectrum.mjs", import.meta.url),
      "utf8"),
    readFile(spectrumPath, "utf8"),
  ]);
  assert.match(preparer, /points\.length !== 253/u);
  assert.match(preparer, /I\/F \[apparent albedo\]/u);
  assert.match(preparer, /renderReflectanceChart/u);
  assert.doesNotMatch(preparer, /<svg/u);
  assert.match(svg,
    /<title id="jupiter-reflectance-title">Jupiter modeled disk reflectance<\/title>/u);
  assert.match(svg, /"measurement":"I\/F apparent albedo"/u);
  assert.match(svg, /"points":253/u);
  assert.match(svg, /<path class="planet-chart-line" d="M[^"]+L[^"]+"/u);
  assert.match(svg, /stroke="#b8bbc4"/u);
  assert.match(svg, /<rect x="0" y="8" width="306" height="1"\/>[\s\S]*?<rect x="0" y="55" width="306" height="1"\/>/u);
  assert.doesNotMatch(svg, />I\/F<|axis-maximum|axis-midpoint/u);
  assert.match(svg, /<desc[^>]*>Full 253-point NASA PSG/u);
});

test("prepares the 50-layer NASA PSG Jupiter temperature-pressure profile",
  async () => {
    const [preparer, svg] = await Promise.all([
      readFile(new URL("../tools/prepare-temperature-pressure.mjs", import.meta.url),
        "utf8"),
      readFile(profilePath, "utf8"),
    ]);
    assert.match(preparer, /layers\.length !== 50/u);
    assert.match(preparer, /Moses et al\. 2005/u);
    assert.match(preparer, /renderTemperaturePressureChart/u);
    assert.doesNotMatch(preparer, /<svg/u);
    assert.match(svg,
      /<title id="jupiter-temperature-pressure-title">Jupiter temperature and pressure profile<\/title>/u);
    assert.match(svg, /"layers":50/u);
    assert.match(svg, /"pressureRangeBar":\[1e-8,10\]/u);
    assert.match(svg, /<path class="planet-chart-line" d="M[^"]+L[^"]+"/u);
    assert.match(svg, /stroke="#b8bbc4"/u);
    assert.doesNotMatch(svg, />Bar<|axis-pressure/u);
    assert.doesNotMatch(svg, />1<\/text>/u);
    assert.match(svg, /10 nanobar/u);
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
