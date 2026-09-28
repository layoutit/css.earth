// `@cssearth/bake/contract` (Node only): the checked object runtime definition preparation writes and tests read back,
// with its prepared resource catalogue, validated against the prepared-presentation contract and the renderer's object
// controls, and the audits that read a prepared presentation and its authored runtime sources back against the descriptor. It
// pins a prepared object to its transport (payload, page metadata, descriptor pin and inventory), and re-publishes a body's
// authored facts into its prepared content without rebaking it (`prepare-factsheets.ts`). It imports `presentation`,
// `runtime-source`, `sources` and `delivery`.
export * from './check-prepared-presentation.ts';
export * from './object-runtime-contract.ts';
export * from './prepared-object-pin.ts';
export * from './prepared-object-source.ts';
export * from './prepare-factsheets.ts';
