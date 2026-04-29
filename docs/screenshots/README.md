# Visual Review Artifacts

Playwright + manual happy-path screenshots produced during change verification
and `/spectra-apply` §visual-iteration steps. Subdirectories are named after
the change they belong to:

```
docs/screenshots/
├── add-canvas-editor-shell/   # M3 editor shell visual review
├── add-auth/                  # M1 auth pages visual review
└── ...
```

## Conventions

- `NN-step.png` — numbered prefixes show order of capture in the flow.
- One folder per Spectra change.
- Screenshots are gitignored (see `.gitignore`); only this README and
  `.gitkeep` files are tracked. Each developer regenerates locally.

## How to regenerate

Bring the dev stack up (`bun run dev:up`) and re-run the relevant Playwright
commands or `/spectra-apply <change>` visual-iteration tasks. Place the PNGs
under `docs/screenshots/<change>/` with the naming convention above.
