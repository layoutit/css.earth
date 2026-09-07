// Controlled native DOM boundary for retained geographic control tests.
export function geographicControlSlots(count) {
  class Element extends EventTarget {
    dataset = {}; hidden = true; textContent = ""; children = new Map();
    style = { setProperty() {} };
    attributes = new Map();
    setAttribute(key, value) { this.attributes.set(key, value); }
    hasAttribute(key) { return this.attributes.has(key); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    querySelectorAll(selector) { return selector === "li" ? this.rows : []; }
  }
  return Array.from({ length: count }, (_, index) => {
    const element = new Element(), details = new Element();
    details.rows = Array.from({ length: 16 }, () => new Element());
    details.setAttribute("data-geographic-details", "");
    const id = `geographic-${index}-details`;
    element.querySelector("button").setAttribute("aria-controls", id);
    element.ownerDocument = { getElementById: key => key === id ? details : null };
    return element;
  });
}
