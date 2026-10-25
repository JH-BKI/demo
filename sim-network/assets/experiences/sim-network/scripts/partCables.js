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
    appendPaletteToolButton,
    createToolbarFactoryButton,
    refreshPaletteTrigger,
    setPaletteToolRowActive,
    hideDropPalette,
    showDropPalette,
    PALETTE_BUTTON_TOOLTIPS,
} from './partDrop.js';
import {
    focusSimNetworkCell,
    focusSimNetworkOverview,
    lockSimNetworkCamera,
    setSimNetworkCameraLockBanner,
    unlockSimNetworkCamera,
    TOOL_CAMERA_DRAG_SLOP_PX,
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
/** Radial slices on a cable tube. Pulse updates must keep this count. */
const CABLE_TUBE_TESSELLATION = 8;
/** One grow-and-shrink of the selected cable (ms). */
const CABLE_PULSE_PERIOD_MS = 1000;
/** How far the selected colour moves toward white at the thickest point (0–1). */
const CABLE_PULSE_LIGHTEN = 0.35;
/** Match droppable hover tile (fill + checker outline), light-blue. */
const PATH_OVERLAY_ALPHA = 0.4;
const PATH_OVERLAY_SCALE = 0.98;
/**
 * Five fixed lanes per cell — same cap as MAX_CABLES_PER_INTERMEDIATE_CELL.
 * Tweak CABLE_LANE_OFFSETS to spread or tighten the bundle. Each number is a
 * fraction of one cell (1 = one full tile). Keep them inside about ±0.45 so
 * the tube stays on the tile. Lane order is left-to-right in world space.
 */
const CABLE_LANE_OFFSETS = [-0.36, -0.18, 0, 0.18, 0.36];
/**
 * Which lane a new cable takes when several are free.
 * Center first, then the neighbours, then the outer edges — so two cables
 * sit apart instead of both hugging one side.
 */
const CABLE_LANE_PICK_ORDER = [2, 1, 3, 0, 4];
/**
 * How far the floor fan travels from the device centre toward the next cell,
 * as a fraction of one cell. 0 sits beside the plug. 0.4 is still inside the
 * device cell, near the edge. The vertical plug itself stays on the centre.
 */
const CABLE_LANE_FAN_REACH = 0.4;
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
/** Set while Test Connection owns the moving dots. */
/** @type {null | 'test'} */
let cableFlowOwner = null;
/** @type {import('@babylonjs/core').Observer<import('@babylonjs/core').Scene> | null} */
let cablePulseObserver = null;
/** @type {import('@babylonjs/core').Scene | null} */
let cablePulseScene = null;
/** @type {import('@babylonjs/core').Mesh | null} */
let cablePulseMesh = null;
/** @type {import('@babylonjs/core').Vector3[] | null} */
let cablePulsePath = null;
/** @type {number} */
let nextCableSeq = 1;
/**
 * @type {Array<{
 *   id: string,
 *   fromStampId: string,
 *   toStampId: string,
 *   cells: Array<{ x: number, z: number }>,
 *   colorIndex: number,
 *   laneIndex: number,
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
/** Tell the open cell inspector to refresh which cable button looks on. */
export const CABLE_SELECTION_CHANGED_EVENT = 'sim-network-cable-selection-changed';
/** Tell the open cell inspector to grey out or restore its cable and trash buttons. */
export const NETWORK_TEST_UI_CHANGED_EVENT = 'sim-network-test-ui-changed';

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
/**
 * Press on empty space while Cable is on. Past the slop, this press orbits.
 * @type {{ x: number, y: number, orbiting: boolean } | null}
 */
let cameraOrbitPress = null;
/** Press started on a cable device, including one with no free ports. Camera stays still. */
let cablePressHoldsCamera = false;
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
/** Last cell the click-hover preview tube was built for. */
let clickPreviewCellKey = null;
/** Cells already heard for the current click-hover preview, so only new cells play. */
let clickPreviewPathKeys = new Set();
/**
 * Device meshes painted blue while a cable start is in progress.
 * Separate from the Test-result overlay map so the two clears do not fight.
 * @type {Set<import('@babylonjs/core').AbstractMesh>}
 */
let cableStartOverlayMeshes = new Set();
/**
 * Device under the pointer during a cable drag, painted only when letting go would connect.
 * @type {Set<import('@babylonjs/core').AbstractMesh>}
 */
let cableHoverOverlayMeshes = new Set();
/** @type {string | null} */
let cableHoverOverlayStampId = null;

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
 * Play a scene/global clip via audioControl. Missing clips warn once in audioManager.
 * @param {string} clipId
 */
function playSfx(clipId) {
    const host = getHost();
    if (typeof host.dispatchAppEvent !== 'function' || !host.EVENTS?.AUDIO_CONTROL) {
        return;
    }
    host.dispatchAppEvent(host.EVENTS.AUDIO_CONTROL, {
        action: 'play',
        clipId,
    });
}

/**
 * One error blip when a cable lay ends without connecting.
 */
function playCableLayMissSfx() {
    playSfx('default-sys-error');
    console.log(
        `[partCables.js]: [N/A] - [playCableLayMissSfx] - clipId has a value of default-sys-error.`
    ); //This is logged when a cable lay is released without a successful connection.
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
        laneIndex: chooseLaneIndex(cells),
    });
    if (!built) {
        return;
    }
    built.material.alpha = 0.65;
    built.material.transparencyMode = 2;
    previewCable = built;
}

/**
 * Drop the click-hover preview tube. A live drag keeps its own preview.
 */
function clearClickHoverPreviewCable() {
    clickPreviewCellKey = null;
    clickPreviewPathKeys = new Set();
    if (!dragSession) {
        disposePreviewCable();
    }
}

/**
 * Forget the armed click-cable. Blue wash, preview, and hover-lay all stop.
 */
function cancelArmedCableLay() {
    pendingStartStampId = null;
    clearCablePathOverlay();
    requestCableSelectedCellFx(null);
    clearCableStartOverlay();
    clearClickHoverPreviewCable();
    playCableLayMissSfx();
}

/**
 * After a click has armed a cable, draw the preview tube to the blue hover cell.
 * Plays drop-cable as the route enters new cells, same as a drag. A held drag owns the preview instead.
 */
function syncClickHoverPreviewCable() {
    if (dragSession) {
        return;
    }
    if (!pendingStartStampId) {
        clearClickHoverPreviewCable();
        return;
    }
    const startStamp = getStampById(pendingStartStampId);
    const layout = getActiveLayout();
    if (!startStamp || !layout || !cableHoverCell) {
        clearClickHoverPreviewCable();
        return;
    }
    const cellKey = `${cableHoverCell.x},${cableHoverCell.z}`;
    if (cellKey === clickPreviewCellKey) {
        return;
    }
    clickPreviewCellKey = cellKey;
    if (cableHoverCell.x === startStamp.x && cableHoverCell.z === startStamp.z) {
        disposePreviewCable();
        return;
    }
    const path = findGridPath(
        { x: startStamp.x, z: startStamp.z },
        { x: cableHoverCell.x, z: cableHoverCell.z },
        layout.width ?? 0,
        layout.depth ?? 0
    );
    if (!path || path.length < 2) {
        disposePreviewCable();
        console.log(
            `[partCables.js]: [N/A] - [syncClickHoverPreviewCable] - previewCleared has a value of true, cell has a value of ${cellKey}.`
        ); //This is logged when a click-hover cell has no free cable route, so the preview tube is removed.
        return;
    }
    const prevKeys = clickPreviewPathKeys;
    /** @type {Set<string>} */
    const nextKeys = new Set();
    let newCellSfxCount = 0;
    for (const entry of path) {
        const key = `${entry.x},${entry.z}`;
        nextKeys.add(key);
        if (!prevKeys.has(key)) {
            playSfx('drop-cable');
            newCellSfxCount += 1;
        }
    }
    clickPreviewPathKeys = nextKeys;
    if (newCellSfxCount > 0) {
        console.log(
            `[partCables.js]: [N/A] - [syncClickHoverPreviewCable] - dropCableSfxCount has a value of ${newCellSfxCount}, cell has a value of ${cellKey}.`
        ); //This is logged when a click-hover preview route enters cells that had not played yet.
    }
    updatePreviewCable(path);
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
 * Lift the blue sheet off the device under a cable drag. Leaves the start device and any Test wash alone.
 */
function clearCableHoverOverlay() {
    for (const mesh of cableHoverOverlayMeshes) {
        try {
            if (
                !mesh ||
                mesh.isDisposed?.() ||
                isNetworkTestResultOverlayMesh(mesh) ||
                cableStartOverlayMeshes.has(mesh)
            ) {
                continue;
            }
            mesh.renderOverlay = false;
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [clearCableHoverOverlay] - clearError has a value of ${error?.message || error}.`
            ); //This is logged when clearing the drag-hover device wash fails on a disposed mesh.
        }
    }
    cableHoverOverlayMeshes.clear();
    cableHoverOverlayStampId = null;
}

/**
 * Lift the blue sheet off the cable-start device. Also clears the drag-hover wash.
 * Leaves a Test-result wash alone.
 */
function clearCableStartOverlay() {
    clearCableHoverOverlay();
    for (const mesh of cableStartOverlayMeshes) {
        try {
            if (!mesh || mesh.isDisposed?.() || isNetworkTestResultOverlayMesh(mesh)) {
                continue;
            }
            mesh.renderOverlay = false;
        } catch (error) {
            console.warn(
                `[partCables.js]: [N/A] - [clearCableStartOverlay] - clearError has a value of ${error?.message || error}.`
            ); //This is logged when clearing the cable-start device wash fails on a disposed mesh.
        }
    }
    cableStartOverlayMeshes.clear();
}

/**
 * Same cyan wash the Test uses on a connected device. Only the stamp a cable starts from.
 * @param {object | null | undefined} stamp
 */
function showCableStartOverlay(stamp) {
    clearCableStartOverlay();
    const meshes = stamp?.wrap?.getChildMeshes?.(false) || [];
    if (!meshes.length) {
        return;
    }
    const host = getHost();
    for (const mesh of meshes) {
        if (isNetworkTestResultOverlayMesh(mesh)) {
            continue;
        }
        mesh.renderOverlay = true;
        mesh.overlayColor = new host.Color3(
            NETWORK_TEST_CONNECTED_RGB.r,
            NETWORK_TEST_CONNECTED_RGB.g,
            NETWORK_TEST_CONNECTED_RGB.b
        );
        mesh.overlayAlpha = NETWORK_TEST_CONNECTED_ALPHA;
        cableStartOverlayMeshes.add(mesh);
    }
    console.log(
        `[partCables.js]: [N/A] - [showCableStartOverlay] - stampId has a value of ${stamp.stampId}, meshCount has a value of ${cableStartOverlayMeshes.size}.`
    ); //This is logged to debug the blue wash on the device a cable starts from.
}

/**
 * True when letting go would commit this cable. No toasts — used while the pointer is still down.
 * @param {object} startStamp
 * @param {object} endStamp
 * @param {Array<{ x: number, z: number }> | null | undefined} path
 * @returns {boolean}
 */
function canPreviewCableCommit(startStamp, endStamp, path) {
    if (!startStamp || !endStamp || startStamp.stampId === endStamp.stampId) {
        return false;
    }
    if (networkEditsLockedAfterPass || !path || path.length < 2) {
        return false;
    }
    const startDef = getPartDef(startStamp.partId);
    const endDef = getPartDef(endStamp.partId);
    if (countCablesOnStamp(startStamp.stampId) >= maxCablesForPart(startDef)) {
        return false;
    }
    if (countCablesOnStamp(endStamp.stampId) >= maxCablesForPart(endDef)) {
        return false;
    }
    if (alreadyConnected(startStamp.stampId, endStamp.stampId)) {
        return false;
    }
    return true;
}

/**
 * Blue wash on the device under the pointer during a drag, when release would connect.
 * @param {object} stamp
 */
function showCableHoverOverlay(stamp) {
    if (!stamp || cableHoverOverlayStampId === stamp.stampId) {
        return;
    }
    clearCableHoverOverlay();
    const meshes = stamp.wrap?.getChildMeshes?.(false) || [];
    const host = getHost();
    for (const mesh of meshes) {
        if (isNetworkTestResultOverlayMesh(mesh) || cableStartOverlayMeshes.has(mesh)) {
            continue;
        }
        mesh.renderOverlay = true;
        mesh.overlayColor = new host.Color3(
            NETWORK_TEST_CONNECTED_RGB.r,
            NETWORK_TEST_CONNECTED_RGB.g,
            NETWORK_TEST_CONNECTED_RGB.b
        );
        mesh.overlayAlpha = NETWORK_TEST_CONNECTED_ALPHA;
        cableHoverOverlayMeshes.add(mesh);
    }
    cableHoverOverlayStampId = stamp.stampId;
    console.log(
        `[partCables.js]: [N/A] - [showCableHoverOverlay] - stampId has a value of ${stamp.stampId}, meshCount has a value of ${cableHoverOverlayMeshes.size}.`
    ); //This is logged to debug the blue wash on a device a cable drag would connect to.
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
function syncCableHoverTargetOverlay(scene) {
    if (!dragSession?.becameDrag) {
        clearCableHoverOverlay();
        return;
    }
    const startStamp = getStampById(dragSession.startStampId);
    const layout = getActiveLayout();
    if (!startStamp || !layout) {
        clearCableHoverOverlay();
        return;
    }
    const { stamp: endStamp } = resolveWiredTargetAtPointer(scene, {
        excludeStampId: startStamp.stampId,
    });
    if (!endStamp) {
        clearCableHoverOverlay();
        return;
    }
    const path = findGridPath(
        { x: startStamp.x, z: startStamp.z },
        { x: endStamp.x, z: endStamp.z },
        layout.width ?? 0,
        layout.depth ?? 0
    );
    if (!canPreviewCableCommit(startStamp, endStamp, path)) {
        clearCableHoverOverlay();
        return;
    }
    showCableHoverOverlay(endStamp);
}

/**
 * Drop a one-press camera freeze (place/cable gesture). Safe when already free.
 */
function releaseToolCameraHold() {
    cameraOrbitPress = null;
    cablePressHoldsCamera = false;
    unlockSimNetworkCamera();
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
 * Sideways shift for one lane, as a fraction of a cell.
 * @param {number} laneIndex
 * @returns {number}
 */
function laneOffsetFraction(laneIndex) {
    const lastSlot = CABLE_LANE_OFFSETS.length - 1;
    const index = Math.max(0, Math.min(lastSlot, laneIndex | 0));
    return CABLE_LANE_OFFSETS[index];
}

/**
 * World XZ shift for a lane. An east–west step spreads lanes on Z.
 * A north–south step spreads them on X. The sign is fixed in the world,
 * so a cable drawn backwards stays on the same side as its neighbours.
 * @param {number} stepX
 * @param {number} stepZ
 * @param {number} laneIndex
 * @param {number} cellSize
 * @returns {{ x: number, z: number }}
 */
function laneWorldOffset(stepX, stepZ, laneIndex, cellSize) {
    const distance = laneOffsetFraction(laneIndex) * cellSize;
    if (Math.abs(stepX) >= Math.abs(stepZ) && stepX !== 0) {
        return { x: 0, z: distance };
    }
    if (stepZ !== 0) {
        return { x: distance, z: 0 };
    }
    return { x: 0, z: 0 };
}

/**
 * One lane for the whole cable. A lane scores higher when a path cell
 * already holds a cable in that lane. Cells beside a device count more,
 * so the run just after a switch stays separated. Ties keep the center lane.
 * @param {Array<{ x: number, z: number }>} cells
 * @returns {number}
 */
function chooseLaneIndex(cells) {
    const laneCount = CABLE_LANE_OFFSETS.length;
    const scores = [];
    for (let lane = 0; lane < laneCount; lane += 1) {
        scores.push(0);
    }
    const last = cells.length - 1;
    for (let i = 0; i < cells.length; i += 1) {
        const nearDevice = i <= 2 || i >= last - 2;
        const weight = nearDevice ? 4 : 1;
        const cell = cells[i];
        /** @type {Set<number>} */
        const seen = new Set();
        for (const peer of getCablesTouchingCell(cell.x, cell.z)) {
            const lane = peer.laneIndex;
            if (typeof lane !== 'number' || seen.has(lane)) {
                continue;
            }
            seen.add(lane);
            if (lane >= 0 && lane < laneCount) {
                scores[lane] += weight;
            }
        }
    }
    let best = CABLE_LANE_PICK_ORDER[0];
    for (const lane of CABLE_LANE_PICK_ORDER) {
        if (scores[lane] < scores[best]) {
            best = lane;
        }
    }
    return best;
}

/**
 * Tube path. The vertical plug stays on the device-cell centre.
 * On the floor, a short fan inside that cell steps out to this cable's lane
 * before the run leaves the cell. The same lane is used for the whole run.
 * @param {Array<{ x: number, z: number }>} cells
 * @param {number} cellSize
 * @param {number} half
 * @param {object} host
 * @param {number} laneIndex
 * @returns {import('@babylonjs/core').Vector3[]}
 */
function buildLanedPathPoints(cells, cellSize, half, host, laneIndex) {
    /** @type {import('@babylonjs/core').Vector3[]} */
    const points = [];
    if (!cells.length) {
        return points;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    function pushPoint(x, y, z) {
        const prev = points[points.length - 1];
        if (prev && Math.hypot(prev.x - x, prev.y - y, prev.z - z) < 1e-4) {
            return;
        }
        points.push(new host.Vector3(x, y, z));
    }

    /**
     * @param {{ x: number, z: number }} cell
     * @returns {{ x: number, z: number }}
     */
    function cellCenter(cell) {
        return {
            x: cell.x * cellSize + half,
            z: cell.z * cellSize + half,
        };
    }

    const last = cells.length - 1;
    const start = cellCenter(cells[0]);
    pushPoint(start.x, CABLE_RISER_TOP_Y, start.z);
    pushPoint(start.x, CABLE_Y, start.z);
    if (last === 0) {
        return points;
    }

    const fanReach = CABLE_LANE_FAN_REACH * cellSize;
    const exitX = cells[1].x - cells[0].x;
    const exitZ = cells[1].z - cells[0].z;
    const exitOffset = laneWorldOffset(exitX, exitZ, laneIndex, cellSize);
    pushPoint(
        start.x + exitX * fanReach + exitOffset.x,
        CABLE_Y,
        start.z + exitZ * fanReach + exitOffset.z
    );

    for (let i = 1; i < last; i += 1) {
        const cell = cells[i];
        const center = cellCenter(cell);
        const inX = cell.x - cells[i - 1].x;
        const inZ = cell.z - cells[i - 1].z;
        const outX = cells[i + 1].x - cell.x;
        const outZ = cells[i + 1].z - cell.z;
        const inOffset = laneWorldOffset(inX, inZ, laneIndex, cellSize);
        const straight = inX === outX && inZ === outZ;
        if (straight) {
            pushPoint(center.x + inOffset.x, CABLE_Y, center.z + inOffset.z);
        } else {
            // One bend: where the incoming lane line meets the outgoing lane line.
            const outOffset = laneWorldOffset(outX, outZ, laneIndex, cellSize);
            pushPoint(
                center.x + inOffset.x + outOffset.x,
                CABLE_Y,
                center.z + inOffset.z + outOffset.z
            );
        }
    }

    const end = cellCenter(cells[last]);
    const approachX = cells[last].x - cells[last - 1].x;
    const approachZ = cells[last].z - cells[last - 1].z;
    const endOffset = laneWorldOffset(approachX, approachZ, laneIndex, cellSize);
    pushPoint(
        end.x - approachX * fanReach + endOffset.x,
        CABLE_Y,
        end.z - approachZ * fanReach + endOffset.z
    );
    pushPoint(end.x, CABLE_Y, end.z);
    pushPoint(end.x, CABLE_RISER_TOP_Y, end.z);
    return points;
}

/**
 * World-space tube path for an existing cable (same points as the mesh).
 * @param {{ id: string, cells: Array<{ x: number, z: number }>, laneIndex?: number }} cable
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
    const laneIndex =
        typeof cable.laneIndex === 'number' ? cable.laneIndex : chooseLaneIndex(cable.cells);
    return buildLanedPathPoints(cable.cells, cellSize, half, host, laneIndex);
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
    return cableGlowLayer;
}

/**
 * @param {Array<{ x: number, z: number }>} cells
 * @param {number} colorIndex
 * @param {boolean} selected
 * @param {number} [radiusOverride]
 * @param {{ laneIndex?: number }} [options]
 * @returns {{ mesh: import('@babylonjs/core').Mesh, material: import('@babylonjs/core').StandardMaterial, path: import('@babylonjs/core').Vector3[] } | null}
 */
function createCableMesh(cells, colorIndex, selected, radiusOverride, options = {}) {
    const layout = getActiveLayout();
    const host = getHost();
    if (!boundScene || !layout || cells.length < 2) {
        return null;
    }
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    const laneIndex =
        typeof options.laneIndex === 'number' ? options.laneIndex : chooseLaneIndex(cells);
    const path = buildLanedPathPoints(cells, cellSize, half, host, laneIndex);
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
            tessellation: CABLE_TUBE_TESSELLATION,
            updatable: selected === true,
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

    return { mesh, material, path };
}

/**
 * @param {object} cable
 * @param {boolean} selected
 */
function rebuildCableVisual(cable, selected) {
    const built = createCableMesh(cable.cells, cable.colorIndex, selected, undefined, {
        laneIndex: cable.laneIndex,
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
    cable.pathPoints = built.path;
}

/**
 * Rebuild every cable tube after a cable is added or removed.
 * Each cable keeps the lane it was given when it was laid.
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
    stopCablePulse();
    for (const cable of cables) {
        const selected = cable.id === selectedId;
        rebuildCableVisual(cable, selected);
        if (selected && glow && !glow.isDisposed?.() && cable.mesh) {
            glow.addIncludedOnlyMesh(cable.mesh);
        }
    }
    if (selectedId) {
        const selectedCable = cables.find((entry) => entry.id === selectedId);
        if (selectedCable) {
            startCablePulse(selectedCable);
        }
    }
}

/**
 * @returns {string | null}
 */
export function getSelectedCableId() {
    return selectedCableId;
}

/**
 * True while Test Connection progress or its result dialog is active.
 * @returns {boolean}
 */
export function isNetworkTestUiBusy() {
    return networkTestUiState !== 'idle';
}

/**
 * Ask the cell inspector to match its buttons to the Test Connection state.
 */
function notifyNetworkTestUiChanged() {
    window.dispatchEvent(new CustomEvent(NETWORK_TEST_UI_CHANGED_EVENT));
}

/**
 * Stop the selected-cable thickness pulse.
 */
function stopCablePulse() {
    const wasRunning = Boolean(cablePulseObserver);
    if (cablePulseScene && cablePulseObserver) {
        cablePulseScene.onBeforeRenderObservable.remove(cablePulseObserver);
    }
    cablePulseObserver = null;
    cablePulseScene = null;
    cablePulseMesh = null;
    cablePulsePath = null;
    if (wasRunning) {
        console.log(
            `[partCables.js]: [N/A] - [stopCablePulse] - cablePulseObserver has a value of null.`
        ); //This is logged when the selected cable stops growing and shrinking.
    }
}

/**
 * Move one colour channel toward white by the pulse amount.
 * @param {number} base
 * @param {number} wave
 * @returns {number}
 */
function pulseColorChannel(base, wave) {
    return base + (1 - base) * CABLE_PULSE_LIGHTEN * wave;
}

/**
 * Grow and shrink one selected cable, and lighten its colour in step.
 * @param {{ id: string, mesh?: import('@babylonjs/core').Mesh, material?: import('@babylonjs/core').StandardMaterial, pathPoints?: import('@babylonjs/core').Vector3[] }} cable
 */
function startCablePulse(cable) {
    stopCablePulse();
    if (!boundScene || !cable?.mesh || !cable.pathPoints || cable.pathPoints.length < 2) {
        return;
    }
    const scene = boundScene;
    const host = getHost();
    cablePulseScene = scene;
    cablePulseMesh = cable.mesh;
    cablePulsePath = cable.pathPoints;
    const diffuse = cable.material?.diffuseColor;
    const emissive = cable.material?.emissiveColor;
    const baseDiffuse = diffuse
        ? { r: diffuse.r, g: diffuse.g, b: diffuse.b }
        : null;
    const baseEmissive = emissive
        ? { r: emissive.r, g: emissive.g, b: emissive.b }
        : null;
    const startedAt = performance.now();
    cablePulseObserver = scene.onBeforeRenderObservable.add(() => {
        if (!cablePulseMesh || cablePulseMesh.isDisposed?.() || !cablePulsePath) {
            stopCablePulse();
            return;
        }
        const cycle =
            ((performance.now() - startedAt) % CABLE_PULSE_PERIOD_MS) /
            CABLE_PULSE_PERIOD_MS;
        const wave = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);
        const radius =
            CABLE_RADIUS + (CABLE_RADIUS_SELECTED - CABLE_RADIUS) * wave;
        host.MeshBuilder.CreateTube(cablePulseMesh.name, {
            path: cablePulsePath,
            radius,
            tessellation: CABLE_TUBE_TESSELLATION,
            instance: cablePulseMesh,
        });
        if (baseDiffuse && diffuse) {
            diffuse.r = pulseColorChannel(baseDiffuse.r, wave);
            diffuse.g = pulseColorChannel(baseDiffuse.g, wave);
            diffuse.b = pulseColorChannel(baseDiffuse.b, wave);
        }
        if (baseEmissive && emissive) {
            emissive.r = pulseColorChannel(baseEmissive.r, wave);
            emissive.g = pulseColorChannel(baseEmissive.g, wave);
            emissive.b = pulseColorChannel(baseEmissive.b, wave);
        }
    });
    console.log(
        `[partCables.js]: [N/A] - [startCablePulse] - cableId has a value of ${cable.id}.`
    ); //This is logged when a selected cable starts pulsing its thickness and colour.
}

/**
 * Ask the cell status panel to show every cable button as off or on.
 */
function notifyCableSelectionChanged() {
    window.dispatchEvent(new CustomEvent(CABLE_SELECTION_CHANGED_EVENT));
}

/**
 * Clear 3D glow / thickness selection (does not close the inspector UI).
 */
export function clearCableSelection() {
    stopCablePulse();
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
    notifyCableSelectionChanged();
}

/**
 * Highlight one cable in 3D (and mark it selected for the inspector).
 * @param {string} cableId
 * @returns {boolean}
 */
export function selectCableById(cableId) {
    if (isNetworkTestUiBusy()) {
        console.log(
            `[partCables.js]: [N/A] - [selectCableById] - blockedByNetworkTest has a value of true, cableId has a value of ${cableId}.`
        ); //This is logged when a cable button click is ignored because Test Connection is running.
        return false;
    }
    const cable = cables.find((entry) => entry.id === cableId);
    if (!cable) {
        return false;
    }
    if (selectedCableId === cableId) {
        return true;
    }

    stopCablePulse();
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
    startCablePulse(cable);
    notifyCableSelectionChanged();
    return true;
}

/**
 * @param {boolean} active
 */
function syncCableToggleButton(active) {
    if (!cableToggleBtn) {
        return;
    }
    setPaletteToolRowActive(cableToggleBtn, active);
    refreshPaletteTrigger();
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
            clearCableStartOverlay();
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
    clearCableStartOverlay();
    ignoreNextDevicePick = false;
    releaseToolCameraHold();
    syncCableToggleButton(cableMode);
    syncCableRenderGroups();

    if (cableMode) {
        clearDropSelection();
        if (boundScene) {
            ensureCableHoverTile(boundScene);
        }
        showDropToast(
            'Click and drag cables along the grid to connect devices.'
        );
    } else if (clearExploreOnExit) {
        requestExploreCellSelection(null);
    }

    console.log(
        `[partCables.js]: [N/A] - [setCableMode] - cableMode has a value of ${cableMode}, clearExploreOnExit has a value of ${clearExploreOnExit}.`
    ); //This is logged when the player toggles cable tool mode.
}

/**
 * @param {HTMLElement} paletteEl
 */
export function mountCableToggle(paletteEl) {
    cableToggleBtn = createToolbarFactoryButton(
        'sim-network-toolbar-cable',
        'primary',
        'icon_cable',
        'Cable',
        () => {
            if (cableToggleBtn?.disabled || networkEditsLockedAfterPass) {
                return;
            }
            setCableMode(!cableMode);
        }
    );
    cableToggleBtn.className =
        'sim-network-toolbar__row sim-network-drop-palette__btn sim-network-drop-palette__btn--cable';
    cableToggleBtn.setAttribute('aria-label', 'Cable');
    cableToggleBtn.setAttribute('data-tool-icon', 'icon_cable');
    cableToggleBtn.setAttribute('data-cable-toggle', 'true');
    const host = globalThis[HOST_KEY];
    const dot = document.createElement('span');
    dot.className = 'sim-network-toolbar__dot';
    dot.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('span');
    icon.innerHTML =
        typeof host?.getIcon === 'function'
            ? host.getIcon('icon_cable', 'h-5 w-5')
            : '';
    dot.appendChild(icon);
    const label = document.createElement('span');
    label.className = 'sim-network-toolbar__label';
    label.textContent = 'Cable';
    cableToggleBtn.replaceChildren(dot, label);
    cableToggleBtn.setAttribute('aria-pressed', 'false');
    applyPaletteButtonTooltip(cableToggleBtn, PALETTE_BUTTON_TOOLTIPS.cable);
    appendPaletteToolButton(paletteEl, cableToggleBtn, 'Cable');
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
    clearCableSelection();
    clearDropSelection();
    setCableMode(false);
    unlockSimNetworkCamera();
    const host = getNetworkTestHost();
    host.dispatchAppEvent(host.EVENTS.RESET_3D_VIEW);
    setNetworkPaletteToolsEnabled(false);
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
    const laneIndex = chooseLaneIndex(path);
    cables.push({
        id,
        fromStampId: startStamp.stampId,
        toStampId: endStamp.stampId,
        cells: path.map((cell) => ({ x: cell.x, z: cell.z })),
        colorIndex,
        laneIndex,
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
    // Cable mode stays on so the next cable can run without re-toggling. Camera does not stay frozen.
    console.log(
        `[partCables.js]: [N/A] - [tryCommitCable] - cableId has a value of ${id}, source has a value of ${source}, cellCount has a value of ${path.length}, colorIndex has a value of ${colorIndex}, laneIndex has a value of ${laneIndex}, cableModeStaysOn has a value of ${cableMode}.`
    ); //This is logged when a wired cable is committed from click–click or hold–drag.
    notifyTutorialAction({
        type: 'cable',
        a: { partId: startStamp.partId, x: startStamp.x, z: startStamp.z },
        b: { partId: endStamp.partId, x: endStamp.x, z: endStamp.z },
    });
    refreshConnectionStatusForStamp(startStamp.stampId);
    refreshConnectionStatusForStamp(endStamp.stampId);
    notifyCablesChanged();
    playSfx('connect-cable');
    console.log(
        `[partCables.js]: [N/A] - [tryCommitCable] - connectCableSfxDispatched has a value of true, cableId has a value of ${id}.`
    ); //This is logged when a successful cable link plays the connect-cable clip.
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
        return;
    }

    if (!pendingStartStampId) {
        if (countCablesOnStamp(stamp.stampId) >= maxCablesForPart(partDef)) {
            showDropToast('That device has no free cable ports.');
            return;
        }
        pendingStartStampId = stamp.stampId;
        clickPreviewCellKey = null;
        clickPreviewPathKeys = new Set();
        clearCablePathOverlay();
        requestCableSelectedCellFx({ x: stamp.x, z: stamp.z });
        showCableStartOverlay(stamp);
        return;
    }

    if (pendingStartStampId === stamp.stampId) {
        cancelArmedCableLay();
        return;
    }

    const startStamp = getStampById(pendingStartStampId);
    if (!startStamp) {
        cancelArmedCableLay();
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
        cancelArmedCableLay();
        return;
    }

    const committed = tryCommitCable(startStamp, stamp, path, 'click-click');
    pendingStartStampId = null;
    clearCablePathOverlay();
    requestCableSelectedCellFx(null);
    clearCableStartOverlay();
    clearClickHoverPreviewCable();
    if (!committed) {
        playCableLayMissSfx();
    }
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
        }
        return;
    }

    const prevCells = dragSession.cells;
    /** @type {Set<string>} */
    const prevKeys = new Set(prevCells.map((entry) => `${entry.x},${entry.z}`));

    dragSession.cells = path.map((entry) => ({ x: entry.x, z: entry.z }));
    dragSession.lastBlockedKey = null;
    if (path.length > 1) {
        const justBecameDrag = !dragSession.becameDrag;
        dragSession.becameDrag = true;
        pendingStartStampId = null;
        requestCableSelectedCellFx(null);
        if (justBecameDrag) {
            showCableStartOverlay(startStamp);
        }
    }

    // Play drop-cable once per newly covered cell while hold-dragging (not on hover rebuild of same path).
    let newCellSfxCount = 0;
    for (const entry of dragSession.cells) {
        const key = `${entry.x},${entry.z}`;
        if (!prevKeys.has(key)) {
            playSfx('drop-cable');
            newCellSfxCount += 1;
        }
    }
    if (newCellSfxCount > 0) {
        console.log(
            `[partCables.js]: [N/A] - [updateDragPathToCell] - dropCableSfxCount has a value of ${newCellSfxCount}, pathLength has a value of ${dragSession.cells.length}.`
        ); //This is logged when hold-drag cable path grows onto new cells.
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
        } else {
            clearCableStartOverlay();
        }
        return;
    }

    clearCableStartOverlay();
    ignoreNextDevicePick = true;
    const startStamp = getStampById(session.startStampId);
    if (!startStamp) {
        clearDragSession();
        playCableLayMissSfx();
        return;
    }

    const { stamp: endStamp } = resolveWiredTargetAtPointer(scene, {
        excludeStampId: startStamp.stampId,
    });

    if (!endStamp || endStamp.stampId === startStamp.stampId) {
        clearDragSession();
        playCableLayMissSfx();
        return;
    }

    const layout = getActiveLayout();
    if (!layout) {
        clearDragSession();
        playCableLayMissSfx();
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
        playCableLayMissSfx();
        return;
    }

    const committed = tryCommitCable(startStamp, endStamp, path, 'hold-drag');
    clearDragSession();
    if (!committed) {
        playCableLayMissSfx();
    }
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

    function refreshCableHover() {
        const cell = pickCellAtPointer(scene.pointerX, scene.pointerY);
        setCableHoverCell(cell);
    }

    pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        if (!cableMode) {
            return;
        }
        const type = pointerInfo.type;

        if (type === host.PointerEventTypes.POINTERMOVE) {
            if (cablePressHoldsCamera) {
                refreshCableHover();
                if (dragSession && cableHoverCell) {
                    updateDragPathToCell(cableHoverCell);
                    if (dragSession.becameDrag) {
                        setSimNetworkCameraLockBanner(true);
                    }
                }
                syncCableHoverTargetOverlay(scene);
                return;
            }
            if (cameraOrbitPress?.orbiting) {
                return;
            }
            if (cameraOrbitPress && !cameraOrbitPress.orbiting) {
                const dx = scene.pointerX - cameraOrbitPress.x;
                const dy = scene.pointerY - cameraOrbitPress.y;
                if (Math.hypot(dx, dy) >= TOOL_CAMERA_DRAG_SLOP_PX) {
                    cameraOrbitPress.orbiting = true;
                    unlockSimNetworkCamera();
                    clearCableHover();
                    clearClickHoverPreviewCable();
                    console.log(
                        `[partCables.js]: [N/A] - [attachCablePointerObserver] - cameraOrbitDrag has a value of true.`
                    ); //This is logged to debug a cable-tool drag on an empty cell that turns the camera.
                    return;
                }
            }
            refreshCableHover();
            if (dragSession && cableHoverCell) {
                updateDragPathToCell(cableHoverCell);
                if (dragSession.becameDrag) {
                    setSimNetworkCameraLockBanner(true);
                }
            }
            syncClickHoverPreviewCable();
            return;
        }

        if (type === host.PointerEventTypes.POINTERDOWN) {
            cameraOrbitPress = null;
            const { stamp } = resolveWiredTargetAtPointer(scene);
            if (stamp) {
                cablePressHoldsCamera = true;
                lockSimNetworkCamera({ showBanner: false });
                console.log(
                    `[partCables.js]: [N/A] - [attachCablePointerObserver] - cablePressHoldsCamera has a value of true, stampId has a value of ${stamp.stampId}.`
                ); //This is logged to debug a cable-tool press that keeps the camera still.
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
                const pendingIsOtherDevice =
                    Boolean(pendingStartStampId) && pendingStartStampId !== stamp.stampId;
                if (!pendingIsOtherDevice) {
                    showCableStartOverlay(stamp);
                }
                return;
            }
            cablePressHoldsCamera = false;
            cameraOrbitPress = {
                x: scene.pointerX,
                y: scene.pointerY,
                orbiting: false,
            };
            lockSimNetworkCamera({ showBanner: false });
            return;
        }

        if (type === host.PointerEventTypes.POINTERUP) {
            const orbiting = cameraOrbitPress?.orbiting === true;
            const hadDrag = Boolean(dragSession);
            if (dragSession) {
                finishHoldDrag(scene);
            }
            releaseToolCameraHold();
            if (!orbiting && !hadDrag && pendingStartStampId) {
                cancelArmedCableLay();
            }
            if (orbiting && cableMode) {
                refreshCableHover();
            }
            return;
        }

        if (type === host.PointerEventTypes.POINTERCAPTURELOST) {
            if (dragSession) {
                const keepPendingStart =
                    !dragSession.becameDrag &&
                    Boolean(pendingStartStampId) &&
                    pendingStartStampId !== dragSession.startStampId;
                clearDragSession();
                if (!keepPendingStart) {
                    clearCableStartOverlay();
                }
            }
            releaseToolCameraHold();
        }
    });
}

/**
 * Endpoint names for a cable (cell inspector 3-column row).
 * @param {string} cableId
 * @returns {{ fromLabel: string, toLabel: string, fromStampId: string, toStampId: string }}
 */
export function getCableEndpointLabels(cableId) {
    const cable = cables.find((entry) => entry.id === cableId);
    if (!cable) {
        return {
            fromLabel: 'Cable',
            toLabel: '',
            fromStampId: '',
            toStampId: '',
        };
    }
    return {
        fromLabel: getStampLabel(getStampById(cable.fromStampId)),
        toLabel: getStampLabel(getStampById(cable.toStampId)),
        fromStampId: cable.fromStampId,
        toStampId: cable.toStampId,
    };
}

/**
 * Human label for a cable row in the cell inspector.
 * @param {string} cableId
 * @returns {string}
 */
export function getCableLabel(cableId) {
    const endpoints = getCableEndpointLabels(cableId);
    if (!endpoints.toLabel) {
        return endpoints.fromLabel;
    }
    return `${endpoints.fromLabel} ↔ ${endpoints.toLabel}`;
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
    stopCablePulse();
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
    stopCablePulse();
    clearCableSelection();
    clearDragSession();
    ignoreNextDevicePick = false;
    clearCableStartOverlay();
    releaseToolCameraHold();
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

/**
 * Flow listens for this after a successful Test.
 * Actions: map-passed | retry | continue | go-back
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
const NETWORK_TEST_LABEL_TESTING = 'Testing connectivity...';
const NETWORK_TEST_LABEL_PASS = 'All devices reachable.';
const NETWORK_TEST_LABEL_FAIL = 'Unreachable devices found...';
const NETWORK_TEST_PCT_COMPLETED_SUFFIX = ' - test completed.';
const NETWORK_TEST_PCT_FAIL_SUFFIX = ' devices connected.';
const NETWORK_TEST_ALERT_BASE_CLASSES =
    'alert alert-vertical sm:alert-horizontal sim-network-test-alert min-w-[300px] w-full';
const NETWORK_TEST_PROGRESS_BASE_CLASSES = 'progress w-full h-3 mt-2';

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
/** How long the results HUD fades in and out. Matches the player HUD fade. */
const NETWORK_TEST_HUD_FADE_MS = 250;
/** Connection path shows at most this many device tiles. */
const NETWORK_TEST_HUD_MAX_TILES = 5;
/** Status icons rest at 1.5m and bob by 0.1m. The number sits above that. */
const NETWORK_TEST_BADGE_Y = 2.85;
/** Same circle for 1–9 and 10–99. Numbers never go past two digits. */
const NETWORK_TEST_BADGE_FRAME_PX = 360;
const NETWORK_TEST_BADGE_CONNECTED_HEX = '#408cff';
const NETWORK_TEST_BADGE_FAIL_HEX = '#d1141a';
/** Part id → outline icon in the shared icon list. */
const NETWORK_TEST_HUD_PART_ICONS = {
    'comms-cupboard': 'icon_server',
    router: 'icon_router',
    switch: 'icon_switch',
    'access-point': 'icon_wifi',
    'desktop-pc': 'icon_computer_desktop',
    laptop: 'icon_computer_desktop',
    nas: 'icon_server',
    printer: 'icon_printer',
    tv: 'icon_tv',
    tablet: 'icon_wifi',
    'wifi-extender': 'icon_wifi',
};
/** @type {HTMLElement | null} */
let testHudDeviceEl = null;
/** @type {HTMLElement | null} */
let testHudBarEl = null;
/** @type {HTMLOListElement | null} */
let testHudChainEl = null;
/** @type {HTMLElement | null} */
let testHudNameEl = null;
/** @type {HTMLElement | null} */
let testHudNumEl = null;
/** @type {HTMLElement | null} */
let testHudTypeEl = null;
/** @type {HTMLElement | null} */
let testHudResultTextEl = null;
/** @type {HTMLElement | null} */
let testHudDotEl = null;
/** @type {HTMLElement | null} */
let testHudTallyEl = null;
/** @type {HTMLButtonElement | null} */
let testHudToggleBtn = null;
/** @type {HTMLElement | null} */
let testHudToggleNumEl = null;
/** @type {HTMLElement | null} */
let testHudToggleValueEl = null;
/** @type {HTMLElement | null} */
let testHudToggleIconEl = null;
/** @type {HTMLElement | null} */
let testHudActionsEl = null;
/** @type {HTMLButtonElement | null} */
let testHudPrevBtn = null;
/** @type {HTMLButtonElement | null} */
let testHudNextBtn = null;
/** @type {HTMLElement | null} */
let testHudOpenTipEl = null;
/** @type {Array<object>} */
let testHudEntries = [];
/** @type {number} */
let testHudIndex = 0;
/** @type {boolean} */
let testHudPanelOpen = true;
/** @type {number | null} */
let testHudFadeTimer = null;
/** @type {HTMLElement | null} */
let testHudIdentityEl = null;
/** @type {HTMLElement | null} */
let testHudHomeStatusEl = null;
/** @type {HTMLElement | null} */
let testHudHomeTextEl = null;
/** @type {HTMLElement | null} */
let testHudHomeTallyEl = null;
/** @type {HTMLElement | null} */
let testHudHomeDotEl = null;
/** Runtime number badges from host.SpatialLabel. Not scene-JSON annotations. */
/** @type {object[]} */
let testHudNumberLabels = [];
/**
 * Meshes tinted for the open Test result (fail red / connected blue).
 * Explore hover must not clear these until Try again / Retry / Continue / Go Back.
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
        typeof host.getUIContainerSlot !== 'function' ||
        typeof host.getIcon !== 'function' ||
        typeof host.getPlayerUiRoot !== 'function' ||
        typeof host.Color3 !== 'function' ||
        typeof host.dispatchAppEvent !== 'function' ||
        typeof host.button !== 'function' ||
        typeof host.SpatialLabel !== 'function' ||
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

    return { waveA, waveB };
}

/**
 * Start looping packet streams on connected cables (partial success included).
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function startNetworkTestCableFlow(result) {
    stopCableFlowFx();
    if (!boundScene) {
        return;
    }
    const { waveA, waveB } = collectConnectedCableFlowWaves(result);
    if (waveA.length === 0 && waveB.length === 0) {
        setNetworkTestCableXray(false);
        return;
    }
    setNetworkTestCableXray(true);
    playCableFlowWaves(boundScene, waveA, waveB, {
        progressMs: NETWORK_TEST_PROGRESS_MS,
    });
    cableFlowOwner = 'test';
}

/** Hard-clear Test cable-flow particles + cable x-ray (dialog exit / dispose / re-test). */
function clearNetworkTestCableFlow() {
    stopCableFlowFx();
    if (cableFlowOwner === 'test') {
        cableFlowOwner = null;
    }
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
}

/**
 * @param {object[]} stamps
 */
function highlightNetworkTestConnectedStamps(stamps) {
    applyNetworkTestOverlayToStamps(stamps, 'connected');
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
}

/**
 * @param {'retry' | 'continue' | 'go-back' | 'map-passed'} action
 */
function dispatchNetworkTestFlowAction(action) {
    window.dispatchEvent(
        new CustomEvent(EVENT_SIM_NETWORK_TEST_FLOW, {
            detail: { action },
        })
    );
}

/**
 * Cupboard counts as one device so the progress alert and the HUD tally match.
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 * @returns {{ ok: number, total: number }}
 */
function networkTestHudTally(result) {
    const connectedCount = Array.isArray(result?.connected) ? result.connected.length : 0;
    const missingCount = Array.isArray(result?.missing) ? result.missing.length : 0;
    const cupboard = result?.startStamp ? 1 : 0;
    const ok = connectedCount + (result?.hasDirectRouter ? 1 : 0);
    return { ok, total: connectedCount + missingCount + cupboard };
}

/**
 * Shortest cable path. `allowed` limits which stamps may be visited.
 * @param {Map<string, Set<string>>} adj
 * @param {string} startId
 * @param {string} goalId
 * @param {Set<string> | null} [allowed]
 * @returns {string[] | null}
 */
function bfsPath(adj, startId, goalId, allowed) {
    if (!startId || !goalId) {
        return null;
    }
    if (allowed && (!allowed.has(startId) || !allowed.has(goalId))) {
        return null;
    }
    if (startId === goalId) {
        return [startId];
    }
    /** @type {Map<string, string | null>} */
    const prev = new Map();
    /** @type {string[]} */
    const queue = [startId];
    prev.set(startId, null);
    while (queue.length > 0) {
        const id = queue.shift();
        for (const next of adj.get(id) || []) {
            if (prev.has(next)) {
                continue;
            }
            if (allowed && !allowed.has(next)) {
                continue;
            }
            prev.set(next, id);
            if (next === goalId) {
                /** @type {string[]} */
                const path = [];
                let cur = goalId;
                while (cur) {
                    path.push(cur);
                    cur = prev.get(cur);
                }
                path.reverse();
                return path;
            }
            queue.push(next);
        }
    }
    return null;
}

/**
 * Stamps you can walk to, without stepping into `blocked`.
 * @param {Map<string, Set<string>>} adj
 * @param {string} startId
 * @param {Set<string> | null} blocked
 * @returns {Set<string>}
 */
function collectComponent(adj, startId, blocked) {
    /** @type {Set<string>} */
    const seen = new Set();
    if (!startId || (blocked && blocked.has(startId))) {
        return seen;
    }
    /** @type {string[]} */
    const queue = [startId];
    seen.add(startId);
    while (queue.length > 0) {
        const id = queue.shift();
        for (const next of adj.get(id) || []) {
            if (seen.has(next) || (blocked && blocked.has(next))) {
                continue;
            }
            seen.add(next);
            queue.push(next);
        }
    }
    return seen;
}

/**
 * @param {Map<string, Set<string>>} adj
 * @param {string} originId
 * @param {string[]} candidateIds
 * @param {Set<string>} allowed
 * @param {(candidateId: string, bestId: string) => boolean} isBetterTie
 * @returns {string | null}
 */
function pickFarthest(adj, originId, candidateIds, allowed, isBetterTie) {
    /** @type {string | null} */
    let best = null;
    let bestDist = -1;
    for (const id of candidateIds) {
        const path = bfsPath(adj, originId, id, allowed);
        if (!path) {
            continue;
        }
        const dist = path.length - 1;
        const betterTie = best != null && dist === bestDist && isBetterTie(id, best);
        if (best == null || dist > bestDist || betterTie) {
            best = id;
            bestDist = dist;
        }
    }
    return best;
}

/**
 * @param {string[]} ids
 * @param {Map<string, number>} numbersById
 * @returns {string | null}
 */
function pickLowestNumberId(ids, numbersById) {
    /** @type {string | null} */
    let best = null;
    let bestNum = Infinity;
    for (const id of ids) {
        const num = numbersById.get(id) ?? 9999;
        if (num < bestNum) {
            best = id;
            bestNum = num;
        }
    }
    return best;
}

/**
 * Same router the test accepts: learner-placed, cabled straight to the cupboard.
 * @param {object} startStamp
 * @param {Map<string, Set<string>>} adj
 * @returns {string[]}
 */
function directPlayerRouterIds(startStamp, adj) {
    /** @type {string[]} */
    const ids = [];
    for (const neighbourId of adj.get(startStamp?.stampId) || []) {
        const neighbour = getStampById(neighbourId);
        if (
            neighbour?.playerDrop === true &&
            neighbour.partId === NETWORK_TEST_ROUTER_PART_ID
        ) {
            ids.push(neighbourId);
        }
    }
    return ids;
}

/**
 * @param {object} startStamp
 * @param {string[]} directIds
 * @param {Map<string, Set<string>>} adj
 * @returns {Set<string>}
 */
function liveNetworkIds(startStamp, directIds, adj) {
    const live = new Set(collectReachableFrom(directIds, adj));
    if (startStamp?.stampId) {
        live.add(startStamp.stampId);
    }
    return live;
}

/**
 * @param {string} candidateId
 * @param {string} bestId
 * @param {Map<string, number>} numbersById
 * @returns {boolean}
 */
function isBetterHudAnchor(candidateId, bestId, numbersById) {
    const rank = (id) =>
        getStampById(id)?.partId === NETWORK_TEST_ROUTER_PART_ID ? 0 : 1;
    const byKind = rank(candidateId) - rank(bestId);
    if (byKind !== 0) {
        return byKind < 0;
    }
    return (numbersById.get(candidateId) ?? 9999) < (numbersById.get(bestId) ?? 9999);
}

/**
 * A placed router, or a faded stand-in when the map has none.
 * @param {Map<string, number>} numbersById
 * @returns {{ stamp?: object, ghost?: boolean, partId?: string, label?: string }}
 */
function routerStandIn(numbersById) {
    const id = pickLowestNumberId(
        [...numbersById.keys()].filter(
            (stampId) => getStampById(stampId)?.partId === NETWORK_TEST_ROUTER_PART_ID
        ),
        numbersById
    );
    if (id) {
        return { stamp: getStampById(id) };
    }
    return {
        ghost: true,
        partId: NETWORK_TEST_ROUTER_PART_ID,
        label: 'Router (not placed)',
    };
}

/**
 * @param {string[]} ids
 * @returns {Array<{ stamp: object }>}
 */
function idsToHops(ids) {
    /** @type {Array<{ stamp: object }>} */
    const hops = [];
    for (const id of ids || []) {
        const stamp = getStampById(id);
        if (stamp) {
            hops.push({ stamp });
        }
    }
    return hops;
}

/**
 * @param {Array<object>} hops
 * @param {number} breakAfter
 * @returns {{ hops: Array<object>, breakAfter: number, skip: object | null }}
 */
function trimHudHops(hops, breakAfter) {
    if (hops.length <= NETWORK_TEST_HUD_MAX_TILES) {
        return { hops, breakAfter, skip: null };
    }
    const skipped = hops.length - NETWORK_TEST_HUD_MAX_TILES;
    const trimmed = hops.slice(0, 2).concat(hops.slice(hops.length - 3));
    const spanLast = hops.length - 4;
    if (breakAfter >= 1 && breakAfter <= spanLast) {
        return {
            hops: trimmed,
            breakAfter: 1,
            skip: { linkIndex: 1, count: skipped, isBreak: true },
        };
    }
    const newBreak = breakAfter > spanLast ? breakAfter - skipped : breakAfter;
    return {
        hops: trimmed,
        breakAfter: newBreak,
        skip: { linkIndex: 1, count: skipped, isBreak: false },
    };
}

/**
 * @param {object} hop
 * @returns {string}
 */
function hudHopId(hop) {
    return hop?.stamp?.stampId || '';
}

/**
 * @param {Map<string, Set<string>>} adj
 * @param {object} left
 * @param {object} right
 * @returns {boolean}
 */
function hudLinkIsReal(adj, left, right) {
    const a = hudHopId(left);
    const b = hudHopId(right);
    if (!a || !b) {
        return false;
    }
    return Boolean(adj.get(a)?.has(b));
}

/**
 * @param {Array<object>} hops
 * @param {number} breakAfter
 * @param {{ linkIndex: number, count: number, isBreak: boolean } | null} skip
 * @param {Map<string, Set<string>>} adj
 * @returns {Array<{ style: string, tip: string, kind: string }>}
 */
function buildHudLinks(hops, breakAfter, skip, adj) {
    /** @type {Array<{ style: string, tip: string, kind: string }>} */
    const links = [];
    for (let i = 0; i < hops.length - 1; i += 1) {
        const isSkip = Boolean(skip && i === skip.linkIndex);
        const isBreak = i === breakAfter || (isSkip && skip.isBreak);
        const real = hudLinkIsReal(adj, hops[i], hops[i + 1]);
        const more = skip
            ? `${skip.count} more hop${skip.count === 1 ? '' : 's'}`
            : '';
        let style = 'ok';
        let tip = 'Cable';
        if (isBreak) {
            style = 'break';
            tip = isSkip ? `Missing · ${more}` : 'Missing';
        } else if (isSkip) {
            style = 'skip';
            tip = `Cable · ${more}`;
        } else if (breakAfter >= 0 && i > breakAfter) {
            style = real ? 'after' : 'after-missing';
            tip = real ? 'Cable' : 'Missing';
        } else if (!real) {
            style = 'break';
            tip = 'Missing';
        }
        links.push({ style, tip, kind: 'cable' });
    }
    return links;
}

/**
 * @param {Array<object>} hops
 * @param {number} breakAfter
 * @param {Map<string, Set<string>>} adj
 * @returns {{ hops: Array<object>, breakAfter: number, links: Array<object> }}
 */
function finalizeHudPath(hops, breakAfter, adj) {
    const trimmed = trimHudHops(hops, breakAfter);
    return {
        hops: trimmed.hops,
        breakAfter: trimmed.breakAfter,
        links: buildHudLinks(trimmed.hops, trimmed.breakAfter, trimmed.skip, adj),
    };
}

/**
 * Path from the cupboard to one device, plus the first broken link.
 * The break is the far end of a disconnected chain, not the hop nearest the device.
 * @param {object} stamp
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 * @param {Map<string, Set<string>>} adj
 * @param {Map<string, number>} numbersById
 * @returns {{ hops: Array<object>, breakAfter: number, links: Array<object> }}
 */
function buildHudPath(stamp, result, adj, numbersById) {
    const start = result.startStamp;
    if (!start || !stamp) {
        return { hops: [], breakAfter: -1, links: [] };
    }
    const directIds = directPlayerRouterIds(start, adj);
    const primaryId = pickLowestNumberId(directIds, numbersById);
    const primaryHop = primaryId ? { stamp: getStampById(primaryId) } : routerStandIn(numbersById);
    if (stamp.stampId === start.stampId) {
        const breakAfter = result.hasDirectRouter && primaryId ? -1 : 0;
        return finalizeHudPath([{ stamp: start }, primaryHop], breakAfter, adj);
    }
    const connectedIds = new Set((result.connected || []).map((item) => item.stampId));
    if (connectedIds.has(stamp.stampId)) {
        const live = liveNetworkIds(start, directIds, adj);
        const ids = bfsPath(adj, start.stampId, stamp.stampId, live);
        if (!ids) {
            console.log(
                `[partCables.js]: [N/A] - [buildHudPath] - missingConnectedPath has a value of ${stamp.stampId}.`
            ); //This is logged when a connected device has no cable path inside the live network.
        }
        const hops = ids ? idsToHops(ids) : [{ stamp: start }, { stamp }];
        return finalizeHudPath(hops, -1, adj);
    }
    if (!result.hasDirectRouter) {
        const component = collectComponent(adj, stamp.stampId, null);
        const routerIds = [...component].filter(
            (id) => getStampById(id)?.partId === NETWORK_TEST_ROUTER_PART_ID
        );
        if (routerIds.length > 0) {
            const farId = pickFarthest(adj, stamp.stampId, routerIds, component, (id, best) => {
                return (numbersById.get(id) ?? 9999) < (numbersById.get(best) ?? 9999);
            });
            const ids = farId ? bfsPath(adj, farId, stamp.stampId, component) : null;
            const tail = ids ? idsToHops(ids) : [{ stamp }];
            return finalizeHudPath([{ stamp: start }, ...tail], 0, adj);
        }
        return finalizeHudPath(
            [{ stamp: start }, routerStandIn(numbersById), { stamp }],
            0,
            adj
        );
    }
    const live = liveNetworkIds(start, directIds, adj);
    const island = collectComponent(adj, stamp.stampId, live);
    const anchorIds = [...island].filter((id) => {
        const partId = getStampById(id)?.partId;
        return partId === NETWORK_TEST_ROUTER_PART_ID || partId === 'switch';
    });
    let anchorId = stamp.stampId;
    if (anchorIds.length > 0) {
        const far = pickFarthest(adj, stamp.stampId, anchorIds, island, (id, best) => {
            return isBetterHudAnchor(id, best, numbersById);
        });
        if (far) {
            anchorId = far;
        }
    }
    const islandIds = bfsPath(adj, anchorId, stamp.stampId, island) || [stamp.stampId];
    return finalizeHudPath(
        [{ stamp: start }, primaryHop, ...idsToHops(islandIds)],
        1,
        adj
    );
}

/**
 * Camera home is 0. Cupboard is 1. Then map-placed required devices, then learner drops.
 * The list stays in number order.
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 * @returns {Array<object>}
 */
function buildHudNavigation(result) {
    const home = {
        kind: 'home',
        number: 0,
        connected: result?.passed === true,
        stamp: null,
        path: null,
    };
    if (!result?.startStamp) {
        return [home];
    }
    const stamps = getAllStamps();
    const required = stamps.filter((stamp) => {
        if (isStartStamp(stamp)) {
            return false;
        }
        return isWiredOrBothLink(getPartDef(stamp.partId));
    });
    const mapPlaced = required.filter((stamp) => stamp.playerDrop !== true);
    const dropped = required.filter((stamp) => stamp.playerDrop === true);
    /** @type {object[]} */
    const numbered = [];
    if (result.startStamp) {
        numbered.push(result.startStamp);
    }
    numbered.push(...mapPlaced, ...dropped);
    /** @type {Map<string, number>} */
    const numbersById = new Map();
    numbered.forEach((stamp, index) => numbersById.set(stamp.stampId, index + 1));
    const adj = buildNetworkAdjacency(getAllCableLinks());
    const connectedIds = new Set((result.connected || []).map((stamp) => stamp.stampId));
    const entries = numbered.map((stamp) => {
        const connected =
            stamp.stampId === result.startStamp?.stampId
                ? result.hasDirectRouter === true
                : connectedIds.has(stamp.stampId);
        return {
            stamp,
            number: numbersById.get(stamp.stampId),
            connected,
            path: buildHudPath(stamp, result, adj, numbersById),
        };
    });
    entries.sort((a, b) => a.number - b.number);
    return [home, ...entries];
}

/**
 * @param {string} partId
 * @returns {string}
 */
function hudPartIconName(partId) {
    return NETWORK_TEST_HUD_PART_ICONS[partId] || 'icon_server';
}

/**
 * @param {string} name
 * @returns {string}
 */
function hudIconHtml(name) {
    const host = getNetworkTestHost();
    return host.getIcon(name, '') || '';
}

/**
 * @param {object} hop
 * @returns {string}
 */
function hudHopLabel(hop) {
    if (hop?.ghost) {
        return hop.label || 'Router (not placed)';
    }
    return getStampLabel(hop?.stamp);
}

/**
 * @param {HTMLElement} el
 * @param {boolean} connected
 */
function setHudNumberFace(el, connected) {
    el.classList.remove('bg-primary', 'text-primary-content', 'bg-error', 'text-error-content');
    el.classList.add(
        ...(connected
            ? ['bg-primary', 'text-primary-content']
            : ['bg-error', 'text-error-content'])
    );
}

/**
 * @param {HTMLElement} el
 * @param {boolean} connected
 */
function setHudTypeFace(el, connected) {
    el.classList.remove('bg-primary/15', 'text-primary', 'bg-error/15', 'text-error');
    el.classList.add(
        ...(connected ? ['bg-primary/15', 'text-primary'] : ['bg-error/15', 'text-error'])
    );
}

function clearHudTip() {
    testHudOpenTipEl?.classList.remove('tooltip-open');
    testHudOpenTipEl = null;
}

/**
 * @param {HTMLElement} el
 */
function toggleHudTip(el) {
    if (testHudOpenTipEl === el) {
        clearHudTip();
        return;
    }
    clearHudTip();
    el.classList.add('tooltip-open');
    testHudOpenTipEl = el;
}

/**
 * @param {HTMLButtonElement} button
 */
function bindHudTipButton(button) {
    button.addEventListener('pointerenter', () => playSfx('default-ui-hover'));
    button.addEventListener('pointerleave', (event) => {
        if (event.pointerType !== 'mouse') {
            return;
        }
        if (testHudOpenTipEl === button) {
            clearHudTip();
        }
    });
    button.addEventListener('click', () => {
        playSfx('default-ui-click');
        toggleHudTip(button);
    });
}

/**
 * @param {object} host
 * @param {{ id: string, variant: string, iconName: string, iconOnly: boolean, iconPosition: string, text: string, onClick: () => void }} options
 * @returns {{ wrap: HTMLElement, buttonEl: HTMLButtonElement | null }}
 */
function mountHudFactoryButton(host, options) {
    const wrap = host.button(
        options.id,
        options.variant,
        {
            iconName: options.iconName,
            iconOnly: options.iconOnly === true,
            iconPosition: options.iconPosition || 'before',
        },
        { text: options.text, tooltipPosition: 'top' },
        options.onClick
    );
    wrap.classList.add('inline-flex');
    const buttonEl = wrap.querySelector('button');
    if (buttonEl instanceof HTMLButtonElement) {
        buttonEl.setAttribute('aria-label', options.text);
        buttonEl.classList.remove('swap');
        if (options.iconOnly) {
            buttonEl.classList.add('btn-circle');
        } else {
            buttonEl.classList.add('sim-network-test-hud__action');
            buttonEl.querySelector('span')?.classList.add('sim-network-test-hud__action-label');
        }
    }
    return { wrap, buttonEl: buttonEl instanceof HTMLButtonElement ? buttonEl : null };
}

/**
 * @param {{ style: string, tip: string }} link
 * @returns {HTMLLIElement}
 */
function renderHudLink(link) {
    const li = document.createElement('li');
    li.className = 'sim-network-test-hud__link';
    const left = document.createElement('span');
    const right = document.createElement('span');
    left.className = 'sim-network-test-hud__line';
    right.className = 'sim-network-test-hud__line';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sim-network-test-hud__link-icon tooltip tooltip-bottom';
    button.setAttribute('data-tip', link.tip);
    button.setAttribute('aria-label', `${link.tip} link`);
    button.setAttribute('data-link-kind', link.kind || 'cable');
    const icon = document.createElement('span');
    if (link.style === 'break') {
        left.classList.add('border-error', 'border-dashed');
        right.classList.add('border-error', 'border-dashed');
        icon.className = 'sim-network-test-hud__break bg-error text-error-content';
        icon.innerHTML = hudIconHtml('icon_close');
    } else if (link.style === 'skip') {
        left.classList.add('border-primary', 'border-dotted');
        right.classList.add('border-primary', 'border-dotted');
        icon.className = 'text-primary';
        icon.innerHTML = hudIconHtml('icon_cable');
    } else if (link.style === 'after' || link.style === 'after-missing') {
        const dashed = link.style === 'after-missing';
        left.classList.add(dashed ? 'border-error' : 'border-base-content/20');
        right.classList.add(dashed ? 'border-error' : 'border-base-content/20');
        if (dashed) {
            left.classList.add('border-dashed');
            right.classList.add('border-dashed');
        }
        icon.className = 'text-base-content/40';
        icon.innerHTML = hudIconHtml('icon_cable');
    } else {
        left.classList.add('border-primary');
        right.classList.add('border-primary');
        icon.className = 'text-primary';
        icon.innerHTML = hudIconHtml('icon_cable');
    }
    button.appendChild(icon);
    bindHudTipButton(button);
    li.appendChild(left);
    li.appendChild(button);
    li.appendChild(right);
    return li;
}

/**
 * @param {object} hop
 * @param {number} index
 * @param {number} breakAfter
 * @returns {HTMLLIElement}
 */
function renderHudHop(hop, index, breakAfter) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    const label = hudHopLabel(hop);
    const faded = breakAfter >= 0 && index > breakAfter;
    button.className = `sim-network-test-hud__hop bg-base-200 tooltip tooltip-bottom ${
        faded ? 'text-base-content/40' : 'text-base-content'
    }`;
    button.setAttribute('data-tip', label);
    button.setAttribute('aria-label', label);
    const partId = hop?.ghost ? hop.partId : hop?.stamp?.partId;
    button.innerHTML = hudIconHtml(hudPartIconName(partId));
    bindHudTipButton(button);
    li.appendChild(button);
    return li;
}

/**
 * @param {{ hops: Array<object>, breakAfter: number, links: Array<object> } | null} path
 */
function renderHudChain(path) {
    if (!testHudChainEl) {
        return;
    }
    testHudChainEl.replaceChildren();
    const hops = path?.hops || [];
    testHudChainEl.hidden = hops.length === 0;
    hops.forEach((hop, index) => {
        if (index > 0 && path.links[index - 1]) {
            testHudChainEl.appendChild(renderHudLink(path.links[index - 1]));
        }
        testHudChainEl.appendChild(renderHudHop(hop, index, path.breakAfter));
    });
}

/**
 * @param {object | null} entry
 * @param {boolean} open
 * @returns {string}
 */
function hudToggleLabel(entry, open) {
    const verb = open ? 'Hide' : 'Show';
    if (!entry) {
        return `${verb} device details`;
    }
    if (entry.kind === 'home') {
        return `${verb} test overview`;
    }
    const state = entry.connected ? 'connected' : 'not connected';
    return `${verb} device details, device ${entry.number}, ${state}`;
}

/**
 * @param {object | null} entry
 */
function updateHudToggle(entry) {
    if (!testHudToggleBtn) {
        return;
    }
    const open = testHudPanelOpen && Boolean(entry);
    testHudToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    testHudToggleBtn.setAttribute('aria-label', hudToggleLabel(entry, open));
    testHudToggleBtn.disabled = !entry;
    if (testHudToggleNumEl) {
        testHudToggleNumEl.hidden = !entry;
        if (entry) {
            setHudNumberFace(testHudToggleNumEl, entry.connected);
        }
    }
    if (testHudToggleValueEl) {
        if (entry?.kind === 'home') {
            testHudToggleValueEl.classList.add('sim-network-test-hud__home-icon');
            testHudToggleValueEl.innerHTML = hudIconHtml('icon_reset');
        } else if (entry) {
            testHudToggleValueEl.classList.remove('sim-network-test-hud__home-icon');
            testHudToggleValueEl.textContent = String(entry.number);
        }
    }
    if (testHudToggleIconEl) {
        const iconName = open ? 'icon_chevron_up' : 'icon_chevron_down';
        testHudToggleIconEl.innerHTML = hudIconHtml(iconName);
    }
}

function clearHudHomeMode() {
    if (testHudIdentityEl) {
        testHudIdentityEl.hidden = false;
    }
    if (testHudHomeStatusEl) {
        testHudHomeStatusEl.hidden = true;
    }
}

/**
 * Camera home card: the same result line as the bottom bar. No device, number, or cable chain.
 * @param {object} entry
 */
function renderHudHome(entry) {
    if (!entry || !testHudDeviceEl) {
        return;
    }
    const statusText = testHudResultTextEl?.textContent || '';
    const tallyText = testHudTallyEl?.textContent || '';
    testHudDeviceEl.setAttribute('aria-label', `${statusText}, ${tallyText}`);
    if (testHudIdentityEl) {
        testHudIdentityEl.hidden = true;
    }
    if (testHudChainEl) {
        testHudChainEl.hidden = true;
    }
    if (testHudHomeStatusEl) {
        testHudHomeStatusEl.hidden = false;
    }
    if (testHudHomeTextEl) {
        testHudHomeTextEl.textContent = statusText;
    }
    if (testHudHomeTallyEl) {
        testHudHomeTallyEl.textContent = tallyText;
    }
    paintHudStatusIcon(testHudHomeDotEl, testHudResultTextEl?.textContent === 'TEST SUCCESS');
    updateHudToggle(entry);
    testHudDeviceEl.classList.toggle('hidden', !testHudPanelOpen);
}

/**
 * @param {object} entry
 */
function renderHudFocus(entry) {
    if (!entry || !testHudDeviceEl) {
        return;
    }
    if (entry.kind === 'home') {
        renderHudHome(entry);
        return;
    }
    clearHudHomeMode();
    const label = getStampLabel(entry.stamp);
    const state = entry.connected ? 'connected' : 'not connected';
    testHudDeviceEl.setAttribute(
        'aria-label',
        `Device ${entry.number}, ${label}, ${state}`
    );
    if (testHudNameEl) {
        testHudNameEl.textContent = label;
    }
    if (testHudNumEl) {
        testHudNumEl.hidden = false;
        testHudNumEl.textContent = String(entry.number);
        setHudNumberFace(testHudNumEl, entry.connected);
    }
    if (testHudTypeEl) {
        testHudTypeEl.hidden = false;
        setHudTypeFace(testHudTypeEl, entry.connected);
        testHudTypeEl.innerHTML = hudIconHtml(hudPartIconName(entry.stamp?.partId));
    }
    renderHudChain(entry.path);
    updateHudToggle(entry);
    testHudDeviceEl.classList.toggle('hidden', !testHudPanelOpen);
}

/**
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function renderHudEmpty(result) {
    clearHudHomeMode();
    const note = result.notes?.[0] || 'No Comms Cupboard found.';
    testHudDeviceEl?.setAttribute('aria-label', note);
    if (testHudNameEl) {
        testHudNameEl.textContent = note;
    }
    if (testHudNumEl) {
        testHudNumEl.hidden = true;
    }
    if (testHudTypeEl) {
        testHudTypeEl.hidden = true;
    }
    if (testHudChainEl) {
        testHudChainEl.replaceChildren();
        testHudChainEl.hidden = true;
    }
    testHudPanelOpen = true;
    testHudDeviceEl?.classList.remove('hidden', 'is-fading');
    updateHudToggle(null);
}

/**
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 * @param {{ ok: number, total: number }} tally
 */
function renderHudResult(result, tally) {
    const passed = result.passed === true;
    if (testHudResultTextEl) {
        testHudResultTextEl.textContent = passed ? 'TEST SUCCESS' : 'TEST FAILED';
    }
    if (testHudTallyEl) {
        testHudTallyEl.textContent = `${tally.ok}/${tally.total}`;
    }
    paintHudStatusIcon(testHudDotEl, passed);
    paintHudStatusIcon(testHudHomeDotEl, passed);
}

/**
 * Red warning when the test failed, blue success when it passed.
 * @param {HTMLElement | null} el
 * @param {boolean} passed
 */
function paintHudStatusIcon(el, passed) {
    if (!el) {
        return;
    }
    el.classList.remove('text-error', 'text-primary');
    el.classList.add(passed ? 'text-primary' : 'text-error');
    el.innerHTML = hudIconHtml(passed ? 'icon_success' : 'icon_triangle_warning');
}

/**
 * @param {boolean} passed
 */
function mountHudActions(passed) {
    const host = getNetworkTestHost();
    testHudActionsEl?.replaceChildren();
    const retry = mountHudFactoryButton(host, {
        id: 'sim-network-test-hud-retry',
        variant: passed ? 'ghost' : 'neutral',
        iconName: 'icon_arrow_path',
        iconOnly: false,
        iconPosition: 'before',
        text: 'Retry',
        onClick: () => onHudRetry(passed),
    });
    testHudActionsEl?.appendChild(retry.wrap);
    if (!passed) {
        return;
    }
    const next = mountHudFactoryButton(host, {
        id: 'sim-network-test-hud-next',
        variant: 'primary',
        iconName: 'icon_arrow_right',
        iconOnly: false,
        iconPosition: 'after',
        text: 'Next',
        onClick: () => onHudNext(),
    });
    testHudActionsEl?.appendChild(next.wrap);
}

function concealPaletteForHud() {
    hideDropPalette();
    if (networkTestAlertEl) {
        networkTestAlertEl.hidden = true;
    }
}

function revealDropPalette() {
    showDropPalette();
}

function cancelHudFadeTimer() {
    if (testHudFadeTimer != null) {
        window.clearTimeout(testHudFadeTimer);
        testHudFadeTimer = null;
    }
}

/**
 * @param {HTMLElement | null} el
 */
function fadeInHudPiece(el) {
    if (!el) {
        return;
    }
    el.classList.remove('hidden');
    el.classList.add('is-fading');
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            el.classList.remove('is-fading');
        });
    });
}

/**
 * @param {() => void} [onDone]
 */
function fadeOutHud(onDone) {
    cancelHudFadeTimer();
    for (const el of [testHudDeviceEl, testHudBarEl]) {
        if (el && !el.classList.contains('hidden')) {
            el.classList.add('is-fading');
        }
    }
    testHudFadeTimer = window.setTimeout(() => {
        testHudFadeTimer = null;
        for (const el of [testHudDeviceEl, testHudBarEl]) {
            el?.classList.add('hidden');
            el?.classList.remove('is-fading');
        }
        onDone?.();
    }, NETWORK_TEST_HUD_FADE_MS);
}

/**
 * @param {boolean} passed
 */
function showNetworkTestHud(passed) {
    cancelHudFadeTimer();
    concealPaletteForHud();
    fadeInHudPiece(testHudBarEl);
    if (passed) {
        testHudDeviceEl?.classList.add('hidden');
        testHudDeviceEl?.classList.remove('is-fading');
    } else {
        fadeInHudPiece(testHudDeviceEl);
    }
    playSfx('default-ui-open');
}

function closeNetworkTestHud() {
    clearNetworkTestNumberBadges();
    playSfx('default-ui-close');
    fadeOutHud(() => {
        revealDropPalette();
    });
}

function clearNetworkTestNumberBadges() {
    for (const label of testHudNumberLabels) {
        label.dispose();
    }
    testHudNumberLabels = [];
}

/**
 * One billboard number per tested device, above the floating status icon.
 * Built when the results open. Not an annotations-plugin entry.
 * @param {Array<object>} entries
 */
function showNetworkTestNumberBadges(entries) {
    clearNetworkTestNumberBadges();
    if (!boundScene) {
        return;
    }
    const layout = getActiveLayout();
    if (!layout) {
        return;
    }
    const host = getNetworkTestHost();
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    for (const entry of entries) {
        if (entry.kind === 'home' || !entry.stamp) {
            continue;
        }
        const connected = entry.connected === true;
        const fill = connected ? NETWORK_TEST_BADGE_CONNECTED_HEX : NETWORK_TEST_BADGE_FAIL_HEX;
        const label = new host.SpatialLabel(
            boundScene,
            `simnetHudNum_${entry.stamp.stampId}`,
            String(entry.number),
            {
                billboard: true,
                planeHeightM: 0.38,
                textureWidth: 512,
                textureHeight: 512,
                style: {
                    frameBackgroundHex: fill,
                    frameBorderHex: fill,
                    textColorHex: '#ffffff',
                    fontSizePx: 200,
                    cornerRadiusPx: 180,
                    paddingHorizontalPx: 48,
                    paddingVerticalPx: 36,
                    borderThicknessPx: 0,
                },
            }
        );
        label.faces.forEach((face) => {
            face.frame.adaptWidthToChildren = false;
            face.frame.adaptHeightToChildren = false;
            face.frame.width = `${NETWORK_TEST_BADGE_FRAME_PX}px`;
            face.frame.height = `${NETWORK_TEST_BADGE_FRAME_PX}px`;
            face.frame.cornerRadius = NETWORK_TEST_BADGE_FRAME_PX / 2;
            face.textBlock.resizeToFit = false;
            face.textBlock.width = '100%';
            face.textBlock.height = '100%';
            face.textBlock.paddingLeftInPixels = 0;
            face.textBlock.paddingRightInPixels = 0;
            face.textBlock.paddingTopInPixels = 0;
            face.textBlock.paddingBottomInPixels = 0;
            face.frame.alpha = 1;
            face.plane.renderingGroupId = 1;
            face.plane.isPickable = false;
        });
        label.setLocalPosition([
            entry.stamp.x * cellSize + half,
            NETWORK_TEST_BADGE_Y,
            entry.stamp.z * cellSize + half,
        ]);
        testHudNumberLabels.push(label);
    }
    console.log(
        `[partCables.js]: [N/A] - [showNetworkTestNumberBadges] - badgeCount has a value of ${testHudNumberLabels.length}.`
    ); //This is logged when the results HUD creates the runtime device numbers.
}

/**
 * @param {boolean} passed
 */
function onHudRetry(passed) {
    clearNetworkTestCableFlow();
    clearNetworkTestFailHighlights();
    if (!passed) {
        setNetworkPaletteToolsEnabled(true);
    }
    resetNetworkTestControl();
    closeNetworkTestHud();
    const host = getNetworkTestHost();
    if (host?.EVENTS?.RESET_3D_VIEW) {
        host.dispatchAppEvent(host.EVENTS.RESET_3D_VIEW);
    }
    console.log(
        `[partCables.js]: [N/A] - [onHudRetry] - cameraReset has a value of ${Boolean(host?.EVENTS?.RESET_3D_VIEW)}.`
    ); //This is logged when Retry sends the same camera-home event as the Reset view button.
    if (passed) {
        dispatchNetworkTestFlowAction('retry');
        return;
    }
    notifyTutorialAction({ type: 'networkTestTryAgain' });
    console.log(
        `[partCables.js]: [N/A] - [onHudRetry] - retryKind has a value of try-again.`
    ); //This is logged when a failed test returns to editing without restarting the map.
}

function onHudNext() {
    clearNetworkTestCableFlow();
    clearNetworkTestFailHighlights();
    resetNetworkTestControl();
    closeNetworkTestHud();
    dispatchNetworkTestFlowAction('continue');
}

/**
 * @param {number} delta
 */
function stepNetworkTestHud(delta) {
    if (testHudEntries.length === 0) {
        return;
    }
    clearHudTip();
    const count = testHudEntries.length;
    testHudIndex = (testHudIndex + delta + count) % count;
    const entry = testHudEntries[testHudIndex];
    renderHudFocus(entry);
    if (entry.kind === 'home') {
        focusSimNetworkOverview();
    } else {
        focusSimNetworkCell({ x: entry.stamp.x, z: entry.stamp.z });
    }
    console.log(
        `[partCables.js]: [N/A] - [stepNetworkTestHud] - index has a value of ${testHudIndex}, kind has a value of ${entry.kind || 'device'}, stampId has a value of ${entry.stamp?.stampId || 'none'}, connected has a value of ${entry.connected}.`
    ); //This is logged when the learner steps to another item in the results HUD.
}

/**
 * @param {boolean} open
 */
function setHudPanelOpen(open) {
    testHudPanelOpen = open;
    clearHudTip();
    const entry = testHudEntries[testHudIndex] || null;
    if (testHudDeviceEl) {
        testHudDeviceEl.classList.toggle('hidden', !open);
        testHudDeviceEl.classList.remove('is-fading');
    }
    updateHudToggle(entry);
}

function ensureNetworkTestHud() {
    if (testHudBarEl && testHudDeviceEl) {
        return;
    }
    const host = getNetworkTestHost();
    testHudDeviceEl = document.createElement('div');
    testHudDeviceEl.className =
        'sim-network-test-hud__device hidden is-fading rounded-box bg-base-100/95 border border-base-content/10 shadow-lg text-base-content';
    testHudDeviceEl.setAttribute('role', 'region');
    testHudDeviceEl.setAttribute('aria-label', 'Device details');

    const identity = document.createElement('div');
    identity.className = 'sim-network-test-hud__identity';
    testHudIdentityEl = identity;
    testHudNumEl = document.createElement('span');
    testHudNumEl.className = 'sim-network-test-hud__num';
    testHudNumEl.setAttribute('aria-hidden', 'true');
    testHudTypeEl = document.createElement('span');
    testHudTypeEl.className = 'sim-network-test-hud__type';
    testHudTypeEl.setAttribute('aria-hidden', 'true');
    testHudNameEl = document.createElement('span');
    testHudNameEl.className = 'sim-network-test-hud__name';
    identity.appendChild(testHudNumEl);
    identity.appendChild(testHudTypeEl);
    identity.appendChild(testHudNameEl);

    testHudChainEl = document.createElement('ol');
    testHudChainEl.className = 'sim-network-test-hud__chain';
    testHudChainEl.setAttribute('aria-label', 'Connection path');
    testHudDeviceEl.appendChild(identity);
    testHudDeviceEl.appendChild(testHudChainEl);

    testHudHomeStatusEl = document.createElement('p');
    testHudHomeStatusEl.className = 'sim-network-test-hud__home-status';
    testHudHomeStatusEl.hidden = true;
    testHudHomeDotEl = document.createElement('span');
    testHudHomeDotEl.className = 'sim-network-test-hud__status-icon text-error';
    testHudHomeDotEl.setAttribute('aria-hidden', 'true');
    testHudHomeDotEl.innerHTML = hudIconHtml('icon_triangle_warning');
    testHudHomeTextEl = document.createElement('span');
    testHudHomeTallyEl = document.createElement('span');
    const homeSep = document.createElement('span');
    homeSep.className = 'sim-network-test-hud__sep';
    homeSep.textContent = '·';
    testHudHomeStatusEl.appendChild(testHudHomeDotEl);
    testHudHomeStatusEl.appendChild(testHudHomeTextEl);
    testHudHomeStatusEl.appendChild(homeSep);
    testHudHomeStatusEl.appendChild(testHudHomeTallyEl);
    testHudDeviceEl.appendChild(testHudHomeStatusEl);

    testHudBarEl = document.createElement('div');
    testHudBarEl.className = 'sim-network-test-hud__bar hidden is-fading';
    const resultLine = document.createElement('p');
    resultLine.className = 'sim-network-test-hud__result';
    resultLine.setAttribute('role', 'status');
    testHudDotEl = document.createElement('span');
    testHudDotEl.className = 'sim-network-test-hud__status-icon text-error';
    testHudDotEl.setAttribute('aria-hidden', 'true');
    testHudDotEl.innerHTML = hudIconHtml('icon_triangle_warning');
    testHudResultTextEl = document.createElement('span');
    testHudResultTextEl.textContent = 'TEST FAILED';
    const sep = document.createElement('span');
    sep.className = 'sim-network-test-hud__sep';
    sep.textContent = '·';
    testHudTallyEl = document.createElement('span');
    testHudTallyEl.textContent = '0/0';
    resultLine.appendChild(testHudDotEl);
    resultLine.appendChild(testHudResultTextEl);
    resultLine.appendChild(sep);
    resultLine.appendChild(testHudTallyEl);
    // Kept off screen. The top card reads these nodes. The footer does not show them.

    const controls = document.createElement('div');
    controls.className = 'sim-network-test-hud__controls';
    const panel = document.createElement('div');
    panel.className =
        'sim-network-test-hud__group bg-base-100/95 border border-base-content/10 shadow-lg text-base-content';
    const navGroup = document.createElement('div');
    navGroup.className = 'sim-network-test-hud__nav';
    const prev = mountHudFactoryButton(host, {
        id: 'sim-network-test-hud-prev',
        variant: 'neutral',
        iconName: 'icon_chevron_left',
        iconOnly: true,
        iconPosition: 'before',
        text: 'Previous device',
        onClick: () => stepNetworkTestHud(-1),
    });
    testHudPrevBtn = prev.buttonEl;
    testHudToggleBtn = document.createElement('button');
    testHudToggleBtn.type = 'button';
    testHudToggleBtn.className = 'btn btn-neutral sim-network-test-hud__toggle';
    testHudToggleBtn.setAttribute('aria-expanded', 'true');
    testHudToggleNumEl = document.createElement('span');
    testHudToggleNumEl.className = 'sim-network-test-hud__num sim-network-test-hud__num--sm';
    testHudToggleValueEl = document.createElement('span');
    testHudToggleValueEl.className = 'sim-network-test-hud__toggle-value';
    testHudToggleIconEl = document.createElement('span');
    testHudToggleIconEl.className = 'sim-network-test-hud__toggle-chevron';
    testHudToggleIconEl.setAttribute('aria-hidden', 'true');
    testHudToggleNumEl.appendChild(testHudToggleValueEl);
    testHudToggleBtn.appendChild(testHudToggleNumEl);
    testHudToggleBtn.appendChild(testHudToggleIconEl);
    testHudToggleBtn.addEventListener('pointerenter', () => playSfx('default-ui-hover'));
    testHudToggleBtn.addEventListener('click', () => {
        playSfx('default-ui-click');
        setHudPanelOpen(!testHudPanelOpen);
    });
    const next = mountHudFactoryButton(host, {
        id: 'sim-network-test-hud-next',
        variant: 'neutral',
        iconName: 'icon_chevron_right',
        iconOnly: true,
        iconPosition: 'before',
        text: 'Next device',
        onClick: () => stepNetworkTestHud(1),
    });
    testHudNextBtn = next.buttonEl;
    navGroup.appendChild(prev.wrap);
    navGroup.appendChild(testHudToggleBtn);
    navGroup.appendChild(next.wrap);

    const split = document.createElement('span');
    split.className = 'sim-network-test-hud__split';
    split.setAttribute('aria-hidden', 'true');
    testHudActionsEl = document.createElement('div');
    testHudActionsEl.className = 'sim-network-test-hud__actions';
    panel.appendChild(navGroup);
    panel.appendChild(split);
    panel.appendChild(testHudActionsEl);
    controls.appendChild(panel);
    testHudBarEl.appendChild(controls);

    host.getUIContainerSlot('header-center').appendChild(testHudDeviceEl);
    host.getUIContainerSlot('footer-center').appendChild(testHudBarEl);
}

/**
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function openNetworkTestHud(result) {
    ensureNetworkTestHud();
    clearHudTip();
    testHudEntries = buildHudNavigation(result);
    testHudIndex = 0;
    testHudPanelOpen = result.passed !== true;
    const tally = networkTestHudTally(result);
    renderHudResult(result, tally);
    mountHudActions(result.passed === true);
    const entry = testHudEntries[0] || null;
    if (testHudPrevBtn) {
        testHudPrevBtn.disabled = testHudEntries.length === 0;
    }
    if (testHudNextBtn) {
        testHudNextBtn.disabled = testHudEntries.length === 0;
    }
    if (!entry) {
        renderHudEmpty(result);
    } else if (entry.kind === 'home') {
        renderHudHome(entry);
        focusSimNetworkOverview();
    } else {
        renderHudFocus(entry);
        if (!result.passed) {
            focusSimNetworkCell({ x: entry.stamp.x, z: entry.stamp.z });
        }
    }
    showNetworkTestNumberBadges(testHudEntries);
    showNetworkTestHud(result.passed === true);
    console.log(
        `[partCables.js]: [N/A] - [openNetworkTestHud] - passed has a value of ${result.passed}, tally has a value of ${tally.ok}/${tally.total}, focus has a value of ${entry?.kind === 'home' ? 'overview' : entry?.stamp?.stampId || 'none'}.`
    ); //This is logged when the results HUD opens after the progress alert.
}

function destroyNetworkTestHud() {
    cancelHudFadeTimer();
    clearHudTip();
    clearNetworkTestNumberBadges();
    testHudDeviceEl?.remove();
    testHudBarEl?.remove();
    testHudDeviceEl = null;
    testHudBarEl = null;
    testHudChainEl = null;
    testHudIdentityEl = null;
    testHudHomeStatusEl = null;
    testHudHomeTextEl = null;
    testHudHomeTallyEl = null;
    testHudHomeDotEl = null;
    testHudNameEl = null;
    testHudNumEl = null;
    testHudTypeEl = null;
    testHudResultTextEl = null;
    testHudDotEl = null;
    testHudTallyEl = null;
    testHudToggleBtn = null;
    testHudToggleNumEl = null;
    testHudToggleValueEl = null;
    testHudToggleIconEl = null;
    testHudActionsEl = null;
    testHudPrevBtn = null;
    testHudNextBtn = null;
    testHudEntries = [];
    testHudIndex = 0;
    revealDropPalette();
}

function cancelNetworkTestProgressAnimation() {
    if (networkTestProgressRafId != null) {
        window.cancelAnimationFrame(networkTestProgressRafId);
        networkTestProgressRafId = null;
    }
    networkTestPendingResult = null;
}

/**
 * Fail progress uses the same fraction as the HUD tally, cupboard included.
 * Pass always targets 100%.
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 * @returns {number}
 */
function getNetworkTestProgressTargetPercent(result) {
    if (result?.passed) {
        return 100;
    }
    const tally = networkTestHudTally(result);
    if (tally.total <= 0) {
        return 0;
    }
    return Math.round((tally.ok / tally.total) * 100);
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
    notifyNetworkTestUiChanged();
    if (networkTestAlertEl) {
        networkTestAlertEl.hidden = true;
    }
    setNetworkTestAlertTone('info');
    if (networkTestBtn) {
        networkTestBtn.hidden = false;
        networkTestBtn.disabled = false;
        networkTestBtn.classList.remove('btn-active');
        networkTestBtn.setAttribute('aria-pressed', 'false');
    }
    refreshPaletteTrigger();
    if (networkTestProgressEl) {
        networkTestProgressEl.hidden = false;
    }
    updateNetworkTestProgressUi(0, NETWORK_TEST_LABEL_TESTING);
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
        playSfx('default-sys-success');
    } else {
        networkEditsLockedAfterPass = false;
        networkTestUiState = 'fail';
        setNetworkTestAlertTone('error');
        updateNetworkTestProgressUi(targetPercent, NETWORK_TEST_LABEL_FAIL, {
            showFailConnectedSuffix: true,
        });
        playSfx('default-sys-error');
    }
    // After the 3s morph, keep title + % text only — hide the bar.
    if (networkTestProgressEl) {
        networkTestProgressEl.hidden = true;
    }
    applyNetworkTestResultOverlays(result);
    notifyNetworkEditsLockChanged();
    // Cable-flow particles already started with the progress bar; keep looping.
    openNetworkTestHud(result);
    if (result.passed) {
        dispatchNetworkTestFlowAction('map-passed');
    }
    console.log(
        `[partCables.js]: [N/A] - [finishNetworkTestAfterProgress] - passed has a value of ${result.passed}, targetPercent has a value of ${targetPercent}, editsLocked has a value of ${networkEditsLockedAfterPass}, progressBarHidden has a value of true.`
    ); //This is logged when the progress alert finishes, the bar is hidden, and results are shown.
}

/**
 * Hide the toolbar, show the Daisy alert + progress, count toward the result target.
 * Pass → 100%. Fail → connected/required % (e.g. 3/4 → 75%).
 * @param {ReturnType<typeof evaluateNetworkTest>} result
 */
function startNetworkTestProgressMorph(result) {
    cancelNetworkTestProgressAnimation();
    networkTestPendingResult = result;
    networkTestUiState = 'testing';
    notifyNetworkTestUiChanged();
    const targetPercent = getNetworkTestProgressTargetPercent(result);
    if (networkTestBtn) {
        networkTestBtn.disabled = true;
    }
    hideDropPalette();
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
}

function runNetworkTest() {
    if (networkTestUiState !== 'idle') {
        return;
    }
    prepareSceneForNetworkTest();
    clearNetworkTestCableFlow();
    const result = evaluateNetworkTest();
    notifyTutorialAction({
        type: 'networkTest',
        result: result.passed ? 'pass' : 'fail',
    });
    console.log(
        `[partCables.js]: [N/A] - [runNetworkTest] - tutorialNotifyResult has a value of ${result.passed ? 'pass' : 'fail'}.`
    ); //This is logged when the network test result is known and reported to the tutorial coach.
    playSfx('test-connection');
    console.log(
        `[partCables.js]: [N/A] - [runNetworkTest] - testConnectionSfxDispatched has a value of true.`
    ); //This is logged when the network test progress morph starts and plays test-connection.
    startNetworkTestProgressMorph(result);
}

function mountNetworkTestButton() {
    const host = getNetworkTestHost();
    const palette = getDropPaletteElement();

    networkTestBtn = createToolbarFactoryButton(
        'sim-network-toolbar-test',
        'info',
        'icon_play',
        'Test',
        () => {
            runNetworkTest();
        }
    );
    networkTestBtn.className = 'btn btn-info sim-network-toolbar__test sim-network-test-control__btn';
    networkTestBtn.setAttribute('aria-label', 'Test connection');
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = host.getIcon('icon_play', 'h-5 w-5');
    const label = document.createElement('span');
    label.textContent = 'Test';
    networkTestBtn.replaceChildren(icon, label);
    applyPaletteButtonTooltip(
        networkTestBtn,
        PALETTE_BUTTON_TOOLTIPS.testConnection
    );
    if (palette) {
        palette.appendChild(networkTestBtn);
    } else {
        host.getPlayerUiRoot().appendChild(networkTestBtn);
    }

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

    host.getPlayerUiRoot().appendChild(networkTestAlertEl);
    networkTestControlEl = networkTestAlertEl;
    networkTestUiState = 'idle';
}

/**
 * Mount the Test Connection circle and the progress alert.
 * @param {import('@babylonjs/core').Scene} _scene
 * @param {{ stageRole?: 'tutorial' | 'level' | 'office' }} [options]
 */
export function initializePartNetworkTest(_scene, options = {}) {
    disposePartNetworkTest();
    networkTestStageRole =
        options.stageRole === 'tutorial' ? 'tutorial' : 'level';
    ensureNetworkTestHud();
    mountNetworkTestButton();
    console.log(
        `[partCables.js]: [N/A] - [initializePartNetworkTest] - ready has a value of true, stageRole has a value of ${networkTestStageRole}.`
    ); //This is logged when the network Test control is mounted for the current flow stage.
}

/**
 * Tear down Test UI, results HUD, and fail highlights.
 */
export function disposePartNetworkTest() {
    clearNetworkTestCableFlow();
    disposeCableFlowFx();
    clearNetworkTestFailHighlights();
    cancelNetworkTestProgressAnimation();
    networkTestPendingResult = null;
    networkTestUiState = 'idle';
    networkTestBtn?.remove();
    if (networkTestAlertEl?.parentNode) {
        networkTestAlertEl.parentNode.removeChild(networkTestAlertEl);
    }
    networkTestControlEl = null;
    networkTestBtn = null;
    networkTestAlertEl = null;
    networkTestTitleEl = null;
    networkTestDescEl = null;
    networkTestProgressEl = null;
    destroyNetworkTestHud();
    lastNetworkTestPassed = false;
    networkEditsLockedAfterPass = false;
    networkTestStageRole = 'level';
    notifyNetworkEditsLockChanged();
}
