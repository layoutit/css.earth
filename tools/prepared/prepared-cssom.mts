import { isArray } from '../../src/platform/is-array.mts';
import { chromium } from "playwright";

// Use Playwright's lockfile-pinned Chromium, never the installed Chrome channel.
// The former runtime read CSSStyleDeclaration before scaling a texture address.
// Its decimal serialization is observable. Resolve those reads once offline;
// preserve original cssText and property-assignment order in the retained plan.
function isPreparedStyleList(value: unknown): value is readonly string[] {
  return isArray(value) && value.every(style => typeof style === "string");
}

export async function prepareCssomDeclarationReads(styles: unknown) {
  if (!isPreparedStyleList(styles)) {
    throw new TypeError("CSS declaration inputs must be prepared strings.");
  }
  const inputs = [...new Set(styles)], browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const records = await page.evaluate(inputs => {
      const node = document.createElement("div");
      return inputs.map(text => {
        node.style.cssText = text;
        return [text, Object.fromEntries((["width", "height", "backgroundPosition", "backgroundSize", "transform"] as const)
          .map(name => [name, node.style[name]]))] as const;
      });
    }, inputs);
    return new Map(records);
  } finally { await browser.close(); }
}
