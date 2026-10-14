---
name: telescope
description: Use whenever the user wants to find, download or view real telescope observations of a sky object or position, or find related papers and simulations, instead of searching archive websites by hand. Triggers on telescope images, archive observations, FITS data, sky coordinates, ESO, ALMA, MAST, JWST, Hubble, Gemini, Keck, Chandra and Spitzer.
---

# Telescope

Use `@cssearth/telescope` for archive discovery, qualified retrieval and local offline HTML. It needs Node 22.18 or Node 24+. Install it before linking the skill; a link needs the installed package to stay in place.

## Find, retrieve, inspect, export

Use `--json` for agent calls: stdout contains JSON, progress goes to stderr, and there are no interactive prompts. Run `telescope --help` for the core flow and `telescope help COMMAND` for flags. Explore returns `cssearth-telescope-explore-summary@1`: counts, immutable picks and `savedPath`; the complete record stays on disk. Write stdout to a summary file or parse it directly. Query saved evidence with `jq` only for the fields you need. Lookups print complete JSON unless --out saves their record. Outputs saves the complete inspection as `outputs.json` inside the existing run and prints a summary naming `savedPath`; it never creates a new run. `--out` may select an existing subfolder inside that run. Get names `resultPath` and includes `download: { bytes, archive, destination }`.

```sh
npm install -g @cssearth/telescope
telescope --help
telescope explore eris --out ./eris-observations --json > ./eris-summary.json
jq '{outcome, choices, savedPath}' ./eris-summary.json
jq '.choices[] | select(.pick == 1) | {pick, reason, limitations}' ./eris-observations/explore.json
telescope get ./eris-observations --pick 1 --json > ./eris-get-summary.json
jq '{context, facts}' ./eris-observations/pick-1/result.json
telescope outputs ./eris-observations/pick-1/result.json --json
telescope export ./eris-observations/pick-1/result.json --output image --hdu 0 --out ./eris-image --json
telescope export ./eris-image/output.product.json --output html --out ./eris-viewer --json
```

This is an image example. Choose the saved observation's actual `pick`; inspect `outputs` before exporting and use its available operation, HDU and required inputs. Do not assume pick 1 is an image or that HDU 0 holds science data. Export directories must be new. Open the reported HTML file locally; it needs no viewer server.

- Explore filters: `--instrument NAME`, `--family F01..F18`, `--kind KIND`, `--wavelength MIN,MAX` in micrometres, and `--from ISO --to ISO`. `--fresh` bypasses answers cached for a day.
- Position only: `telescope explore --icrs-circle 83.82,-5.39,0.1 --out ./orion-field --json`. RA, declination and radius are ICRS degrees. Results are in the field, not attributed to a named target. Name-only archives are skipped. With a target, the circle also requests a cutout.
- Saved choices are immutable. Get revalidates the exact identity and writes data and evidence under `pick-N/`. `get --offline` reuses a verified delivery; it cannot download missing bytes.
- Image/cube outputs use zero-based HDU, plane and pixel indices. A cube image needs `--plane N`; a pixel spectrum needs `--pixel X,Y`. Follow `outputs` for available spectra, band images, maps, spheres, points and volumes. HTML accepts qualified image/spectrum product records and supported prepared spatial objects. Composite volume kinds remain unsupported in this release.

## Read the evidence

`outcome.selection` (`available` or `none`) and `outcome.coverage` are separate. `bounded` means the configured search completed within its bounds, not that every archive was searched. `incomplete` means a provider failed, overflowed or could not be read; selectable observations can still exist. `target-unresolved` means target discovery did not establish a target. Observations needing workspace program or ledger writes are listed as unsupported without a workspace and say `needs a css.earth checkout: pass --workspace`. Other unsupported observations or operations have no implemented retrieval/export route: retain the reason rather than guessing one. Use `--verbose` and the saved JSON for full diagnostics. No choices never proves no observation exists.

Exit codes: **0** completed exploration/retrieval or fulfilled request; **1** operation failed; **2** invalid arguments; **3** no retrievable choice or unresolved request; **4** refused request. A successful exploration is not scientific acceptance. Preserve the request verdict and limitations through export. Fix provider errors and explore into a new directory instead of changing saved choices.

## Papers, simulations and setup

`telescope papers eris --about imaging --json` finds related literature; `telescope simulations eris --json` lists model dataset leads without downloading them. Read a simulation's paper, license and assumptions before treating it as evidence; a lead is not an observation.

Get and fetch print size and destination before transferring science bytes. In a terminal, downloads of at least 100 MB or unknown size ask `Continue? [Y/n]`; Enter proceeds and `n` cancels. `--yes` (`-y`) skips this question and the first implicit Python setup consent. `--json` and redirected stdin/stdout proceed without prompts. Downloads and run-owned JSON stay in `./telescope-runs/<target>-<timestamp>/` where the command runs, or in `--out DIR`. Field runs use `field-<ra>-<dec>-<timestamp>`. `get RUN --pick N` downloads once into `RUN/pick-N/` and reuses it on retry; `--out DIR` chooses another run folder. Plain lookups without `--out` write nothing. A read-only working folder fails before network work.

No separate Python install is needed. The first operation needing a managed toolchain downloads pinned micromamba, Python and conda-forge packages into the user root’s `toolchains/` folder; the CLI names the packages, approximate size and folder and asks first in a terminal (explicit `toolchain install` does not ask). This can cost hundreds of MB and needs network access. Explore also searches Python-free archives, which remain available when the managed Python environment cannot be installed. The astronomy environment builds orbitize and batman from source and needs a working C compiler and C standard-library headers; macOS also needs its SDK. Install these with `xcode-select --install` on macOS, `sudo apt install build-essential` on Debian/Ubuntu, or `sudo dnf install gcc` on Fedora. The installer checks them before creating an environment. Use `telescope toolchain list [--json]` for installed environments, size on disk and folders; `telescope toolchain remove NAME [--json]` deletes one managed environment inside `toolchains/`, refusing links, outside paths and active install locks. Legacy installs are listed but removal is refused. Use `telescope toolchain install astroquery` for explicit setup and `telescope toolchain verify astroquery` to verify it. `CSSEARTH_TELESCOPE_HOME` selects the cache root; an existing micromamba on PATH or `CSSEARTH_TELESCOPE_MICROMAMBA` is used when supplied. Offline setup fails if the toolchain is missing. Some reduction routes also require native tools; follow the CLI's named prerequisite errors.

Windows managed toolchains are unsupported in this release: use WSL. Skill installation can use `--copy` where directory symlinks are unavailable.

## css.earth development

Standalone HTML is the default delivery. Site authoring requires a checkout selected with `--workspace /path/to/css.earth` or `CSSEARTH_WORKSPACE`; a source entry launched inside its own checkout also selects it. Every `new-object` mode and volume preparation requires that workspace; do not fabricate body records from an unqualified archive lead.

First draft with `telescope --workspace /path/to/css.earth new-object --from-ROUTE NAME --out SPEC.json --json`, choosing a route from `--help`. Drafters write the requested spec and may cache source inputs, but do not write site records. Review `SPEC.json`, its citations and missing values with the user before generation.

Get the user's go-ahead before running any generation, refresh or bake mode: each writes into the checkout. `telescope --workspace /path/to/css.earth new-object SPEC.json --check --json` writes package records, then runs the bake's first steps through page data; it is not a dry run. With `--bake` instead, it writes and runs the full bake. Without either flag, generation still writes records. Existing-object bake mode writes prepared assets. Picture, map and corona specs also write records; their partial-check flag does not run preparation. Choose the intended mode before running it; a second generation of an existing package requires the refresh flow.
