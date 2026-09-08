# Sim Network — journal

Append-only history for sim-network feature work. Newest entries at the **bottom**.

---

## [2026-09-01] Phase I — authoring map (scene-based refactor)

- **Details:** Doc-only phase of the scene-based refactor. Defines how sim-network will be split from one monolithic scene into ~11 tour scenes, and how layout stamping will be declared in JSON via `modelSets[]` (implemented in core Phase 3).

**Implemented:**
- `plans/sim-network-phase-i-authoring-map.md` — authoring reference: scene list, `general` vs per-scene fields, `modelSets[]` shape, catalog + map split, loading-progress rules
- Scratchpad updated — Phase I complete; config inheritance dropped for v1

**Locked decisions (designer 2026-09-01):**
- **11 scenes:** splash, instructions, level-select, **7** levels (`sim-network-level-01` … `07`), complete
- **2D flow screens** use `type: "2d"` (Phase 1 core work)
- **No JSON inheritance** in v1 — repeat `plugins[]` / `audio[]` per level scene is OK
- **`modelSets[]`** on level scenes — multiple entries per scene (e.g. shell + props), each with `id` + `catalog` + `map`
- **Repeat full `catalog` path** on every `modelSet` (usually `kit-parts.json`)
- **Loading progress** counts unique GLB paths across `models[]` + `modelSets[]`, not placement clones
- **`models[]`** for fixed single GLBs only — not layout stamps

**Files touched:**
- `plans/sim-network-phase-i-authoring-map.md` — created
- `plans/sim-network-scene-based-refactor-scratchpad.md` — modified

**Notes:**
- Runtime layout load today still lives in `simNetworkFlow` / layout assembler until Phase 3
- `layouts-index.json` can stay as editor metadata; level-select will list scene ids, not index rows

**Designer confirmation received: 2026-09-01**

---
