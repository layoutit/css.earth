// `@cssearth/bake/objects/content` (Node only): the object-content contract (facts, labels, dataset, legend and gallery
// recipes, the prepared shell payload), the shared dataset vocabulary, dataset steps and prepared legends, and the billboard
// colour of each dataset control, and the legend labels a palette dataset derives from its reported stretch. The content preparer that reads factsheets and writes the payload is `site/build/content/prepare.ts`.
export * from './billboard-colors.ts';
export * from './legend-labels.ts';
export * from './datasets.ts';
export * from './prepare-dataset-labels.ts';
export * from './prepared-dataset-legends.ts';
export * from './types.ts';
