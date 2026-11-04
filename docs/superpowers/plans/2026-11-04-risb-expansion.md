# RISB expansion implementation plan

**Goal:** Extend the existing RISB site with 24 self-contained games and a searchable portal, preserving all 116 existing game entries and the existing entrance.

**Architecture:** Static HTML, CSS and ES modules. Keep the Netlify authentication function and landing page unchanged. Replace the menu and game gallery with a shared portal; use a native dialog for games and dispose of frames, timers and listeners on close. Store favourites, recent games and best scores locally with validation and a memory fallback.

**Tech stack:** Browser APIs, dependency-free JavaScript modules, Node's built-in test runner, Playwright for browser verification.

- [x] Extract the existing title, image and URL entries from `lens.html` to `catalog.mjs`; preserve ordering and destinations. Add curated official football, shopping, music, video, learning and utility links, clearly labelled as external.
- [x] Add `games/common.mjs` lifecycle helpers and three independent modules: `arcade.mjs`, `boards.mjs`, `challenges.mjs`. Each exports `games`: `{id,title,category,description,controls,mount(root,context)}`. `mount` returns a cleanup function; `context.recordScore(number)` persists a higher-is-better score. Each game has instructions, restart and keyboard/touch controls where applicable.
- [x] Add rule tests under `tests/` using `node:test` and `node:assert/strict`; verify legal moves, wins, losses, boundaries and cleanup rather than snapshots of implementation.
- [x] Replace `search.html` and `lens.html` with accessible portal shells sharing `portal.css` and `portal.mjs`. Preserve the existing session check. Implement search without accent sensitivity, section/category filters, favourites, recents, random game and a real empty state.
- [x] Implement the native game dialog: labelled close, Escape, focus restoration, opt-in fullscreen, iframe title, external destination link, reload, and actual disposal on close. Do not claim that an iframe load event proves a third-party game is playable.
- [x] Check the rule tests, desktop/mobile browser flows, keyboard navigation, denied storage, local games with external requests blocked, and the external player close/fullscreen lifecycle. Run `git diff --check`.
- [ ] Upload the verified change to a new GitHub branch and open a draft pull request with test evidence and the Netlify authentication limitation. Do not merge or replace the published site as part of preparing the change.

The visual direction is retro arcade: dark violet-black, cyan and magenta, monospaced type, subtle static scanlines and generous readable game cards. Counts are derived from the actual catalog. External providers may require payment, region eligibility or access permission; their availability is not guaranteed by RISB.
