/**
 * Sim-network explore cell highlight — green hover / sticky select in free play.
 * Phase 2.1 green · 2.2 purple/red droppable · 2.3 blue cable hover.
 */

import { getActiveLayout, getStampsAtCell } from './layoutAssembler.js';
import {
    isCableModeActive,
    isNetworkTestResultOverlayMesh,
    restoreNetworkTestResultOverlay,
} from './partCables.js';
import { isDroppableToolActive, pickCellAtPointer } from './partDrop.js';
import {
    disposeCellHoverFx,
    hideCellHoverFx,
    setCellHoverFxTheme,
    syncCellHoverFx,
    unhideCellHoverFx,
} from './partCellHoverFx.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const SELECT_CLICK_SLOP_PX = 5;
/** Bright sticky-select floor wash (higher opacity + emissive for even read on light/dark tiles). */
const SELECTED_WASH_ALPHA = 0.738;
/** Hover-only soft tint (selected wash stays bright). */
const HOVER_WASH_ALPHA = 0.22;
const SELECTED_OUTLINE_WIDTH = 0.016;
const SELECTED_OUTLINE_Y = 0.01;
const HOVER_OUTLINE_Y = 0.012;
const HOVER_INNER_OUTLINE_SCALE = 0.9;
/** Match partDrop hover purple for interactable mesh overlay. */
const DROPPABLE_PURPLE_RGB = { r: 0.7, g: 0.35, b: 0.95 };
const INTERACTABLE_OVERLAY_ALPHA = 0.4;

/** Wash / outline paint per theme (particles use matching bases in partCellHoverFx). */
const THEME_CHROME = {
    green: {
        wash: { r: 0.28, g: 0.98, b: 0.42 },
        selectedOutline: { r: 0.35, g: 1.0, b: 0.45 },
        hoverOutline: { r: 0.4, g: 1.0, b: 0.5 },
    },
    purple: {
        wash: { r: 0.7, g: 0.35, b: 0.95 },
        selectedOutline: { r: 0.78, g: 0.42, b: 1.0 },
        hoverOutline: { r: 0.82, g: 0.48, b: 1.0 },
    },
    red: {
        wash: { r: 0.95, g: 0.25, b: 0.2 },
        selectedOutline: { r: 1.0, g: 0.35, b: 0.28 },
        hoverOutline: { r: 1.0, g: 0.4, b: 0.32 },
    },
    blue: {
        wash: { r: 0.45, g: 0.72, b: 1.0 },
        selectedOutline: { r: 0.55, g: 0.82, b: 1.0 },
        hoverOutline: { r: 0.6, g: 0.85, b: 1.0 },
    },
};

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {import('@babylonjs/core').Observer | null} */
let pointerObserver = null;
/** @type {import('@babylonjs/core').TransformNode | null} */
let selectedWashRoot = null;
/** @type {import('@babylonjs/core').StandardMaterial | null} */
let selectedWashMat = null;
/** @type {import('@babylonjs/core').TransformNode | null} */
let hoverOutlineRoot = null;
/** @type {import('@babylonjs/core').StandardMaterial | null} */
let hoverWashMat = null;
/** @type {import('@babylonjs/core').StandardMaterial | null} */
let selectedOutlineMat = null;
/** @type {import('@babylonjs/core').LinesMesh[]} */
let hoverOutlineLines = [];
/** @type {'green' | 'purple' | 'red' | 'blue'} */
let activeChromeTheme = 'green';
/** @type {{ x: number, z: number } | null} */
let hoverCell = null;
/** @type {{ x: number, z: number } | null} */
let selectedCell = null;
/** @type {{ x: number, y: number, cell: { x: number, z: number } | null } | null} */
let pointerDownInfo = null;
/** @type {boolean} */
let toolsWereActive = false;
/** @type {'cable' | 'droppable' | null} */
let activeToolMode = null;
/** Click–click cable start cell (blue selected FX). */
/** @type {{ x: number, z: number } | null} */
let cableSelectedCell = null;
/** Last Cable-mode hover cell (kept when an event only updates selected). */
/** @type {{ x: number, z: number } | null} */
let lastCableHoverCell = null;
/** Meshes currently showing the purple interactable overlay. */
/** @type {Set<import('@babylonjs/core').AbstractMesh>} */
let overlaidMeshes = new Set();
/** @type {HTMLCanvasElement | null} */
let renderingCanvas = null;
let previousCursor = '';
/** Scene cursor ownership before we took over (Babylon auto-cursor). */
let previousDoNotHandleCursors = false;
/** Last cell key that owned the hand cursor (`x,z` or `''` for none). */
let lastCursorCellKey = '';
/** @type {((this: Window, ev: Event) => void) | null} */
let exploreSelectionListener = null;
/** @type {((this: Window, ev: Event) => void) | null} */
let droppableCellFxListener = null;
/** @type {((this: Window, ev: Event) => void) | null} */
let cableCellFxListener = null;

/** Other modules set/clear sticky green select without importing this file (avoids cycles). */
const EXPLORE_SELECTION_EVENT = 'sim-network-explore-selection';
/** partDrop drives purple/red hover FX without importing this file (avoids cycles). */
const DROPPABLE_CELL_FX_EVENT = 'sim-network-droppable-cell-fx';
/** partCables drives blue hover FX without importing this file (avoids cycles). */
const CABLE_CELL_FX_EVENT = 'sim-network-cable-cell-fx';

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.Color3 !== 'function' ||
        typeof host.MeshBuilder !== 'object' ||
        typeof host.StandardMaterial !== 'function' ||
        typeof host.TransformNode !== 'function' ||
        typeof host.Vector3 !== 'function' ||
        !host.PointerEventTypes ||
        typeof host.layoutCellHalfOffset !== 'function'
    ) {
        throw new Error(
            'Experience host API missing explore-highlight helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @returns {boolean}
 */
function areToolsActive() {
    return isDroppableToolActive() || isCableModeActive();
}

/**
 * @param {'green' | 'purple' | 'red' | 'blue'} theme
 */
function applyCellFxTheme(theme) {
    const chrome = THEME_CHROME[theme] || THEME_CHROME.green;
    activeChromeTheme = theme;
    setCellHoverFxTheme(theme);
    const host = getHost();

    if (selectedWashMat) {
        selectedWashMat.diffuseColor = new host.Color3(
            chrome.wash.r * 0.25,
            chrome.wash.g * 0.25,
            chrome.wash.b * 0.25
        );
        selectedWashMat.emissiveColor = new host.Color3(
            chrome.wash.r,
            chrome.wash.g,
            chrome.wash.b
        );
    }
    if (selectedOutlineMat) {
        selectedOutlineMat.diffuseColor = new host.Color3(
            chrome.selectedOutline.r * 0.35,
            chrome.selectedOutline.g * 0.35,
            chrome.selectedOutline.b * 0.35
        );
        selectedOutlineMat.emissiveColor = new host.Color3(
            chrome.selectedOutline.r,
            chrome.selectedOutline.g,
            chrome.selectedOutline.b
        );
    }
    if (hoverWashMat) {
        hoverWashMat.diffuseColor = new host.Color3(
            chrome.wash.r * 0.25,
            chrome.wash.g * 0.25,
            chrome.wash.b * 0.25
        );
        hoverWashMat.emissiveColor = new host.Color3(
            chrome.wash.r * 0.85,
            chrome.wash.g * 0.85,
            chrome.wash.b * 0.85
        );
    }
    for (const line of hoverOutlineLines) {
        if (line && !line.isDisposed?.()) {
            line.color = new host.Color3(
                chrome.hoverOutline.r,
                chrome.hoverOutline.g,
                chrome.hoverOutline.b
            );
        }
    }
}

/**
 * Outline / line chrome that must stay crisp on top of the cell.
 * @param {import('@babylonjs/core').AbstractMesh} mesh
 * @param {object} host
 */
function makeCellOverlayMesh(mesh, host) {
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    if (mesh.material) {
        mesh.material.disableDepthWrite = true;
        if (host.Engine?.ALWAYS != null) {
            mesh.material.depthFunction = host.Engine.ALWAYS;
        }
    }
}

/**
 * Floor tint under stamps/droppables — normal depth so props are not painted over.
 * Used for selected + hover washes (all colour themes share these meshes).
 * @param {import('@babylonjs/core').AbstractMesh} mesh
 * @param {object} host
 */
function makeFloorWashMesh(mesh, host) {
    mesh.isPickable = false;
    mesh.renderingGroupId = 0;
    if (mesh.material) {
        mesh.material.disableDepthWrite = true;
    }
}

/**
 * Four flat edge bars (no tube rings / corner bunching).
 * Corner lengths are shortened so bars meet without stacking alpha.
 * @param {string} name
 * @param {import('@babylonjs/core').TransformNode} parent
 * @param {number} half
 * @param {number} y
 * @param {number} width
 * @param {{ r: number, g: number, b: number }} rgb
 * @param {number} alpha
 * @param {number} emissiveScale
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} host
 */
function addRectOutlineBars(name, parent, half, y, width, rgb, alpha, emissiveScale, scene, host) {
    const mat = new host.StandardMaterial(`${name}_mat`, scene);
    mat.diffuseColor = new host.Color3(rgb.r * 0.35, rgb.g * 0.35, rgb.b * 0.35);
    mat.emissiveColor = new host.Color3(
        rgb.r * emissiveScale,
        rgb.g * emissiveScale,
        rgb.b * emissiveScale
    );
    mat.alpha = alpha;
    mat.transparencyMode = 2;
    mat.disableLighting = true;
    selectedOutlineMat = mat;

    const span = half * 2;
    const barLen = Math.max(span - width, width * 0.5);
    const h = 0.004;
    const inset = half - width * 0.5;

    /** @type {Array<{ n: string, w: number, d: number, x: number, z: number }>} */
    const specs = [
        { n: 'n', w: barLen, d: width, x: 0, z: -inset },
        { n: 's', w: barLen, d: width, x: 0, z: inset },
        { n: 'w', w: width, d: barLen, x: -inset, z: 0 },
        { n: 'e', w: width, d: barLen, x: inset, z: 0 },
    ];

    for (const spec of specs) {
        const bar = host.MeshBuilder.CreateBox(
            `${name}_${spec.n}`,
            { width: spec.w, height: h, depth: spec.d },
            scene
        );
        bar.position = new host.Vector3(spec.x, y, spec.z);
        bar.material = mat;
        bar.parent = parent;
        makeCellOverlayMesh(bar, host);
    }
}

/**
 * Green floor wash + thin bright outline for sticky-selected cell.
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} layout
 */
function buildSelectedWash(scene, layout) {
    const host = getHost();
    const cell = layout.cellSize ?? 1;
    const chrome = THEME_CHROME.green;
    selectedWashMat = new host.StandardMaterial('simNetworkExploreSelectedWashMat', scene);
    selectedWashMat.diffuseColor = new host.Color3(
        chrome.wash.r * 0.25,
        chrome.wash.g * 0.25,
        chrome.wash.b * 0.25
    );
    selectedWashMat.emissiveColor = new host.Color3(
        chrome.wash.r,
        chrome.wash.g,
        chrome.wash.b
    );
    selectedWashMat.alpha = SELECTED_WASH_ALPHA;
    selectedWashMat.transparencyMode = 2;
    selectedWashMat.disableLighting = true;

    selectedWashRoot = new host.TransformNode('simNetworkExploreSelectedWash', scene);
    const fill = host.MeshBuilder.CreateGround(
        'simNetworkExploreSelectedWashFill',
        { width: cell * 0.98, height: cell * 0.98 },
        scene
    );
    fill.parent = selectedWashRoot;
    fill.position.y = 0.003;
    fill.material = selectedWashMat;
    makeFloorWashMesh(fill, host);

    const half = (cell * 0.98) / 2;
    addRectOutlineBars(
        'simNetworkExploreSelectedOutline',
        selectedWashRoot,
        half,
        SELECTED_OUTLINE_Y,
        SELECTED_OUTLINE_WIDTH,
        chrome.selectedOutline,
        1,
        1,
        scene,
        host
    );
    selectedWashRoot.setEnabled(false);
}

/**
 * Subtle green wash + outer/inner thin line outlines for hover cell.
 * Inner ring is ~10% inset (outer × HOVER_INNER_OUTLINE_SCALE).
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} layout
 */
function buildHoverOutline(scene, layout) {
    const host = getHost();
    const cell = layout.cellSize ?? 1;
    const half = (cell * 0.98) / 2;
    const innerHalf = half * HOVER_INNER_OUTLINE_SCALE;
    const chrome = THEME_CHROME.green;
    hoverOutlineRoot = new host.TransformNode('simNetworkExploreHoverOutline', scene);
    hoverOutlineLines = [];

    hoverWashMat = new host.StandardMaterial('simNetworkExploreHoverWashMat', scene);
    hoverWashMat.diffuseColor = new host.Color3(
        chrome.wash.r * 0.25,
        chrome.wash.g * 0.25,
        chrome.wash.b * 0.25
    );
    hoverWashMat.emissiveColor = new host.Color3(
        chrome.wash.r * 0.85,
        chrome.wash.g * 0.85,
        chrome.wash.b * 0.85
    );
    hoverWashMat.alpha = HOVER_WASH_ALPHA;
    hoverWashMat.transparencyMode = 2;
    hoverWashMat.disableLighting = true;

    const fill = host.MeshBuilder.CreateGround(
        'simNetworkExploreHoverWashFill',
        { width: cell * 0.98, height: cell * 0.98 },
        scene
    );
    fill.parent = hoverOutlineRoot;
    fill.position.y = 0.002;
    fill.material = hoverWashMat;
    makeFloorWashMesh(fill, host);

    /**
     * @param {string} name
     * @param {number} ringHalf
     */
    function addHoverLineRing(name, ringHalf) {
        const outline = host.MeshBuilder.CreateLines(
            name,
            {
                points: [
                    new host.Vector3(-ringHalf, HOVER_OUTLINE_Y, -ringHalf),
                    new host.Vector3(ringHalf, HOVER_OUTLINE_Y, -ringHalf),
                    new host.Vector3(ringHalf, HOVER_OUTLINE_Y, ringHalf),
                    new host.Vector3(-ringHalf, HOVER_OUTLINE_Y, ringHalf),
                    new host.Vector3(-ringHalf, HOVER_OUTLINE_Y, -ringHalf),
                ],
            },
            scene
        );
        outline.color = new host.Color3(
            chrome.hoverOutline.r,
            chrome.hoverOutline.g,
            chrome.hoverOutline.b
        );
        outline.parent = hoverOutlineRoot;
        makeCellOverlayMesh(outline, host);
        hoverOutlineLines.push(outline);
    }

    addHoverLineRing('simNetworkExploreHoverOutlineOuter', half);
    addHoverLineRing('simNetworkExploreHoverOutlineInner', innerHalf);
    hoverOutlineRoot.setEnabled(false);
}

/**
 * @param {{ x: number, z: number } | null} cell
 * @param {{ allowCable?: boolean }} [options]
 */
function positionSelectedWash(cell, options = {}) {
    const layout = getActiveLayout();
    const host = getHost();
    const allowCable = options.allowCable === true;
    const blocked =
        !selectedWashRoot ||
        !cell ||
        !layout ||
        isDroppableToolActive() ||
        (isCableModeActive() && !allowCable) ||
        (!allowCable && areToolsActive());
    if (blocked) {
        selectedWashRoot?.setEnabled(false);
        return;
    }
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    selectedWashRoot.position = new host.Vector3(
        cell.x * cellSize + half,
        0,
        cell.z * cellSize + half
    );
    selectedWashRoot.setEnabled(true);
}

/**
 * @param {{ x: number, z: number } | null} cell
 * @param {{ allowDroppable?: boolean, allowCable?: boolean }} [options]
 */
function positionHoverOutline(cell, options = {}) {
    const layout = getActiveLayout();
    const host = getHost();
    const allowDroppable = options.allowDroppable === true;
    const allowCable = options.allowCable === true;
    const blocked =
        !hoverOutlineRoot ||
        !cell ||
        !layout ||
        (isCableModeActive() && !allowCable) ||
        (isDroppableToolActive() && !allowDroppable);
    if (blocked) {
        hoverOutlineRoot?.setEnabled(false);
        return;
    }
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    hoverOutlineRoot.position = new host.Vector3(
        cell.x * cellSize + half,
        0,
        cell.z * cellSize + half
    );
    hoverOutlineRoot.setEnabled(true);
}

/**
 * Push current hover/select cells into particle FX + selected wash + hover outline (explore green).
 */
function syncGreenCellFx() {
    if (!boundScene || isCableModeActive() || isDroppableToolActive()) {
        positionSelectedWash(null);
        if (!isDroppableToolActive() && !isCableModeActive()) {
            positionHoverOutline(null);
        }
        return;
    }
    applyCellFxTheme('green');
    syncCellHoverFx(boundScene, hoverCell, selectedCell, getActiveLayout());
    positionSelectedWash(selectedCell);
    positionHoverOutline(hoverCell);
}

/**
 * Droppable tool hover FX (purple allowed / red blocked). No sticky selected orbs.
 * @param {{ cell?: { x: number, z: number } | null, theme?: 'purple' | 'red' } | null | undefined} detail
 */
function applyDroppableCellFxRequest(detail) {
    if (!boundScene || isCableModeActive() || !isDroppableToolActive()) {
        return;
    }
    const theme = detail?.theme === 'red' ? 'red' : 'purple';
    const cell = detail?.cell;
    const validCell =
        cell &&
        typeof cell.x === 'number' &&
        typeof cell.z === 'number' &&
        Number.isFinite(cell.x) &&
        Number.isFinite(cell.z)
            ? { x: cell.x, z: cell.z }
            : null;

    unhideCellHoverFx();
    const themeChanged = activeChromeTheme !== theme;
    applyCellFxTheme(theme);
    positionSelectedWash(null);
    if (!validCell) {
        syncCellHoverFx(boundScene, null, null, getActiveLayout());
        positionHoverOutline(null);
        return;
    }
    // Theme swap on the same cell must reset beams so old-coloured particles do not linger.
    if (themeChanged) {
        syncCellHoverFx(boundScene, null, null, getActiveLayout());
    }
    syncCellHoverFx(boundScene, validCell, null, getActiveLayout());
    positionHoverOutline(validCell, { allowDroppable: true });
    console.log(
        `[partCellHighlight.js]: [N/A] - [applyDroppableCellFxRequest] - theme has a value of ${theme}, cell has a value of ${validCell.x},${validCell.z}.`
    ); //This is logged when droppable hover drives purple/red cell FX.
}

/**
 * Cable tool hover FX (blue) + optional click–click start selected FX.
 * @param {{
 *   cell?: { x: number, z: number } | null,
 *   selectedCell?: { x: number, z: number } | null
 * } | null | undefined} detail
 */
function applyCableCellFxRequest(detail) {
    if (!boundScene || !isCableModeActive() || isDroppableToolActive()) {
        return;
    }

    if (detail && Object.prototype.hasOwnProperty.call(detail, 'selectedCell')) {
        const selected = detail.selectedCell;
        cableSelectedCell =
            selected &&
            typeof selected.x === 'number' &&
            typeof selected.z === 'number' &&
            Number.isFinite(selected.x) &&
            Number.isFinite(selected.z)
                ? { x: selected.x, z: selected.z }
                : null;
    }

    let hoverCellFx = null;
    let hoverProvided = false;
    if (detail && Object.prototype.hasOwnProperty.call(detail, 'cell')) {
        hoverProvided = true;
        const cell = detail.cell;
        hoverCellFx =
            cell &&
            typeof cell.x === 'number' &&
            typeof cell.z === 'number' &&
            Number.isFinite(cell.x) &&
            Number.isFinite(cell.z)
                ? { x: cell.x, z: cell.z }
                : null;
    }

    unhideCellHoverFx();
    const themeChanged = activeChromeTheme !== 'blue';
    applyCellFxTheme('blue');

    // Re-read current hover from last sync if this event only updated selected.
    // We keep hover by re-querying via sync: if hover not in this event, pass a sentinel —
    // store lastCableHoverCell.
    if (hoverProvided) {
        lastCableHoverCell = hoverCellFx;
    }

    if (themeChanged) {
        syncCellHoverFx(boundScene, null, null, getActiveLayout());
    }
    syncCellHoverFx(
        boundScene,
        lastCableHoverCell,
        cableSelectedCell,
        getActiveLayout()
    );
    positionHoverOutline(lastCableHoverCell, { allowCable: true });
    positionSelectedWash(cableSelectedCell, { allowCable: true });
    console.log(
        `[partCellHighlight.js]: [N/A] - [applyCableCellFxRequest] - hoverCell has a value of ${lastCableHoverCell ? `${lastCableHoverCell.x},${lastCableHoverCell.z}` : 'null'}, selectedCell has a value of ${cableSelectedCell ? `${cableSelectedCell.x},${cableSelectedCell.z}` : 'null'}.`
    ); //This is logged when Cable mode updates blue hover and/or click–click selected FX.
}

function enterCableToolFxMode() {
    hoverCell = null;
    cableSelectedCell = null;
    lastCableHoverCell = null;
    clearInteractableOverlays();
    positionSelectedWash(null);
    positionHoverOutline(null);
    unhideCellHoverFx();
    applyCellFxTheme('blue');
    syncCellHoverFx(boundScene, null, null, getActiveLayout());
    activeToolMode = 'cable';
    console.log(
        `[partCellHighlight.js]: [N/A] - [enterCableToolFxMode] - activeToolMode has a value of cable.`
    ); //This is logged when Cable tool takes over cell FX in blue.
}

function enterDroppableToolFxMode() {
    hoverCell = null;
    clearInteractableOverlays();
    positionSelectedWash(null);
    positionHoverOutline(null);
    unhideCellHoverFx();
    applyCellFxTheme('purple');
    syncCellHoverFx(boundScene, null, null, getActiveLayout());
    activeToolMode = 'droppable';
    console.log(
        `[partCellHighlight.js]: [N/A] - [enterDroppableToolFxMode] - activeToolMode has a value of droppable.`
    ); //This is logged when Droppable tool takes over cell FX in purple/red.
}

/**
 * Resolve grid cell from any stamp mesh in the cell, else floor pick.
 * @param {number} pointerX
 * @param {number} pointerY
 * @returns {{ x: number, z: number } | null}
 */
function resolveCellAtPointer(pointerX, pointerY) {
    return pickCellAtPointer(pointerX, pointerY);
}

/**
 * Hand cursor for any cell that has at least one stamp (furniture counts).
 * Runs in free play and while droppable / Cable tools are on.
 * Owns the cursor via scene.doNotHandleCursors so Babylon’s ActionManager
 * auto-cursor (hand only on OnPick meshes) cannot reset it every move.
 * @param {number} pointerX
 * @param {number} pointerY
 */
function syncCellPointerCursor(pointerX, pointerY) {
    if (!renderingCanvas) {
        console.log(
            `[partCellHighlight.js]: [N/A] - [syncCellPointerCursor] - renderingCanvas has a value of null.`
        ); //This is logged when cursor sync cannot run because the input element was never captured.
        return;
    }
    const cell = resolveCellAtPointer(pointerX, pointerY);
    const stamps = cell ? getStampsAtCell(cell.x, cell.z) : [];
    const wantsPointer = stamps.length > 0;
    const cellKey = wantsPointer && cell ? `${cell.x},${cell.z}` : '';
    if (cellKey === lastCursorCellKey) {
        return;
    }
    lastCursorCellKey = cellKey;
    renderingCanvas.style.cursor = wantsPointer ? 'pointer' : previousCursor;
}

function clearHover() {
    hoverCell = null;
    syncGreenCellFx();
    syncInteractableOverlays();
}

function clearSelectedCell() {
    selectedCell = null;
    syncGreenCellFx();
    syncInteractableOverlays();
}

/**
 * Apply an external request to set or clear the sticky green explore cell.
 * @param {{ x: number, z: number } | null | undefined} cell
 */
function applyExploreSelectionRequest(cell) {
    if (
        !cell ||
        typeof cell.x !== 'number' ||
        typeof cell.z !== 'number' ||
        !Number.isFinite(cell.x) ||
        !Number.isFinite(cell.z)
    ) {
        clearSelectedCell();
        clearHover();
        console.log(
            `[partCellHighlight.js]: [N/A] - [applyExploreSelectionRequest] - clearedExploreSelection has a value of true.`
        ); //This is logged when Cable/droppable cancel or an external clear wipes the green sticky cell.
        return;
    }
    selectedCell = { x: cell.x, z: cell.z };
    // Tools hide FX; keep memory so restore (or next free-play frame) shows this cell.
    if (!areToolsActive()) {
        hoverCell = null;
        applyCellFxTheme('green');
        syncGreenCellFx();
        syncInteractableOverlays();
    }
    console.log(
        `[partCellHighlight.js]: [N/A] - [applyExploreSelectionRequest] - selectedCell has a value of ${selectedCell.x},${selectedCell.z}.`
    ); //This is logged when a successful drop (or other caller) sets the green sticky cell.
}

function hideExploreHighlights() {
    hoverCell = null;
    hideCellHoverFx();
    positionSelectedWash(null);
    positionHoverOutline(null);
    clearInteractableOverlays();
}

function restoreSelectedIfAny() {
    applyCellFxTheme('green');
    unhideCellHoverFx();
    syncGreenCellFx();
    syncInteractableOverlays();
}

/**
 * @param {object} stamp
 * @returns {boolean}
 */
function isInteractableStamp(stamp) {
    return Boolean(stamp?.wrap?.metadata?.simNetworkInteraction);
}

/**
 * @param {{ x: number, z: number } | null} cell
 * @returns {import('@babylonjs/core').AbstractMesh[]}
 */
function getInteractableMeshesAtCell(cell) {
    if (!cell) {
        return [];
    }
    /** @type {import('@babylonjs/core').AbstractMesh[]} */
    const meshes = [];
    for (const stamp of getStampsAtCell(cell.x, cell.z)) {
        if (!isInteractableStamp(stamp)) {
            continue;
        }
        for (const mesh of stamp.wrap?.getChildMeshes?.(false) || []) {
            meshes.push(mesh);
        }
    }
    return meshes;
}

function clearInteractableOverlays() {
    for (const mesh of overlaidMeshes) {
        try {
            if (mesh && !mesh.isDisposed?.()) {
                // Test result blue/orange must survive hover — restore instead of clearing.
                if (isNetworkTestResultOverlayMesh(mesh)) {
                    restoreNetworkTestResultOverlay(mesh);
                    continue;
                }
                mesh.renderOverlay = false;
            }
        } catch (error) {
            console.warn(
                `[partCellHighlight.js]: [N/A] - [clearInteractableOverlays] - clearError has a value of ${error?.message || error}.`
            ); //This is logged when clearing a purple interactable overlay fails on a disposed mesh.
        }
    }
    overlaidMeshes.clear();
}

/**
 * Purple mesh overlay on interactables in hovered and/or selected cells (both can show).
 */
function syncInteractableOverlays() {
    clearInteractableOverlays();
    if (areToolsActive()) {
        return;
    }
    const host = getHost();
    /** @type {Set<string>} */
    const seenCells = new Set();
    for (const cell of [selectedCell, hoverCell]) {
        if (!cell) {
            continue;
        }
        const key = `${cell.x},${cell.z}`;
        if (seenCells.has(key)) {
            continue;
        }
        seenCells.add(key);
        for (const mesh of getInteractableMeshesAtCell(cell)) {
            // Do not paint purple over Test result overlays (blue connected / orange missing).
            if (isNetworkTestResultOverlayMesh(mesh)) {
                continue;
            }
            mesh.renderOverlay = true;
            mesh.overlayColor = new host.Color3(
                DROPPABLE_PURPLE_RGB.r,
                DROPPABLE_PURPLE_RGB.g,
                DROPPABLE_PURPLE_RGB.b
            );
            mesh.overlayAlpha = INTERACTABLE_OVERLAY_ALPHA;
            overlaidMeshes.add(mesh);
        }
    }
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
function attachPointerObserver(scene) {
    const host = getHost();
    pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        const type = pointerInfo.type;
        if (type === host.PointerEventTypes.POINTERMOVE) {
            syncCellPointerCursor(scene.pointerX, scene.pointerY);
        }

        const cableActive = isCableModeActive();
        const droppableActive = isDroppableToolActive();
        if (cableActive) {
            if (!toolsWereActive || activeToolMode !== 'cable') {
                enterCableToolFxMode();
                toolsWereActive = true;
            }
            return;
        }
        if (droppableActive) {
            if (!toolsWereActive || activeToolMode !== 'droppable') {
                enterDroppableToolFxMode();
                toolsWereActive = true;
            }
            return;
        }
        if (toolsWereActive) {
            toolsWereActive = false;
            activeToolMode = null;
            restoreSelectedIfAny();
        }

        if (type === host.PointerEventTypes.POINTERMOVE) {
            const cell = resolveCellAtPointer(scene.pointerX, scene.pointerY);
            if (!cell) {
                clearHover();
                return;
            }
            // Same cell as sticky select — keep hoverCell so FX use full hover strength (not stacked).
            if (
                !hoverCell ||
                hoverCell.x !== cell.x ||
                hoverCell.z !== cell.z
            ) {
                hoverCell = cell;
                syncGreenCellFx();
                syncInteractableOverlays();
            }
            return;
        }

        if (type === host.PointerEventTypes.POINTERDOWN) {
            pointerDownInfo = {
                x: scene.pointerX,
                y: scene.pointerY,
                cell: resolveCellAtPointer(scene.pointerX, scene.pointerY),
            };
            return;
        }

        if (type !== host.PointerEventTypes.POINTERUP || !pointerDownInfo) {
            return;
        }

        const dx = scene.pointerX - pointerDownInfo.x;
        const dy = scene.pointerY - pointerDownInfo.y;
        const downCell = pointerDownInfo.cell;
        pointerDownInfo = null;
        if (Math.hypot(dx, dy) > SELECT_CLICK_SLOP_PX) {
            return;
        }

        const cell = resolveCellAtPointer(scene.pointerX, scene.pointerY) || downCell;
        if (!cell) {
            // Click outside the grid — clear sticky selection.
            clearSelectedCell();
            clearHover();
            console.log(
                `[partCellHighlight.js]: [N/A] - [attachPointerObserver] - clearedSelectionOutsideGrid has a value of true.`
            ); //This is logged when an outside-grid click clears the green explore selection.
            return;
        }

        if (
            selectedCell &&
            selectedCell.x === cell.x &&
            selectedCell.z === cell.z
        ) {
            // Re-click same cell — keep selection.
            return;
        }

        selectedCell = { ...cell };
        hoverCell = null;
        syncGreenCellFx();
        syncInteractableOverlays();
        console.log(
            `[partCellHighlight.js]: [N/A] - [attachPointerObserver] - selectedCell has a value of ${selectedCell.x},${selectedCell.z}.`
        ); //This is logged when the player sticky-selects a cell with the green explore highlight.
    });
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} layout
 */
export function initializePartCellHighlight(scene, layout) {
    disposePartCellHighlight();
    boundScene = scene;
    const engine = scene.getEngine();
    // Babylon InputManager writes cursor to getInputElement(), not always getRenderingCanvas().
    renderingCanvas =
        (typeof engine.getInputElement === 'function' && engine.getInputElement()) ||
        engine.getRenderingCanvas();
    previousCursor = renderingCanvas?.style.cursor || '';
    previousDoNotHandleCursors = Boolean(scene.doNotHandleCursors);
    // Stop Babylon resetting cursor to default / ActionManager hover every POINTERMOVE.
    scene.doNotHandleCursors = true;
    lastCursorCellKey = '';
    unhideCellHoverFx();
    applyCellFxTheme('green');
    buildSelectedWash(scene, layout);
    buildHoverOutline(scene, layout);
    attachPointerObserver(scene);
    exploreSelectionListener = (event) => {
        const detail = /** @type {CustomEvent<{ cell?: { x: number, z: number } | null }>} */ (
            event
        ).detail;
        applyExploreSelectionRequest(detail?.cell ?? null);
    };
    window.addEventListener(EXPLORE_SELECTION_EVENT, exploreSelectionListener);
    droppableCellFxListener = (event) => {
        const detail = /** @type {CustomEvent<{ cell?: { x: number, z: number } | null, theme?: 'purple' | 'red' }>} */ (
            event
        ).detail;
        applyDroppableCellFxRequest(detail ?? null);
    };
    window.addEventListener(DROPPABLE_CELL_FX_EVENT, droppableCellFxListener);
    cableCellFxListener = (event) => {
        const detail = /** @type {CustomEvent<{ cell?: { x: number, z: number } | null }>} */ (
            event
        ).detail;
        applyCableCellFxRequest(detail ?? null);
    };
    window.addEventListener(CABLE_CELL_FX_EVENT, cableCellFxListener);
    const renderEl = engine.getRenderingCanvas();
    const sameAsRenderCanvas = renderingCanvas === renderEl;
    console.log(
        `[partCellHighlight.js]: [N/A] - [initializePartCellHighlight] - particleFxReady has a value of true, selectedWashReady has a value of true, hoverWashAlpha has a value of ${HOVER_WASH_ALPHA}, phase23CableFx has a value of true, layoutCellSize has a value of ${layout?.cellSize ?? 'unknown'}, doNotHandleCursors has a value of ${scene.doNotHandleCursors}, sameAsRenderCanvas has a value of ${sameAsRenderCanvas}.`
    ); //This is logged to verify explore + droppable + cable themed cell FX init.
}

/**
 * Tear down particle FX and pointer observer.
 */
export function disposePartCellHighlight() {
    if (exploreSelectionListener) {
        window.removeEventListener(EXPLORE_SELECTION_EVENT, exploreSelectionListener);
        exploreSelectionListener = null;
    }
    if (droppableCellFxListener) {
        window.removeEventListener(DROPPABLE_CELL_FX_EVENT, droppableCellFxListener);
        droppableCellFxListener = null;
    }
    if (cableCellFxListener) {
        window.removeEventListener(CABLE_CELL_FX_EVENT, cableCellFxListener);
        cableCellFxListener = null;
    }
    if (boundScene && pointerObserver) {
        boundScene.onPointerObservable.remove(pointerObserver);
    }
    pointerObserver = null;
    pointerDownInfo = null;
    hoverCell = null;
    selectedCell = null;
    toolsWereActive = false;
    activeToolMode = null;
    cableSelectedCell = null;
    lastCableHoverCell = null;
    clearInteractableOverlays();
    disposeCellHoverFx();
    selectedWashRoot?.dispose(false, true);
    selectedWashRoot = null;
    selectedWashMat?.dispose();
    selectedWashMat = null;
    selectedOutlineMat = null;
    hoverOutlineRoot?.dispose(false, true);
    hoverOutlineRoot = null;
    hoverWashMat?.dispose();
    hoverWashMat = null;
    hoverOutlineLines = [];
    activeChromeTheme = 'green';

    if (boundScene) {
        boundScene.doNotHandleCursors = previousDoNotHandleCursors;
    }
    if (renderingCanvas) {
        renderingCanvas.style.cursor = previousCursor;
    }
    renderingCanvas = null;
    previousCursor = '';
    previousDoNotHandleCursors = false;
    lastCursorCellKey = '';
    boundScene = null;
}
