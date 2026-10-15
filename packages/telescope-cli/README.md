<h1><img src="https://raw.githubusercontent.com/layoutit/css.earth/main/.github/assets/css-earth-wordmark.png" alt="css.earth" width="260"></h1>

**telescope** finds real observations of anything in the sky and turns them into files you can open. One command searches the JWST, Hubble, ESO, ALMA, Keck, Gemini, Chandra and Spitzer archives at once, shows you what exists, and retrieves the one you choose.

It is the command-line telescope behind [css.earth](https://css.earth/) 🔭

Join the community at [chat.polycss.com](https://chat.polycss.com/) 🌎

## Install

Use Node.js 24 (or 22.18+).

```sh
npm i -g @cssearth/telescope
telescope --help
```

Or run it without installing:

```sh
npx @cssearth/telescope explore eris
```

## Quick Start

```sh
telescope explore eris
```

That's it. telescope lists what the archives hold for Eris, and every step ends by printing the next command to run:

1. `explore` shows the observations and saves them.
2. `get` downloads the one you pick.
3. `outputs` asks what to make of it: an image, a spectrum, a map on the body, or a standalone 3D sphere in HTML.

- `--yes` (`-y`) skips terminal consent for large or unknown downloads and first-time Python setup.
- `telescope open [DIRECTORY]` lists saved runs under `./telescope-runs/` (or DIRECTORY), newest first, with observation, downloaded, partial and made counts. Use ↑↓ or Page Up/Down and Enter to reopen the saved explore table without searching; Escape quits. Pipes print plain rows; `--json` prints the run list.

## What You Can Search

- **A name.** Anything [SIMBAD](https://simbad.cds.unistra.fr/simbad/) knows: `M31`, `Betelgeuse`, `HD 209458`. A near-miss such as `betelgeus` suggests `Betelgeuse`.
- **A patch of sky.** `telescope explore --icrs-circle RA,DEC,RADIUS`, in degrees.
- **Only what you need.** Add `--kind image|cube|spectrum|…`, `--instrument`, `--wavelength MIN,MAX` or `--from`/`--to` dates.
- **A class of object.** `telescope leads --class exoplanet`.
- **Stars in a galaxy.** `telescope stars GALAXY`.
- **Papers about a target.** `telescope papers TARGET`.

## How It Works

Some archives are only reachable through Python clients. The first time one is needed, telescope installs a pinned Python environment for it, using micromamba from conda-forge. No system Python is required. Managed Python needs macOS or Linux; on Windows use WSL.

Downloads and results land in `./telescope-runs/` where you run the command; `--out DIR` overrides it. `outputs` saves the complete inspection as `outputs.json` inside the existing run and prints a summary naming `savedPath`; it never creates a new run. `--out` may select an existing subfolder inside that run. Standalone artifacts use their containing folder. Python environments are installed once in the user folder: `~/Library/Caches/cssearth-telescope` on macOS, `~/.cache/cssearth-telescope` on Linux. Set `CSSEARTH_TELESCOPE_HOME` to move that folder. Use `telescope toolchain list` to see installed environments and `telescope toolchain remove NAME` to remove one.

For some instruments, the observatory's own software is run again on the same inputs and the result is checked against the published product.

In an interactive terminal, the main help screen shows a spinning globe and the four core commands. Narrow windows omit
the globe; short windows show one still. Explore shows up to twelve rows per page, reduced to fit the window: ↑↓ scrolls, Page Up/Down pages,
typing searches and Backspace edits. Enter chooses an observation and confirms a download; in make it creates and opens
an output, or opens it again if already made. Escape returns to the list; Escape from the list saves and quits.
Use `q` to quit from make and `--no-open` to disable opening files. `--all` applies to plain output; the interactive
table always scrolls through every saved pick. Screens use stderr; pipes and `--json` keep plain stdout without animation or
prompts. Use `telescope help COMMAND` for details and `telescope help all` for the full reference, including development
commands.

## Agent Skill

The package ships a telescope skill for coding agents. Install it for the host you use:

```sh
telescope skill install --provider claude
telescope skill install --provider codex
```

Other providers: `agents`, `grok`, `agy`, `antigravity`, `cursor`, `opencode`, or `--dest DIRECTORY` for any skills folder.

## Documentation

- [Command reference](https://github.com/layoutit/css.earth/blob/main/docs/telescope-commands.md): every command, path rule and toolchain.
- [css.earth](https://github.com/layoutit/css.earth): the universe this telescope feeds, and how to run it.

## License and Data

telescope is [MIT licensed](https://github.com/layoutit/css.earth/blob/main/LICENSE). Observations you retrieve keep the terms and attribution of the archive that published them.
