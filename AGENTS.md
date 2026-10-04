Always refactor source code into several smaller files, each under 256 LOC.
Always update this file, then `git commit` and `git push` to
`https://github.com/abdshomad/3d-universe.git` after a task is completed.

## Plans

Every plan lives in `plans/` as `plans/<name>.md`. If a plan grows too big to stay readable and actionable, split it into sub-plans under `plans/<name>/` (`plans/<name>/01-<topic>.md`, `02-<topic>.md`, …), each standing on its own, and keep the parent plan as the index that links to them.

## Inex method

Work the flywheel: `i` → `n`, `n`, `n`… ♾️

- `i` / `init` — deep research into `docs/deep-research/`, PRD into `docs/prd/`, baseline scaffolding.
- `n` / `next` — implement the top `[TODO]` of the active plan; auto-runs `e` when the plan is empty. `n3` runs 3 cycles in one turn.
- `e` / `enhance` — decompose the PRD into 3 tasks per module in `plans/next-enhancements.md`.
- `focus: <dir>` — steer 1 batch at `<dir>` (or edit `plans/focus.md`), then auto-resume the PRD roadmap. `focus: reset` cancels.
- `r` `m` `t` `f` `c` `d` — xtend commands, auto-run after a build: `t`/`f`/`c`/`r` gates, then `m` migrate features, `d` deploy.
- `/loop <interval>` — repeat `n` forever (`/loop 5m`) or capped (`/loop 10m max=6`).
- `/goal <text>` — run a goal until done, e.g. `/goal Run inex continuous loop until Phase 1 done`.
- `/schedule CronExpression="0 9 * * *" Prompt="trigger 'n'"` — run on a schedule.

When the plan is empty, auto-trigger `e`: decompose the next 3 PRD enhancements and continue with `n`.

## Done

- 2026-10-04 — `i` init: deep research, PRD, art direction, reference videos; phase-1 plan split into
  5 sub-plans; grill locked 5 decisions (500 Mpc / DESI tier, simulated fill badged, web + three.js
  WebGPU, interactive atlas + cinematic mode, public web app).