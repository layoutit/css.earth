import { chromium } from "playwright";

// Use Playwright's lockfile-pinned Chromium, never the installed Chrome channel.
// The former runtime read CSSStyleDeclaration before scaling a texture address.
// Its decimal serialization is observable. Resolve those reads once offline;
// preserve original cssText and property-assignment order in the retained plan.
export async function prepareCssomDeclarationReads(styles) {
  if (!Array.isArray(styles) || styles.some(style => typeof style !== "string")) {
    throw new TypeError("CSS declaration inputs must be prepared strings.");
  }
  const inputs = [...new Set(styles)], browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const records = await page.evaluate(inputs => {
      const node = document.createElement("div");
      return inputs.map(text => {
        node.style.cssText = text;
        return [text, Object.fromEntries(["width", "height", "backgroundPosition", "backgroundSize", "transform"]
          .map(name => [name, node.style[name]]))];
      });
    }, inputs);
    return new Map(records);
  } finally { await browser.close(); }
}
