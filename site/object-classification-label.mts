/** A classification as the reader sees it: "Moon" for a satellite, words for hyphens. */
export function objectClassificationLabel(classification: string) {
  const label = classification === "satellite" ? "moon" : classification.replaceAll("-", " ");
  return label[0].toUpperCase() + label.slice(1);
}
