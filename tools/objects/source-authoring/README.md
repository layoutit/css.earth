# Reproduce ellipsoid source tables

These tools read a body's pinned `source/measurements.json`, repeat its original
radius-table calculation, and check the result against `source/manifest.json`.
They write the table to standard output. Run from the repository root:

```sh
node tools/objects/source-authoring/lucy-targets/author.mjs src/planets/polymele/source > /tmp/polymele-ellipsoid.tab
python3 tools/objects/source-authoring/trans-neptunian/author.py src/planets/quaoar/source > /tmp/quaoar-ellipsoid.tab
```

The JavaScript calculation covers Polymele, Leucus, Orus, Eurybates, Patroclus,
Annefrank, Braille, Chariklo and Bienor. The Python calculation covers Quaoar and
`gkunhomdima`. Body-owned measurements retain the scientific assumptions and
citations. Shared acquisition and preparation tools continue to own the rest
of each package.
