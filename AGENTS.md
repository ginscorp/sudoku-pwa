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
