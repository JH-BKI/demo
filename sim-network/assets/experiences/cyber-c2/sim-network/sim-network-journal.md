# Sim-network journal

Scene-specific notes for cyber-c2 / sim-network. Not general app docs (`docs/json-options.md`). Keep runtime JSON free of comments; put authoring knowledge here instead.

---

## [2026-08-08] Layouts index (`layouts/layouts-index.json`)

This file lists maps the sim-network scene can load.
It is **custom scene data** (read by sim-network scripts), not general experience JSON.

### Top level

- `stages` (array, required) — ordered list of stages

### Each stage

- `id` (string, required) — usually matches the map filename without `.json`
- `role` (string, required) — `"tutorial"` or `"office"` today
- `title` (string) — label for UI / authoring
- `url` (string, required) — path to the map JSON under `layouts/`
- `description` (string, optional) — short blurb
- `sequenceFileName` (string, optional) — intro sequence in `animations/` if used (played after stamp via host `playNamedSequence`; replays on Retry / return to tutorial)

### Player behaviour

- Loads this file at scene start (`simNetworkFlow.js`)
- Uses the **first** stage with role `"tutorial"`, then the **first** with role `"office"`
- Extra stages can exist for authoring; they are not chosen unless `role` matches
- Layout chooser UI is parked for a later pass — stages drive the fixed flow today

### Layout editor

- Open / New / Save / Save As manage many map files; shared `kit-parts.json` is never overwritten
- Save / Save As / New upsert the matching stage by `id` (title, role, description, url)
- Map files and `kit-parts.json` are separate; this index only points at maps
- Editor save **preserves** unknown stage fields (e.g. `sequenceFileName`) and other top-level index keys — it only overwrites the editor-owned fields above

### Author edit → play loop

1. Author placements in `layout-editor.html` (parts from `kit-parts.json`)
2. Save writes the map file (e.g. `tutorial-01.json` / `level-01.json`)
3. Stage entry lives in `layouts-index.json` (`role: tutorial | office`), then open sim-network in the player

---

## [2026-08-08] Flow phases (title → tutorial → office)

Local phase helper in `simNetworkFlow.js` (not StateManager):

1. **title** — start screen; Start begins the tutorial
2. **tutorial** — practice map from first `role: "tutorial"` stage; right-side instructions dialog; optional stage intro sequence
3. **office** — full level from first `role: "office"` stage; stamped only after leaving tutorial (Continue)

### After a successful Test

- **Tutorial pass:** Continue (go to office) / Retry tutorial (fresh stamp of same tutorial stage)
- **Office pass:** Retry (fresh office) / Back to title

Layout chooser is parked — flow does not offer a free pick list of every stage yet.

---

## [2026-08-08] Optional `sequenceFileName` per stage

- Set on a stage in `layouts-index.json` (e.g. `"sequenceFileName": "tutorial-01-sequence.json"`)
- File lives under `sim-network/animations/`
- After the map is stamped, flow calls host `playNamedSequence` when the field is present
- Replays when returning to that stage (Retry / return to tutorial), not only on first enter
- Omit the field to skip an intro for that stage

---

## [2026-08-08] `createScene` wait (play-ready)

`sim-network.js` `createScene` awaits `startSimNetworkFlow(...)`, which resolves only after:

- First play assemble has stamped the layout, and
- `model3d` sequence targets exist

So chapter sequencing / named sequences are not racing an empty scene. `createScene` then finishes and logs `playReadyLayoutId` / `aliasCount`.

---

## [2026-08-08] Hand-owned `kit-parts.json`

- Path: `layouts/kit-parts.json`
- Shared by every map; layout editor **never** overwrites it on Save
- Catalog owns part definitions the palette uses (`id`, `path`, and authoring fields such as `kind` / `group` for tabs and behaviour)
- Maps (`tutorial-01.json`, `level-01.json`, …) store placements only; at play/edit time the catalog is joined onto the map in memory

---

## [2026-08-08] Editor index save — preserve unknown fields (fixed)

**Was:** layout-editor `normalizeLayoutsIndex` / `upsertStage` rebuilt stages with only `id`, `role`, `title`, `url`, `description`, which could wipe `sequenceFileName` (and any future stage fields) on Save.

**Now:** upsert merges editor-owned fields into the existing stage object; unknown keys (including `sequenceFileName`) and other top-level index keys are kept. See `src/tools/layout-editor/layouts-index.js`.
---

## [2026-08-08] Tutorial wait-gate continues on live drop only

- **Details**: Sequence wait listens for `event:continue-animation`; the tutorial coach arms a drop goal and fires continue only when the learner completes that drop while the goal is armed (at wait time).

**Implemented:**
- Tutorial coach arms goals from `event:tutorial-arm-goal` and fires continue on a matching live drop
- Removed continue-if-already-done / early-drop credit so placements before the wait do not release the gate
- Arm emit aligned with wait at t=11 in `tutorial-01-sequence.json`
- Wired from partDrop notify + simNetworkFlow init/dispose on tutorial stages

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/sim-network-tutorial-coach.js` — created / simplified (arm + match → continue)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partDrop.js` — modified (notify coach after place)
- `public/assets/experiences/cyber-c2/sim-network/scripts/simNetworkFlow.js` — modified (init/dispose coach)
- `public/assets/experiences/cyber-c2/sim-network/animations/tutorial-01-sequence.json` — modified (arm + wait)

**Notes:**
- Early router placement can sit on the board; learner must drop again after the wait
- Continue-if-already-done shelved until a real use case appears (see reminders)

**Designer confirmation received: 2026-08-08**

---

## [2026-08-08] Timeline HUD control emits (show / hide / ping)

- **Details**: Add timeline emit support to fade in/out or ping 2D HUD elements inside the player frame (`#uiContainer`), similar to annotation control emits. Shared plugin; opted in on sim-network.

**Implemented:**
- Shared `hudControl` plugin listens for `hudControl` emits (`show` / `hide` / `showPing` / `hidePing`)
- Selectors scoped to `#uiContainer` (`#id` = one element; `.class` or compound = all matches)
- Show/hide uses CSS fade (default 250ms, optional `durationMs`); ping toggles existing `btn-ping`
- Timeline emit dialog gained Custom / HUD tabs for authoring
- Opted in on cyber-c2 sim-network only via `scene.plugins`

**Files touched:**
- `src/plugins/hudControl.js` - created (event listener + fade/ping)
- `src/utils/eventConstants.js` - modified (added `HUD_CONTROL`)
- `styles/styles.css` - modified (fade helper classes)
- `public/assets/experiences/cyber-c2/config/cyber-c2.json` - modified (sim-network plugin list)
- `src/tools/timeline-editor/timeline-ui.js` - modified (emit dialog HUD tab)
- `reminders.md` - modified (Phase 2 follow-ups)

**Notes:**
- Seek / chapter nav leaves HUD state alone by design (see reminders for optional reset later)
- Also logged in root `changelog.md`

**Designer confirmation received: 2026-08-08**
---

## [2026-08-08] Tutorial cable wait-gate (router 5,2 to PC 0,1)

- **Details**: After the router drop wait, the sequence arms a cable goal and continues only when the learner connects router (5,2) to desktop-pc (0,1) while the wait is listening (either direction).

**Implemented:**
- Coach goal `cable-router-5-2-pc-0-1` matches live cable endpoints either way
- `partCables` notifies the coach after a successful cable commit
- Sequence arm + wait at t=5.05 right after the drop wait
- Wrong PC (e.g. 2,6) and early cables do not release the gate

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/sim-network-tutorial-coach.js` — modified (cable goal + match)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCables.js` — modified (notify on commit)
- `public/assets/experiences/cyber-c2/sim-network/animations/tutorial-01-sequence.json` — modified (arm + wait)

**Notes:**
- None

**Designer confirmation received: 2026-08-08**
---

## [2026-08-08] Tutorial cable wait-gate (cupboard 5,6 to router 5,2)

- **Details**: After the PC cable wait, the sequence arms a cable goal and continues only when the learner connects `comms-cupboard` (5,6) to `router` (5,2) while the wait is listening (either direction).

**Implemented:**
- Coach goal `cable-comms-5-6-router-5-2`
- Sequence arm + `gate-4` at t=8.05 (re-added after sequence retimes had dropped it)
- Reuses existing `partCables` → coach notify path

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/sim-network-tutorial-coach.js` — modified (new cable goal)
- `public/assets/experiences/cyber-c2/sim-network/animations/tutorial-01-sequence.json` — modified (arm + gate-4)

**Notes:**
- Changelog skipped per designer request

**Designer confirmation received: 2026-08-08**
---

## [2026-08-09] Tutorial look-at goal for reset/home camera

- **Details**: Soft-zone `lookAt` goal using the scene reset/home camera values; sequence arms and waits at t=2.

**Implemented:**
- Coach goal `look-reset-home` with view from cyber-c2 scene camera (alpha -1.5625, beta 1.1516, radius 12, fov 0.9, target [3, 0.5, 3.5])
- Same soft zone as cupboard look (`holdSeconds: 0.01`, default tol)
- Sequence arm + `gate-5` at t=2

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/sim-network-tutorial-coach.js` — modified (new lookAt goal)
- `public/assets/experiences/cyber-c2/sim-network/animations/tutorial-01-sequence.json` — modified (arm + gate-5)

**Notes:**
- Changelog skipped per designer request
- Soft zone still matches on alpha + target only (beta/radius/fov stored but not used for match)

**Designer confirmation received: 2026-08-09**
---

## [2026-08-09] Tutorial double-click cell (3,3) wait-gate

- **Details**: Sequence arms a cell double-click goal; continue only when the learner double-clicks (3,3) while the wait is listening. Camera focus on double-click is unchanged.

**Implemented:**
- Coach goal `dblclick-cell-3-3` (`type: cellDoubleClick`)
- `partCellInspector` notifies the coach on double-click (still calls `focusSimNetworkCell`)
- Sequence arm + `gate-6` at t=4

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/sim-network-tutorial-coach.js` — modified (cellDoubleClick goal + match)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellInspector.js` — modified (notify on double-click)
- `public/assets/experiences/cyber-c2/sim-network/animations/tutorial-01-sequence.json` — modified (arm + gate-6)

**Notes:**
- Changelog skipped per designer request

**Designer confirmation received: 2026-08-09**
---

## [2026-08-09] Tutorial network-test Try again wait-gate

- **Details**: Continue the sequence when the learner clicks Try again on a failed network test dialog while that goal is armed.

**Implemented:**
- Coach goal `network-test-try-again` (`type: networkTestTryAgain`)
- Fail dialog Try again in `partCables` notifies the coach (success footer buttons unchanged)
- Sequence arm + `gate-7` at t=2

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/sim-network-tutorial-coach.js` — modified (new goal + match)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCables.js` — modified (notify on Try again)
- `public/assets/experiences/cyber-c2/sim-network/animations/tutorial-01-sequence.json` — modified (arm + gate-7)

**Notes:**
- Changelog skipped per designer request

**Designer confirmation received: 2026-08-09**
---

## [2026-08-09] Test cable-flow particles (Phase 1)

- **Details**: On Test, show evenly spaced blue packets along connected cables (Cupboard→Router first, then fan-out); loop until Try again / Retry / title / dialog close; clear immediately on exit.

**Implemented:**
- New `partCableFlowFx.js` shared conveyor particle system along live cable paths (Wave A then Wave B)
- Host API exposes `ParticleSystem`, `Texture`, and `Color4` for experience scripts
- Wired start/clear from network test and result-dialog exit paths in `partCables.js`
- Babylon flare texture + ADD blend; 8 packets; cable glow left enabled after Experiment C

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCableFlowFx.js` — created (shared path particle streams)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCables.js` — modified (Test wiring; glow restore)
- `src/core/experienceHostApi.js` — modified (expose particle helpers)
- `reminders.md` — modified (mesh/draw-call follow-up)

**Notes:**
- Deviations: emitRate bursts → conveyor; Pass A (8 packets); Pass B (one shared system)
- Bugs: stale load; updateSpeed clump; STANDARD blend looked like black quads (reverted to ADD)
- Office rotate lag attributed mainly to scene/cables/layout cost, not particles (separate perf investigation next)

**Designer confirmation received: 2026-08-09**
---

## [2026-08-09] Green cell hover particles (Phase 2.1)

- **Details**: Replace explore green cell wash + black/white dashed outline with green floor sparkle + edge-ring particles. Hover full strength; sticky select lighter; both when cells differ; tools hide green (purple/blue later).

**Implemented:**
- New `partCellHoverFx.js` with hover + selected particle slots (floor box emitter + square edge conveyor)
- `partCellHighlight.js` drives FX; removed ground fill and dashed outlines; kept purple mesh overlay + hand cursor
- Same-cell hover/select uses hover strength only (no double stack)

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellHoverFx.js` — created (green sparkle + ring)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellHighlight.js` — modified (remove wash/outline; wire FX)
- `reminders.md` — modified (Phase 2 split into 2.1 / 2.2 / 2.3)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- Visual polish pass requested before Phase 2.2 / 2.3

**Designer confirmation received: 2026-08-09**
---

## [2026-08-10] Selected orb cleanup + hover wash/outline polish

- **Details**: Kill leftover selected middle particles on cell change and shorten lifetime; add subtle hover wash (0.22) and a second inner hover outline (~10% inset); leave selected wash alone.

**Implemented:**
- Selected orbs: `stop` / `reset` / `start` when the selected cell changes, plus shorter lifetime (`0.35–1.8s`)
- Hover: soft green wash at alpha `0.22` plus outer and inner `CreateLines` rings (inner at ×0.9)
- Selected wash brightness and outline left unchanged

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellHoverFx.js` — modified (orb clear + lifetime)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellHighlight.js` — modified (hover wash + double outline)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)

**Designer confirmation received: 2026-08-10**
---

## [2026-08-10] Sim-network office perf — Blender wall/furniture content win

- **Details**: After hide-layer A/Bs showed walls (~−1160 draws) and furniture (~−730) as the big cost, designer optimized wall and furniture GLBs in Blender. Office dropped from ~1700 draws / ~9–10 ms to ~491 draws / ~3.7 ms idle.

**Implemented:**
- Top wall GLBs: joined meshes, backface cull, fewer materials (glass removed on window walls)
- Bookshelf and other furniture GLBs optimized the same way
- Hide-layer A/Bs finished (`EXPERIMENT_HIDE_LAYER = null` again) — floors ~−280, walls ~−1160, furniture ~−730 vs prior ~1700-draw baseline
- Runtime L2 wall merge tried then left **off** (`MERGE_LAYER2_WALL_STAMPS = false`) — multi-material still meant multi draws; Blender cleanup was the real win
- Keepers from measure-first slice still in place: L1–L3 unpickable, stamp-bounds cell hover, temp `SimNetworkPerf` probe

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/3D/environment/` — modified (optimized wall / furniture GLBs)
- `public/assets/experiences/cyber-c2/sim-network/scripts/layoutAssembler.js` — modified (hide-layer + wall-merge experiment flags; merge left off)
- `public/assets/experiences/cyber-c2/sim-network/scripts/simNetworkPerfProbe.js` — kept (temp sampler still wired)
- `src/core/experienceHostApi.js` — modified (host helpers for assemble / probe path)

**Notes:**
- Rotate idle now ~512 draws / ~3.5 ms on the measured desktop pass
- Quest ~90 FPS still not claimed — more headroom may still be needed
- Probe should be removed or gated before ship; floor thin-instances parked as optional next cut (~−280 draws)
- Also logged in root `changelog.md` and `reminders.md`

**Designer confirmation received: 2026-08-10**
---

## [2026-08-10] Sim-network office perf — Blender wall/furniture content win

- **Details**: After hide-layer A/Bs showed walls (~−1160 draws) and furniture (~−730) as the big cost, designer optimized wall and furniture GLBs in Blender. Office dropped from ~1700 draws / ~9–10 ms to ~491 draws / ~3.7 ms idle.

**Implemented:**
- Top wall GLBs: joined meshes, backface cull, fewer materials (glass removed on window walls)
- Bookshelf and other furniture GLBs optimized the same way
- Hide-layer A/Bs finished (`EXPERIMENT_HIDE_LAYER = null` again) — floors ~−280, walls ~−1160, furniture ~−730 vs prior ~1700-draw baseline
- Runtime L2 wall merge tried then left **off** (`MERGE_LAYER2_WALL_STAMPS = false`) — multi-material still meant multi draws; Blender cleanup was the real win
- Keepers from measure-first slice still in place: L1–L3 unpickable, stamp-bounds cell hover, temp `SimNetworkPerf` probe

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/3D/environment/` — modified (optimized wall / furniture GLBs)
- `public/assets/experiences/cyber-c2/sim-network/scripts/layoutAssembler.js` — modified (hide-layer + wall-merge experiment flags; merge left off)
- `public/assets/experiences/cyber-c2/sim-network/scripts/simNetworkPerfProbe.js` — kept (temp sampler still wired)
- `src/core/experienceHostApi.js` — modified (host helpers for assemble / probe path)

**Notes:**
- Rotate idle now ~512 draws / ~3.5 ms on the measured desktop pass
- Quest ~90 FPS still not claimed — more headroom may still be needed
- Probe should be removed or gated before ship; floor thin-instances parked as optional next cut (~−280 draws)
- Also logged in root `changelog.md` and `reminders.md`

**Designer confirmation received: 2026-08-10**
---

## [2026-08-10] Purple droppable cell FX (Phase 2.2)

- **Details**: While a Droppable part is selected, use the same polished cell FX as green explore, recoloured purple (allowed) or red (blocked). Replace old purple wash + black/white dashes. Blocked click = toast only (no sticky). Successful place exits tool → green explore sticky select.

**Implemented:**
- Theme colours on particles (`green` / `purple` / `red`) in `partCellHoverFx.js`
- Matching wash + outline chrome themes in `partCellHighlight.js`
- Droppable hover drives FX via `sim-network-droppable-cell-fx` event (avoids import cycle)
- Old `partDrop` hover/selected wash + dashed outlines left disabled; ghost / no-drop icon unchanged
- Cable tool still hides cell FX (Phase 2.3)

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellHoverFx.js` — modified (theme colours)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellHighlight.js` — modified (chrome themes + droppable event)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partDrop.js` — modified (drive purple/red FX; no sticky on blocked)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- `reminders.md` updated: 2.2 done; 2.3 still open

**Designer confirmation received: 2026-08-10**
---

## [2026-08-10] Blue cable cell FX (Phase 2.3)

- **Details**: Cable mode uses the same polished cell FX as green/purple, in light-blue. Path overlay cells are soft blue wash only (no black/white dashes). Click+click first device shows blue selected look (bright wash + middle orbs + bars).

**Implemented:**
- `blue` theme on particles + wash/outline chrome (`CABLE_RGB_LIGHT`)
- Cable hover via `sim-network-cable-cell-fx` event; old hover tile left disabled
- Path overlay: removed dashed checker borders; wash-only tiles for drag path
- Click+click start: blue selected FX on first-device cell; cleared on cancel/commit/exit
- Green explore + purple/red droppable unchanged

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellHoverFx.js` — modified (blue theme)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCellHighlight.js` — modified (cable hover + selected FX)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCables.js` — modified (drive FX; path wash only)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- `reminders.md` updated: Phase 2 cell hover (2.1–2.3) complete

**Designer confirmation received: 2026-08-10**
---

## [2026-08-25] Difficulty screen flow (StateManager + difficulties[])

- **Details**: Replace the old title → tutorial → office phase helper with five screen states and data-driven difficulty tracks (easy / med / hard), so splash, instructions, level select, play, and complete can each init and clean up cleanly.

**Implemented:**
- Host API exposes `StateManager` for public experience scripts
- Flow screens: splash → instructions → levelSelect → play → complete (full-panel HTML overlays in `#uiContainer`)
- Canvas hidden on HTML screens; shown only during play
- `layouts-index.json` uses `difficulties[].maps[]` (kind: tutorial | level); each map belongs to one difficulty
- Unlock order easy → med → hard; session progress only (resets on reload)
- Empty tracks stay locked / “Coming soon” until maps exist
- Layout editor Save/Open writes Difficulty + Kind into `difficulties[]` (no more stages/role as source of truth)
- Test pass footer is Retry + Continue; flow advances map or returns to level select
- Easy path designer-confirmed; Med/Hard maps authored by designer (no temp URL remaps)

**Files touched:**
- `src/core/experienceHostApi.js` — modified (expose StateManager)
- `src/tools/layout-editor/editor-config.js` — modified (difficulty + kind lists)
- `src/tools/layout-editor/editor-ui.js` — modified (Difficulty / Kind fields)
- `src/tools/layout-editor/layout-loader.js` — modified (load map meta from difficulties)
- `src/tools/layout-editor/layout-saver.js` — modified (upsert into difficulties)
- `src/tools/layout-editor/layouts-index.js` — modified (difficulties helpers)
- `public/assets/experiences/cyber-c2/sim-network/scripts/simNetworkFlow.js` — modified (StateManager flow)
- `public/assets/experiences/cyber-c2/sim-network/scripts/simNetworkScreens.js` — created (HTML panels)
- `public/assets/experiences/cyber-c2/sim-network/scripts/sim-network.js` — modified (boot waits for splash ready)
- `public/assets/experiences/cyber-c2/sim-network/scripts/partCables.js` — modified (Continue for all maps)
- `public/assets/experiences/cyber-c2/sim-network/styles/sim-network.css` — modified (overlay styles)
- `public/assets/experiences/cyber-c2/sim-network/layouts/layouts-index.json` — modified (difficulties schema)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- Footer HUD visibility on HTML screens deferred to Phase 2
- Experience assets under `public/assets/experiences/` are gitignored

**Designer confirmation received: 2026-08-25**
---

## [2026-08-25] Splash + instructions foreground screens redesign

- **Details**: Redesign the splash and instructions HTML screens to use splash-style white rounded panels on the shared teal animated backdrop (gate → photo splash; 60/40 instructions layout).

**Implemented:**
- Two-step splash: small gate card (“Press/click anywhere to begin”) → large photo panel (`splash-full.jpg`) with logo fade-in + white strip / START
- Main splash panel scales to ~80% of the player frame; title logo ~60% of frame width
- Instructions: left photo panel (`manager-full.jpg`, ~60%) + right how-to card (~40%) with existing copy and Continue
- How-to card height fits content and sits vertically centered on the middle-right
- Shared overlay shell (backdrop + content) unchanged as the mount point

**Files touched:**
- `public/assets/experiences/cyber-c2/sim-network/scripts/simNetworkScreens.js` — modified (splash + instructions markup/flow)
- `public/assets/experiences/cyber-c2/sim-network/styles/sim-network.css` — modified (splash + instructions panel styles)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- Music autoplay left as-is (not tied to gate click)

**Designer confirmation received: 2026-08-25**
---
