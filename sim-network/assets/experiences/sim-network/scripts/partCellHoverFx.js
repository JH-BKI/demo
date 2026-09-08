/**
 * Sim-network cell hover / sticky-select particles (2.1 green · 2.2 purple/red · 2.3 blue).
 * Hover: edge light beams. Selected: middle orbs.
 * Theme swaps colour only — sizes, rates, and lifetimes stay shared.
 */

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';

/** Babylon CDN flare — soft round particle (same as cable-flow Phase 1). */
const FLARE_TEXTURE_URL = 'https://assets.babylonjs.com/core/textures/flare.png';

/** Colour themes — same multipliers applied to each base RGB. */
const THEME_RGB = {
    green: { r: 0.2, g: 0.78, b: 0.35 },
    purple: { r: 0.7, g: 0.35, b: 0.95 },
    red: { r: 0.95, g: 0.25, b: 0.2 },
    /** Match partCables CABLE_RGB_LIGHT hover / path overlay. */
    blue: { r: 0.45, g: 0.72, b: 1.0 },
};

/** Selected middle orbs — smaller, denser, wider height/life variation. */
const SELECTED_FLOOR_CAPACITY = 128;
const SELECTED_FLOOR_EMIT_RATE = 96;
const SELECTED_FLOOR_SIZE = { min: 0.025, max: 0.07 };

/** Hover border beams. */
const HOVER_EDGE_CAPACITY = 252;
const HOVER_EDGE_EMIT_RATE = 288;
const HOVER_EDGE_SIZE = { min: 0.012, max: 0.07 };
const EDGE_SCALE_X = { min: 0.12, max: 0.95 };
const EDGE_SCALE_Y = { min: 0.85, max: 3.2 };
const EDGE_SPAWN_Y = 0.02;

/**
 * @typedef {'green' | 'purple' | 'red' | 'blue'} CellFxTheme
 */

/**
 * @typedef {{
 *   floor: import('@babylonjs/core').ParticleSystem | null,
 *   edge: import('@babylonjs/core').ParticleSystem | null,
 *   edgeCx: number,
 *   edgeCz: number,
 *   edgeHalf: number,
 *   cellKey: string | null,
 *   role: 'hover' | 'selected',
 *   floorRunning: boolean,
 *   edgeRunning: boolean
 * }} CellFxSlot
 */

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {import('@babylonjs/core').Texture | null} */
let sharedFlareTexture = null;
/** @type {CellFxSlot | null} */
let hoverSlot = null;
/** @type {CellFxSlot | null} */
let selectedSlot = null;
/** @type {boolean} */
let fxHidden = false;
/** @type {CellFxTheme} */
let activeTheme = 'green';

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.ParticleSystem !== 'function' ||
        typeof host.Texture !== 'function' ||
        typeof host.Color4 !== 'function' ||
        typeof host.Vector3 !== 'function' ||
        typeof host.layoutCellHalfOffset !== 'function'
    ) {
        throw new Error(
            'Experience host API missing cell-hover particle helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @returns {import('@babylonjs/core').Texture}
 */
function getFlareTexture(scene) {
    const host = getHost();
    if (sharedFlareTexture && !sharedFlareTexture.isDisposed?.()) {
        return sharedFlareTexture;
    }
    sharedFlareTexture = new host.Texture(FLARE_TEXTURE_URL, scene);
    return sharedFlareTexture;
}

/**
 * @returns {{ r: number, g: number, b: number }}
 */
function themeBaseRgb() {
    return THEME_RGB[activeTheme] || THEME_RGB.green;
}

/**
 * @param {number} cx
 * @param {number} cz
 * @param {number} half
 * @param {{ x: number, y: number, z: number }} out
 */
function samplePerimeterPoint(cx, cz, half, out) {
    const edge = half * 0.96;
    const side = Math.floor(Math.random() * 4);
    const t = Math.random() * 2 - 1;
    out.y = EDGE_SPAWN_Y;
    if (side === 0) {
        out.x = cx + t * edge;
        out.z = cz - edge;
    } else if (side === 1) {
        out.x = cx + edge;
        out.z = cz + t * edge;
    } else if (side === 2) {
        out.x = cx + t * edge;
        out.z = cz + edge;
    } else {
        out.x = cx - edge;
        out.z = cz + t * edge;
    }
}

/**
 * @param {object} host
 * @param {'floor' | 'edge'} kind
 */
function themeColors(host, kind) {
    const base = themeBaseRgb();
    if (kind === 'edge') {
        return {
            color1: new host.Color4(
                Math.min(base.r * 1.05, 1),
                Math.min(base.g * 1.1, 1),
                Math.min(base.b * 1.05, 1),
                1
            ),
            color2: new host.Color4(base.r * 0.35, base.g * 0.55, base.b * 0.35, 0.18),
            colorDead: new host.Color4(base.r * 0.15, base.g * 0.2, base.b * 0.15, 0),
        };
    }
    return {
        color1: new host.Color4(
            Math.min(base.r * 1.15, 1),
            Math.min(base.g * 1.2, 1),
            Math.min(base.b * 1.1, 1),
            1
        ),
        color2: new host.Color4(base.r * 0.4, base.g * 0.55, base.b * 0.4, 0.25),
        colorDead: new host.Color4(base.r * 0.2, base.g * 0.25, base.b * 0.2, 0),
    };
}

/**
 * @param {import('@babylonjs/core').ParticleSystem | null | undefined} system
 * @param {'floor' | 'edge'} kind
 */
function paintSystemColors(system, kind) {
    if (!system) {
        return;
    }
    const host = getHost();
    const colors = themeColors(host, kind);
    system.color1 = colors.color1;
    system.color2 = colors.color2;
    system.colorDead = colors.colorDead;
}

/**
 * @param {string} name
 * @param {import('@babylonjs/core').Scene} scene
 * @returns {import('@babylonjs/core').ParticleSystem}
 */
function createSelectedFloorSystem(name, scene) {
    const host = getHost();
    const system = new host.ParticleSystem(name, SELECTED_FLOOR_CAPACITY, scene);
    system.particleTexture = getFlareTexture(scene);
    system.emitter = new host.Vector3(0, 0, 0);
    paintSystemColors(system, 'floor');
    system.minSize = SELECTED_FLOOR_SIZE.min;
    system.maxSize = SELECTED_FLOOR_SIZE.max;
    system.minLifeTime = 0.35;
    system.maxLifeTime = 1.8;
    system.emitRate = SELECTED_FLOOR_EMIT_RATE;
    system.gravity = new host.Vector3(0, -0.07, 0);
    system.minEmitPower = 0.03;
    system.maxEmitPower = 0.48;
    system.direction1 = new host.Vector3(-0.14, 0.35, -0.14);
    system.direction2 = new host.Vector3(0.14, 1.2, 0.14);
    system.updateSpeed = 0.016;
    system.blendMode = host.ParticleSystem.BLENDMODE_ADD;
    system.createBoxEmitter(
        new host.Vector3(-0.08, 0.55, -0.08),
        new host.Vector3(0.08, 0.85, 0.08),
        new host.Vector3(-0.4, 0.02, -0.4),
        new host.Vector3(0.4, 0.06, 0.4)
    );
    return system;
}

/**
 * @param {string} name
 * @param {import('@babylonjs/core').Scene} scene
 * @param {CellFxSlot} slot
 * @returns {import('@babylonjs/core').ParticleSystem}
 */
function createHoverEdgeSystem(name, scene, slot) {
    const host = getHost();
    const system = new host.ParticleSystem(name, HOVER_EDGE_CAPACITY, scene);
    system.particleTexture = getFlareTexture(scene);
    system.emitter = new host.Vector3(0, 0, 0);
    system.minEmitBox = new host.Vector3(0, 0, 0);
    system.maxEmitBox = new host.Vector3(0, 0, 0);
    paintSystemColors(system, 'edge');
    system.minSize = HOVER_EDGE_SIZE.min;
    system.maxSize = HOVER_EDGE_SIZE.max;
    system.minLifeTime = 0.12;
    system.maxLifeTime = 1.05;
    system.emitRate = HOVER_EDGE_EMIT_RATE;
    system.gravity = new host.Vector3(0, -0.18, 0);
    system.minEmitPower = 0.15;
    system.maxEmitPower = 1.55;
    system.direction1 = new host.Vector3(-0.05, 0.55, -0.05);
    system.direction2 = new host.Vector3(0.05, 1.45, 0.05);
    system.updateSpeed = 0.016;
    system.blendMode = host.ParticleSystem.BLENDMODE_ADD;
    if (host.ParticleSystem.BILLBOARDMODE_STRETCHED != null) {
        system.billboardMode = host.ParticleSystem.BILLBOARDMODE_STRETCHED;
    }
    system.minScaleX = EDGE_SCALE_X.min;
    system.maxScaleX = EDGE_SCALE_X.max;
    system.minScaleY = EDGE_SCALE_Y.min;
    system.maxScaleY = EDGE_SCALE_Y.max;
    system.startPositionFunction = (_worldMatrix, positionToUpdate) => {
        samplePerimeterPoint(slot.edgeCx, slot.edgeCz, slot.edgeHalf, positionToUpdate);
    };
    return system;
}

/**
 * @param {'hover' | 'selected'} role
 * @param {import('@babylonjs/core').Scene} scene
 * @returns {CellFxSlot}
 */
function createSlot(role, scene) {
    /** @type {CellFxSlot} */
    const slot = {
        floor: null,
        edge: null,
        edgeCx: 0,
        edgeCz: 0,
        edgeHalf: 0.5,
        cellKey: null,
        role,
        floorRunning: false,
        edgeRunning: false,
    };
    if (role === 'selected') {
        slot.floor = createSelectedFloorSystem('simNetworkCellSelectedFloor', scene);
    } else {
        slot.edge = createHoverEdgeSystem('simNetworkCellHoverEdge', scene, slot);
    }
    return slot;
}

/**
 * @param {CellFxSlot} slot
 * @param {{ x: number, z: number }} cell
 * @param {object} layout
 */
function placeHoverEdgeOnCell(slot, cell, layout) {
    const host = getHost();
    if (!slot.edge) {
        return;
    }
    paintSystemColors(slot.edge, 'edge');
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    const cx = cell.x * cellSize + half;
    const cz = cell.z * cellSize + half;
    const key = `${cell.x},${cell.z}`;

    slot.edgeCx = cx;
    slot.edgeCz = cz;
    slot.edgeHalf = half;
    if (slot.edge.emitter?.set) {
        slot.edge.emitter.set(cx, 0, cz);
    } else {
        slot.edge.emitter = new host.Vector3(cx, 0, cz);
    }

    const wasSame = slot.cellKey === key;
    slot.cellKey = key;
    if (!wasSame || !slot.edgeRunning) {
        slot.edge.stop();
        slot.edge.reset();
        slot.edge.start();
        slot.edgeRunning = true;
    }
}

/**
 * @param {CellFxSlot} slot
 * @param {{ x: number, z: number }} cell
 * @param {object} layout
 */
function placeSelectedFloorOnCell(slot, cell, layout) {
    const host = getHost();
    if (!slot.floor) {
        return;
    }
    paintSystemColors(slot.floor, 'floor');
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    const cx = cell.x * cellSize + half;
    const cz = cell.z * cellSize + half;
    const key = `${cell.x},${cell.z}`;

    if (slot.floor.emitter?.set) {
        slot.floor.emitter.set(cx, 0, cz);
    } else {
        slot.floor.emitter = new host.Vector3(cx, 0, cz);
    }
    const emitHalf = half * 0.85;
    slot.floor.createBoxEmitter(
        new host.Vector3(-0.08, 0.55, -0.08),
        new host.Vector3(0.08, 0.85, 0.08),
        new host.Vector3(-emitHalf, 0.02, -emitHalf),
        new host.Vector3(emitHalf, 0.06, emitHalf)
    );

    const wasSame = slot.cellKey === key;
    slot.cellKey = key;
    // Kill leftover orbs on the old cell immediately (stop alone would let them finish dying).
    if (!wasSame || !slot.floorRunning) {
        slot.floor.stop();
        slot.floor.reset();
        slot.floor.start();
        slot.floorRunning = true;
    }
}

/**
 * @param {CellFxSlot | null} slot
 */
function stopSlot(slot) {
    if (!slot) {
        return;
    }
    slot.cellKey = null;
    slot.floorRunning = false;
    slot.edgeRunning = false;
    try {
        slot.floor?.stop();
        slot.floor?.reset();
        slot.edge?.stop();
        slot.edge?.reset();
    } catch (error) {
        console.warn(
            `[partCellHoverFx.js]: [N/A] - [stopSlot] - stopError has a value of ${error?.message || error}.`
        ); //This is logged when stopping a cell-hover particle slot fails.
    }
}

/**
 * @param {CellFxSlot | null} slot
 */
function disposeSlot(slot) {
    if (!slot) {
        return;
    }
    stopSlot(slot);
    try {
        slot.floor?.dispose(true);
        slot.edge?.dispose(true);
    } catch (error) {
        console.warn(
            `[partCellHoverFx.js]: [N/A] - [disposeSlot] - disposeError has a value of ${error?.message || error}.`
        ); //This is logged when disposing a cell-hover particle slot fails.
    }
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
function ensureSlots(scene) {
    if (boundScene === scene && hoverSlot && selectedSlot) {
        return;
    }
    disposeCellHoverFx();
    boundScene = scene;
    hoverSlot = createSlot('hover', scene);
    selectedSlot = createSlot('selected', scene);
    fxHidden = false;
    console.log(
        `[partCellHoverFx.js]: [N/A] - [ensureSlots] - slotsReady has a value of true, activeTheme has a value of ${activeTheme}.`
    ); //This is logged when hover beams + selected middle particle systems are created.
}

/**
 * Swap particle paint (green explore / purple droppable / red blocked).
 * @param {CellFxTheme} theme
 */
export function setCellHoverFxTheme(theme) {
    if (
        theme !== 'green' &&
        theme !== 'purple' &&
        theme !== 'red' &&
        theme !== 'blue'
    ) {
        return;
    }
    if (activeTheme === theme) {
        return;
    }
    activeTheme = theme;
    paintSystemColors(hoverSlot?.edge, 'edge');
    paintSystemColors(selectedSlot?.floor, 'floor');
    console.log(
        `[partCellHoverFx.js]: [N/A] - [setCellHoverFxTheme] - activeTheme has a value of ${activeTheme}.`
    ); //This is logged when cell particle theme colour changes.
}

/**
 * @returns {CellFxTheme}
 */
export function getCellHoverFxTheme() {
    return activeTheme;
}

/**
 * Hover → edge beams. Selected → middle orbs. Same cell → both (option C).
 * @param {import('@babylonjs/core').Scene} scene
 * @param {{ x: number, z: number } | null} hoverCell
 * @param {{ x: number, z: number } | null} selectedCell
 * @param {object | null} layout
 */
export function syncCellHoverFx(scene, hoverCell, selectedCell, layout) {
    if (!scene || !layout || fxHidden) {
        return;
    }
    ensureSlots(scene);

    if (hoverCell) {
        placeHoverEdgeOnCell(hoverSlot, hoverCell, layout);
    } else {
        stopSlot(hoverSlot);
    }

    if (selectedCell) {
        placeSelectedFloorOnCell(selectedSlot, selectedCell, layout);
    } else {
        stopSlot(selectedSlot);
    }
}

/**
 * Hide particles (Cable tool, or explore paused while switching modes).
 */
export function hideCellHoverFx() {
    fxHidden = true;
    stopSlot(hoverSlot);
    stopSlot(selectedSlot);
    console.log(
        `[partCellHoverFx.js]: [N/A] - [hideCellHoverFx] - fxHidden has a value of true.`
    ); //This is logged when cell FX hide because a tool mode requires it.
}

/**
 * Allow FX again after tools turn off / droppable mode needs particles.
 */
export function unhideCellHoverFx() {
    fxHidden = false;
}

/**
 * Tear down all cell-hover particle systems.
 */
export function disposeCellHoverFx() {
    disposeSlot(hoverSlot);
    disposeSlot(selectedSlot);
    hoverSlot = null;
    selectedSlot = null;
    boundScene = null;
    fxHidden = false;
    activeTheme = 'green';
    if (sharedFlareTexture && !sharedFlareTexture.isDisposed?.()) {
        try {
            sharedFlareTexture.dispose();
        } catch {
            /* ignore */
        }
    }
    sharedFlareTexture = null;
}
