/** Opt-in saved-scene acceptance. All compile/preview submissions receive local fake responses; no processing is permitted. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://127.0.0.1:4331";
const out = "output/nebula-refactor/image-appearance";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1500, height: 1050 },
    serviceWorkers: "block",
  }),
  page = await context.newPage();
const blocked: string[] = [],
  errors: string[] = [],
  mocked: {
    path: string;
    body: { requestId: string; request: Record<string, unknown> };
  }[] = [],
  metadata: unknown[] = [],
  checks: unknown[] = [];
let expectedPost = "";
await context.route("**/*", (route) => {
  const r = route.request();
  if (["GET", "HEAD", "OPTIONS"].includes(r.method())) return route.continue();
  const path = new URL(r.url()).pathname,
    body: unknown = r.postDataJSON();
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Unexpected request body");
  if (path === expectedPost) {
    if (
      !("requestId" in body) ||
      typeof body.requestId !== "string" ||
      !("request" in body) ||
      !body.request ||
      typeof body.request !== "object" ||
      Array.isArray(body.request)
    )
      throw new Error("Invalid job submission");
    const request = Object.fromEntries(Object.entries(body.request));
    mocked.push({ path, body: { requestId: body.requestId, request } });
    expectedPost = "";
    return route.fulfill({
      json: {
        job: {
          id: body.requestId,
          imageId: request.imageId,
          status: "cancelled",
        },
      },
    });
  }
  if (
    path === "/__nebula/star-removal" &&
    "action" in body &&
    body.action === "overview" &&
    "imageId" in body &&
    typeof body.imageId === "string"
  ) {
    metadata.push(body);
    return route.continue();
  }
  blocked.push(r.url());
  return route.abort();
});
page.on("pageerror", (e) => errors.push(e.message));
try {
  for (const subject of [
    "m8",
    "helix-model-prior",
    "m42",
    "lmc-clouds",
    "smc-particles",
  ]) {
    await page.goto(
      `${base}/reconstruction?subject=${subject}${subject === "m8" || subject === "m42" || subject === "helix-model-prior" ? "&inspection=compiler" : ""}`,
    );
    await page.waitForFunction(
      (id) =>
        document.querySelector("#subject")?.getAttribute("data-object-id") ===
          id && !document.querySelector<HTMLInputElement>("#subject")?.disabled,
      subject,
      { timeout: 60000 },
    );
    const panel = page.locator(".image-appearance-panel:visible");
    await panel.waitFor();
    const controls = await panel
      .locator("select:visible,button:visible,input[type=checkbox]:visible")
      .evaluateAll((nodes) =>
        nodes.map((n) =>
          n.tagName === "SELECT"
            ? "Image"
            : n.tagName === "BUTTON"
              ? n.textContent?.trim()
              : n.closest("label")?.textContent?.trim(),
        ),
      );
    assert.deepEqual(controls, [
      "Image",
      "Neutral",
      "Textured",
      "Stars",
      "Original",
    ]);
    if (subject === "lmc-clouds")
      await page.waitForFunction(
        () => {
          const s = document.querySelector<HTMLSelectElement>(
            "#reconstruction-image",
          );
          return s && !s.disabled && s.options.length > 1;
        },
        null,
        { timeout: 60000 },
      );
    if (subject === "m42") {
      await page.waitForFunction(
        () =>
          document
            .querySelector(".compiler-stage")
            ?.getAttribute("data-compiler-ready") === "true",
        null,
        { timeout: 60000 },
      );
      const root = await page.locator("[data-compiler-root]").elementHandle();
      await panel.getByRole("button", { name: "Neutral", exact: true }).click();
      await panel
        .getByRole("button", { name: "Textured", exact: true })
        .click();
      await panel
        .getByRole("checkbox", { name: "Stars", exact: true })
        .uncheck();
      await panel.getByRole("checkbox", { name: "Stars", exact: true }).check();
      await panel
        .getByRole("checkbox", { name: "Original", exact: true })
        .check();
      await panel
        .getByRole("checkbox", { name: "Original", exact: true })
        .uncheck();
      const select = panel.locator("select");
      const options = await select
        .locator("option")
        .evaluateAll((nodes) =>
          nodes.map((n) => (n as HTMLOptionElement).value),
        );
      if (options.length > 1) await select.selectOption(options[1]!);
      assert.equal(
        await root!.evaluate(
          (n) => n === document.querySelector("[data-compiler-root]"),
        ),
        true,
      );
    }
    if (subject === "m8") {
      await page.waitForFunction(
        () =>
          document
            .querySelector(".compiler-controls")
            ?.getAttribute("data-busy") === "false",
      );
      expectedPost = "/__nebula/compiler-jobs";
      await page
        .getByRole("button", { name: /^(Retry compile|Compile nebula)$/ })
        .click();
      await page.waitForFunction(
        () =>
          document
            .querySelector(".compiler-controls")
            ?.getAttribute("data-job-status") === "cancelled",
      );
      const request = mocked.at(-1)!.body.request;
      assert.equal(request.action, "apply");
      assert.equal(request.imageId, "compiler");
      assert.equal(typeof request.recipePath, "string");
      assert.match(String(request.recipePath), /m8/);
      assert.ok(request.cataloguePath && request.controls && request.evidence);
    }
    if (subject === "lmc-clouds") {
      assert.equal(
        await panel
          .getByRole("button", { name: "Neutral", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(await page.locator("#cloud-stars-brightness").count(), 1);
      assert.equal(await page.locator("#cloud-stars-size").count(), 1);
      const star = panel.getByRole("checkbox", { name: "Stars", exact: true });
      if (await star.isEnabled()) {
        const before = await star.isChecked();
        await star.setChecked(!before);
        await star.setChecked(before);
      }
      const select = panel.locator("select");
      const candidates = await select
        .locator("option")
        .evaluateAll((nodes) =>
          nodes
            .map((n) => (n as HTMLOptionElement).value)
            .filter((v) => v !== "benchmark"),
        );
      assert.ok(candidates.length);
      await select.selectOption(candidates[0]!);
      await page.waitForFunction(
        () =>
          !document.querySelector<HTMLButtonElement>("#reconstruction-process")
            ?.disabled,
        null,
        { timeout: 60000 },
      );
      expectedPost = "/__nebula/reconstruction-jobs";
      await page.locator("#reconstruction-process").click();
      await page.waitForFunction(
        () =>
          document
            .querySelector(".reconstruction-controls")
            ?.getAttribute("data-reconstruction-job-status") === "cancelled",
      );
      const request = mocked.at(-1)!.body.request;
      assert.equal(request.action, "apply");
      assert.equal(request.subjectId, "lmc-clouds");
      assert.equal(request.imageId, candidates[0]);
      assert.ok(
        request.removalResultId && request.placement && request.appearance,
      );
    }
    if (subject === "smc-particles") {
      assert.equal(await panel.locator("select:visible").isDisabled(), true);
      assert.equal(
        await panel
          .getByRole("button", { name: "Textured", exact: true })
          .isDisabled(),
        true,
      );
    }
    await page.screenshot({ path: `${out}/${subject}.png` });
    checks.push({ subject, controls });
  }
  assert.deepEqual(blocked, []);
  assert.deepEqual(errors, []);
  assert.equal(mocked.length, 2);
  await writeFile(
    out + "/result.json",
    JSON.stringify(
      { passed: true, checks, mocked, metadata, blocked, errors },
      null,
      2,
    ),
  );
  console.log(
    "IMAGE_APPEARANCE_PASS 5 Model views same order; saved callbacks; compiler+preview POSTs mocked/no scientific work",
  );
} catch (error) {
  await page.screenshot({ path: out + "/failure.png" });
  await writeFile(
    out + "/failure.json",
    JSON.stringify(
      { error: String(error), checks, mocked, blocked, errors },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
