// Controlled native DOM boundary for retained geographic control tests.
export function geographicControlSlots(count) {
  class Element extends EventTarget {
    dataset = {}; hidden = true; textContent = ""; children = new Map();
    style = { setProperty() {} };
    attributes = new Map();
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    querySelectorAll(selector) { return selector === "li" ? this.rows : []; }
  }
  return Array.from({ length: count }, () => {
    const element = new Element(); element.rows = Array.from({ length: 16 }, () => new Element()); return element;
  });
}
