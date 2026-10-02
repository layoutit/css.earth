/** The dataset the mounted object shows of each context package it names (a level's sphere, cut open or whole): set while
 * that dataset is shown (scene-datasets.mts), read by whatever draws the package (application-world-resources.mts). A
 * package no mounted object shows is drawn in its default view. */
export const CONTEXT_DATASETS = new Map<string, string>();
