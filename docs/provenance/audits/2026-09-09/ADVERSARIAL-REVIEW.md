# Adversarial review of the documentation proposal

The maintainer asked for clear provenance without overengineering or unnecessary
ceremony. Two independent agents reviewed PR #83 and the changes that moved
detailed results out of READMEs. They then checked the revised instructions.

| Problem found | Change made |
| --- | --- |
| A mandatory JSON report, ten field groups, a second run document and body index repeated existing reports. | Removed. Use an existing report; add an index only when several reports need connecting. |
| Manual dependency lists repeated generated records. | Link existing manifests and reports. Record any missing revision, uncommitted changes or ignored/served file hashes needed to identify the test. |
| SOURCE had to repeat every dataset mapping, and NOTICE updates were required for every change. | Explain meaning and calculations missing from generated records. Update NOTICE when credits or terms change. |
| Fixed size thresholds and unrelated historical cleanup added paperwork. | Explain unusually large additions once. Fix older records needed for the task. |
| Preparation could be called reproduction without comparing against an expected result. | Name the expected inventory before running and compare outputs against it. State any allowed tolerance before comparing. |
| A report's permanent `CURRENT` flag would become misleading. | Keep the tested version and outcome. Explain reuse for a named new version in the maintained evidence note. |
| A hash of processed input could be mistaken for the original download's hash. | Explain conversion steps and say when the original download's identity is unknown. |

Both reviewers confirmed that their findings were addressed. After the
plain-language rewrite, a further check caught two requirements that needed
clearer wording: exact hashes for otherwise unrecorded files, and no pixel-match
claim from images with different sources or framing. Both are explicit in the
[contract](../../CONTRACT.md) and its relevant [examples](../../TEMPLATES.md).

The reviewers checked the instructions. They did not download sources, build
the application or run browser tests. Existing body data and results still need
the checks appropriate to each change.
