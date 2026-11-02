# Agent instructions

Read README.md and README.ru.md before changing the game. The interface is Russian; documentation is bilingual. Keep both READMEs consistent for version, features, commands, storage/network behavior and limitations.

- Maintained browser sources are in dist/js/, dist/index.html and dist/style.css; dist/ is not disposable output. dist/sw.js maintains the offline asset list and cache version.
- Start a loopback preview with `python3 scripts/serve.py`; run core/offline tests with `node --test tests/*.test.mjs`. No npm installation or build is required. The preview binds to 127.0.0.1 and writes request paths only to its terminal.
- Use fresh test profiles and synthetic data. Do not read or ship credentials, browser profiles, local game journals, personal identifiers or deployment configuration. Do not add network services, analytics or account dependencies as a hidden requirement.
- Preserve puzzle uniqueness, active-time accounting, unlimited mistakes, undo/redo, candidate proofs and local journal persistence. Test changes to hints against the unique solution.
- For browser checks, verify play, lessons, local save/reload, history and a genuine offline reload after the worker is ready. Report browser/emulation/device limits honestly.
- Update the service-worker asset list for added/removed application assets. Change its cache version when shipping changed cached bytes.
- Keep changes focused. Do not deploy, publish, send data, delete user saves or install system services merely to inspect the project. Respect the operator's source-control rules; never initialize Git as an incidental setup step.
- Return the change, checks actually run, remaining limitations and any required user decision. Preserve MIT and reference notices.

## Visual documentation

Keep the README screenshots and covers accurate for this standalone edition. Capture real application states using an isolated browser profile and synthetic data; exclude accounts, personal journals, service addresses, browser chrome and notifications. Preserve image provenance and inspect both pixels and metadata before any authorized upload. Keep English/Russian alt text and captions consistent. A mobile-emulation screenshot is not a physical-device test. Command-line-only components may instead demonstrate their input, exact command and expected output as copyable Markdown.


## Release coordination

After a meaningful, ready change, record the local version, user-visible changes, checks and differences from the last verified published revision, even if the version number did not change. Propose a concrete GitHub update to the maintainer. Agree the release-review cadence per product: a number of ready versions and, when useful, a maximum wait. Do not count individual commits or draft builds as ready versions. Until a cadence is agreed, raise each meaningful ready change for review; discuss security fixes, data-loss risks and a broken primary launch promptly.

Keep a concise pending-change handoff and report whether publication is current, needs review, or has only been prepared. Do not claim the remote state is current without verification. Refresh both README languages, examples and affected real anonymized screenshots when behavior changes. A cadence agreement does not authorize uploads: prepare and verify the exact scope, obtain applicable maintainer authorization, and perform a fresh source-revision and final sensitive-data/metadata review before publishing. Preserve the operator's local Git restrictions. After an authorized update, verify the published revision and close only the changes actually included.
