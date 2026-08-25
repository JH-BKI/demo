/**
 * Sim-network layout assembler — load each unique part once, stamp from map JSON.
 * Transform order: position → rotationY → optional local-X mirror.
 * Also supports one-off runtime stamps for player droppables.
 */

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';

/**
 * Perf experiment: scenery layers (floor/wall/furniture) skip pointer hits.
 * Devices / interactables on layer 4+ stay pickable. Set false to revert.
 */
const EXPERIMENT_SCENERY_UNPICKABLE = true;
/**
 * Perf experiment: hide one scenery layer after assemble (draw-call A/B).
 * Tracked layout stamps only — not ghosts. Set null to show all layers.
 * Measured (vs ~1687 draw-call baseline): L1 floors ~−280; L2 walls ~−1160; L3 furniture ~−730.
 * Hide tests done — null restores full office visuals.
 */
const EXPERIMENT_HIDE_LAYER = null;
/**
 * Quick win attempt: merge child meshes on each layer-2 (wall) stamp.
 * Off — Blender wall cleanup already cut materials/draws; runtime merge added cost with no draw-call win.
 */
const MERGE_LAYER2_WALL_STAMPS = false;

/** @type {Map<string, import('@babylonjs/core').AssetContainer>} */
let templateContainers = new Map();
/** @type {Array<{ dispose?: () => void }>} */
let stampEntries = [];
/** @type {import('@babylonjs/core').TransformNode[]} */
let stampRoots = [];
/** @type {Map<string, object>} */
let partById = new Map();
/** @type {object | null} */
let activeLayout = null;
/** Occupancy keys: "x,z,layer" */
let occupiedCells = new Set();
/** @type {number} */
let nextStampSeq = 1;
/**
 * Tracked stamps (map + player drops). Ghosts are not tracked.
 * @type {Map<string, {
 *   stampId: string,
 *   wrap: import('@babylonjs/core').TransformNode,
 *   entries: object,
 *   partId: string,
 *   x: number,
 *   z: number,
 *   layer: number,
 *   playerDrop: boolean
 * }>}
 */
let stampsById = new Map();

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.loadAssetContainerFromPath !== 'function' ||
        typeof host.layoutCellHalfOffset !== 'function' ||
        typeof host.Mesh?.MergeMeshes !== 'function'
    ) {
        throw new Error(
            'Experience host API missing loadAssetContainerFromPath / layoutCellHalfOffset / Mesh.MergeMeshes. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * Merge a stamp's child meshes into one (or one multi-material) mesh.
 * Call while wrap is still at identity so merge stays in local space.
 * @param {object} host
 * @param {import('@babylonjs/core').TransformNode} wrap
 * @param {string} stampName
 * @param {boolean} pickable
 * @returns {number} mesh count after merge (1 if merged, else original count)
 */
function mergeStampChildMeshes(host, wrap, stampName, pickable) {
    const meshes = (wrap.getChildMeshes?.(false) || []).filter(
        (mesh) => mesh && typeof mesh.getTotalVertices === 'function' && mesh.getTotalVertices() > 0
    );
    if (meshes.length < 2) {
        return meshes.length;
    }
    const beforeCount = meshes.length;
    const merged = host.Mesh.MergeMeshes(
        meshes,
        true,
        true,
        undefined,
        false,
        true
    );
    if (!merged) {
        console.warn(
            `[layoutAssembler.js]: [N/A] - [mergeStampChildMeshes] - mergeFailedStampName has a value of ${stampName}, meshCount has a value of ${beforeCount}.`
        ); //This is logged when wall mesh merge returns null.
        return beforeCount;
    }
    merged.name = `${stampName}_merged`;
    merged.parent = wrap;
    merged.isPickable = pickable;

    // Drop empty transform leftovers from the old GLB hierarchy under wrap.
    const leftovers = [...(wrap.getChildren?.() || [])];
    for (const child of leftovers) {
        if (child === merged) {
            continue;
        }
        const childMeshes = child.getChildMeshes?.(false) || [];
        if (childMeshes.length === 0) {
            child.dispose?.(false, true);
        }
    }

    return 1;
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} layer
 * @returns {string}
 */
export function occupancyKey(x, z, layer) {
    return `${x},${z},${layer}`;
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} layer
 * @returns {boolean}
 */
export function isCellOccupied(x, z, layer) {
    return occupiedCells.has(occupancyKey(x, z, layer));
}

/**
 * Unmarked cells allow player drops; map cellConditions with allowDrop:false block.
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
export function isCellDropAllowed(x, z) {
    const list = activeLayout?.cellConditions;
    if (!Array.isArray(list)) {
        return true;
    }
    for (const entry of list) {
        if (entry?.x === x && entry?.z === z && entry.allowDrop === false) {
            return false;
        }
    }
    return true;
}

/**
 * First placement at (x, z, layer) in the active layout, or null.
 * @param {number} x
 * @param {number} z
 * @param {number} layer
 * @returns {object | null}
 */
export function getPlacementAtCell(x, z, layer) {
    const placements = activeLayout?.placements;
    if (!Array.isArray(placements)) {
        return null;
    }
    for (const placement of placements) {
        if (
            placement?.x === x &&
            placement?.z === z &&
            (placement.layer ?? 1) === layer
        ) {
            return placement;
        }
    }
    return null;
}

/**
 * rotationY of the first placement at (x, z, layer), or null if none.
 * @param {number} x
 * @param {number} z
 * @param {number} layer
 * @returns {number | null}
 */
export function getRotationYAtCell(x, z, layer) {
    const placement = getPlacementAtCell(x, z, layer);
    if (!placement) {
        return null;
    }
    return typeof placement.rotationY === 'number' ? placement.rotationY : 0;
}

/**
 * Catalog `droppableYOffset` for the first part at (x, z, layer), or null if none / missing flag.
 * @param {number} x
 * @param {number} z
 * @param {number} layer
 * @returns {number | null}
 */
export function getDroppableYOffsetAtCell(x, z, layer) {
    const placement = getPlacementAtCell(x, z, layer);
    if (!placement?.part) {
        return null;
    }
    const partDef = partById.get(placement.part);
    const offset = partDef?.droppableYOffset;
    return typeof offset === 'number' ? offset : null;
}

/**
 * @param {object} layout
 * @param {object} placement
 * @param {object} partDef
 * @returns {{ x: number, y: number, z: number }}
 */
export function cellToWorld(layout, placement, partDef) {
    const host = getHost();
    const cellSize = layout.cellSize ?? 1;
    const partY = partDef?.yOffset ?? 0;
    const placeY = placement.yOffset ?? 0;
    const half = host.layoutCellHalfOffset(cellSize);
    return {
        x: placement.x * cellSize + half,
        y: partY + placeY,
        z: placement.z * cellSize + half,
    };
}

/**
 * @param {object} partDef
 * @returns {{ title: string, bodyHtml: string } | null}
 */
function getInteractionContent(partDef) {
    const message = partDef?.interactableMessage;
    if (
        partDef?.interactable !== true ||
        !Array.isArray(message) ||
        typeof message[0] !== 'string' ||
        message[0].trim().length === 0 ||
        typeof message[1] !== 'string'
    ) {
        return null;
    }
    return {
        title: message[0].trim(),
        bodyHtml: message[1],
    };
}

/**
 * @param {string} partId
 * @returns {object | null}
 */
export function getPartDef(partId) {
    return partById.get(partId) || null;
}

/**
 * @param {string} stampId
 * @returns {object | null}
 */
export function getStampById(stampId) {
    return stampsById.get(stampId) || null;
}

/**
 * Walk parents to find a tracked stamp root from a picked mesh.
 * @param {import('@babylonjs/core').Node | null | undefined} node
 * @returns {object | null}
 */
export function findStampFromNode(node) {
    let current = node || null;
    while (current) {
        const stampId = current.metadata?.simNetworkStamp?.stampId;
        if (typeof stampId === 'string') {
            return stampsById.get(stampId) || null;
        }
        current = current.parent;
    }
    return null;
}

/**
 * Droppable (layer 5) stamp in a cell, if any.
 * @param {number} x
 * @param {number} z
 * @param {number} [layer=5]
 * @returns {object | null}
 */
export function getStampAtCell(x, z, layer = 5) {
    for (const stamp of stampsById.values()) {
        if (stamp.x === x && stamp.z === z && stamp.layer === layer) {
            return stamp;
        }
    }
    return null;
}

/**
 * All tracked stamps in a cell (any layer).
 * @param {number} x
 * @param {number} z
 * @returns {object[]}
 */
export function getStampsAtCell(x, z) {
    /** @type {object[]} */
    const matches = [];
    for (const stamp of stampsById.values()) {
        if (stamp.x === x && stamp.z === z) {
            matches.push(stamp);
        }
    }
    return matches;
}

/**
 * Every tracked stamp currently in the scene (layout + player drops).
 * @returns {object[]}
 */
export function getAllStamps() {
    return Array.from(stampsById.values());
}

/**
 * Display label for a stamp (interactable title or part id).
 * @param {object | null} stamp
 * @returns {string}
 */
export function getStampLabel(stamp) {
    if (!stamp) {
        return 'Unknown';
    }
    const partDef = partById.get(stamp.partId);
    const title = partDef?.interactableMessage?.[0];
    if (typeof title === 'string' && title.trim()) {
        return title.trim();
    }
    return String(stamp.partId || 'Part');
}

/**
 * Remove a tracked stamp from the scene and occupancy.
 * @param {string} stampId
 * @returns {boolean}
 */
export function removeStampById(stampId) {
    const stamp = stampsById.get(stampId);
    if (!stamp) {
        return false;
    }

    const entryIndex = stampEntries.lastIndexOf(stamp.entries);
    if (entryIndex >= 0) {
        stampEntries.splice(entryIndex, 1);
    }
    const rootIndex = stampRoots.lastIndexOf(stamp.wrap);
    if (rootIndex >= 0) {
        stampRoots.splice(rootIndex, 1);
    }

    occupiedCells.delete(occupancyKey(stamp.x, stamp.z, stamp.layer));
    stampsById.delete(stampId);

    try {
        stamp.entries.dispose?.();
    } catch (error) {
        console.warn(
            `[layoutAssembler.js]: [N/A] - [removeStampById] - entriesDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when stamp entries fail to dispose on remove.
    }
    try {
        stamp.wrap.dispose?.(false, true);
    } catch (error) {
        console.warn(
            `[layoutAssembler.js]: [N/A] - [removeStampById] - wrapDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when stamp wrap fails to dispose on remove.
    }

    console.log(
        `[layoutAssembler.js]: [N/A] - [removeStampById] - stampId has a value of ${stampId}.`
    ); //This is logged when a tracked stamp is removed by the player.
    return true;
}

/**
 * @returns {object | null}
 */
export function getActiveLayout() {
    return activeLayout;
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} layout
 * @param {object} placement
 * @param {object} [options]
 * @param {boolean} [options.freeze=true]
 * @param {boolean} [options.pickable=null] null = pickable (so explore highlight / cell resolve can hit furniture & walls). Pass false for ghosts.
 * @param {boolean} [options.recordOccupancy=true]
 * @param {boolean} [options.quiet=false] When true, skip the per-stamp success log (used during bulk assemble).
 * @param {string} [options.namePrefix='simnet']
 * @param {boolean} [options.trackStamp=true] When false, skip stampsById (ghosts).
 * @param {boolean} [options.playerDrop=false] Marks session droppables for cell inspect / remove.
 * @returns {{ wrap: import('@babylonjs/core').TransformNode, entries: object, interactionContent: { title: string, bodyHtml: string } | null, stampId: string | null } | null}
 */
export function stampPlacement(scene, layout, placement, options = {}) {
    const host = getHost();
    const partId = placement?.part;
    const partDef = partById.get(partId);
    const container = templateContainers.get(partId);
    if (!partDef || !container) {
        console.warn(
            `[layoutAssembler.js]: [N/A] - [stampPlacement] - missingPartForPlacement has a value of ${partId}.`
        ); //This is logged when a placement references an unknown part id.
        return null;
    }

    const freeze = options.freeze !== false;
    const recordOccupancy = options.recordOccupancy !== false;
    const trackStamp = options.trackStamp !== false;
    const playerDrop = options.playerDrop === true;
    const quiet = options.quiet === true;
    const namePrefix = typeof options.namePrefix === 'string' ? options.namePrefix : 'simnet';
    const layer = placement.layer ?? 1;
    const stampName = `${namePrefix}_${partId}_${placement.x}_${placement.z}_L${layer}${placement.mirror ? '_m' : ''}`;
    const entries = container.instantiateModelsToScene(
        (name) => `${stampName}_${name}`,
        false
    );

    const wrap = new host.TransformNode(stampName, scene);
    for (const root of entries.rootNodes || []) {
        if (root) {
            root.parent = wrap;
        }
    }

    // Merge wall meshes while wrap is still at identity (local = world for the merge bake).
    const shouldMergeWalls =
        MERGE_LAYER2_WALL_STAMPS && layer === 2 && trackStamp;
    let pickable = true;
    if (typeof options.pickable === 'boolean') {
        pickable = options.pickable;
    } else if (EXPERIMENT_SCENERY_UNPICKABLE && layer <= 3) {
        pickable = false;
    }
    if (shouldMergeWalls) {
        mergeStampChildMeshes(host, wrap, stampName, pickable);
    }

    const world = cellToWorld(layout, placement, partDef);
    wrap.position = new host.Vector3(world.x, world.y, world.z);

    const rotationY = placement.rotationY ?? 0;
    wrap.rotation.y = (rotationY * Math.PI) / 180;

    if (placement.mirror === true) {
        wrap.scaling = new host.Vector3(-1, 1, 1);
    }

    const interactionContent = getInteractionContent(partDef);
    const meshes = wrap.getChildMeshes?.(false) || [];
    // Default: scenery L1–L3 unpickable (perf experiment); L4+ pickable for devices.
    // Ghosts / callers can still force pickable via options.pickable.
    // Info dialogs still only open where ActionManager is bound.
    for (const mesh of meshes) {
        mesh.isPickable = pickable;
    }

    /** @type {string | null} */
    let stampId = null;
    if (trackStamp) {
        stampId = `stamp_${nextStampSeq++}`;
        const stampMeta = {
            stampId,
            partId,
            x: placement.x,
            z: placement.z,
            layer,
            playerDrop,
        };
        wrap.metadata = {
            ...(wrap.metadata || {}),
            simNetworkStamp: stampMeta,
        };
        stampsById.set(stampId, {
            stampId,
            wrap,
            entries,
            partId,
            x: placement.x,
            z: placement.z,
            layer,
            playerDrop,
        });
    }

    if (interactionContent) {
        wrap.metadata = {
            ...(wrap.metadata || {}),
            simNetworkInteraction: {
                partId,
                stampId,
                ...interactionContent,
            },
        };
    } else if (partDef.interactable === true) {
        console.warn(
            `[layoutAssembler.js]: [N/A] - [stampPlacement] - interactablePartWithoutMessage has a value of ${partId}.`
        ); //This is logged when an interactable part is missing its required title/body message.
    }

    wrap.computeWorldMatrix?.(true);
    if (freeze) {
        wrap.freezeWorldMatrix?.();
    }

    // Draw-call A/B: hide one tracked scenery layer (ghosts use trackStamp:false).
    if (
        EXPERIMENT_HIDE_LAYER != null &&
        trackStamp &&
        layer === EXPERIMENT_HIDE_LAYER
    ) {
        wrap.setEnabled(false);
    }

    stampEntries.push(entries);
    stampRoots.push(wrap);

    if (recordOccupancy) {
        occupiedCells.add(occupancyKey(placement.x, placement.z, layer));
    }

    if (!quiet) {
        console.log(
            `[layoutAssembler.js]: [N/A] - [stampPlacement] - stampName has a value of ${stampName}, stampId has a value of ${stampId}, freeze has a value of ${freeze}.`
        ); //This is logged when a single stamp is created for player drop or ghost preview.
    }

    return { wrap, entries, interactionContent, stampId };
}

/**
 * Temporary ghost stamp for drop preview (not occupancy, not pickable, not frozen).
 * @param {import('@babylonjs/core').Scene} scene
 * @param {string} partId
 * @returns {{ wrap: import('@babylonjs/core').TransformNode, entries: object, dispose: () => void } | null}
 */
export function createGhostStamp(scene, partId) {
    const layout = activeLayout;
    if (!layout) {
        return null;
    }
    const result = stampPlacement(
        scene,
        layout,
        { part: partId, x: 0, z: 0, layer: 1, rotationY: 0 },
        {
            freeze: false,
            pickable: false,
            recordOccupancy: false,
            trackStamp: false,
            namePrefix: 'simnetGhost',
        }
    );
    if (!result) {
        return null;
    }

    // Ghost stamps must not stay in the permanent stamp lists / dispose via disposeLayout only.
    const entryIndex = stampEntries.lastIndexOf(result.entries);
    if (entryIndex >= 0) {
        stampEntries.splice(entryIndex, 1);
    }
    const rootIndex = stampRoots.lastIndexOf(result.wrap);
    if (rootIndex >= 0) {
        stampRoots.splice(rootIndex, 1);
    }

    const dispose = () => {
        try {
            result.entries.dispose?.();
        } catch (error) {
            console.warn(
                `[layoutAssembler.js]: [N/A] - [createGhostStamp] - ghostEntriesDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when ghost stamp entries fail to dispose.
        }
        try {
            result.wrap.dispose?.(false, true);
        } catch (error) {
            console.warn(
                `[layoutAssembler.js]: [N/A] - [createGhostStamp] - ghostWrapDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when ghost wrap dispose fails.
        }
    };

    return { wrap: result.wrap, entries: result.entries, dispose };
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} layout
 * @returns {Promise<import('@babylonjs/core').TransformNode[]>}
 */
export async function assembleLayout(scene, layout) {
    disposeLayout();

    const host = getHost();
    const parts = Array.isArray(layout?.parts) ? layout.parts : [];
    const placements = Array.isArray(layout?.placements) ? layout.placements : [];

    activeLayout = layout;
    partById = new Map();
    occupiedCells = new Set();
    stampsById = new Map();
    nextStampSeq = 1;

    let newlyLoadedTemplates = 0;
    for (const part of parts) {
        if (!part?.id || !part?.path) {
            console.warn(
                `[layoutAssembler.js]: [N/A] - [assembleLayout] - skippingPart has a value of ${JSON.stringify(part)}.`
            ); //This is logged when a part entry is incomplete.
            continue;
        }
        partById.set(part.id, part);
        if (!templateContainers.has(part.id)) {
            const container = await host.loadAssetContainerFromPath(part.path, scene);
            templateContainers.set(part.id, container);
            newlyLoadedTemplates += 1;
        }
    }

    /** @type {import('@babylonjs/core').TransformNode[]} */
    const interactableRoots = [];
    let stamped = 0;
    for (const placement of placements) {
        const result = stampPlacement(scene, layout, placement, { quiet: true });
        if (!result) {
            continue;
        }
        stamped += 1;
        if (result.interactionContent) {
            interactableRoots.push(result.wrap);
        }
    }

    console.log(
        `[layoutAssembler.js]: [N/A] - [assembleLayout] - layoutId has a value of ${layout?.id ?? 'unnamed'}, partsCount has a value of ${parts.length}, placementsCount has a value of ${placements.length}, newlyLoadedTemplates has a value of ${newlyLoadedTemplates}, stampedCount has a value of ${stamped}, interactableCount has a value of ${interactableRoots.length}, templateCount has a value of ${templateContainers.size}, hideLayer has a value of ${EXPERIMENT_HIDE_LAYER}, mergeLayer2Walls has a value of ${MERGE_LAYER2_WALL_STAMPS}.`
    ); //This is logged once to summarize layout assembly (templates + stamps).
    return interactableRoots;
}

/**
 * Dispose stamps and template containers.
 */
export function disposeLayout() {
    for (const entries of stampEntries) {
        try {
            entries.dispose?.();
        } catch (error) {
            console.warn(
                `[layoutAssembler.js]: [N/A] - [disposeLayout] - stampDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when stamp dispose fails.
        }
    }
    stampEntries = [];

    for (const root of stampRoots) {
        try {
            root.dispose?.(false, true);
        } catch (error) {
            console.warn(
                `[layoutAssembler.js]: [N/A] - [disposeLayout] - rootDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when wrap node dispose fails.
        }
    }
    stampRoots = [];

    for (const [partId, container] of templateContainers) {
        try {
            container.dispose?.();
            console.log(
                `[layoutAssembler.js]: [N/A] - [disposeLayout] - disposedTemplateId has a value of ${partId}.`
            ); //This is logged when a template container is disposed.
        } catch (error) {
            console.warn(
                `[layoutAssembler.js]: [N/A] - [disposeLayout] - containerDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when container dispose fails.
        }
    }
    templateContainers = new Map();
    partById = new Map();
    activeLayout = null;
    occupiedCells = new Set();
    stampsById = new Map();
    nextStampSeq = 1;
}
