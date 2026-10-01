/** A section that only a selection shows (a dataset's details, another object's card, a closed tab) is not mounted. The
 * server wraps it in `<template data-detached-section>`, whose content is inert: no style, layout or paint. The page
 * moves it into place when it is shown and back into a template when it is hidden, the way prepared meshes and
 * cutaways are swapped (prepared-omitted-nodes.ts). */
const DETACHED = 'template[data-detached-section]';
const anchors = new WeakMap<Element, Element>();

type Template = Element & { readonly content: DocumentFragment };
const isTemplate = (element: Element): element is Template => element.localName === 'template' && 'content' in element;
/** Where a template holds its section: its inert content in a browser. A server DOM (linkedom) keeps and serializes a
 * template's own children, and its content shares the page's document, so there the template itself holds it. A browser's
 * template inside another's content shares that inert document too, but that document has no window: its sections go in
 * the content, or the outer query would reach them and they would come into the page as live elements with their parent. */
const holder = (template: Template): ParentNode => template.children.length > 0
  || (template.content.childElementCount === 0 && template.content.ownerDocument === template.ownerDocument && !!template.ownerDocument.defaultView)
  ? template : template.content;

/** Every element matching `selector` under `root`, mounted or waiting in a detached template, in document order. */
export function sectionElements<E extends Element = HTMLElement>(root: ParentNode, selector: string): E[] {
  const found: E[] = [];
  for (const element of root.querySelectorAll<Element>(`${selector}, ${DETACHED}`)) {
    if (!isTemplate(element) || !element.matches(DETACHED)) { if (element.matches(selector)) found.push(element as E); continue; }
    for (const child of [...holder(element).children]) {
      anchors.set(child, element);
      if (child.matches(selector)) found.push(child as E);
      found.push(...sectionElements<E>(child, selector));
    }
  }
  return found;
}

/** Whether a section waits in its own template (it may still sit inside another detached section when shown). */
function waiting(element: Element) {
  const anchor = anchors.get(element);
  return !!anchor && isTemplate(anchor) && (element.parentNode === anchor || element.parentNode === anchor.content);
}

/** Mounts a section in place of its template, or moves it back into one. A section inside a detached parent mounts into
 * that parent, and comes into the page with it. */
export function showSection(element: HTMLElement, shown: boolean) {
  if (shown) {
    const anchor = anchors.get(element);
    if (anchor?.parentNode && waiting(element)) anchor.replaceWith(element);
    if (element.hidden) element.hidden = false;
    return;
  }
  if (!element.hidden) element.hidden = true;
  if (waiting(element) || !element.parentNode) return;
  let anchor = anchors.get(element);
  if (!anchor) {
    anchor = element.ownerDocument.createElement('template');
    anchor.setAttribute('data-detached-section', '');
    anchors.set(element, anchor);
  }
  element.replaceWith(anchor);
  holder(anchor as Template).append(element);
}

/** What stands in the page for a section: the section while mounted, its template while detached. Code that moves a
 * section between cards moves this, so a later `showSection` mounts it where it now belongs. */
export function sectionPlaceholder(element: HTMLElement): Element {
  return waiting(element) ? anchors.get(element)! : element;
}
