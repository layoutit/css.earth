# Reconstruction package

- Own scientific registration, evidence extraction and fitting algorithms. Depend on `@cssearth/bake/volume` and explicitly declared scientific dependencies only.
- Never import the lab application, viewer, `@cssearth/bake/volume/node` or application renderer. Keep acquisition and request orchestration outside pure methods.
- Preserve numerical operation order, coordinate conventions, accepted results and scientific limitations during relocation. Update implementation fingerprint inventories when owners move.
- Use explicit subpath exports, strict TypeScript and a maximum of 600 physical lines per source file.
- Keep methods object-agnostic. Recipes and evidence identify targets; no object-specific branches or repository path assumptions belong here.
- Validate external values at the boundary. Host adapters enforce their filesystem policies; core validators retain schema and relative-path safety.
- Test only affected numerical methods and direct consumers during iteration. Never rebake unrelated datasets or restart the user's lab.
