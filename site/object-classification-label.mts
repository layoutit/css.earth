/** A classification as the reader sees it: "Moon" for a satellite, words for hyphens. */
export function objectClassificationLabel(classification: string) {
  const label = classification === "satellite" ? "moon" : classification.replaceAll("-", " ");
  return label[0].toUpperCase() + label.slice(1);
}

/** The body's own label where its catalogue gives one, such as "Brown dwarf", otherwise its classification's. */
export function objectTypeLabel(object: { classification: string; classificationLabel?: string }) {
  return object.classificationLabel ?? objectClassificationLabel(object.classification);
}
