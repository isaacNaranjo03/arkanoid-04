# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Goal: an Arkanoid/Breakout clone in plain HTML, CSS and JavaScript (see `readme.md`). **No game code exists yet.** There is no build system, package manager, linter or test suite; the game is meant to run directly in a browser. Do not introduce tooling (npm, bundlers, frameworks) unless a spec calls for it.

The directory is not a git repository yet. The `/spec-impl` workflow below relies on git branches, so it needs `git init` first.

## Workflow: spec-driven development

Features are designed as specs before any code is written. Two skills define the process (their source lives in `.claude/skills/`):

- **`/spec <description>`**: asks clarifying questions, then writes `specs/NN-slug.md` in `Draft` status, following `.claude/skills/spec/template.md`. It also creates `specs/.spec-config.yml` (`AutoCreateBranch: true`) if missing. It never writes code.
- **`/spec-impl <NN-slug>`**: refuses unless the spec's status means "Approved" (only a human changes the status). It creates or switches to branch `spec-NN-slug`, then implements the plan **one step at a time, pausing for diff review after each step**. It never commits automatically and never adds out-of-scope features.

Conventions:
- Spec statuses: `Draft` → `In review` → `Approved` → `Implemented` / `Obsolete`. Use one language for these labels throughout the repo.
- Specs are numbered sequentially with two digits (`01-`, `02-`, …).
- Reply in the language the user writes in.
- When implementing, follow the spec exactly. Raise disagreements as observations; don't silently change the design.

## Assets

Everything is under `assets/assets/`. (`assets/__MACOSX/` and the `.DS_Store` files are leftovers from unzipping and can be ignored.)

- `spritesheet-breakout.png` (559×337): a single atlas holding the paddle, ball, bricks and brick-explosion frames.
- `spritesheet.js`: a ready-made sprite helper that defines globals (no modules), so load it with a plain `<script>` tag before the game script:
  - `SPRITES`: source rects `{sx, sy, sw, sh}` for `paddle`, `ball` and `blocks.<color>` (gray, red, yellow, cyan, magenta, hotpink, green).
  - `EXPLOSION_FRAMES.<color>`: four frames per color. `EXPLOSION_DURATION = 150` (ms). The `gray` entry reuses the red frames.
  - `loadSpritesheet(cb)`: loads the PNG once into an offscreen canvas and queues callbacks until it is ready.
  - `drawSprite(ctx, name, x, y, w, h)`: `name` is `'paddle'`, `'ball'` or `'block_<color>'`. `drawFrame(ctx, frame, x, y, w, h)` draws an explosion frame. Both do nothing until the sheet has loaded.
  - The image path is hardcoded as `'assets/spritesheet-breakout.png'` and resolves **relative to the HTML page**, so the page's location must match (for example, `index.html` placed inside the outer `assets/`), or the path or layout must be adjusted.
- `sounds/ball-bounce.mp3` and `sounds/break-sound.mp3`.

Because the sprites are drawn with `ctx.drawImage`, rendering is expected to use `<canvas>`. Serve the files over a local HTTP server (for example, `npx serve` or `python -m http.server`) rather than opening them with `file://`, which can block asset loading in some browsers.
