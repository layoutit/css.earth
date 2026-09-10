export const SHELL_TITLE_SOURCES = Object.freeze({
  schema: "cssearth-shell-title-sources@1",
  font: Object.freeze({
    source: "Inter Variable 4.001 git-9221beed3",
    sourceUrl: "https://raw.githubusercontent.com/rsms/inter/9221beed3/docs/font-files/InterVariable.ttf",
    sourceSha256: "746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c",
  }),
  recipe: Object.freeze({
    weight: 500,
    fontSize: 17,
    letterSpacing: -0.1,
    baseline: 19,
    viewBoxHeight: 23,
  }),
  titles: Object.freeze([
    Object.freeze({ key: "facts", label: "Factsheet", vectorText: "Factsheet", file: "title-factsheet.svg" }),
    Object.freeze({ key: "reflectance", label: "Reflectance spectrum", vectorText: "Reflectance spectrum", file: "title-reflectance-spectrum.svg" }),
    Object.freeze({ key: "temperaturePressure", label: "Temperature–pressure profile", vectorText: "Temperature–pressure profile", file: "title-thermal-profile.svg" }),
    Object.freeze({ key: "surfacePhotos", label: "Surface photographs", vectorText: "Surface photos", file: "title-surface-photos.svg" }),
    Object.freeze({ key: "resources", label: "Sources & Resources", vectorText: "Sources & Resources", file: "title-sources-resources.svg" }),
    Object.freeze({ key: "lenses", label: "Surface lens", vectorText: "Surface lens", file: "title-surface-lens.svg" }),
    Object.freeze({ key: "settings", label: "Settings", vectorText: "Settings", file: "title-settings.svg" }),
  ]),
});
