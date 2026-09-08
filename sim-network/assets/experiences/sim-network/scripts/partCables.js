/**
 * Sim-network wired cables — Phase 1a click–click (A* path) + Phase 1b hold–drag (drawn path).
 */

import {
    findStampFromNode,
    getActiveLayout,
    getAllStamps,
    getPartDef,
    getStampById,
    getStampLabel,
    getStampsAtCell,
} from './layoutAssembler.js';
import {
    clearDropSelection,
    pickCellAtPointer,
    showDropToast,
    makeCellOverlayMesh,
    setDroppableButtonsEnabled,
    getDropPaletteElement,
    applyPaletteButtonTooltip,
    appendPaletteOnBadge,
    PALETTE_BUTTON_TOOLTIPS,
} from './partDrop.js';
import {
    lockSimNetworkCamera,
    unlockSimNetworkCamera,
} from './partCamera.js';
import { notifyTutorialAction } from './sim-network-tutorial-coach.js';
import {
    disposeCableFlowFx,
    playCableFlowWaves,
    stopCableFlowFx,
} from './partCableFlowFx.js';
import {
    enterConnectionStatusTestMode,
    exitConnectionStatusTestMode,
    refreshConnectionStatusForStamp,
} from './partConnectionStatus.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
/** Intermediate cells may hold this many cables; endpoints are exempt for pathfinding. */
const MAX_CABLES_PER_INTERMEDIATE_CELL = 5;
const DEFAULT_MAX_CABLES = 1;
/** Main cable run height — just above the floor tiles (avoids z-fight). */
const CABLE_Y = 0.05;
/** Top of start/end vertical risers (device connection height). */
const CABLE_RISER_TOP_Y = 0.5;
/** Normal play: cables use scene depth (walls can hide them). */
const CABLE_RENDER_GROUP_NORMAL = 0;
/** Cable mode: draw after scene so paths stay readable over furniture/walls. */
const CABLE_RENDER_GROUP_ON_TOP = 1;
/** Tube radii — 25% thinner than the original buried-cable sizes. */
const CABLE_RADIUS = 0.021;
const CABLE_RADIUS_SELECTED = 0.03375;
const CABLE_RADIUS_PREVIEW = 0.0165;
/** Match droppable hover tile (fill + checker outline), light-blue. */
const PATH_OVERLAY_ALPHA = 0.4;
const PATH_OVERLAY_SCALE = 0.98;
/** Virtual id so hold–drag preview can take a lane among real cables. */
const PREVIEW_CABLE_ID = '__preview__';
/**
 * Sideways lane offsets as a fraction of cellSize (max 5 cables / intermediate cell).
 * Index order matches stable-sorted cable ids in that cell.
 */
const LANE_OFFSETS_BY_COUNT = {
    1: [0],
    2: [-0.15, 0.15],
    3: [-0.15, 0, 0.15],
    4: [-0.225, -0.075, 0.075, 0.225],
    5: [-0.3, -0.15, 0, 0.15, 0.3],
};
/** Even index = light blue; odd = dark blue. */
const CABLE_RGB_LIGHT = { r: 0.45, g: 0.72, b: 1.0 };
const CABLE_RGB_DARK = { r: 0.12, g: 0.35, b: 0.85 };

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
let cableMode = false;
/** While Test progress/results are open, cables draw on top (same as Cable mode). */
let networkTestCableXray = false;
/** @type {string | null} */
let pendingStartStampId = null;
/** @type {string | null} */
let selectedCableId = null;
/** @type {number} */
let nextCableSeq = 1;
/**
 * @type {Array<{
 *   id: string,
 *   fromStampId: string,
 *   toStampId: string,
 *   cells: Array<{ x: number, z: number }>,
 *   colorIndex: number,
 *   mesh: import('@babylonjs/core').Mesh,
 *   material: import('@babylonjs/core').StandardMaterial
 * }>}
 */
let cables = [];
/** @type {HTMLButtonElement | null} */
let cableToggleBtn = null;
/** @type {((event: Event) => void) | null} */
let onResetClearTools = null;

/** Ask explore highlight to set/clear sticky green select (no import cycle). */
const EXPLORE_SELECTION_EVENT = 'sim-network-explore-selection';
/** Ask explore highlight to show blue Cable hover FX (no import cycle). */
const CABLE_CELL_FX_EVENT = 'sim-network-cable-cell-fx';
/** Tell open cell inspector to re-render after cables change (no import cycle). */
const CABLES_CHANGED_EVENT = 'sim-network-cables-changed';

/**
 * @param {{ x: number, z: number } | null} cell
 */
function requestExploreCellSelection(cell) {
    window.dispatchEvent(
        new CustomEvent(EXPLORE_SELECTION_EVENT, { detail: { cell } })
    );
}

/**
 * Notify listeners (cell inspector) that the cable list changed.
 */
function notifyCablesChanged() {
    window.dispatchEvent(new CustomEvent(CABLES_CHANGED_EVENT));
}

/**
 * @param {{ x: number, z: number } | null} cell
 */
function requestCableCellFx(cell) {
    window.dispatchEvent(
        new CustomEvent(CABLE_CELL_FX_EVENT, { detail: { cell } })
    );
}

/**
 * Blue selected look on click–click first-device cell (wash + orbs + bars).
 * @param {{ x: number, z: number } | null} cell
 */
function requestCableSelectedCellFx(cell) {
    window.dispatchEvent(
        new CustomEvent(CABLE_CELL_FX_EVENT, { detail: { selectedCell: cell } })
    );
}
/** @type {import('@babylonjs/core').GlowLayer | null} */
let cableGlowLayer = null;
/**
 * Hold–drag gesture (Phase 1b). Null when idle.
 * @type {{
 *   startStampId: string,
 *   cells: Array<{ x: number, z: number }>,
 *   becameDrag: boolean,
 *   lastBlockedKey: string | null
 * } | null}
 */
let dragSession = null;
/** After a hold–drag ends, skip the following click–click OnPick once. */
let ignoreNextDevicePick = false;
/** @type {import('@babylonjs/core').Observer | null} */
let pointerObserver = null;
/** @type {{ mesh: import('@babylonjs/core').Mesh, material: import('@babylonjs/core').StandardMaterial } | null} */
let previewCable = null;
/**
 * Temporary blue path tiles (droppable-style fill + outline).
 * @type {Array<{ root: import('@babylonjs/core').TransformNode, material: import('@babylonjs/core').StandardMaterial }>}
 */
let pathOverlayTiles = [];
/** @type {import('@babylonjs/core').TransformNode | null} */
let cableHoverTile = null;
/** @type {import('@babylonjs/core').StandardMaterial | null} */
let cableHoverMat = null;
/** @type {{ x: number, z: number } | null} */
let cableHoverCell = null;

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.MeshBuilder !== 'object' ||
        typeof host.Color3 !== 'function' ||
        typeof host.Vector3 !== 'function' ||
        typeof host.StandardMaterial !== 'function' ||
        typeof host.GlowLayer !== 'function' ||
        typeof host.TransformNode !== 'function' ||
        typeof host.layoutCellHalfOffset !== 'function' ||
        !host.PointerEventTypes
    ) {
        throw new Error(
            'Experience host API missing cable helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * Lightweight cable edges for connectivity tests (no meshes).
 * @returns {Array<{ id: string, fromStampId: string, toStampId: string }>}
 */
export function getAllCableLinks() {
    return cables.map((cable) => ({
        id: cable.id,
        fromStampId: cable.fromStampId,
        toStampId: cable.toStampId,
    }));
}

/**
 * @returns {boolean}
 */
export function isCableModeActive() {
    return cableMode;
}

/**
 * @param {string} stampId
 * @returns {number}
 */
export function countCablesOnStamp(stampId) {
    let count = 0;
    for (const cable of cables) {
        if (cable.fromStampId === stampId || cable.toStampId === stampId) {
            count += 1;
        }
    }
    return count;
}

/**
 * @param {number} x
 * @param {number} z
 * @returns {number}
 */
export function countCablesTouchingCell(x, z) {
    let count = 0;
    for (const cable of cables) {
        if (cable.cells.some((cell) => cell.x === x && cell.z === z)) {
            count += 1;
        }
    }
    return count;
}

/**
 * @param {number} x
 * @param {number} z
 * @returns {typeof cables}
 */
export function getCablesTouchingCell(x, z) {
    return cables.filter((cable) =>
        cable.cells.some((cell) => cell.x === x && cell.z === z)
    );
}

/**
 * @param {object} partDef
 * @returns {boolean}
 */
function acceptsWiredCable(partDef) {
    const linkType = partDef?.linkType;
    return linkType === 'wired' || linkType === 'both';
}

/**
 * Max cable ports for a part (kit `maxCables`, else default 1).
 * @param {object} partDef
 * @returns {number}
 */
export function maxCablesForPart(partDef) {
    return typeof partDef?.maxCables === 'number' ? partDef.maxCables : DEFAULT_MAX_CABLES;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function alreadyConnected(a, b) {
    return cables.some(
        (cable) =>
            (cable.fromStampId === a && cable.toStampId === b) ||
            (cable.fromStampId === b && cable.toStampId === a)
    );
}

/**
 * First wired/both stamp in the cell that still has a free port (optional port check).
 * @param {number} x
 * @param {number} z
 * @param {{ requireFreePort?: boolean, excludeStampId?: string | null }} [options]
 * @returns {object | null}
 */
function findWiredStampAtCell(x, z, options = {}) {
    const requireFreePort = options.requireFreePort === true;
    const excludeStampId = options.excludeStampId ?? null;
    for (const stamp of getStampsAtCell(x, z)) {
        if (excludeStampId && stamp.stampId === excludeStampId) {
            continue;
        }
        const partDef = getPartDef(stamp.partId);
        if (!acceptsWiredCable(partDef)) {
            continue;
        }
        if (requireFreePort && countCablesOnStamp(stamp.stampId) >= maxCablesForPart(partDef)) {
            continue;
        }
        return stamp;
    }
    return null;
}

/**
 * @param {import('@babylonjs/core').AbstractMesh | null | undefined} mesh
 * @returns {object | null}
 */
function findWiredStampFromMesh(mesh) {
    const stamp = findStampFromNode(mesh);
    if (!stamp) {
        return null;
    }
    const partDef = getPartDef(stamp.partId);
    if (!acceptsWiredCable(partDef)) {
        return null;
    }
    return stamp;
}

function disposePreviewCable() {
    if (!previewCable) {
        return;
    }
    try {
        previewCable.mesh.dispose?.();
    } catch (error) {
        console.warn(
            `[partCables.js]: [N/A] - [disposePreviewCable] - meshDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when the hold–drag preview tube fails to dispose.
    }
    try {
        previewCable.material.dispose?.();
    } catch (error) {
        console.warn(
            `[partCables.js]: [N/A] - [disposePreviewCable] - materialDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when the hold–drag preview material fails to dispose.
    }
    previewCable = null;
}

/**
 * Remove all temporary blue path-cell tiles.
 */
function clearCablePathOverlay() {
    if (pathOverlayTiles.length === 0) {
        return;
    }
    for (const tile of pathOverlayTiles) {
        try {
            tile.root.dispose?.(false, true);
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [clearCablePathOverlay] - rootDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when a path overlay tile fails to dispose.
        }
    }
    pathOverlayTiles = [];
    console.log(
        `[partCables.js]: [N/A] - [clearCablePathOverlay] - cleared has a value of true.`
    ); //This is logged when cable-path cell highlights are removed.
}

/**
 * @param {string} name
 * @param {number} cellSize
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} host
 * @returns {{ root: import('@babylonjs/core').TransformNode, material: import('@babylonjs/core').StandardMaterial }}
 */
function createBlueCellTile(name, cellSize, scene, host) {
    const root = new host.TransformNode(name, scene);
    const fill = host.MeshBuilder.CreateGround(
        `${name}_fill`,
        {
            width: cellSize * PATH_OVERLAY_SCALE,
            height: cellSize * PATH_OVERLAY_SCALE,
        },
        scene
    );
    fill.parent = root;
    fill.position.y = 0.03;
    const rgb = CABLE_RGB_LIGHT;
    const material = new host.StandardMaterial(`${name}_mat`, scene);
    material.diffuseColor = new host.Color3(rgb.r, rgb.g, rgb.b);
    material.emissiveColor = new host.Color3(
        rgb.r * 0.35,
        rgb.g * 0.35,
        rgb.b * 0.35
    );
    material.alpha = PATH_OVERLAY_ALPHA;
    material.transparencyMode = 2;
    fill.material = material;
    makeCellOverlayMesh(fill, host);
    // Phase 2.3 polish: soft blue wash only (no black/white dashed borders).
    return { root, material };
}

/**
 * @param {import('@babylonjs/core').TransformNode | null} marker
 * @param {{ x: number, z: number } | null} cell
 */
function positionCableCellMarker(marker, cell) {
    const layout = getActiveLayout();
    const host = getHost();
    if (!marker || !cell || !layout) {
        marker?.setEnabled(false);
        return;
    }
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    marker.position = new host.Vector3(
        cell.x * cellSize + half,
        0,
        cell.z * cellSize + half
    );
    marker.setEnabled(true);
}

/**
 * Ensure the Cable-mode blue hover tile exists (same shape as droppable purple hover).
 * @param {import('@babylonjs/core').Scene} scene
 */
function ensureCableHoverTile(scene) {
    if (cableHoverTile) {
        return;
    }
    const layout = getActiveLayout();
    const host = getHost();
    if (!layout) {
        return;
    }
    const cellSize = layout.cellSize ?? 1;
    const built = createBlueCellTile(
        'simNetworkCableHover',
        cellSize,
        scene,
        host
    );
    cableHoverTile = built.root;
    cableHoverMat = built.material;
    cableHoverTile.setEnabled(false);
}

/**
 * @param {{ x: number, z: number } | null} cell
 */
function setCableHoverCell(cell) {
    if (!boundScene) {
        return;
    }
    // Old wash + dashed hover tile stays disabled; Phase 2.3 blue FX instead.
    if (
        cell &&
        cableHoverCell &&
        cableHoverCell.x === cell.x &&
        cableHoverCell.z === cell.z
    ) {
        return;
    }
    cableHoverCell = cell ? { ...cell } : null;
    positionCableCellMarker(cableHoverTile, null);
    requestCableCellFx(cableHoverCell);
}

function clearCableHover() {
    cableHoverCell = null;
    cableHoverTile?.setEnabled(false);
    requestCableCellFx(null);
}

/**
 * Show droppable-style blue tiles on the given cells (active cable start / drag path).
 * @param {Array<{ x: number, z: number }>} cells
 */
function setCablePathOverlay(cells) {
    clearCablePathOverlay();
    const layout = getActiveLayout();
    const host = getHost();
    if (!boundScene || !layout || !cells?.length) {
        return;
    }
    const cellSize = layout.cellSize ?? 1;
    /** @type {Set<string>} */
    const seen = new Set();
    const half = host.layoutCellHalfOffset(cellSize);

    for (let i = 0; i < cells.length; i += 1) {
        const cell = cells[i];
        const key = `${cell.x},${cell.z}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const built = createBlueCellTile(
            `simNetworkCablePathOverlay_${i}`,
            cellSize,
            boundScene,
            host
        );
        built.root.position = new host.Vector3(
            cell.x * cellSize + half,
            0,
            cell.z * cellSize + half
        );
        pathOverlayTiles.push(built);
    }

    console.log(
        `[partCables.js]: [N/A] - [setCablePathOverlay] - cellCount has a value of ${seen.size}.`
    ); //This is logged when blue path-cell tiles are shown for an active cable run.
}

/**
 * Wired device under the pointer: mesh hit, else any wired stamp in the resolved cell.
 * @param {import('@babylonjs/core').Scene} scene
 * @param {{ requireFreePort?: boolean, excludeStampId?: string | null }} [options]
 * @returns {{ stamp: object | null, cell: { x: number, z: number } | null }}
 */
function resolveWiredTargetAtPointer(scene, options = {}) {
    const meshPick = scene.pick(scene.pointerX, scene.pointerY);
    const fromMesh = findWiredStampFromMesh(meshPick?.pickedMesh);
    const cell = pickCellAtPointer(scene.pointerX, scene.pointerY);
    if (fromMesh) {
        return { stamp: fromMesh, cell: { x: fromMesh.x, z: fromMesh.z } };
    }
    if (!cell) {
        return { stamp: null, cell: null };
    }
    const stamp = findWiredStampAtCell(cell.x, cell.z, options);
    return { stamp, cell };
}

/**
 * @param {Array<{ x: number, z: number }>} cells
 */
function updatePreviewCable(cells) {
    disposePreviewCable();
    if (!cells || cells.length < 2) {
        return;
    }
    const built = createCableMesh(cells, cables.length, false, CABLE_RADIUS_PREVIEW, {
        cableId: PREVIEW_CABLE_ID,
        isPreview: true,
    });
    if (!built) {
        return;
    }
    built.material.alpha = 0.65;
    built.material.transparencyMode = 2;
    previewCable = built;
}

function clearDragSession() {
    dragSession = null;
    disposePreviewCable();
    // Keep click–click start tile if that session is still pending.
    if (!pendingStartStampId) {
        clearCablePathOverlay();
    }
}

/**
 * Shortest 4-neighbour grid path. Intermediate cells with too many cables are blocked;
 * start/end cells are always walkable for pathfinding.
 * @param {{ x: number, z: number }} start
 * @param {{ x: number, z: number }} end
 * @param {number} width
 * @param {number} depth
 * @returns {Array<{ x: number, z: number }> | null}
 */
function findGridPath(start, end, width, depth) {
    const key = (x, z) => `${x},${z}`;
    const startKey = key(start.x, start.z);
    const endKey = key(end.x, end.z);
    if (startKey === endKey) {
        return [{ x: start.x, z: start.z }];
    }

    /**
     * @param {number} x
     * @param {number} z
     * @returns {boolean}
     */
    function isBlocked(x, z) {
        if (x < 0 || z < 0 || x >= width || z >= depth) {
            return true;
        }
        const k = key(x, z);
        if (k === startKey || k === endKey) {
            return false;
        }
        return countCablesTouchingCell(x, z) >= MAX_CABLES_PER_INTERMEDIATE_CELL;
    }

    if (isBlocked(start.x, start.z) && startKey !== endKey) {
        // start exempt — never blocked via isBlocked
    }

    /** @type {Map<string, { x: number, z: number, g: number, f: number, parent: string | null }>} */
    const nodes = new Map();
    /** @type {Set<string>} */
    const open = new Set();
    /** @type {Set<string>} */
    const closed = new Set();

    const heuristic = (x, z) => Math.abs(x - end.x) + Math.abs(z - end.z);

    nodes.set(startKey, {
        x: start.x,
        z: start.z,
        g: 0,
        f: heuristic(start.x, start.z),
        parent: null,
    });
    open.add(startKey);

    const neighbours = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];

    while (open.size > 0) {
        let currentKey = null;
        let bestF = Infinity;
        for (const k of open) {
            const n = nodes.get(k);
            if (n && n.f < bestF) {
                bestF = n.f;
                currentKey = k;
            }
        }
        if (!currentKey) {
            break;
        }
        if (currentKey === endKey) {
            /** @type {Array<{ x: number, z: number }>} */
            const path = [];
            let walk = currentKey;
            while (walk) {
                const n = nodes.get(walk);
                if (!n) {
                    break;
                }
                path.push({ x: n.x, z: n.z });
                walk = n.parent;
            }
            path.reverse();
            return path;
        }

        open.delete(currentKey);
        closed.add(currentKey);
        const current = nodes.get(currentKey);
        if (!current) {
            continue;
        }

        for (const [dx, dz] of neighbours) {
            const nx = current.x + dx;
            const nz = current.z + dz;
            const nKey = key(nx, nz);
            if (closed.has(nKey) || isBlocked(nx, nz)) {
                continue;
            }
            const g = current.g + 1;
            const existing = nodes.get(nKey);
            if (!existing || g < existing.g) {
                nodes.set(nKey, {
                    x: nx,
                    z: nz,
                    g,
                    f: g + heuristic(nx, nz),
                    parent: currentKey,
                });
                open.add(nKey);
            }
        }
    }

    return null;
}

/**
 * @param {number} colorIndex
 * @returns {{ r: number, g: number, b: number }}
 */
function rgbForColorIndex(colorIndex) {
    return colorIndex % 2 === 0 ? CABLE_RGB_LIGHT : CABLE_RGB_DARK;
}

/**
 * @param {number} count
 * @param {number} index
 * @returns {number}
 */
function laneOffsetFractionFor(count, index) {
    const n = Math.max(1, Math.min(5, count | 0));
    const slots = LANE_OFFSETS_BY_COUNT[n];
    const i = Math.max(0, Math.min(slots.length - 1, index | 0));
    return slots[i];
}

/**
 * Stable peer list for a cell (optional preview id).
 * @param {number} x
 * @param {number} z
 * @param {boolean} includePreview
 * @returns {string[]}
 */
function getLanePeerIds(x, z, includePreview) {
    const ids = getCablesTouchingCell(x, z).map((cable) => cable.id);
    if (includePreview) {
        ids.push(PREVIEW_CABLE_ID);
    }
    ids.sort();
    return ids;
}

/**
 * Build tube path: rise at start (riser top → floor), run just above floor, rise at end.
 * Endpoints stay on the cell centre (pinned under the device); middle cells keep lane offsets.
 * @param {Array<{ x: number, z: number }>} cells
 * @param {number} cellSize
 * @param {number} half
 * @param {object} host
 * @param {string} cableId
 * @param {boolean} isPreview
 * @returns {import('@babylonjs/core').Vector3[]}
 */
function buildLanedPathPoints(cells, cellSize, half, host, cableId, isPreview) {
    /** @type {import('@babylonjs/core').Vector3[]} */
    const points = [];
    if (!cells.length) {
        return points;
    }
    const last = cells.length - 1;

    /**
     * @param {number} i
     * @returns {{ x: number, z: number }}
     */
    function cellWorldXZ(i) {
        const cell = cells[i];
        let offsetX = 0;
        let offsetZ = 0;
        const isEndpoint = i === 0 || i === last;
        if (!isEndpoint && cableId) {
            const peerIds = getLanePeerIds(cell.x, cell.z, isPreview);
            let laneIndex = peerIds.indexOf(cableId);
            if (laneIndex < 0) {
                laneIndex = peerIds.length;
            }
            const fraction = laneOffsetFractionFor(
                Math.max(peerIds.length, laneIndex + 1),
                laneIndex
            );
            if (fraction !== 0) {
                const prev = cells[i - 1];
                const next = cells[i + 1];
                let dx = next.x - prev.x;
                let dz = next.z - prev.z;
                let len = Math.hypot(dx, dz);
                if (len < 1e-6) {
                    dx = cell.x - prev.x;
                    dz = cell.z - prev.z;
                    len = Math.hypot(dx, dz);
                }
                if (len >= 1e-6) {
                    dx /= len;
                    dz /= len;
                    // Left of travel in XZ — keeps parallel runs side-by-side.
                    offsetX = -dz * fraction * cellSize;
                    offsetZ = dx * fraction * cellSize;
                }
            }
        }
        return {
            x: cell.x * cellSize + half + offsetX,
            z: cell.z * cellSize + half + offsetZ,
        };
    }

    const start = cellWorldXZ(0);
    // Start riser: device height → floor run.
    points.push(new host.Vector3(start.x, CABLE_RISER_TOP_Y, start.z));
    points.push(new host.Vector3(start.x, CABLE_Y, start.z));

    // Floor run through remaining cells (skip duplicating start at CABLE_Y).
    for (let i = 1; i <= last; i += 1) {
        const p = cellWorldXZ(i);
        points.push(new host.Vector3(p.x, CABLE_Y, p.z));
    }

    const end = cellWorldXZ(last);
    // End riser: floor → device height.
    points.push(new host.Vector3(end.x, CABLE_RISER_TOP_Y, end.z));

    return points;
}

/**
 * World-space tube path for an existing cable (same points as the mesh).
 * @param {{ id: string, cells: Array<{ x: number, z: number }> }} cable
 * @returns {import('@babylonjs/core').Vector3[]}
 */
export function getCableWorldPathPoints(cable) {
    const layout = getActiveLayout();
    const host = getHost();
    if (!layout || !cable?.cells?.length) {
        return [];
    }
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    return buildLanedPathPoints(
        cable.cells,
        cellSize,
        half,
        host,
        cable.id,
        false
    );
}

/** Unselected tube self-light (fraction of base blue). */
const CABLE_EMISSIVE_UNSELECTED = 0.45;
/**
 * Selected tube self-light — only a mild bump over unselected.
 * (Full emissive + GlowLayer was blowing the core out to white.)
 */
const CABLE_EMISSIVE_SELECTED = 0.58;
/** Soft light-blue halo strength on the selected cable. */
const CABLE_GLOW_INTENSITY = 0.2;
/** Selected-cable soft bloom (GlowLayer). Kept on after Experiment C ruled it out as the main rotate lag. */
const CABLE_GLOW_ENABLED = true;

/**
 * @returns {import('@babylonjs/core').GlowLayer | null}
 */
function ensureCableGlowLayer() {
    if (!CABLE_GLOW_ENABLED) {
        return null;
    }
    const host = getHost();
    if (!boundScene) {
        return null;
    }
    if (cableGlowLayer && !cableGlowLayer.isDisposed?.()) {
        return cableGlowLayer;
    }
    cableGlowLayer = new host.GlowLayer('simNetworkCableGlow', boundScene, {
        blurKernelSize: 24,
        mainTextureRatio: 0.5,
    });
    cableGlowLayer.intensity = CABLE_GLOW_INTENSITY;
    console.log(
        `[partCables.js]: [N/A] - [ensureCableGlowLayer] - glowCreated has a value of true.`
    ); //This is logged when the cable selection GlowLayer is created.
    return cableGlowLayer;
}

/**
 * @param {Array<{ x: number, z: number }>} cells
 * @param {number} colorIndex
 * @param {boolean} selected
 * @param {number} [radiusOverride]
 * @param {{ cableId?: string, isPreview?: boolean }} [options]
 * @returns {{ mesh: import('@babylonjs/core').Mesh, material: import('@babylonjs/core').StandardMaterial } | null}
 */
function createCableMesh(cells, colorIndex, selected, radiusOverride, options = {}) {
    const layout = getActiveLayout();
    const host = getHost();
    if (!boundScene || !layout || cells.length < 2) {
        return null;
    }
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    const cableId = options.cableId || '';
    const isPreview = options.isPreview === true;
    const path = buildLanedPathPoints(
        cells,
        cellSize,
        half,
        host,
        cableId,
        isPreview
    );
    const radius =
        typeof radiusOverride === 'number'
            ? radiusOverride
            : selected
              ? CABLE_RADIUS_SELECTED
              : CABLE_RADIUS;
    const mesh = host.MeshBuilder.CreateTube(
        `simNetworkCable_${nextCableSeq}_${selected ? 'sel' : 'base'}`,
        {
            path,
            radius,
            tessellation: 8,
            updatable: false,
        },
        boundScene
    );
    mesh.renderingGroupId =
        cableMode || networkTestCableXray
            ? CABLE_RENDER_GROUP_ON_TOP
            : CABLE_RENDER_GROUP_NORMAL;
    mesh.isPickable = false;

    const rgb = rgbForColorIndex(colorIndex);
    const emissiveScale = selected
        ? CABLE_EMISSIVE_SELECTED
        : CABLE_EMISSIVE_UNSELECTED;
    const material = new host.StandardMaterial(
        `simNetworkCableMat_${nextCableSeq}`,
        boundScene
    );
    material.diffuseColor = new host.Color3(rgb.r, rgb.g, rgb.b);
    material.emissiveColor = new host.Color3(
        rgb.r * emissiveScale,
        rgb.g * emissiveScale,
        rgb.b * emissiveScale
    );
    material.specularColor = new host.Color3(0.1, 0.1, 0.1);
    mesh.material = material;

    return { mesh, material };
}

/**
 * @param {object} cable
 * @param {boolean} selected
 */
function rebuildCableVisual(cable, selected) {
    const built = createCableMesh(cable.cells, cable.colorIndex, selected, undefined, {
        cableId: cable.id,
    });
    if (!built) {
        return;
    }
    try {
        cable.mesh?.dispose?.();
    } catch (error) {
        console.warn(
            `[partCables.js]: [N/A] - [rebuildCableVisual] - meshDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when rebuilding a cable mesh fails to dispose the old tube.
    }
    try {
        cable.material?.dispose?.();
    } catch (error) {
        console.warn(
            `[partCables.js]: [N/A] - [rebuildCableVisual] - materialDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when rebuilding a cable mesh fails to dispose the old material.
    }
    cable.mesh = built.mesh;
    cable.material = built.material;
}

/**
 * Rebuild every cable tube so shared-cell lanes rebalance after add/remove.
 */
function refreshCableLaneVisuals() {
    const glow = cableGlowLayer;
    const selectedId = selectedCableId;
    if (glow && !glow.isDisposed?.() && selectedId) {
        const selectedCable = cables.find((entry) => entry.id === selectedId);
        if (selectedCable?.mesh) {
            try {
                glow.removeIncludedOnlyMesh?.(selectedCable.mesh);
            } catch (error) {
                console.warn(
                    `[partCables.js]: [N/A] - [refreshCableLaneVisuals] - glowRemoveError has a value of ${error?.message || error}.`
                ); //This is logged when glow include-list clear fails before lane rebuild.
            }
        }
    }
    for (const cable of cables) {
        const selected = cable.id === selectedId;
        rebuildCableVisual(cable, selected);
        if (selected && glow && !glow.isDisposed?.() && cable.mesh) {
            glow.addIncludedOnlyMesh(cable.mesh);
        }
    }
    console.log(
        `[partCables.js]: [N/A] - [refreshCableLaneVisuals] - cableCount has a value of ${cables.length}.`
    ); //This is logged when cable tubes are rebuilt to apply per-cell lane spacing.
}

/**
 * @returns {string | null}
 */
export function getSelectedCableId() {
    return selectedCableId;
}

/**
 * Clear 3D glow / thickness selection (does not close the inspector UI).
 */
export function clearCableSelection() {
    if (!selectedCableId) {
        return;
    }
    const previousId = selectedCableId;
    const cable = cables.find((entry) => entry.id === previousId);
    selectedCableId = null;
    const glow = cableGlowLayer;
    if (glow && !glow.isDisposed?.() && cable?.mesh) {
        try {
            glow.removeIncludedOnlyMesh?.(cable.mesh);
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [clearCableSelection] - glowRemoveError has a value of ${error?.message || error}.`
            ); //This is logged when clearing glow include-list fails.
        }
    }
    if (cable) {
        rebuildCableVisual(cable, false);
    }
    console.log(
        `[partCables.js]: [N/A] - [clearCableSelection] - previousCableId has a value of ${previousId}.`
    ); //This is logged when cable highlight is cleared (panel close or switch).
}

/**
 * Highlight one cable in 3D (and mark it selected for the inspector).
 * @param {string} cableId
 * @returns {boolean}
 */
export function selectCableById(cableId) {
    const cable = cables.find((entry) => entry.id === cableId);
    if (!cable) {
        return false;
    }
    if (selectedCableId === cableId) {
        return true;
    }

    const previousId = selectedCableId;
    if (previousId) {
        const previous = cables.find((entry) => entry.id === previousId);
        if (previous) {
            const glow = cableGlowLayer;
            if (glow && !glow.isDisposed?.()) {
                try {
                    glow.removeIncludedOnlyMesh?.(previous.mesh);
                } catch (error) {
                    console.warn(
                        `[partCables.js]: [N/A] - [selectCableById] - glowRemovePrevError has a value of ${error?.message || error}.`
                    ); //This is logged when removing the previous cable from the glow layer.
                }
            }
            rebuildCableVisual(previous, false);
        }
    }

    selectedCableId = cableId;
    rebuildCableVisual(cable, true);
    const glow = ensureCableGlowLayer();
    if (glow) {
        glow.addIncludedOnlyMesh(cable.mesh);
    }
    console.log(
        `[partCables.js]: [N/A] - [selectCableById] - cableId has a value of ${cableId}.`
    ); //This is logged when the player selects a cable from the cell inspector.
    return true;
}

/**
 * @param {boolean} active
 */
function syncCableToggleButton(active) {
    if (!cableToggleBtn) {
        return;
    }
    // Cable stays btn-primary; pressed state uses Daisy btn-active + aria-pressed.
    cableToggleBtn.classList.add('btn-primary');
    cableToggleBtn.classList.remove('btn-neutral');
    cableToggleBtn.classList.toggle('btn-active', active);
    cableToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
}

/**
 * Cable mode or Test x-ray draws tubes on top; free play uses normal depth occlusion.
 */
function syncCableRenderGroups() {
    const onTop = cableMode || networkTestCableXray;
    const group = onTop
        ? CABLE_RENDER_GROUP_ON_TOP
        : CABLE_RENDER_GROUP_NORMAL;
    for (const cable of cables) {
        if (cable.mesh) {
            cable.mesh.renderingGroupId = group;
        }
    }
    if (previewCable?.mesh) {
        previewCable.mesh.renderingGroupId = group;
    }
    console.log(
        `[partCables.js]: [N/A] - [syncCableRenderGroups] - renderingGroupId has a value of ${group}, cableMode has a value of ${cableMode}, networkTestCableXray has a value of ${networkTestCableXray}, cableCount has a value of ${cables.length}.`
    ); //This is logged when cable draw-order switches with Cable mode or Test x-ray.
}

/**
 * Expose cables through furniture during Test (same draw order as Cable toggle on).
 * @param {boolean} on
 */
function setNetworkTestCableXray(on) {
    const next = Boolean(on);
    if (networkTestCableXray === next) {
        return;
    }
    networkTestCableXray = next;
    syncCableRenderGroups();
    console.log(
        `[partCables.js]: [N/A] - [setNetworkTestCableXray] - networkTestCableXray has a value of ${networkTestCableXray}.`
    ); //This is logged when Test turns cable x-ray on or off.
}

/**
 * @param {boolean} active
 * @param {{ clearExplore?: boolean }} [options] - When leaving Cable mode, clearExplore
 *   defaults true. Reset passes false so the green sticky cell can stay.
 */
export function setCableMode(active, options = {}) {
    const next = Boolean(active);
    const clearExploreOnExit = options.clearExplore !== false;
    // After a successful Test, refuse turning Cable mode back on until unlock.
    if (next && networkEditsLockedAfterPass) {
        return;
    }
    if (cableMode === next) {
        if (!next) {
            pendingStartStampId = null;
            clearDragSession();
            clearCablePathOverlay();
            clearCableHover();
            requestCableSelectedCellFx(null);
            ignoreNextDevicePick = false;
        }
        syncCableToggleButton(cableMode);
        return;
    }

    cableMode = next;
    pendingStartStampId = null;
    clearDragSession();
    clearCablePathOverlay();
    clearCableHover();
    requestCableSelectedCellFx(null);
    ignoreNextDevicePick = false;
    syncCableToggleButton(cableMode);
    syncCableRenderGroups();

    if (cableMode) {
        clearDropSelection();
        if (boundScene) {
            ensureCableHoverTile(boundScene);
        }
        lockSimNetworkCamera();
        showDropToast(
            'Click and drag cables along the grid to connect devices.'
        );
    } else {
        unlockSimNetworkCamera();
        if (clearExploreOnExit) {
            requestExploreCellSelection(null);
        }
    }

    console.log(
        `[partCables.js]: [N/A] - [setCableMode] - cableMode has a value of ${cableMode}, clearExploreOnExit has a value of ${clearExploreOnExit}.`
    ); //This is logged when the player toggles cable tool mode.
}

/**
 * @param {HTMLElement} paletteEl
 */
export function mountCableToggle(paletteEl) {
    const host = globalThis[HOST_KEY];
    const trailingIconHtml =
        typeof host?.getIcon === 'function'
            ? host.getIcon('icon_arrows_right_left', 'size-5 shrink-0')
            : '';

    cableToggleBtn = document.createElement('button');
    cableToggleBtn.type = 'button';
    cableToggleBtn.className =
        'btn btn-primary btn-lg sim-network-drop-palette__btn sim-network-drop-palette__btn--cable sim-network-drop-palette__btn--toggle';
    cableToggleBtn.replaceChildren();

    const labelEl = document.createElement('span');
    labelEl.className = 'sim-network-drop-palette__btn-label';
    labelEl.textContent = 'Cable';
    cableToggleBtn.appendChild(labelEl);

    if (trailingIconHtml) {
        const iconWrap = document.createElement('span');
        iconWrap.className = 'sim-network-drop-palette__btn-icon';
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.innerHTML = trailingIconHtml;
        cableToggleBtn.appendChild(iconWrap);
    }

    applyPaletteButtonTooltip(cableToggleBtn, PALETTE_BUTTON_TOOLTIPS.cable);
    appendPaletteOnBadge(cableToggleBtn);
    cableToggleBtn.setAttribute('data-cable-toggle', 'true');
    cableToggleBtn.setAttribute('aria-pressed', 'false');
    cableToggleBtn.addEventListener('click', () => {
        if (cableToggleBtn?.disabled || networkEditsLockedAfterPass) {
            return;
        }
        setCableMode(!cableMode);
    });
    paletteEl.prepend(cableToggleBtn);
    console.log(
        `[partCables.js]: [N/A] - [mountCableToggle] - trailingIconAttached has a value of ${Boolean(trailingIconHtml)}, tooltip has a value of ${PALETTE_BUTTON_TOOLTIPS.cable}.`
    ); //This is logged to verify the Cable button received the host getIcon SVG and tooltip.
}

/**
 * @param {boolean} enabled
 */
function setCableToggleEnabled(enabled) {
    const on = enabled !== false;
    if (!cableToggleBtn) {
        return;
    }
    cableToggleBtn.disabled = !on;
    cableToggleBtn.setAttribute('aria-disabled', on ? 'false' : 'true');
}

/**
 * Enable/disable Cable + droppable palette toggles together.
 * @param {boolean} enabled
 */
function setNetworkPaletteToolsEnabled(enabled) {
    const on = enabled !== false;
    setDroppableButtonsEnabled(on);
    setCableToggleEnabled(on);
    console.log(
        `[partCables.js]: [N/A] - [setNetworkPaletteToolsEnabled] - enabled has a value of ${on}.`
    ); //This is logged when Test locks or unlocks the left palette tools.
}

/**
 * True after a successful Test until layout replay clears the lock.
 * @returns {boolean}
 */
export function areNetworkEditsLocked() {
    return networkEditsLockedAfterPass;
}

/**
 * Clear the post-pass edit lock (e.g. player picks a layout again later).
 */
export function clearNetworkTestPassLock() {
    networkEditsLockedAfterPass = false;
    lastNetworkTestPassed = false;
    setNetworkPaletteToolsEnabled(true);
    notifyNetworkEditsLockChanged();
    console.log(
        `[partCables.js]: [N/A] - [clearNetworkTestPassLock] - unlocked has a value of true.`
    ); //This is logged when a future layout re-pick clears the successful-Test tool lock.
}

/**
 * Tell the open cell inspector to hide/show ✕ delete buttons for the lock.
 */
function notifyNetworkEditsLockChanged() {
    window.dispatchEvent(new CustomEvent('sim-network-network-edits-lock'));
}

/**
 * Exit place/cable tools, unlock camera, go home, and disable palette toggles.
 */
function prepareSceneForNetworkTest() {
    clearDropSelection();
    setCableMode(false);
    unlockSimNetworkCamera();
    const host = getNetworkTestHost();
    host.dispatchAppEvent(host.EVENTS.RESET_3D_VIEW);
    setNetworkPaletteToolsEnabled(false);
    console.log(
        `[partCables.js]: [N/A] - [prepareSceneForNetworkTest] - toolsCleared has a value of true.`
    ); //This is logged when Test turns off tools and resets the camera to home.
}

/**
 * Shared commit for click–click and hold–drag.
 * @param {object} startStamp
 * @param {object} endStamp
 * @param {Array<{ x: number, z: number }>} path
 * @param {'click-click' | 'hold-drag'} source
 * @returns {boolean}
 */
function tryCommitCable(startStamp, endStamp, path, source) {
    if (networkEditsLockedAfterPass) {
        return false;
    }
    if (!path || path.length < 2) {
        return false;
    }

    const startDef = getPartDef(startStamp.partId);
    const endDef = getPartDef(endStamp.partId);
    if (countCablesOnStamp(startStamp.stampId) >= maxCablesForPart(startDef)) {
        showDropToast('Start device has no free cable ports.');
        return false;
    }
    if (countCablesOnStamp(endStamp.stampId) >= maxCablesForPart(endDef)) {
        showDropToast('That device has no free cable ports.');
        return false;
    }
    if (alreadyConnected(startStamp.stampId, endStamp.stampId)) {
        return false;
    }

    const colorIndex = cables.length;
    const id = `cable_${nextCableSeq++}`;
    cables.push({
        id,
        fromStampId: startStamp.stampId,
        toStampId: endStamp.stampId,
        cells: path.map((cell) => ({ x: cell.x, z: cell.z })),
        colorIndex,
        mesh: null,
        material: null,
    });
    refreshCableLaneVisuals();
    const committed = cables.find((entry) => entry.id === id);
    if (!committed?.mesh) {
        const index = cables.findIndex((entry) => entry.id === id);
        if (index >= 0) {
            cables.splice(index, 1);
        }
        return false;
    }
    clearCablePathOverlay();
    // Keep Cable mode on and camera locked so the next cable can run without re-toggling.
    console.log(
        `[partCables.js]: [N/A] - [tryCommitCable] - cableId has a value of ${id}, source has a value of ${source}, cellCount has a value of ${path.length}, colorIndex has a value of ${colorIndex}, cableModeStaysOn has a value of ${cableMode}.`
    ); //This is logged when a wired cable is committed from click–click or hold–drag.
    notifyTutorialAction({
        type: 'cable',
        a: { partId: startStamp.partId, x: startStamp.x, z: startStamp.z },
        b: { partId: endStamp.partId, x: endStamp.x, z: endStamp.z },
    });
    refreshConnectionStatusForStamp(startStamp.stampId);
    refreshConnectionStatusForStamp(endStamp.stampId);
    notifyCablesChanged();
    return true;
}

/**
 * Click–click cable endpoint from an interactable stamp root.
 * @param {import('@babylonjs/core').TransformNode} root
 */
export function handleCableDevicePick(root) {
    if (!cableMode) {
        return;
    }
    if (ignoreNextDevicePick) {
        ignoreNextDevicePick = false;
        console.log(
            `[partCables.js]: [N/A] - [handleCableDevicePick] - ignoredAfterHoldDrag has a value of true.`
        ); //This is logged when click–click is skipped after a hold–drag gesture.
        return;
    }
    if (dragSession?.becameDrag) {
        return;
    }

    const stampId = root?.metadata?.simNetworkStamp?.stampId;
    const stamp = typeof stampId === 'string' ? getStampById(stampId) : null;
    if (!stamp) {
        return;
    }
    handleCableStampPick(stamp);
}

/**
 * Click–click cable logic from a resolved stamp (device mesh or any object in its cell).
 * @param {object} stamp
 */
function handleCableStampPick(stamp) {
    if (!cableMode || !stamp) {
        return;
    }
    if (dragSession?.becameDrag) {
        return;
    }

    const partDef = getPartDef(stamp.partId);
    if (!acceptsWiredCable(partDef)) {
        console.log(
            `[partCables.js]: [N/A] - [handleCableStampPick] - refusedWifiOnlyPartId has a value of ${stamp.partId}.`
        ); //This is logged when a wifi-only part is chosen in cable mode.
        return;
    }

    if (!pendingStartStampId) {
        if (countCablesOnStamp(stamp.stampId) >= maxCablesForPart(partDef)) {
            showDropToast('That device has no free cable ports.');
            return;
        }
        pendingStartStampId = stamp.stampId;
        clearCablePathOverlay();
        requestCableSelectedCellFx({ x: stamp.x, z: stamp.z });
        lockSimNetworkCamera();
        console.log(
            `[partCables.js]: [N/A] - [handleCableStampPick] - pendingStartStampId has a value of ${pendingStartStampId}.`
        ); //This is logged when the first click–click cable endpoint is chosen.
        return;
    }

    if (pendingStartStampId === stamp.stampId) {
        pendingStartStampId = null;
        clearCablePathOverlay();
        requestCableSelectedCellFx(null);
        return;
    }

    const startStamp = getStampById(pendingStartStampId);
    if (!startStamp) {
        pendingStartStampId = null;
        clearCablePathOverlay();
        requestCableSelectedCellFx(null);
        return;
    }

    const layout = getActiveLayout();
    if (!layout) {
        return;
    }
    const width = layout.width ?? 0;
    const depth = layout.depth ?? 0;
    const path = findGridPath(
        { x: startStamp.x, z: startStamp.z },
        { x: stamp.x, z: stamp.z },
        width,
        depth
    );
    if (!path || path.length < 2) {
        showDropToast('No free cable path between those devices.');
        console.log(
            `[partCables.js]: [N/A] - [handleCableStampPick] - pathBlockedFromTo has a value of ${startStamp.stampId}->${stamp.stampId}.`
        ); //This is logged when A* cannot find a route under the per-cell cable cap.
        pendingStartStampId = null;
        clearCablePathOverlay();
        requestCableSelectedCellFx(null);
        return;
    }

    tryCommitCable(startStamp, stamp, path, 'click-click');
    pendingStartStampId = null;
    clearCablePathOverlay();
    requestCableSelectedCellFx(null);
}

/**
 * While hold–dragging: rebuild the shortest free path from the start cell to the pointer cell.
 * @param {{ x: number, z: number }} cell
 */
function updateDragPathToCell(cell) {
    if (!dragSession) {
        return;
    }
    const startStamp = getStampById(dragSession.startStampId);
    if (!startStamp) {
        return;
    }
    const layout = getActiveLayout();
    if (!layout) {
        return;
    }

    const last = dragSession.cells[dragSession.cells.length - 1];
    if (last && last.x === cell.x && last.z === cell.z) {
        return;
    }

    const startCell = { x: startStamp.x, z: startStamp.z };
    const path = findGridPath(
        startCell,
        cell,
        layout.width ?? 0,
        layout.depth ?? 0
    );
    if (!path || path.length < 1) {
        const key = `${cell.x},${cell.z}`;
        if (dragSession.lastBlockedKey !== key) {
            dragSession.lastBlockedKey = key;
            console.log(
                `[partCables.js]: [N/A] - [updateDragPathToCell] - noPathToCell has a value of ${key}.`
            ); //This is logged when hold–drag A* cannot reach the pointer cell under the cable cap.
        }
        return;
    }

    dragSession.cells = path.map((entry) => ({ x: entry.x, z: entry.z }));
    dragSession.lastBlockedKey = null;
    if (path.length > 1) {
        dragSession.becameDrag = true;
        pendingStartStampId = null;
        requestCableSelectedCellFx(null);
    }
    updatePreviewCable(dragSession.cells);
    setCablePathOverlay(dragSession.cells);
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
function finishHoldDrag(scene) {
    if (!dragSession) {
        return;
    }

    const session = dragSession;
    if (!session.becameDrag) {
        clearDragSession();
        // Own click–click here so furniture/walls in the cell work (OnPick only fires on interactables).
        ignoreNextDevicePick = true;
        const { stamp, cell } = resolveWiredTargetAtPointer(scene);
        if (stamp) {
            handleCableStampPick(stamp);
        }
        return;
    }

    ignoreNextDevicePick = true;
    const startStamp = getStampById(session.startStampId);
    if (!startStamp) {
        clearDragSession();
        return;
    }

    const { stamp: endStamp } = resolveWiredTargetAtPointer(scene, {
        excludeStampId: startStamp.stampId,
    });

    if (!endStamp || endStamp.stampId === startStamp.stampId) {
        clearDragSession();
        console.log(
            `[partCables.js]: [N/A] - [finishHoldDrag] - cancelledMissingEnd has a value of true.`
        ); //This is logged when hold–drag ends without a valid second device.
        return;
    }

    const layout = getActiveLayout();
    if (!layout) {
        clearDragSession();
        return;
    }
    const path = findGridPath(
        { x: startStamp.x, z: startStamp.z },
        { x: endStamp.x, z: endStamp.z },
        layout.width ?? 0,
        layout.depth ?? 0
    );
    if (!path || path.length < 2) {
        showDropToast('No free cable path between those devices.');
        clearDragSession();
        console.log(
            `[partCables.js]: [N/A] - [finishHoldDrag] - pathBlockedFromTo has a value of ${startStamp.stampId}->${endStamp.stampId}.`
        ); //This is logged when hold–drag ends but A* cannot connect the two devices.
        return;
    }

    tryCommitCable(startStamp, endStamp, path, 'hold-drag');
    clearDragSession();
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
function attachCablePointerObserver(scene) {
    const host = getHost();
    if (!host.PointerEventTypes) {
        throw new Error(
            'Experience host API missing PointerEventTypes for cable drag.'
        );
    }

    ensureCableHoverTile(scene);

    pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        if (!cableMode) {
            return;
        }
        const type = pointerInfo.type;

        if (type === host.PointerEventTypes.POINTERMOVE) {
            const cell = pickCellAtPointer(scene.pointerX, scene.pointerY);
            setCableHoverCell(cell);
            if (dragSession && cell) {
                updateDragPathToCell(cell);
            }
            return;
        }

        if (type === host.PointerEventTypes.POINTERDOWN) {
            const { stamp } = resolveWiredTargetAtPointer(scene);
            if (!stamp) {
                return;
            }
            const partDef = getPartDef(stamp.partId);
            if (countCablesOnStamp(stamp.stampId) >= maxCablesForPart(partDef)) {
                showDropToast('That device has no free cable ports.');
                return;
            }
            dragSession = {
                startStampId: stamp.stampId,
                cells: [{ x: stamp.x, z: stamp.z }],
                becameDrag: false,
                lastBlockedKey: null,
            };
            setCablePathOverlay([{ x: stamp.x, z: stamp.z }]);
            // Same as droppable place cycle / click–click first device: lock for this cable run.
            lockSimNetworkCamera();
            console.log(
                `[partCables.js]: [N/A] - [attachCablePointerObserver] - dragStartStampId has a value of ${stamp.stampId}.`
            ); //This is logged when a potential hold–drag begins on a wired device.
            return;
        }

        if (type === host.PointerEventTypes.POINTERUP) {
            if (!dragSession) {
                return;
            }
            finishHoldDrag(scene);
        }
    });
}

/**
 * Human label for a cable row in the cell inspector.
 * @param {string} cableId
 * @returns {string}
 */
export function getCableLabel(cableId) {
    const cable = cables.find((entry) => entry.id === cableId);
    if (!cable) {
        return 'Cable';
    }
    const fromLabel = getStampLabel(getStampById(cable.fromStampId));
    const toLabel = getStampLabel(getStampById(cable.toStampId));
    return `${fromLabel} ↔ ${toLabel}`;
}

/**
 * @param {string} cableId
 * @param {{ skipLaneRefresh?: boolean }} [options]
 * @returns {boolean}
 */
export function removeCableById(cableId, options = {}) {
    const index = cables.findIndex((cable) => cable.id === cableId);
    if (index < 0) {
        return false;
    }
    if (selectedCableId === cableId) {
        clearCableSelection();
    }
    const [cable] = cables.splice(index, 1);
    const fromStampId = cable.fromStampId;
    const toStampId = cable.toStampId;
    try {
        cable.mesh?.dispose?.();
    } catch (error) {
        console.warn(
            `[partCables.js]: [N/A] - [removeCableById] - meshDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when a cable tube fails to dispose.
    }
    try {
        cable.material?.dispose?.();
    } catch (error) {
        console.warn(
            `[partCables.js]: [N/A] - [removeCableById] - materialDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when a cable material fails to dispose.
    }
    if (!options.skipLaneRefresh) {
        refreshCableLaneVisuals();
    }
    refreshConnectionStatusForStamp(fromStampId);
    refreshConnectionStatusForStamp(toStampId);
    notifyCablesChanged();
    console.log(
        `[partCables.js]: [N/A] - [removeCableById] - cableId has a value of ${cableId}.`
    ); //This is logged when the player removes a cable from the cell inspector.
    return true;
}

/**
 * Remove every cable attached to a stamp (e.g. when a droppable is deleted).
 * @param {string} stampId
 * @returns {number}
 */
export function removeCablesForStamp(stampId) {
    const ids = cables
        .filter(
            (cable) =>
                cable.fromStampId === stampId || cable.toStampId === stampId
        )
        .map((cable) => cable.id);
    for (const id of ids) {
        removeCableById(id, { skipLaneRefresh: true });
    }
    if (ids.length > 0) {
        refreshCableLaneVisuals();
    }
    if (pendingStartStampId === stampId) {
        pendingStartStampId = null;
        clearCablePathOverlay();
        requestCableSelectedCellFx(null);
    }
    if (dragSession?.startStampId === stampId) {
        clearDragSession();
    }
    return ids.length;
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
export function initializePartCables(scene) {
    clearCableSelection();
    clearDragSession();
    ignoreNextDevicePick = false;
    if (boundScene && pointerObserver) {
        boundScene.onPointerObservable.remove(pointerObserver);
    }
    pointerObserver = null;

    for (const cable of cables) {
        try {
            cable.mesh.dispose?.();
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [initializePartCables] - meshDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when leftover cable tubes fail to dispose on init.
        }
        try {
            cable.material.dispose?.();
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [initializePartCables] - materialDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when leftover cable materials fail to dispose on init.
        }
    }
    cables = [];
    cableMode = false;
    pendingStartStampId = null;
    clearCablePathOverlay();
    clearCableHover();
    try {
        cableHoverTile?.dispose?.(false, true);
    } catch (error) {
        console.warn(
            `[partCables.js]: [N/A] - [initializePartCables] - hoverDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when the cable hover tile fails to dispose on init.
    }
    cableHoverTile = null;
    cableHoverMat = null;
    nextCableSeq = 1;
    boundScene = scene;
    if (cableGlowLayer && !cableGlowLayer.isDisposed?.()) {
        cableGlowLayer.dispose();
    }
    cableGlowLayer = null;
    // Keep cableToggleBtn if the palette already mounted it (drop init runs first).
    syncCableToggleButton(false);
    attachCablePointerObserver(scene);

    const host = globalThis[HOST_KEY];
    if (host?.EVENTS?.RESET_3D_VIEW) {
        if (onResetClearTools) {
            window.removeEventListener(host.EVENTS.RESET_3D_VIEW, onResetClearTools);
        }
        // Always turn off Cable + droppable on Reset (camera unlock stays in partCamera).
        // Preserve green explore sticky cell (clearExplore: false).
        onResetClearTools = () => {
            clearDropSelection();
            setCableMode(false, { clearExplore: false });
            console.log(
                `[partCables.js]: [N/A] - [onResetClearTools] - toolsClearedForReset has a value of true.`
            ); //This is logged when Reset view turns off Cable/droppable toggles.
        };
        window.addEventListener(host.EVENTS.RESET_3D_VIEW, onResetClearTools);
    }

    console.log(
        `[partCables.js]: [N/A] - [initializePartCables] - boundSceneReady has a value of true.`
    ); //This is logged when cable system boots for the sim-network scene.
}

/**
 * Tear down cables and mode state. Does not remove the Cable button (palette owns that).
 */
export function disposePartCables() {
    clearCableSelection();
    clearDragSession();
    ignoreNextDevicePick = false;
    if (boundScene && pointerObserver) {
        boundScene.onPointerObservable.remove(pointerObserver);
    }
    pointerObserver = null;

    for (const cable of cables) {
        try {
            cable.mesh.dispose?.();
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [disposePartCables] - meshDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when cable tubes fail to dispose on scene exit.
        }
        try {
            cable.material.dispose?.();
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [disposePartCables] - materialDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when cable materials fail to dispose on scene exit.
        }
    }
    cables = [];
    cableMode = false;
    pendingStartStampId = null;
    clearCablePathOverlay();
    clearCableHover();
    try {
        cableHoverTile?.dispose?.(false, true);
    } catch (error) {
        console.warn(
            `[partCables.js]: [N/A] - [disposePartCables] - hoverDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when the cable hover tile fails to dispose on scene exit.
    }
    cableHoverTile = null;
    cableHoverMat = null;
    nextCableSeq = 1;
    cableToggleBtn = null;
    if (cableGlowLayer && !cableGlowLayer.isDisposed?.()) {
        cableGlowLayer.dispose();
    }
    cableGlowLayer = null;
    boundScene = null;

    const host = globalThis[HOST_KEY];
    if (host?.EVENTS?.RESET_3D_VIEW && onResetClearTools) {
        window.removeEventListener(host.EVENTS.RESET_3D_VIEW, onResetClearTools);
    }
    onResetClearTools = null;
}

/* --------------------------------------------------------------------------
   Phase 3 — Network Test (wired connectivity). Kept in this file so the scene
   does not depend on a separate public script URL that was 404ing in browser.
   -------------------------------------------------------------------------- */

const NETWORK_TEST_DIALOG_ID = 'sim-network-network-test-dialog';

/**
 * Flow listens for this after a successful Test.
 * tutorial: retry | continue — office: retry | back-title
 */
export const EVENT_SIM_NETWORK_TEST_FLOW = 'sim-network:test-flow-action';
const NETWORK_TEST_ROUTER_PART_ID = 'router';
/** Unreachable devices — clear red (not orange), softer than connected blue. */
const NETWORK_TEST_FAIL_RGB = { r: 0.82, g: 0.08, b: 0.1 };
const NETWORK_TEST_FAIL_ALPHA = 0.4;
/** Connected devices — strong cyan/blue (readable opposite of fail red). */
const NETWORK_TEST_CONNECTED_RGB = { r: 0.25, g: 0.55, b: 1.0 };
const NETWORK_TEST_CONNECTED_ALPHA = 0.55;
/** Progress morph duration (button → filled bar) before results show. */
const NETWORK_TEST_PROGRESS_MS = 3000;
const NETWORK_TEST_LABEL_IDLE = 'Test Connection';
const NETWORK_TEST_LABEL_TESTING = 'Testing connectivity...';
const NETWORK_TEST_LABEL_PASS = 'All devices reachable.';
const NETWORK_TEST_LABEL_FAIL = 'Unreachable devices found...';
const NETWORK_TEST_PCT_COMPLETED_SUFFIX = ' - test completed.';
const NETWORK_TEST_PCT_FAIL_SUFFIX = ' devices connected.';
/** Idle Test Connection button sizing (Daisy btn-lg). */
const NETWORK_TEST_BTN_LAYOUT_CLASSES =
    'btn btn-lg btn-block h-auto min-h-14 whitespace-normal';
const NETWORK_TEST_ALERT_BASE_CLASSES =
    'alert alert-vertical sm:alert-horizontal sim-network-test-alert min-w-[300px] w-full pointer-events-none';
const NETWORK_TEST_PROGRESS_BASE_CLASSES = 'progress w-full h-3 mt-2';
const PALETTE_WIDE_TEST_CLASS = 'sim-network-drop-palette--wide-test';

/** @type {HTMLElement | null} */
let networkTestControlEl = null;
/** @type {HTMLButtonElement | null} */
let networkTestBtn = null;
/** @type {HTMLElement | null} */
let networkTestAlertEl = null;
/** @type {HTMLElement | null} */
let networkTestTitleEl = null;
/** @type {HTMLElement | null} */
let networkTestDescEl = null;
/** @type {HTMLProgressElement | null} */
let networkTestProgressEl = null;
/** @type {'idle' | 'testing' | 'pass' | 'fail'} */
let networkTestUiState = 'idle';
/** @type {number | null} */
let networkTestProgressRafId = null;
/** @type {ReturnType<typeof evaluateNetworkTest> | null} */
let networkTestPendingResult = null;
/** @type {{ open: Function, close: Function, dispose: Function, getDialogElement: Function } | null} */
let networkTestDialogApi = null;
/** @type {((this: HTMLDialogElement, ev: Event) => void) | null} */
let networkTestDialogCloseHandler = null;
/**
 * Meshes tinted for the open Test result (fail red / connected blue).
 * Explore hover must not clear these until Try again / Retry / Continue / Back to title.
 * @type {Map<import('@babylonjs/core').AbstractMesh, 'fail' | 'connected'>}
 */
let networkTestOverlayByMesh = new Map();
/** Last Test result — used when the results dialog closes. */
let lastNetworkTestPassed = false;
/** After a successful Test, palette tools + inspector deletes stay locked. */
let networkEditsLockedAfterPass = false;
/** @type {'tutorial' | 'office'} */
let networkTestStageRole = 'office';

/**
 * @returns {object}
 */
function getNetworkTestHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.createGenericDialogPanel !== 'function' ||
        typeof host.getPlayerUiRoot !== 'function' ||
        typeof host.Color3 !== 'function' ||
        typeof host.dispatchAppEvent !== 'function' ||
        !host.EVENTS?.RESET_3D_VIEW
    ) {
        throw new Error(
            'Experience host API missing network-test helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @param {object | null | undefined} partDef
 * @returns {boolean}
 */
function isWiredOrBothLink(partDef) {
    const linkType = partDef?.linkType;
    return linkType === 'wired' || linkType === 'both';
}

/**
 * @param {object} stamp
 * @returns {boolean}
 */
function isStartStamp(stamp) {
    return getPartDef(stamp?.partId)?.kind === 'START';
}

/**
 * @param {Array<{ fromStampId: string, toStampId: string }>} links
 * @returns {Map<string, Set<string>>}
 */
function buildNetworkAdjacency(links) {
    /** @type {Map<string, Set<string>>} */
    const adj = new Map();
    const add = (a, b) => {
        if (!adj.has(a)) {
            adj.set(a, new Set());
        }
        adj.get(a).add(b);
    };
    for (const link of links) {
        if (!link?.fromStampId || !link?.toStampId) {
            continue;
        }
        add(link.fromStampId, link.toStampId);
        add(link.toStampId, link.fromStampId);
    }
    return adj;
}

/**
 * @param {string[]} startIds
 * @param {Map<string, Set<string>>} adj
 * @returns {Set<string>}
 */
function collectReachableFrom(startIds, adj) {
    /** @type {Set<string>} */
    const reached = new Set();
    /** @type {string[]} */
    const queue = [];
    for (const id of startIds) {
        if (!id || reached.has(id)) {
            continue;
        }
        reached.add(id);
        queue.push(id);
    }
    while (queue.length > 0) {
        const id = queue.shift();
        for (const next of adj.get(id) || []) {
            if (reached.has(next)) {
                continue;
            }
            reached.add(next);
            queue.push(next);
        }
    }
    return reached;
}

/**
 * Hop distance from a start stamp through the cable graph (for flow direction).
 * @param {string} startId
 * @param {Map<string, Set<string>>} adj
 * @returns {Map<string, number>}
 */
function buildStampDistanceFrom(startId, adj) {
    /** @type {Map<string, number>} */
    const dist = new Map();
    if (!startId) {
        return dist;
    }
    /** @type {string[]} */
    const queue = [startId];
    dist.set(startId, 0);
    while (queue.length > 0) {
        const id = queue.shift();
        const d = dist.get(id) ?? 0;
        for (const next of adj.get(id) || []) {
            if (dist.has(next)) {
                continue;
            }
            dist.set(next, d + 1);
            queue.push(next);
        }
    }
    return dist;
}

/**
 * Build Wave A (Cupboard→Router) and Wave B (everything else on the connected subgraph).
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 * @returns {{
 *   waveA: Array<{ id: string, points: import('@babylonjs/core').Vector3[] }>,
 *   waveB: Array<{ id: string, points: import('@babylonjs/core').Vector3[] }>
 * }}
 */
function collectConnectedCableFlowWaves(result) {
    /** @type {Array<{ id: string, points: import('@babylonjs/core').Vector3[] }>} */
    const waveA = [];
    /** @type {Array<{ id: string, points: import('@babylonjs/core').Vector3[] }>} */
    const waveB = [];
    if (!result?.startStamp || !result.hasDirectRouter) {
        return { waveA, waveB };
    }

    const startId = result.startStamp.stampId;
    const links = getAllCableLinks();
    const adj = buildNetworkAdjacency(links);
    const neighbours = adj.get(startId) || new Set();
    /** @type {string[]} */
    const directRouterIds = [];
    for (const neighbourId of neighbours) {
        const neighbour = getStampById(neighbourId);
        if (
            neighbour?.playerDrop === true &&
            neighbour.partId === NETWORK_TEST_ROUTER_PART_ID
        ) {
            directRouterIds.push(neighbourId);
        }
    }
    if (directRouterIds.length === 0) {
        return { waveA, waveB };
    }

    const reached = collectReachableFrom(directRouterIds, adj);
    /** @type {Set<string>} */
    const energized = new Set([startId, ...reached]);
    const dist = buildStampDistanceFrom(startId, adj);
    /** @type {Set<string>} */
    const routerIdSet = new Set(directRouterIds);

    for (const cable of cables) {
        if (
            !energized.has(cable.fromStampId) ||
            !energized.has(cable.toStampId)
        ) {
            continue;
        }
        let points = getCableWorldPathPoints(cable);
        if (points.length < 2) {
            continue;
        }
        const dFrom = dist.get(cable.fromStampId);
        const dTo = dist.get(cable.toStampId);
        if (
            typeof dFrom === 'number' &&
            typeof dTo === 'number' &&
            dFrom > dTo
        ) {
            points = points.slice().reverse();
        }
        const isWaveA =
            (cable.fromStampId === startId &&
                routerIdSet.has(cable.toStampId)) ||
            (cable.toStampId === startId &&
                routerIdSet.has(cable.fromStampId));
        const entry = { id: cable.id, points };
        if (isWaveA) {
            waveA.push(entry);
        } else {
            waveB.push(entry);
        }
    }

    console.log(
        `[partCables.js]: [N/A] - [collectConnectedCableFlowWaves] - waveACount has a value of ${waveA.length}, waveBCount has a value of ${waveB.length}, energizedCount has a value of ${energized.size}.`
    ); //This is logged when Test builds particle paths for connected cables only.
    return { waveA, waveB };
}

/**
 * Start looping packet streams on connected cables (partial success included).
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function startNetworkTestCableFlow(result) {
    stopCableFlowFx();
    if (!boundScene) {
        console.log(
            `[partCables.js]: [N/A] - [startNetworkTestCableFlow] - boundScene has a value of null.`
        ); //This is logged when Test cannot start cable-flow particles without a scene.
        return;
    }
    const { waveA, waveB } = collectConnectedCableFlowWaves(result);
    if (waveA.length === 0 && waveB.length === 0) {
        setNetworkTestCableXray(false);
        console.log(
            `[partCables.js]: [N/A] - [startNetworkTestCableFlow] - flowCount has a value of 0.`
        ); //This is logged when Test has no connected cables to animate.
        return;
    }
    setNetworkTestCableXray(true);
    playCableFlowWaves(boundScene, waveA, waveB, {
        progressMs: NETWORK_TEST_PROGRESS_MS,
    });
}

/** Hard-clear Test cable-flow particles + cable x-ray (dialog exit / dispose / re-test). */
function clearNetworkTestCableFlow() {
    stopCableFlowFx();
    setNetworkTestCableXray(false);
}

/**
 * @returns {{
 *   passed: boolean,
 *   startStamp: object | null,
 *   hasDirectRouter: boolean,
 *   connected: object[],
 *   missing: object[],
 *   notes: string[]
 * }}
 */
function evaluateNetworkTest() {
    const stamps = getAllStamps();
    const links = getAllCableLinks();
    const adj = buildNetworkAdjacency(links);
    /** @type {string[]} */
    const notes = [];

    const startStamp = stamps.find((stamp) => isStartStamp(stamp)) || null;
    if (!startStamp) {
        notes.push('No Comms Cupboard (START) found in this layout.');
        return {
            passed: false,
            startStamp: null,
            hasDirectRouter: false,
            connected: [],
            missing: [],
            notes,
        };
    }

    const required = stamps.filter((stamp) => {
        if (isStartStamp(stamp)) {
            return false;
        }
        return isWiredOrBothLink(getPartDef(stamp.partId));
    });

    const neighbours = adj.get(startStamp.stampId) || new Set();
    /** @type {string[]} */
    const directRouterIds = [];
    for (const neighbourId of neighbours) {
        const neighbour = getStampById(neighbourId);
        if (
            neighbour?.playerDrop === true &&
            neighbour.partId === NETWORK_TEST_ROUTER_PART_ID
        ) {
            directRouterIds.push(neighbourId);
        }
    }
    const hasDirectRouter = directRouterIds.length > 0;
    if (!hasDirectRouter) {
        notes.push(
            'Comms Cupboard must have a direct cable to a player-placed Router.'
        );
    }

    const reached = hasDirectRouter
        ? collectReachableFrom(directRouterIds, adj)
        : new Set();
    /** @type {object[]} */
    const connected = [];
    /** @type {object[]} */
    const missing = [];
    for (const stamp of required) {
        if (reached.has(stamp.stampId)) {
            connected.push(stamp);
        } else {
            missing.push(stamp);
        }
    }

    const passed = hasDirectRouter && missing.length === 0;
    console.log(
        `[partCables.js]: [N/A] - [evaluateNetworkTest] - passed has a value of ${passed}, hasDirectRouter has a value of ${hasDirectRouter}, connectedCount has a value of ${connected.length}, missingCount has a value of ${missing.length}, cableCount has a value of ${links.length}.`
    ); //This is logged when Test evaluates wired reachability from the Comms Cupboard.
    return {
        passed,
        startStamp,
        hasDirectRouter,
        connected,
        missing,
        notes,
    };
}

function clearNetworkTestFailHighlights() {
    for (const mesh of networkTestOverlayByMesh.keys()) {
        try {
            if (mesh && !mesh.isDisposed?.()) {
                mesh.renderOverlay = false;
            }
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [clearNetworkTestFailHighlights] - clearError has a value of ${error?.message || error}.`
            ); //This is logged when clearing a Test result overlay fails on a disposed mesh.
        }
    }
    networkTestOverlayByMesh.clear();
    exitConnectionStatusTestMode();
}

/**
 * True while a mesh is showing Test result blue/red (protect from explore hover).
 * @param {import('@babylonjs/core').AbstractMesh | null | undefined} mesh
 * @returns {boolean}
 */
export function isNetworkTestResultOverlayMesh(mesh) {
    return Boolean(mesh && networkTestOverlayByMesh.has(mesh));
}

/**
 * Re-apply fail/connected overlay after explore hover tried to clear it.
 * @param {import('@babylonjs/core').AbstractMesh | null | undefined} mesh
 * @returns {boolean}
 */
export function restoreNetworkTestResultOverlay(mesh) {
    if (!mesh || mesh.isDisposed?.()) {
        return false;
    }
    const kind = networkTestOverlayByMesh.get(mesh);
    if (!kind) {
        return false;
    }
    const host = getNetworkTestHost();
    const rgb = kind === 'connected' ? NETWORK_TEST_CONNECTED_RGB : NETWORK_TEST_FAIL_RGB;
    const alpha =
        kind === 'connected' ? NETWORK_TEST_CONNECTED_ALPHA : NETWORK_TEST_FAIL_ALPHA;
    mesh.renderOverlay = true;
    mesh.overlayColor = new host.Color3(rgb.r, rgb.g, rgb.b);
    mesh.overlayAlpha = alpha;
    return true;
}

/**
 * @param {object[]} stamps
 * @param {'fail' | 'connected'} kind
 */
function applyNetworkTestOverlayToStamps(stamps, kind) {
    if (!stamps?.length) {
        return;
    }
    const host = getNetworkTestHost();
    const rgb = kind === 'connected' ? NETWORK_TEST_CONNECTED_RGB : NETWORK_TEST_FAIL_RGB;
    const alpha =
        kind === 'connected' ? NETWORK_TEST_CONNECTED_ALPHA : NETWORK_TEST_FAIL_ALPHA;
    for (const stamp of stamps) {
        for (const mesh of stamp.wrap?.getChildMeshes?.(false) || []) {
            mesh.renderOverlay = true;
            mesh.overlayColor = new host.Color3(rgb.r, rgb.g, rgb.b);
            mesh.overlayAlpha = alpha;
            networkTestOverlayByMesh.set(mesh, kind);
        }
    }
}

/**
 * @param {object[]} stamps
 */
function highlightNetworkTestMissingStamps(stamps) {
    applyNetworkTestOverlayToStamps(stamps, 'fail');
    console.log(
        `[partCables.js]: [N/A] - [highlightNetworkTestMissingStamps] - stampCount has a value of ${stamps.length}.`
    ); //This is logged when unreachable devices are tinted red after a failed Test.
}

/**
 * @param {object[]} stamps
 */
function highlightNetworkTestConnectedStamps(stamps) {
    applyNetworkTestOverlayToStamps(stamps, 'connected');
    console.log(
        `[partCables.js]: [N/A] - [highlightNetworkTestConnectedStamps] - stampCount has a value of ${stamps.length}.`
    ); //This is logged when connected devices are tinted blue after Test (pass or partial fail).
}

/**
 * Paint blue (connected) and optional red (missing) for the open result dialog.
 * When Router link is OK, also treat the Comms Cupboard (START) as connected for
 * blue overlay + status mesh — it is the source, so it is not in result.connected.
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function applyNetworkTestResultOverlays(result) {
    clearNetworkTestFailHighlights();
    /** @type {object[]} */
    const connectedForVisuals = [...(result.connected || [])];
    if (result.hasDirectRouter && result.startStamp) {
        connectedForVisuals.push(result.startStamp);
    }
    highlightNetworkTestConnectedStamps(connectedForVisuals);
    if (!result.passed) {
        highlightNetworkTestMissingStamps(result.missing);
    }
    enterConnectionStatusTestMode(
        connectedForVisuals.map((stamp) => stamp.stampId)
    );
    console.log(
        `[partCables.js]: [N/A] - [applyNetworkTestResultOverlays] - connectedCount has a value of ${result.connected.length}, includeStartStamp has a value of ${Boolean(result.hasDirectRouter && result.startStamp)}, missingCount has a value of ${result.missing.length}, overlayMeshCount has a value of ${networkTestOverlayByMesh.size}.`
    ); //This is logged when Test result device overlays are applied for the dialog lifetime.
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeNetworkTestHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {object[]} stamps
 * @returns {string}
 */
function networkTestStampListHtml(stamps) {
    if (!stamps.length) {
        return '<p class="sim-network-test-dialog__empty">None</p>';
    }
    const items = stamps
        .map((stamp) => {
            const label = getStampLabel(stamp);
            return `<li><strong>${escapeNetworkTestHtml(label)}</strong></li>`;
        })
        .join('');
    return `<ul class="sim-network-test-dialog__list">${items}</ul>`;
}

function ensureNetworkTestDialog() {
    const host = getNetworkTestHost();
    if (!networkTestDialogApi) {
        networkTestDialogApi = host.createGenericDialogPanel({
            id: NETWORK_TEST_DIALOG_ID,
            allowBackdropClose: false,
            closeOnEscape: false,
            hideCloseButton: true,
            footerAlign: 'end',
            nonBlocking: true,
            position: 'right',
            collapsible: true,
        });
        const dialogEl = networkTestDialogApi.getDialogElement?.();
        if (dialogEl) {
            networkTestDialogCloseHandler = () => {
                clearNetworkTestCableFlow();
                clearNetworkTestFailHighlights();
                // Fail: unlock palette after Try again. Success: stay locked until Retry/Continue/Back to title.
                if (!lastNetworkTestPassed) {
                    setNetworkPaletteToolsEnabled(true);
                }
            };
            dialogEl.addEventListener('close', networkTestDialogCloseHandler);
        }
    }
}

/**
 * @param {'retry' | 'continue' | 'back-title'} action
 */
function dispatchNetworkTestFlowAction(action) {
    window.dispatchEvent(
        new CustomEvent(EVENT_SIM_NETWORK_TEST_FLOW, {
            detail: { action },
        })
    );
    console.log(
        `[partCables.js]: [N/A] - [dispatchNetworkTestFlowAction] - action has a value of ${action}, stageRole has a value of ${networkTestStageRole}.`
    ); //This is logged when a Test pass button asks the sim-network flow to change phase.
}

/**
 * Pass footer: Retry + Continue for both tutorial and level maps.
 * Flow decides whether Continue advances the track or returns to level select.
 * @returns {string}
 */
function buildNetworkTestPassFooterHtml() {
    return (
        '<button type="button" class="btn btn-neutral" data-action="retry">Retry</button>' +
        '<button type="button" class="btn btn-primary" data-action="continue">Continue</button>'
    );
}

/**
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function openNetworkTestResultDialog(result) {
    ensureNetworkTestDialog();
    const title = result.passed ? 'Network test — success' : 'Network test — failed';
    const statusLine = result.passed
        ? '<h2>Well done!</h2><p class="sim-network-test-dialog__status sim-network-test-dialog__status--pass">All required devices can reach the internet from the Comms Cupboard.</p>'
        : '<p class="sim-network-test-dialog__status sim-network-test-dialog__status--fail">Not all required devices can receive internet from the Comms Cupboard. Fix the layout and try again.</p>';
    const notesHtml = result.notes.length
        ? `<ul class="sim-network-test-dialog__notes">${result.notes
              .map((note) => `<li>${escapeNetworkTestHtml(note)}</li>`)
              .join('')}</ul>`
        : '';
    const routerLine = result.hasDirectRouter
        ? '<p>Router link: <strong>OK</strong> (direct cable from Comms Cupboard to a player-placed Router).</p>'
        : '<p>Router link: <strong>Missing</strong> (need a direct cable from Comms Cupboard to a player-placed Router).</p>';

    const bodyHtml = `
        ${statusLine}
        ${routerLine}
        ${notesHtml}
        <h3 class="sim-network-test-dialog__heading">Connected</h3>
        ${networkTestStampListHtml(result.connected)}
        <h3 class="sim-network-test-dialog__heading">Missing / unreachable</h3>
        ${networkTestStampListHtml(result.missing)}
    `;

    const footerHtml = result.passed
        ? buildNetworkTestPassFooterHtml()
        : '<button type="button" class="btn btn-neutral" data-action="try-again">Try again</button>';

    networkTestDialogApi.open({
        title,
        bodyHtml,
        footerHtml,
        nonBlocking: true,
        position: 'right',
        collapsible: true,
        bind: ({ footerEl, close }) => {
            const tryAgainBtn = footerEl.querySelector('[data-action="try-again"]');
            tryAgainBtn?.addEventListener('click', () => {
                clearNetworkTestCableFlow();
                clearNetworkTestFailHighlights();
                resetNetworkTestControl();
                close();
                notifyTutorialAction({ type: 'networkTestTryAgain' });
            });

            const retryBtn = footerEl.querySelector('[data-action="retry"]');
            retryBtn?.addEventListener('click', () => {
                clearNetworkTestCableFlow();
                clearNetworkTestFailHighlights();
                resetNetworkTestControl();
                close();
                dispatchNetworkTestFlowAction('retry');
            });

            const continueBtn = footerEl.querySelector('[data-action="continue"]');
            continueBtn?.addEventListener('click', () => {
                clearNetworkTestCableFlow();
                clearNetworkTestFailHighlights();
                resetNetworkTestControl();
                close();
                dispatchNetworkTestFlowAction('continue');
            });

            const backTitleBtn = footerEl.querySelector('[data-action="back-title"]');
            backTitleBtn?.addEventListener('click', () => {
                clearNetworkTestCableFlow();
                clearNetworkTestFailHighlights();
                resetNetworkTestControl();
                close();
                dispatchNetworkTestFlowAction('back-title');
            });
        },
    });
}

/**
 * Stop any in-flight progress animation.
 */
function cancelNetworkTestProgressAnimation() {
    if (networkTestProgressRafId != null) {
        window.cancelAnimationFrame(networkTestProgressRafId);
        networkTestProgressRafId = null;
    }
    networkTestPendingResult = null;
}

/**
 * Fail progress stops at connected / required devices (e.g. 3 of 4 → 75%).
 * Pass always targets 100%.
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 * @returns {number}
 */
function getNetworkTestProgressTargetPercent(result) {
    if (result?.passed) {
        return 100;
    }
    const connectedCount = Array.isArray(result?.connected) ? result.connected.length : 0;
    const missingCount = Array.isArray(result?.missing) ? result.missing.length : 0;
    const total = connectedCount + missingCount;
    if (total <= 0) {
        return 0;
    }
    return Math.round((connectedCount / total) * 100);
}

/**
 * @param {'info' | 'error'} tone
 */
function setNetworkTestAlertTone(tone) {
    const isError = tone === 'error';
    if (networkTestAlertEl) {
        networkTestAlertEl.className = `${NETWORK_TEST_ALERT_BASE_CLASSES} ${
            isError ? 'alert-error' : 'alert-info'
        }`;
    }
    if (networkTestProgressEl) {
        // Fill colour is forced black in CSS so it suits alert-info and alert-error.
        networkTestProgressEl.className = NETWORK_TEST_PROGRESS_BASE_CLASSES;
    }
}

/**
 * Widen the left palette so the 300px alert can sit anchored there.
 * @param {boolean} wide
 */
function setNetworkTestPaletteWide(wide) {
    const palette = getDropPaletteElement();
    if (!palette) {
        return;
    }
    palette.classList.toggle(PALETTE_WIDE_TEST_CLASS, wide === true);
}

/**
 * @param {number} percent 0–100
 * @param {string} titleText
 * @param {{ showCompletedSuffix?: boolean, showFailConnectedSuffix?: boolean }} [options]
 */
function updateNetworkTestProgressUi(percent, titleText, options = {}) {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    const showCompletedSuffix = options.showCompletedSuffix === true;
    const showFailConnectedSuffix = options.showFailConnectedSuffix === true;
    let description = `${safePercent}%`;
    if (showCompletedSuffix && safePercent >= 100) {
        description = `100%${NETWORK_TEST_PCT_COMPLETED_SUFFIX}`;
    } else if (showFailConnectedSuffix) {
        description = `${safePercent}%${NETWORK_TEST_PCT_FAIL_SUFFIX}`;
    }
    if (networkTestProgressEl) {
        networkTestProgressEl.value = safePercent;
    }
    if (networkTestDescEl) {
        networkTestDescEl.textContent = description;
    }
    if (networkTestTitleEl && titleText != null) {
        networkTestTitleEl.textContent = titleText;
    }
    if (networkTestAlertEl) {
        networkTestAlertEl.setAttribute('aria-valuenow', String(safePercent));
    }
}

/**
 * Show idle "Test Connection" button again.
 */
function resetNetworkTestControl() {
    cancelNetworkTestProgressAnimation();
    networkTestPendingResult = null;
    networkTestUiState = 'idle';
    setNetworkTestPaletteWide(false);
    if (networkTestAlertEl) {
        networkTestAlertEl.hidden = true;
    }
    setNetworkTestAlertTone('info');
    if (networkTestBtn) {
        networkTestBtn.hidden = false;
        networkTestBtn.disabled = false;
    }
    if (networkTestProgressEl) {
        networkTestProgressEl.hidden = false;
    }
    updateNetworkTestProgressUi(0, NETWORK_TEST_LABEL_TESTING);
    console.log(
        `[partCables.js]: [N/A] - [resetNetworkTestControl] - uiState has a value of ${networkTestUiState}.`
    ); //This is logged when Try again / Retry restores the Test Connection button.
}

/**
 * Apply overlays, cable flow, lock flags, and open the results dialog after the progress morph.
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function finishNetworkTestAfterProgress(result) {
    const targetPercent = getNetworkTestProgressTargetPercent(result);
    lastNetworkTestPassed = result.passed;
    if (result.passed) {
        networkEditsLockedAfterPass = true;
        networkTestUiState = 'pass';
        setNetworkTestAlertTone('info');
        updateNetworkTestProgressUi(100, NETWORK_TEST_LABEL_PASS, {
            showCompletedSuffix: true,
        });
    } else {
        networkEditsLockedAfterPass = false;
        networkTestUiState = 'fail';
        setNetworkTestAlertTone('error');
        updateNetworkTestProgressUi(targetPercent, NETWORK_TEST_LABEL_FAIL, {
            showFailConnectedSuffix: true,
        });
    }
    // After the 3s morph, keep title + % text only — hide the bar.
    if (networkTestProgressEl) {
        networkTestProgressEl.hidden = true;
    }
    applyNetworkTestResultOverlays(result);
    notifyNetworkEditsLockChanged();
    // Cable-flow particles already started with the progress bar; keep looping.
    openNetworkTestResultDialog(result);
    console.log(
        `[partCables.js]: [N/A] - [finishNetworkTestAfterProgress] - passed has a value of ${result.passed}, targetPercent has a value of ${targetPercent}, editsLocked has a value of ${networkEditsLockedAfterPass}, progressBarHidden has a value of true.`
    ); //This is logged when the progress alert finishes, the bar is hidden, and results are shown.
}

/**
 * Hide the button, show the Daisy alert + progress, count toward the result target.
 * Pass → 100%. Fail → connected/required % (e.g. 3/4 → 75%).
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function startNetworkTestProgressMorph(result) {
    cancelNetworkTestProgressAnimation();
    networkTestPendingResult = result;
    networkTestUiState = 'testing';
    const targetPercent = getNetworkTestProgressTargetPercent(result);
    if (networkTestBtn) {
        networkTestBtn.hidden = true;
        networkTestBtn.disabled = true;
    }
    setNetworkTestPaletteWide(true);
    setNetworkTestAlertTone('info');
    if (networkTestAlertEl) {
        networkTestAlertEl.hidden = false;
    }
    if (networkTestProgressEl) {
        networkTestProgressEl.hidden = false;
    }
    updateNetworkTestProgressUi(0, NETWORK_TEST_LABEL_TESTING);
    // Packets run during the 3s bar: Wave A ~first half, Wave B ~second half, then loop.
    startNetworkTestCableFlow(result);

    const startedAt = performance.now();
    const tick = (now) => {
        const elapsed = now - startedAt;
        const t = Math.min(1, elapsed / NETWORK_TEST_PROGRESS_MS);
        updateNetworkTestProgressUi(t * targetPercent, NETWORK_TEST_LABEL_TESTING);
        if (t < 1) {
            networkTestProgressRafId = window.requestAnimationFrame(tick);
            return;
        }
        networkTestProgressRafId = null;
        const pending = networkTestPendingResult;
        networkTestPendingResult = null;
        if (pending) {
            finishNetworkTestAfterProgress(pending);
        }
    };
    networkTestProgressRafId = window.requestAnimationFrame(tick);
    console.log(
        `[partCables.js]: [N/A] - [startNetworkTestProgressMorph] - durationMs has a value of ${NETWORK_TEST_PROGRESS_MS}, targetPercent has a value of ${targetPercent}, passed has a value of ${result.passed}, cableFlowStarted has a value of true.`
    ); //This is logged when Test Connection shows the alert progress and cable packets start.
}

function runNetworkTest() {
    if (networkTestUiState !== 'idle') {
        console.log(
            `[partCables.js]: [N/A] - [runNetworkTest] - ignoredClick has a value of true, uiState has a value of ${networkTestUiState}.`
        ); //This is logged when a second click is ignored while the progress / result state is showing.
        return;
    }
    prepareSceneForNetworkTest();
    clearNetworkTestCableFlow();
    const result = evaluateNetworkTest();
    startNetworkTestProgressMorph(result);
    console.log(
        `[partCables.js]: [N/A] - [runNetworkTest] - passed has a value of ${result.passed}, progressStarted has a value of true.`
    ); //This is logged when Test evaluates connectivity and starts the 3s progress morph.
}

function mountNetworkTestButton() {
    const host = getNetworkTestHost();
    const palette = getDropPaletteElement();
    const parent = palette || host.getPlayerUiRoot();

    networkTestControlEl = document.createElement('div');
    networkTestControlEl.className = 'sim-network-test-control w-full mt-4';

    networkTestBtn = document.createElement('button');
    networkTestBtn.type = 'button';
    networkTestBtn.className = `${NETWORK_TEST_BTN_LAYOUT_CLASSES} btn-primary sim-network-drop-palette__btn sim-network-test-control__btn`;
    networkTestBtn.replaceChildren();

    const testLabelEl = document.createElement('span');
    testLabelEl.className = 'sim-network-drop-palette__btn-label';
    testLabelEl.textContent = NETWORK_TEST_LABEL_IDLE;
    networkTestBtn.appendChild(testLabelEl);

    const testIconHtml =
        typeof host.getIcon === 'function'
            ? host.getIcon('icon_circle_help', 'size-5 shrink-0')
            : '';
    if (testIconHtml) {
        const iconWrap = document.createElement('span');
        iconWrap.className = 'sim-network-drop-palette__btn-icon';
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.innerHTML = testIconHtml;
        networkTestBtn.appendChild(iconWrap);
    }

    applyPaletteButtonTooltip(
        networkTestBtn,
        PALETTE_BUTTON_TOOLTIPS.testConnection
    );
    networkTestBtn.setAttribute('aria-label', 'Test network connections');
    networkTestBtn.addEventListener('click', () => {
        runNetworkTest();
    });
    console.log(
        `[partCables.js]: [N/A] - [mountNetworkTestButton] - testHelpIconAttached has a value of ${Boolean(testIconHtml)}.`
    ); //This is logged to verify Test Connection received the right-aligned help icon.

    networkTestAlertEl = document.createElement('div');
    networkTestAlertEl.className = `${NETWORK_TEST_ALERT_BASE_CLASSES} alert-info`;
    networkTestAlertEl.hidden = true;
    networkTestAlertEl.setAttribute('role', 'alert');
    networkTestAlertEl.setAttribute('aria-live', 'polite');
    networkTestAlertEl.setAttribute('aria-valuemin', '0');
    networkTestAlertEl.setAttribute('aria-valuemax', '100');
    networkTestAlertEl.setAttribute('aria-valuenow', '0');

    const textCol = document.createElement('div');
    textCol.className = 'min-w-0 flex-1';

    networkTestTitleEl = document.createElement('h3');
    networkTestTitleEl.className = 'font-bold';
    networkTestTitleEl.textContent = NETWORK_TEST_LABEL_TESTING;

    networkTestDescEl = document.createElement('div');
    networkTestDescEl.className = 'text-xs';
    networkTestDescEl.textContent = '0%';

    networkTestProgressEl = document.createElement('progress');
    networkTestProgressEl.className = `${NETWORK_TEST_PROGRESS_BASE_CLASSES} progress-info`;
    networkTestProgressEl.max = 100;
    networkTestProgressEl.value = 0;

    textCol.appendChild(networkTestTitleEl);
    textCol.appendChild(networkTestDescEl);
    textCol.appendChild(networkTestProgressEl);

    networkTestAlertEl.appendChild(textCol);

    networkTestControlEl.appendChild(networkTestBtn);
    networkTestControlEl.appendChild(networkTestAlertEl);
    parent.appendChild(networkTestControlEl);
    networkTestUiState = 'idle';
    console.log(
        `[partCables.js]: [N/A] - [mountNetworkTestButton] - mountedInPalette has a value of ${Boolean(palette)}.`
    ); //This is logged when Test Connection is mounted at the bottom of the left palette.
}

/**
 * Mount the left-palette Test Connection control and result dialog.
 * @param {import('@babylonjs/core').Scene} _scene
 * @param {{ stageRole?: 'tutorial' | 'level' | 'office' }} [options]
 */
export function initializePartNetworkTest(_scene, options = {}) {
    disposePartNetworkTest();
    networkTestStageRole =
        options.stageRole === 'tutorial' ? 'tutorial' : 'level';
    ensureNetworkTestDialog();
    mountNetworkTestButton();
    console.log(
        `[partCables.js]: [N/A] - [initializePartNetworkTest] - ready has a value of true, stageRole has a value of ${networkTestStageRole}.`
    ); //This is logged when the network Test control is mounted for the current flow stage.
}

/**
 * Tear down Test UI, dialog, and fail highlights.
 */
export function disposePartNetworkTest() {
    clearNetworkTestCableFlow();
    disposeCableFlowFx();
    clearNetworkTestFailHighlights();
    cancelNetworkTestProgressAnimation();
    networkTestPendingResult = null;
    networkTestUiState = 'idle';
    setNetworkTestPaletteWide(false);
    if (networkTestControlEl?.parentNode) {
        networkTestControlEl.parentNode.removeChild(networkTestControlEl);
    }
    networkTestControlEl = null;
    networkTestBtn = null;
    networkTestAlertEl = null;
    networkTestTitleEl = null;
    networkTestDescEl = null;
    networkTestProgressEl = null;

    const dialogEl = networkTestDialogApi?.getDialogElement?.();
    if (dialogEl && networkTestDialogCloseHandler) {
        dialogEl.removeEventListener('close', networkTestDialogCloseHandler);
    }
    networkTestDialogCloseHandler = null;
    networkTestDialogApi?.dispose();
    networkTestDialogApi = null;
    lastNetworkTestPassed = false;
    networkEditsLockedAfterPass = false;
    networkTestStageRole = 'level';
    notifyNetworkEditsLockChanged();
}
