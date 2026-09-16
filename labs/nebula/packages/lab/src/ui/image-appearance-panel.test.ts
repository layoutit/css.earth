import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
const root = process.cwd(),
  require = createRequire(resolve(root, "packages/engine/package.json"));
const { build } = createRequire(require.resolve("tsup"))("esbuild");

test("shared appearance preserves selection callbacks and guards unsupported actions without extra controls", async () => {
  const fixture = await build({
    stdin: {
      loader: "tsx",
      resolveDir: root,
      contents: `
    import {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {ImageAppearancePanel,ImageAppearanceCheckbox} from './labs/nebula/packages/lab/src/ui/image-appearance-panel';
    function App(){const [image,setImage]=useState('first'),[mode,setMode]=useState('neutral'),[stars,setStars]=useState(false),[original,setOriginal]=useState(false),[disabled,setDisabled]=useState(false);
      return <><div id="scene"/><ImageAppearancePanel image={<select aria-label="Image" value={image} onChange={e=>setImage(e.target.value)}><option>first</option><option>second</option></select>}
      material={disabled?{reason:'No interchangeable prepared banks.'}:{mode,onChange:setMode}}
      stars={<ImageAppearanceCheckbox label="Stars" control={disabled?{reason:'No prepared stars.'}:{checked:stars,onChange:setStars}}/>}
      original={<ImageAppearanceCheckbox label="Original" control={{checked:original,onChange:setOriginal}}/>}/>
      <button onClick={()=>setDisabled(true)}>Unavailable</button><output>{JSON.stringify({image,mode,stars,original})}</output></>}
    createRoot(document.getElementById('fixture')).render(<App/>);`,
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    outfile: "fixture.js",
    loader: { ".css": "empty" },
    jsx: "automatic",
  });
  const server = createServer((request, response) => {
    response.setHeader(
      "Content-Type",
      request.url === "/fixture.js" ? "text/javascript" : "text/html",
    );
    response.end(
      request.url === "/fixture.js"
        ? fixture.outputFiles[0].text
        : '<div id="fixture"></div><script src="/fixture.js"></script>',
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}`);
    const scene = await page.locator("#scene").elementHandle();
    await page.getByRole("combobox", { name: "Image" }).selectOption("second");
    await page.getByRole("button", { name: "Textured", exact: true }).click();
    await page.getByRole("checkbox", { name: "Stars", exact: true }).check();
    await page.getByRole("checkbox", { name: "Original", exact: true }).check();
    assert.deepEqual(JSON.parse(await page.locator("output").innerText()), {
      image: "second",
      mode: "textured",
      stars: true,
      original: true,
    });
    await page
      .getByRole("button", { name: "Unavailable", exact: true })
      .click();
    const neutral = page.getByRole("button", { name: "Neutral", exact: true });
    await neutral.focus();
    assert.match(
      await page.locator("[role=tooltip]:popover-open").innerText(),
      /No interchangeable/,
    );
    await neutral.press("Enter");
    assert.equal(
      JSON.parse(await page.locator("output").innerText()).mode,
      "textured",
    );
    const stars = page.getByRole("checkbox", { name: "Stars", exact: true });
    await stars.focus();
    await stars.press("Space");
    assert.equal(
      JSON.parse(await page.locator("output").innerText()).stars,
      true,
    );
    assert.equal(
      await scene!.evaluate(
        (node) => node === document.getElementById("scene"),
      ),
      true,
    );
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
