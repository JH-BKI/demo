# Sim-network journal

Scene-specific notes for cyber-c2 / sim-network. Not general app docs (`docs/json-options.md`). Keep runtime JSON free of comments; put authoring knowledge here instead.

---

## [2026-08-08] Layouts index (`layouts/layouts-index.json`)

This file lists maps the sim-network scene can load.
It is **custom scene data** (read by sim-network scripts), not general experience JSON.

### Top level

- `stages` (array, required) ? ordered list of stages

### Each stage

- `id` (string, required) ? usually matches the map filename without `.json`
- `role` (string, required) ? `"tutorial"` or `"office"` today
- `title` (string) ? label for UI / authoring
- `url` (string, required) ? path to the map JSON under `layouts/`
- `description` (string, optional) ? short blurb
- `sequenceFileName` (string, optional) ? intro sequence in `animations/` if used (played after stamp via host `playNamedSequence`; replays on Retry / return to tutorial)

### Player behaviour

- Loads this file at scene start (`simNetworkFlow.js`)
- Uses the **first** stage with role `"tutorial"`, then the **first** with role `"office"`
- Extra stages can exist for authoring; they are not chosen unless `role` matches
- Layout chooser UI is parked for a later pass ? stages drive the fixed flow today

### Layout editor

- Open / New / Save / Save As manage many map files; shared `kit-parts.json` is never overwritten
- Save / Save As / New upsert the matching stage by `id` (title, role, description, url)
- Map files and `kit-parts.json` are separate; this index only points at maps
- Editor save **preserves** unknown stage fields (e.g. `sequenceFileName`) and other top-level index keys ? it only overwrites the editor-owned fields above

### Author edit ? play loop

1. Author placements in `layout-editor.html` (parts from `kit-parts.json`)
2. Save writes the map file (e.g. `tutorial-01.json` / `level-01.json`)
3. Stage entry lives in `layouts-index.json` (`role: tutorial | office`), then open sim-network in the player

---

## [2026-08-08] Flow phases (title ? tutorial ? office)

Local phase helper in `simNetworkFlow.js` (not StateManager):

1. **title** ? start screen; Start begins the tutorial
2. **tutorial** ? practice map from first `role: "tutorial"` stage; right-side instructions dialog; optional stage intro sequence
3. **office** ? full level from first `role: "office"` stage; stamped only after leaving tutorial (Continue)

### After a successful Test

- **Tutorial pass:** Continue (go to office) / Retry tutorial (fresh stamp of same tutorial stage)
- **Office pass:** Retry (fresh office) / Back to title

Layout chooser is parked ? flow does not offer a free pick list of every stage yet.

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
- Maps (`tutorial-01.json`, `level-01.json`, ?) store placements only; at play/edit time the catalog is joined onto the map in memory

---

## [2026-08-08] Editor index save ? preserve unknown fields (fixed)

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
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-coach.js` ? created / simplified (arm + match ? continue)
- `public/assets/experiences/sim-network/scripts/partDrop.js` ? modified (notify coach after place)
- `public/assets/experiences/sim-network/scripts/simNetworkFlow.js` ? modified (init/dispose coach)
- `public/assets/experiences/sim-network/animations/tutorial-01-sequence.json` ? modified (arm + wait)

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
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-coach.js` ? modified (cable goal + match)
- `public/assets/experiences/sim-network/scripts/partCables.js` ? modified (notify on commit)
- `public/assets/experiences/sim-network/animations/tutorial-01-sequence.json` ? modified (arm + wait)

**Notes:**
- None

**Designer confirmation received: 2026-08-08**
---

## [2026-08-08] Tutorial cable wait-gate (cupboard 5,6 to router 5,2)

- **Details**: After the PC cable wait, the sequence arms a cable goal and continues only when the learner connects `comms-cupboard` (5,6) to `router` (5,2) while the wait is listening (either direction).

**Implemented:**
- Coach goal `cable-comms-5-6-router-5-2`
- Sequence arm + `gate-4` at t=8.05 (re-added after sequence retimes had dropped it)
- Reuses existing `partCables` ? coach notify path

**Files touched:**
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-coach.js` ? modified (new cable goal)
- `public/assets/experiences/sim-network/animations/tutorial-01-sequence.json` ? modified (arm + gate-4)

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
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-coach.js` ? modified (new lookAt goal)
- `public/assets/experiences/sim-network/animations/tutorial-01-sequence.json` ? modified (arm + gate-5)

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
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-coach.js` ? modified (cellDoubleClick goal + match)
- `public/assets/experiences/sim-network/scripts/partCellInspector.js` ? modified (notify on double-click)
- `public/assets/experiences/sim-network/animations/tutorial-01-sequence.json` ? modified (arm + gate-6)

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
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-coach.js` ? modified (new goal + match)
- `public/assets/experiences/sim-network/scripts/partCables.js` ? modified (notify on Try again)
- `public/assets/experiences/sim-network/animations/tutorial-01-sequence.json` ? modified (arm + gate-7)

**Notes:**
- Changelog skipped per designer request

**Designer confirmation received: 2026-08-09**
---

## [2026-08-09] Test cable-flow particles (Phase 1)

- **Details**: On Test, show evenly spaced blue packets along connected cables (Cupboard?Router first, then fan-out); loop until Try again / Retry / title / dialog close; clear immediately on exit.

**Implemented:**
- New `partCableFlowFx.js` shared conveyor particle system along live cable paths (Wave A then Wave B)
- Host API exposes `ParticleSystem`, `Texture`, and `Color4` for experience scripts
- Wired start/clear from network test and result-dialog exit paths in `partCables.js`
- Babylon flare texture + ADD blend; 8 packets; cable glow left enabled after Experiment C

**Files touched:**
- `public/assets/experiences/sim-network/scripts/partCableFlowFx.js` ? created (shared path particle streams)
- `public/assets/experiences/sim-network/scripts/partCables.js` ? modified (Test wiring; glow restore)
- `src/core/experienceHostApi.js` ? modified (expose particle helpers)
- `reminders.md` ? modified (mesh/draw-call follow-up)

**Notes:**
- Deviations: emitRate bursts ? conveyor; Pass A (8 packets); Pass B (one shared system)
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
- `public/assets/experiences/sim-network/scripts/partCellHoverFx.js` ? created (green sparkle + ring)
- `public/assets/experiences/sim-network/scripts/partCellHighlight.js` ? modified (remove wash/outline; wire FX)
- `reminders.md` ? modified (Phase 2 split into 2.1 / 2.2 / 2.3)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- Visual polish pass requested before Phase 2.2 / 2.3

**Designer confirmation received: 2026-08-09**
---

## [2026-08-10] Selected orb cleanup + hover wash/outline polish

- **Details**: Kill leftover selected middle particles on cell change and shorten lifetime; add subtle hover wash (0.22) and a second inner hover outline (~10% inset); leave selected wash alone.

**Implemented:**
- Selected orbs: `stop` / `reset` / `start` when the selected cell changes, plus shorter lifetime (`0.35?1.8s`)
- Hover: soft green wash at alpha `0.22` plus outer and inner `CreateLines` rings (inner at ?0.9)
- Selected wash brightness and outline left unchanged

**Files touched:**
- `public/assets/experiences/sim-network/scripts/partCellHoverFx.js` ? modified (orb clear + lifetime)
- `public/assets/experiences/sim-network/scripts/partCellHighlight.js` ? modified (hover wash + double outline)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)

**Designer confirmation received: 2026-08-10**
---

## [2026-08-10] Sim-network office perf ? Blender wall/furniture content win

- **Details**: After hide-layer A/Bs showed walls (~?1160 draws) and furniture (~?730) as the big cost, designer optimized wall and furniture GLBs in Blender. Office dropped from ~1700 draws / ~9?10 ms to ~491 draws / ~3.7 ms idle.

**Implemented:**
- Top wall GLBs: joined meshes, backface cull, fewer materials (glass removed on window walls)
- Bookshelf and other furniture GLBs optimized the same way
- Hide-layer A/Bs finished (`EXPERIMENT_HIDE_LAYER = null` again) ? floors ~?280, walls ~?1160, furniture ~?730 vs prior ~1700-draw baseline
- Runtime L2 wall merge tried then left **off** (`MERGE_LAYER2_WALL_STAMPS = false`) ? multi-material still meant multi draws; Blender cleanup was the real win
- Keepers from measure-first slice still in place: L1?L3 unpickable, stamp-bounds cell hover, temp `SimNetworkPerf` probe

**Files touched:**
- `public/assets/experiences/sim-network/3D/environment/` ? modified (optimized wall / furniture GLBs)
- `public/assets/experiences/sim-network/scripts/layoutAssembler.js` ? modified (hide-layer + wall-merge experiment flags; merge left off)
- `public/assets/experiences/sim-network/scripts/simNetworkPerfProbe.js` ? kept (temp sampler still wired)
- `src/core/experienceHostApi.js` ? modified (host helpers for assemble / probe path)

**Notes:**
- Rotate idle now ~512 draws / ~3.5 ms on the measured desktop pass
- Quest ~90 FPS still not claimed ? more headroom may still be needed
- Probe should be removed or gated before ship; floor thin-instances parked as optional next cut (~?280 draws)
- Also logged in root `changelog.md` and `reminders.md`

**Designer confirmation received: 2026-08-10**
---

## [2026-08-10] Sim-network office perf ? Blender wall/furniture content win

- **Details**: After hide-layer A/Bs showed walls (~?1160 draws) and furniture (~?730) as the big cost, designer optimized wall and furniture GLBs in Blender. Office dropped from ~1700 draws / ~9?10 ms to ~491 draws / ~3.7 ms idle.

**Implemented:**
- Top wall GLBs: joined meshes, backface cull, fewer materials (glass removed on window walls)
- Bookshelf and other furniture GLBs optimized the same way
- Hide-layer A/Bs finished (`EXPERIMENT_HIDE_LAYER = null` again) ? floors ~?280, walls ~?1160, furniture ~?730 vs prior ~1700-draw baseline
- Runtime L2 wall merge tried then left **off** (`MERGE_LAYER2_WALL_STAMPS = false`) ? multi-material still meant multi draws; Blender cleanup was the real win
- Keepers from measure-first slice still in place: L1?L3 unpickable, stamp-bounds cell hover, temp `SimNetworkPerf` probe

**Files touched:**
- `public/assets/experiences/sim-network/3D/environment/` ? modified (optimized wall / furniture GLBs)
- `public/assets/experiences/sim-network/scripts/layoutAssembler.js` ? modified (hide-layer + wall-merge experiment flags; merge left off)
- `public/assets/experiences/sim-network/scripts/simNetworkPerfProbe.js` ? kept (temp sampler still wired)
- `src/core/experienceHostApi.js` ? modified (host helpers for assemble / probe path)

**Notes:**
- Rotate idle now ~512 draws / ~3.5 ms on the measured desktop pass
- Quest ~90 FPS still not claimed ? more headroom may still be needed
- Probe should be removed or gated before ship; floor thin-instances parked as optional next cut (~?280 draws)
- Also logged in root `changelog.md` and `reminders.md`

**Designer confirmation received: 2026-08-10**
---

## [2026-08-10] Purple droppable cell FX (Phase 2.2)

- **Details**: While a Droppable part is selected, use the same polished cell FX as green explore, recoloured purple (allowed) or red (blocked). Replace old purple wash + black/white dashes. Blocked click = toast only (no sticky). Successful place exits tool ? green explore sticky select.

**Implemented:**
- Theme colours on particles (`green` / `purple` / `red`) in `partCellHoverFx.js`
- Matching wash + outline chrome themes in `partCellHighlight.js`
- Droppable hover drives FX via `sim-network-droppable-cell-fx` event (avoids import cycle)
- Old `partDrop` hover/selected wash + dashed outlines left disabled; ghost / no-drop icon unchanged
- Cable tool still hides cell FX (Phase 2.3)

**Files touched:**
- `public/assets/experiences/sim-network/scripts/partCellHoverFx.js` ? modified (theme colours)
- `public/assets/experiences/sim-network/scripts/partCellHighlight.js` ? modified (chrome themes + droppable event)
- `public/assets/experiences/sim-network/scripts/partDrop.js` ? modified (drive purple/red FX; no sticky on blocked)

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
- `public/assets/experiences/sim-network/scripts/partCellHoverFx.js` ? modified (blue theme)
- `public/assets/experiences/sim-network/scripts/partCellHighlight.js` ? modified (cable hover + selected FX)
- `public/assets/experiences/sim-network/scripts/partCables.js` ? modified (drive FX; path wash only)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- `reminders.md` updated: Phase 2 cell hover (2.1?2.3) complete

**Designer confirmation received: 2026-08-10**
---

## [2026-08-25] Difficulty screen flow (StateManager + difficulties[])

- **Details**: Replace the old title ? tutorial ? office phase helper with five screen states and data-driven difficulty tracks (easy / med / hard), so splash, instructions, level select, play, and complete can each init and clean up cleanly.

**Implemented:**
- Host API exposes `StateManager` for public experience scripts
- Flow screens: splash ? instructions ? levelSelect ? play ? complete (full-panel HTML overlays in `#uiContainer`)
- Canvas hidden on HTML screens; shown only during play
- `layouts-index.json` uses `difficulties[].maps[]` (kind: tutorial | level); each map belongs to one difficulty
- Unlock order easy ? med ? hard; session progress only (resets on reload)
- Empty tracks stay locked / ?Coming soon? until maps exist
- Layout editor Save/Open writes Difficulty + Kind into `difficulties[]` (no more stages/role as source of truth)
- Test pass footer is Retry + Continue; flow advances map or returns to level select
- Easy path designer-confirmed; Med/Hard maps authored by designer (no temp URL remaps)

**Files touched:**
- `src/core/experienceHostApi.js` ? modified (expose StateManager)
- `src/tools/layout-editor/editor-config.js` ? modified (difficulty + kind lists)
- `src/tools/layout-editor/editor-ui.js` ? modified (Difficulty / Kind fields)
- `src/tools/layout-editor/layout-loader.js` ? modified (load map meta from difficulties)
- `src/tools/layout-editor/layout-saver.js` ? modified (upsert into difficulties)
- `src/tools/layout-editor/layouts-index.js` ? modified (difficulties helpers)
- `public/assets/experiences/sim-network/scripts/simNetworkFlow.js` ? modified (StateManager flow)
- `public/assets/experiences/sim-network/scripts/simNetworkScreens.js` ? created (HTML panels)
- `public/assets/experiences/sim-network/scripts/sim-network.js` ? modified (boot waits for splash ready)
- `public/assets/experiences/sim-network/scripts/partCables.js` ? modified (Continue for all maps)
- `public/assets/experiences/sim-network/styles/sim-network.css` ? modified (overlay styles)
- `public/assets/experiences/sim-network/layouts/layouts-index.json` ? modified (difficulties schema)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- Footer HUD visibility on HTML screens deferred to Phase 2
- Experience assets under `public/assets/experiences/` are gitignored

**Designer confirmation received: 2026-08-25**
---

## [2026-08-25] Splash + instructions foreground screens redesign

- **Details**: Redesign the splash and instructions HTML screens to use splash-style white rounded panels on the shared teal animated backdrop (gate ? photo splash; 60/40 instructions layout).

**Implemented:**
- Two-step splash: small gate card (?Press/click anywhere to begin?) ? large photo panel (`splash-full.jpg`) with logo fade-in + white strip / START
- Main splash panel scales to ~80% of the player frame; title logo ~60% of frame width
- Instructions: left photo panel (`manager-full.jpg`, ~60%) + right how-to card (~40%) with existing copy and Continue
- How-to card height fits content and sits vertically centered on the middle-right
- Shared overlay shell (backdrop + content) unchanged as the mount point

**Files touched:**
- `public/assets/experiences/sim-network/scripts/simNetworkScreens.js` ? modified (splash + instructions markup/flow)
- `public/assets/experiences/sim-network/styles/sim-network.css` ? modified (splash + instructions panel styles)

**Notes:**
- Root `changelog.md` skipped per designer (journal only)
- Music autoplay left as-is (not tied to gate click)

**Designer confirmation received: 2026-08-25**
---

## [2026-09-01] Superseded note ? layouts-index `stages[]` journal entries

**Task summary:** Phase C cleanup (sim-network scene-based refactor). No runtime change ? documentation only.

The journal entries dated **2026-08-08** above (`layouts-index.json` with `stages[]` / `role: tutorial | office`, and the "Flow phases title ? tutorial ? office" section) describe the **pre?2026-08-25** flow.

**Superseded by:** the difficulty-track flow shipped 2026-08-25 ? `layouts-index.json` now uses `difficulties[].maps[]`, and the player runs splash ? instructions ? level select ? play ? complete via `simNetworkFlow.js` + `simNetworkScreens.js`.

**Authoring source of truth today:** `difficulties[]` in `layouts-index.json` and the 2026-08-25+ journal entries below. Keep the 2026-08-08 entries for history; do not use `stages[]` / `role` when authoring new content.

**Designer confirmation received: 2026-09-01**

---

## [2026-08-31] Sim-network info drawer custom styling

- **Details**: Style the tutorial info drawer for sim-network only ? larger, more readable step text ? without changing the shared core info drawer component.

**Implemented:**
- Added info drawer override block to `styles/sim-network.css` (loads via scene `customCss` only on sim-network)
- Overrides target the same `.info-drawer*` class names as base `src/core/ui/info-drawer/infoDrawer.css`
- Increased title and body font sizes for tutorial step copy (designer tuned final values to `1.4rem` title / `1.15rem` body)
- Core player info drawer unchanged; other scenes keep default look

**Files touched:**
- `public/assets/experiences/sim-network/styles/sim-network.css` ? modified (info drawer override section + font sizes)

**Notes:**
- Builds on core info drawer CSS co-location (`src/core/ui/info-drawer/`) shipped 2026-08-25
- Root `changelog.md` skipped per designer (journal only)
- Trim unused override rules in `sim-network.css` as styling settles

**Designer confirmation received: 2026-08-31**

---

## [2026-09-01] Config split ? sim-network into standalone dataset

- **Details:** Break sim-network out of `cyber-c2.json` into its own experience loaded via `?dataset=sim-network`. Move assets from `cyber-c2/sim-network/` to `sim-network/`. Keep only `pc-components` and `router-anatomy` in cyber-c2.

**Implemented:**
- Extracted `sim-network` scene into `public/assets/experiences/sim-network/config/sim-network.json` with `initialScene: "sim-network"`
- Trimmed `cyber-c2.json` to two scenes; `initialScene` stays `"router-anatomy"`
- Moved asset folder to `public/assets/experiences/sim-network/` and updated path references in 9 text files (scripts, layouts, etc.)
- Updated layout-editor default folder to `sim-network`
- Fixed `sceneStyleLoader.js` regex so dataset-root CSS paths (`experiences/sim-network/styles/...`) load correctly (nested `cyber-c2/sim-network/styles/...` paths still work)

**Files touched:**
- `public/assets/experiences/cyber-c2/config/cyber-c2.json` ? modified (trimmed to pc-components + router-anatomy)
- `public/assets/experiences/sim-network/config/sim-network.json` ? created (standalone dataset config)
- `public/assets/experiences/sim-network/` ? created (moved from `cyber-c2/sim-network/`)
- `src/tools/layout-editor/editor-config.js` ? modified (`DEFAULT_LAYOUT_FOLDER` ? `sim-network`)
- `src/tools/layout-editor/layouts-index.js` ? modified (comment example path)
- `tools/vite-plugin-save-json.js` ? modified (comment example paths)
- `src/core/sceneStyleLoader.js` ? modified (CSS path regex accepts flat dataset-root layout)

**Notes:**
- Loader convention unchanged: `./assets/experiences/<dataset>/config/<dataset>.json` ? no `configLoader.js` changes needed
- Post-split bug: `notSceneStylesPath` console error when loading `customCss` ? fixed by widening `SCENE_STYLES_PATH_RE`
- Annotation "model not found" warnings at boot are expected until a layout map is stamped (layout-placed models do not exist yet)
- Root `changelog.md` skipped per designer (journal only)

**Designer confirmation received: 2026-09-01**

---

## [2026-09-02] Phase 1 ? type "2d" scene type + proof instructions scene

- **Details:** Core support for HTML-only tour scenes (`type: "2d"`): hide Babylon canvas and 360 domes, expose `switchToScene` on the experience host API, and add a proof `sim-network-instructions` scene in `sim-network.json`.

**Implemented:**
- Created `scenePresentation.js` ? syncs canvas + dome visibility for `type: "2d"`
- Added `set360DomesVisible()` and `ensure360ImageForScene()` in `image360Manager.js` (first 3D scene after 2D boot creates domes; later switches use fade path)
- Wired presentation sync on boot (`sceneCore`) and switch (`sceneManager`)
- Exposed `host.switchToScene(sceneId)` on experience host API for public experience scripts
- Added proof scene `sim-network-instructions` + thin script with Continue ? `sim-network`
- CSS class `#renderCanvas.xrs-scene-canvas-hidden` for 2D scenes
- Updated `docs/json-options.md` ? documented `type: "2d"` and host `switchToScene`

**Files touched:**
- `src/core/scenePresentation.js` ? created (2D scene canvas/dome presentation)
- `src/core/image360Manager.js` ? modified (`set360DomesVisible`, `ensure360ImageForScene`)
- `src/core/sceneManager.js` ? modified (presentation sync; dome-safe 360 load)
- `src/core/sceneCore.js` ? modified (presentation sync on boot)
- `src/core/experienceHostApi.js` ? modified (`switchToScene` on host API)
- `styles/styles.css` ? modified (canvas hidden class for 2D scenes)
- `public/assets/experiences/sim-network/config/sim-network.json` ? modified (added `sim-network-instructions` scene)
- `public/assets/experiences/sim-network/scripts/sim-network-instructions.js` ? created (proof 2D instructions screen)
- `docs/json-options.md` ? modified (document `type: "2d"`)

**Notes:**
- Render loop pause deferred ? CSS hide only for v1
- Default `initialScene` stays `"sim-network"`; proof scene via `?initialScene=sim-network-instructions` or debug `[` / `]`
- Post-test bug: Continue from 2D boot failed because 360 domes were never created ? fixed with `ensure360ImageForScene()`
- Also logged in root `changelog.md`

**Designer confirmation received: 2026-09-02**

---

## [2026-09-09] Load Sim Network sequences from the correct folder

- **Details**: Named sequences now load from the experience-level `animations` folder when the experience and scene share the same name, while other scenes keep their existing scene-specific paths.

**Implemented:**
- Prevented the loader from building the nonexistent `sim-network/sim-network/animations/` path
- Preserved `experience/scene/animations/` paths when the experience and scene names differ
- Confirmed Level 1-1 resolves `tutorial-01-sequence.json` from `sim-network/animations/`

**Files touched:**
- `src/core/animationBinding.js` ? modified (correct same-named experience and scene sequence paths)
- `changelog.md` ? modified (completion record)
- `public/assets/experiences/sim-network/sim-network-journal.md` ? modified (completion record)

**Notes:**
- Annotations, model targets, timeline behaviour and asset folders were intentionally unchanged
- The Sim Network production build, lint check and designer runtime test passed

**Designer confirmation received: 2026-09-09**

---

## [2026-09-12] EA 2/5 ? Multi-scene Sim Network flow

- **Details**: Peel splash / instructions / level-select / complete into real `type: "2d"` scenes; keep one `in-game` play scene with layout-swap maps; session progress survives scene switches.

**Implemented:**
- Added scenes `splash`, `level-select`, `complete`; kept `instructions` / `in-game`; boot at `splash`
- Shared `simNetworkSession.js` for track progress across scene switches
- Slimmed `simNetworkFlow.js` to play-only; finished track/all ? `switchToScene`
- Wired Continue: splash ? instructions ? level-select ? in-game; Play again ? reset ? level-select
- Always stamp the selected map on play (removed overlay-era skip-assemble)
- Kept HTML proof sequence on instructions for now

**Files touched:**
- `public/assets/experiences/sim-network/scripts/simNetworkSession.js` ? created
- `public/assets/experiences/sim-network/scripts/sim-network-splash.js` ? created
- `public/assets/experiences/sim-network/scripts/sim-network-level-select.js` ? created
- `public/assets/experiences/sim-network/scripts/sim-network-complete.js` ? created
- `public/assets/experiences/sim-network/scripts/sim-network-instructions.js` ? modified
- `public/assets/experiences/sim-network/scripts/simNetworkFlow.js` ? modified
- `public/assets/experiences/sim-network/scripts/sim-network.js` ? modified
- `public/assets/experiences/sim-network/config/sim-network.json` ? modified
- `plans/2026-09-12-ea-2-5-multi-scene-sim-network-flow.md` ? created / completion appended
- `reminders.md` ? modified
- `public/assets/experiences/sim-network/sim-network-journal.md` ? modified (this entry)

**Notes:**
- One play scene for all maps (not seven play scenes) ? locked for EA 2/5
- Root `changelog.md` not updated for this entry (designer chose journal + plan only)
- Follow-ups: optional double-stamp cleanup; remove HTML proof when ready; EA 3/4 modelSets next candidate

**Designer confirmation received: 2026-09-12**

---

## [2026-09-13] Scene-switch HTML loading curtain (EA Task 3 Phase 2)

- **Details**: HTML loading curtain for scene switches ? spinner, n/total %, bar ? so multi-scene Sim Network flow does not flash blank between splash / instructions / level-select / in-game / complete.

**Implemented:**
- Curtain mounts in the player frame (`#uiContainer`); boot splash still uses `#loadingScreen`
- Progress driven from existing `sceneLoadProgress` ticks
- Minimum hold 250ms; TEMP `?loadingPreview=1` for style checks (easy to remove)
- Empty above/below slots reserved for future extras

**Files touched:**
- `src/core/ui/sceneLoadingScreen.js` ? created
- `styles/loading.css` ? created
- `index.html` ? modified
- `src/core/sceneManager.js` ? modified
- `src/core/sceneLoadProgress.js` ? modified
- `changelog.md` ? modified (root completion record)
- `docs/EA-task list.txt` ? modified (task 3 Phase 2 note)
- `plans/sim-network-scene-based-refactor-scratchpad.md` ? modified (Section 17)
- `public/assets/experiences/sim-network/sim-network-journal.md` ? modified (this entry)

**Notes:**
- EA Task 3 not fully closed ? dispose audit may still remain
- Follow-up: remove TEMP preview blocks after styling is signed off

**Designer confirmation received: 2026-09-13**

---

## [2026-09-13] Scene-switch HTML loading curtain (EA Task 3 Phase 2)

- **Details**: HTML loading curtain for scene switches ? spinner, n/total %, bar ? so multi-scene Sim Network flow does not flash blank between splash / instructions / level-select / in-game / complete.

**Implemented:**
- Curtain mounts in the player frame (`#uiContainer`); boot splash still uses `#loadingScreen`
- Progress driven from existing `sceneLoadProgress` ticks
- Minimum hold 250ms; TEMP `?loadingPreview=1` for style checks (easy to remove)
- Empty above/below slots reserved for future extras

**Files touched:**
- `src/core/ui/sceneLoadingScreen.js` ? created
- `styles/loading.css` ? created
- `index.html` ? modified
- `src/core/sceneManager.js` ? modified
- `src/core/sceneLoadProgress.js` ? modified
- `changelog.md` ? modified (root completion record)
- `docs/EA-task list.txt` ? modified (task 3 Phase 2 note)
- `plans/sim-network-scene-based-refactor-scratchpad.md` ? modified (Section 17)
- `public/assets/experiences/sim-network/sim-network-journal.md` ? modified (this entry)

**Notes:**
- EA Task 3 not fully closed ? dispose audit may still remain
- Follow-up: remove TEMP preview blocks after styling is signed off

**Designer confirmation received: 2026-09-13**

---


## [2026-09-13] EA Task 3 dispose audit ? closed (loading follow-ups remain)

- **Details**: Audit Sim Network scene-switch dispose (core + office layout). Confirmed teardown works; stripped TEMP audit logs. Task 3 stays open for loading-screen follow-ups only.

**Implemented:**
- TEMP `TEMP-AUDIT-TESTINGS` walk: splash ? instructions ? level-select ? in-game ? leave play
- Verified core dispose (360, viewer models, scene audio, CSS) and experience `disposeLayout` (32 templates released)
- Designer confirmed no leftover "feel" in 3D after leave play
- Removed all TEMP audit instrumentation (no behaviour change)

**Files touched:**
- `src/core/tempDisposeAuditLog.js` ? created then deleted
- Core + sim-network dispose paths ? TEMP logs added then removed
- `changelog.md` ? modified
- `docs/EA-task list.txt` ? modified (dispose DONE; loading follow-ups open)
- `plans/sim-network-scene-based-refactor-scratchpad.md` ? modified (Section 18)
- `reminders.md` ? modified
- `public/assets/experiences/sim-network/sim-network-journal.md` ? modified (this entry)

**Notes:**
- No dispose code fixes required
- Loading follow-ups still open under Task 3 (`?loadingPreview=1`, experience skin, etc.)

**Designer confirmation received: 2026-09-13**

---


## [2026-09-14] EA Task 3 closed ? sticky experience loading.css + TEMP preview removed

- **Details**: Finish Task 3 loading leftovers ? remove TEMP curtain preview; move Sim Network curtain skin into experience `styles/loading.css`; load that file once per session if present (fixes dark flash mid-switch).

**Implemented:**
- Removed TEMP `?loadingPreview=1` hold/Continue UI from core curtain
- Moved teal curtain skin from `sim-network.css` into `?/sim-network/styles/loading.css`
- Core `ensureExperienceLoadingCss` loads that file once at boot when present; missing file keeps core defaults; link stays across scene switches
- Scene `customCss` unload/reload no longer strips the curtain skin mid-count

**Files touched:**
- `src/core/ui/sceneLoadingScreen.js` ? modified (TEMP preview removed)
- `src/core/sceneStyleLoader.js` ? modified (session sticky experience loading.css)
- `src/core/configLoader.js` ? modified (resolveDatasetPath returns datasetName)
- `src/main.js` ? modified (call ensureExperienceLoadingCss after dataset resolve)
- `styles/loading.css` ? modified (comment + earlier TEMP hint removal)
- `public/assets/experiences/sim-network/styles/loading.css` ? created (teal curtain skin)
- `public/assets/experiences/sim-network/styles/sim-network.css` ? modified (skin block removed)

**Notes:**
- Boot `#loadingScreen` unchanged
- EA Task 3 fully closed

**Designer confirmation received: 2026-09-14**

---

## [2026-09-14] Phase 5.5 - 2D scene polish (A/B/C; EA list still open for manual work)

- **Details**: Number splash through complete scenes in appearance order; placeholder enter timelines (except 04-in-game); light polish; reorganize `sim-network.css` and consolidate shared 2D UI styles/HTML. Loading-slot media out of scope.

**Implemented:**
- Steps A/B: scene ids/folders `01-splash` through `05-complete`; placeholder enter sequences wired (04-in-game rename only)
- Step C: section banners in `sim-network.css`; shared `2d-surface` / `2d-heading` / `2d-lead`; dual HTML classes on splash / instructions / level-select
- Recovered from a bad Step C CSS reorg using designer backup `temp/sim-network.css`, then redid carefully by hand

**Files touched:**
- `public/assets/experiences/sim-network/config/sim-network.json` - modified (scene ids / paths)
- `public/assets/experiences/sim-network/styles/sim-network.css` - modified (restore + careful Step C)
- `public/assets/experiences/sim-network/scripts/simNetworkScreens.js` - modified (shared 2D classes)
- `public/assets/experiences/sim-network/scripts/sim-network-instructions.js` - modified (shared 2D classes)
- `public/assets/experiences/sim-network/scripts/sim-network-splash.js` - modified (enter sequence / scene target)
- `public/assets/experiences/sim-network/scripts/sim-network-level-select.js` - modified (enter sequence / scene target)
- `public/assets/experiences/sim-network/scripts/sim-network-complete.js` - modified (enter sequence / scene target)
- `public/assets/experiences/sim-network/scripts/simNetworkFlow.js` - modified (scene id references)
- `public/assets/experiences/sim-network/01-splash/` through `05-complete/` - created/renamed (folders + placeholders)
- `docs/EA-task list.txt` - modified earlier (5.5 added; **not** marked DONE yet - designer still polishing manually)
- `temp/sim-network.css` - created (safety backup; keep for now)

**Notes:**
- Deviation: first CSS reorg corrupted the file; fixed by restore from backup, then hand-edited Step C
- EA Task 5.5 left open in the task list until designer finishes manual work

**Designer confirmation received: 2026-09-14**

---

## [2026-09-14] Split dialogue UI out of the info drawer

- **Details**: Restore the simple info drawer for EV-style step notes, and move avatar/typewriter coaching speech into a new dialogue helper for sim-network.

**Implemented:**
- Added core `createDialogue` helper (avatar, typewriter, showToggle, minWidth) on the experience host API
- Pointed sim-network tutorial coaching at dialogue + `event:show-dialogue` / `event:hide-dialogue`
- Renamed flow helpers to `initTutorialDialogue` / `disposeTutorialDialogue` (and show/hide)
- Retargeted sim-network CSS overrides to `.dialogue*`
- Fixed typing SFX id to `default-ui-typewriter`
- Stripped typewriter/avatar/showToggle/minWidth from the shared info drawer (title/body notes again)

**Files touched:**
- `src/core/ui/dialogue/dialogue.js` ? created (dialogue UI helper)
- `src/core/ui/dialogue/dialogue.css` ? created (dialogue styles)
- `src/core/ui/dialogue/index.js` ? created (package exports)
- `src/core/experienceHostApi.js` ? modified (export createDialogue)
- `src/core/ui/info-drawer/infoDrawer.js` ? modified (restore simple notes)
- `src/core/ui/info-drawer/infoDrawer.css` ? modified (remove avatar styles)
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-step-content.js` ? modified (use dialogue + new events)
- `public/assets/experiences/sim-network/scripts/simNetworkFlow.js` ? modified (Dialogue helper names)
- `public/assets/experiences/sim-network/04-in-game/animations/tutorial-01-sequence.json` ? modified (show-dialogue emits)
- `public/assets/experiences/sim-network/04-in-game/animations/tutorial-02-sequence.json` ? modified (show-dialogue emits)
- `public/assets/experiences/sim-network/styles/sim-network.css` ? modified (dialogue CSS overrides)
- `plans/dialogue-plugin-split.md` ? created (split plan)

**Notes:**
- Safe order used: build dialogue ? migrate sim-network ? strip info drawer
- EV fade-in scare during testing: logs showed CSS transition starting OK; no rAF change
- EV scene-05 console noise (~264 warns) is separate (sequence mesh names / Draco); not caused by this split

**Designer confirmation received: 2026-09-14**

---

## [2026-09-15] Option B ? per-scene UI (remove simNetworkScreens)

- **Details**: Remove the shared `simNetworkScreens.js` middle layer so each 2D flow scene owns its own HTML, listeners, and button SFX. Keep `simNetworkSession.js` for visit progress only.

**Implemented:**
- Inlined splash gate/START UI + SFX into `sim-network-splash.js`
- Added Continue hover/click SFX in `sim-network-instructions.js`
- Inlined level-select cards UI + SFX into `sim-network-level-select.js`
- Inlined complete / Play again UI + SFX into `sim-network-complete.js`
- Deleted `simNetworkScreens.js`
- SFX via `host.dispatchAppEvent` (`default-ui-hover`, `default-ui-click`, `default-sys-next`)

**Files touched:**
- `public/assets/experiences/sim-network/scripts/sim-network-splash.js` ? modified (inline splash UI + SFX)
- `public/assets/experiences/sim-network/scripts/sim-network-instructions.js` ? modified (Continue SFX)
- `public/assets/experiences/sim-network/scripts/sim-network-level-select.js` ? modified (inline level-select UI + SFX)
- `public/assets/experiences/sim-network/scripts/sim-network-complete.js` ? modified (inline complete UI + SFX)
- `public/assets/experiences/sim-network/scripts/simNetworkScreens.js` ? deleted

**Notes:**
- No deviations from approved Option B plan
- Root `changelog.md` skipped per designer (specialty journal only)

**Designer confirmation received: 2026-09-15**

---

## [2026-09-15] Dialogue split follow-ups (shared docks + tutorial rename)

- **Details**: After the dialogue / info-drawer split, clean outdated reminders, rename the sim-network tutorial coaching script, and share the 9-slot dock helper.

**Implemented:**
- Added shared `uiDockPositions.js` (nine docks + `normalizeDockPosition`)
- Info drawer and dialogue keep thin aliases so EV / overlays keep working
- Renamed `sim-network-tutorial-step-content.js` ? `sim-network-tutorial-dialogue.js` and updated flow import + logs
- Updated outdated reminders and the plan doc path

**Files touched:**
- `src/core/ui/uiDockPositions.js` ? created (shared 9-slot docks)
- `src/core/ui/info-drawer/infoDrawer.js` ? modified (use shared helper aliases)
- `src/core/ui/dialogue/dialogue.js` ? modified (use shared helper aliases)
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-dialogue.js` ? created (renamed from step-content)
- `public/assets/experiences/sim-network/scripts/sim-network-tutorial-step-content.js` ? deleted (renamed)
- `public/assets/experiences/sim-network/scripts/simNetworkFlow.js` ? modified (import new filename)
- `reminders.md` ? modified (retarget outdated follow-ups)
- `plans/dialogue-plugin-split.md` ? modified (new tutorial script path)

**Notes:**
- No intended behaviour change ? same docks and panels, less duplicated position logic
- Also recorded in root `changelog.md`

**Designer confirmation received: 2026-09-15**

---

## [2026-09-18] In-game SFX (drop, select, cable, network test)

- **Details**: Wire sim-network scene audio clip ids (plus global success/error) through `audioControl` for gameplay actions. Overlapping clips are intentional and must not cancel each other.

**Implemented:**
- Drop / no-drop: `partDrop.js` (`drop-component`, `no-drop` on blocked or occupied click)
- Cell / device select: `partCellHighlight.js` (`cell-selection`, `device-selection` on sticky select only — not hover)
- Remove: `partCellInspector.js` (`remove-component` on trash click; hand-built button, action SFX only)
- Cable: `partCables.js` (`drop-cable` per new hold-drag cell; `connect-cable` on successful commit)
- Network test: `partCables.js` (`test-connection` on start; `default-sys-success` / `default-sys-error` on finish)

**Files touched:**
- `public/assets/experiences/sim-network/scripts/partDrop.js` — modified (drop / no-drop SFX)
- `public/assets/experiences/sim-network/scripts/partCellHighlight.js` — modified (select SFX)
- `public/assets/experiences/sim-network/scripts/partCellInspector.js` — modified (remove SFX)
- `public/assets/experiences/sim-network/scripts/partCables.js` — modified (cable + test SFX)

**Notes:**
- Shipped as four mini-groups; each tested and confirmed before the next
- Root `changelog.md` skipped per designer (specialty journal only)

**Designer confirmation received: 2026-09-18**

---
