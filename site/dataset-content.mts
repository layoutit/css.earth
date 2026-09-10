/** Shared by preparation and the card: dataset identity is separate from UI categories and explanatory copy. */
export interface DatasetText { readonly id: string; readonly title?: string; readonly label?: string; readonly summary?: string; readonly description?: string; }
export function validateDatasetText(lens: DatasetText) {
  const title = lens.title?.trim();
  const description = (lens.summary ?? lens.description)?.trim();
  if (!title || title.length > 120 || /[\r\n]/u.test(title)
      || title.toLocaleLowerCase() === lens.label?.trim().toLocaleLowerCase()
      || title === lens.description?.trim() || title === description) {
    throw new TypeError(`${lens.id}: provide a specific dataset title, separate from its category and description.`);
  }
  if (!description) throw new TypeError(`${lens.id}: provide a dataset description.`);
  return { title, description };
}
