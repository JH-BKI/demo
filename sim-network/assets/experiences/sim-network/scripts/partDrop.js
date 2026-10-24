/**
 * Sim-network player droppables — bottom-center Tools toolbar, cell hover/select, ghost preview, place on layer 5.
 * Player only (not the layout editor).
 */

import {
    cellToWorld,
    createGhostStamp,
    getActiveLayout,
    getAllStamps,
    getDroppableYOffsetAtCell,
    getPartDef,
    getPlacementAtCell,
    getStampById,
    isCellDropAllowed,
    isCellOccupied,
    stampPlacement,
} from './layoutAssembler.js';
import { bindInteractableRoot } from './partInteraction.js';
import { attachConnectionStatusForStamp } from './partConnectionStatus.js';
import { mountCableToggle, setCableMode } from './partCables.js';
import {
    lockSimNetworkCamera,
    unlockSimNetworkCamera,
    TOOL_CAMERA_DRAG_SLOP_PX,
} from './partCamera.js';
import { notifyTutorialAction } from './sim-network-tutorial-coach.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
/**
 * Hardcoded palette tooltips (Daisy tooltip-top, so they sit above the circle).
 * Kept next to the UI builders — Cable / Test are not kit-parts entries.
 * data-tip values are tutorial selectors. Do not rename them.
 */
export const PALETTE_BUTTON_TOOLTIPS = {
    cable: 'Connect cables.',
    router: 'Drop this device.',
    switch: 'Drop this device.',
    testConnection: 'Connection test and results.',
};
const DROP_LAYER = 5;
/** Wall / structure layer used as rotation reference for drops. */
const ROTATION_REFERENCE_LAYER = 2;
/** Furniture layer used as height reference for drops. */
const Y_OFFSET_REFERENCE_LAYER = 3;
/** Used when the drop cell has no layer-2 part. */
const DEFAULT_DROP_ROTATION_Y = 270;
/** Extra yaw when the same-cell layer-2 part is mirrored. */
const MIRRORED_LAYER2_ROTATION_Y_EXTRA = 180;
/** Used when the drop cell has no layer-3 part with droppableYOffset. */
const DEFAULT_DROP_Y_OFFSET = 0;
const HOVER_LAYER_RGB = { r: 0.7, g: 0.35, b: 0.95 };
/** Hover tint when the cell blocks player drops. */
const HOVER_BLOCKED_RGB = { r: 0.95, g: 0.25, b: 0.2 };
/** Preview model shown instead of the droppable on blocked cells. */
const NO_DROP_ICON_PATH =
    './assets/experiences/sim-network/3D/interaction/no-icon-1m.glb';
const TOAST_MS = 2200;

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {HTMLElement | null} */
let paletteEl = null;
/** @type {HTMLElement | null} */
let toastEl = null;
/** @type {string | null} */
let selectedPartId = null;
/** @type {{ mesh: import('@babylonjs/core').AbstractMesh } | null} */
let pickGround = null;
/** @type {import('@babylonjs/core').TransformNode | null} */
let hoverTile = null;
/** @type {import('@babylonjs/core').StandardMaterial | null} */
let hoverFillMat = null;
/** @type {import('@babylonjs/core').TransformNode | null} */
let selectedMarker = null;
/** @type {{ wrap: import('@babylonjs/core').TransformNode, dispose: () => void } | null} */
let ghost = null;
/** Session-cached no-drop icon container (loaded once). */
/** @type {import('@babylonjs/core').AssetContainer | null} */
let noDropIconContainer = null;
/** @type {{ wrap: import('@babylonjs/core').TransformNode, dispose: () => void } | null} */
let blockedGhost = null;
/** @type {Promise<{ wrap: import('@babylonjs/core').TransformNode, dispose: () => void } | null> | null} */
let blockedGhostLoadPromise = null;
/** @type {{ x: number, z: number } | null} */
let hoverCell = null;
/** @type {{ x: number, z: number } | null} */
let selectedCell = null;
/** @type {{ x: number, y: number, cell: { x: number, z: number } | null } | null} */
let pointerDownInfo = null;
/** @type {import('@babylonjs/core').Observer | null} */
let pointerObserver = null;
/** @type {number | null} */
let toastTimerId = null;
/** @type {((event: PointerEvent) => void) | null} */
let paletteDialPointerDown = null;

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.MeshBuilder !== 'object' ||
        typeof host.StandardMaterial !== 'function' ||
        typeof host.Color3 !== 'function' ||
        !host.PointerEventTypes ||
        typeof host.getPlayerUiRoot !== 'function' ||
        typeof host.button !== 'function' ||
        typeof host.TransformNode !== 'function' ||
        typeof host.Vector3 !== 'function' ||
        typeof host.layoutCellHalfOffset !== 'function' ||
        typeof host.loadAssetContainerFromPath !== 'function' ||
        typeof host.getIcon !== 'function'
    ) {
        throw new Error(
            'Experience host API missing drop helpers. Is installExperienceHostApi() running?'
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
 * @param {object} partDef
 * @returns {string}
 */
function partLabel(partDef) {
    const title = partDef?.interactableMessage?.[0];
    if (typeof title === 'string' && title.trim()) {
        return title.trim();
    }
    return String(partDef?.id || 'Part');
}

/**
 * Store the lesson-selector tip on the button without showing a hover bubble.
 * The name already sits beside the circle. data-tip must stay — tutorials click it.
 * @param {HTMLElement} el
 * @param {string | null | undefined} tipText
 */
export function applyPaletteButtonTooltip(el, tipText) {
    const tip = typeof tipText === 'string' ? tipText.trim() : '';
    if (!el || !tip) {
        return;
    }
    el.classList.remove('tooltip', 'tooltip-top', 'tooltip-right');
    el.setAttribute('data-tip', tip);
}

/** Icons for player-dropped parts. Unknown ids fall back to the add-device icon. */
const DROP_TOOL_ICONS = {
    router: 'icon_router',
    switch: 'icon_switch',
};

/**
 * @param {string} partId
 * @returns {string}
 */
function dropToolIconName(partId) {
    return DROP_TOOL_ICONS[partId] || 'icon_add_device';
}

/**
 * Toolbox button, taken out of its wrapper so it can sit in the toolbar.
 * Hover and click sounds stay on the button. The click action is added here.
 * @param {string} id
 * @param {string} variant
 * @param {string} iconName
 * @param {string} text
 * @param {(() => void) | null} onClick
 * @returns {HTMLButtonElement}
 */
export function createToolbarFactoryButton(id, variant, iconName, text, onClick) {
    const host = getHost();
    const wrap = host.button(
        id,
        variant,
        { iconName, iconOnly: false, iconPosition: 'before' },
        { text, tooltipPosition: 'top' },
        null
    );
    const buttonEl = wrap.querySelector('button');
    if (!(buttonEl instanceof HTMLButtonElement)) {
        wrap.remove();
        throw new Error(`Toolbar button factory did not return a button for ${id}.`);
    }
    buttonEl.type = 'button';
    buttonEl.id = id;
    buttonEl.remove();
    wrap.remove();
    if (onClick) {
        buttonEl.addEventListener('click', onClick);
    }
    console.log(
        `[partDrop.js]: [N/A] - [createToolbarFactoryButton] - id has a value of ${id}.`
    ); //This is logged when a toolbar button is built with the shared button factory.
    return buttonEl;
}

/**
 * Paint one menu row: dark icon dot, name, and room for the tick.
 * @param {HTMLButtonElement} btn
 * @param {string} iconName
 * @param {string} labelText
 */
function fillToolbarRow(btn, iconName, labelText) {
    const host = getHost();
    btn.replaceChildren();
    btn.className = 'sim-network-toolbar__row sim-network-drop-palette__btn';
    btn.setAttribute('data-tool-icon', iconName);
    btn.setAttribute('aria-pressed', 'false');

    const dot = document.createElement('span');
    dot.className = 'sim-network-toolbar__dot';
    dot.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('span');
    icon.innerHTML = host.getIcon(iconName, 'h-5 w-5');
    dot.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'sim-network-toolbar__label';
    label.textContent = labelText;
    btn.append(dot, label);
}

/**
 * Tick the active row. Clear the tick when that tool is off.
 * menu-active is not combined with btn — DaisyUI ignores menu-active on a btn.
 * @param {HTMLElement | null} btn
 * @param {boolean} active
 */
export function setPaletteToolRowActive(btn, active) {
    if (!(btn instanceof HTMLElement)) {
        return;
    }
    const on = active === true;
    btn.classList.toggle('menu-active', on);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const existing = btn.querySelector('.sim-network-toolbar__check');
    if (!on) {
        existing?.remove();
        return;
    }
    if (existing) {
        return;
    }
    const host = getHost();
    const check = document.createElement('span');
    check.className = 'sim-network-toolbar__check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = host.getIcon('icon_check', 'h-4 w-4');
    btn.appendChild(check);
}

/**
 * @param {boolean} open
 */
function setPaletteTriggerExpanded(open) {
    const slot = paletteEl?.querySelector('.sim-network-toolbar__slot');
    if (slot instanceof HTMLElement) {
        slot.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
}

/**
 * Show the tool circles. Only the player clicking the bottom button does this.
 */
function openPaletteDial() {
    if (!paletteEl || paletteEl.classList.contains('is-open')) {
        return;
    }
    paletteEl.classList.add('is-open');
    setPaletteTriggerExpanded(true);
    console.log(
        `[partDrop.js]: [N/A] - [openPaletteDial] - isOpen has a value of true.`
    ); //This is logged when the player opens the Actions dial.
}

/**
 * Hide the tool circles. The bottom button stays.
 */
function closePaletteDial() {
    if (!paletteEl) {
        return;
    }
    paletteEl.classList.remove('is-open');
    setPaletteTriggerExpanded(false);
    const active = document.activeElement;
    if (active instanceof HTMLElement && paletteEl.contains(active)) {
        active.blur();
    }
    console.log(
        `[partDrop.js]: [N/A] - [closePaletteDial] - isOpen has a value of false.`
    ); //This is logged when the Actions dial closes after a tool pick, a second click, or a click on the scene.
}

/**
 * Copy the selected tool onto the slot. Nothing selected shows "Tools".
 */
export function refreshPaletteTrigger() {
    const slot = paletteEl?.querySelector('.sim-network-toolbar__slot');
    if (!(slot instanceof HTMLButtonElement)) {
        return;
    }
    const host = getHost();
    const expanded = slot.getAttribute('aria-expanded') === 'true';
    const active = paletteEl.querySelector(
        '.sim-network-drop-palette__btn[aria-pressed="true"]'
    );
    const chevron = document.createElement('span');
    chevron.className = 'sim-network-toolbar__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = host.getIcon('icon_chevron_up', 'h-4 w-4');

    slot.replaceChildren();
    slot.className = 'btn sim-network-toolbar__slot';
    if (!(active instanceof HTMLElement)) {
        slot.classList.add('sim-network-toolbar__slot--empty');
        const text = document.createElement('span');
        text.className = 'sim-network-toolbar__slot-text';
        text.textContent = 'Tools';
        slot.append(text, chevron);
        slot.setAttribute('aria-label', 'Choose a tool');
        slot.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        console.log(
            `[partDrop.js]: [N/A] - [refreshPaletteTrigger] - activeName has a value of empty.`
        ); //This is logged when the slot returns to the empty Tools look.
        return;
    }

    slot.classList.add('btn-primary');
    const iconName = active.getAttribute('data-tool-icon') || '';
    if (iconName) {
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = host.getIcon(iconName, 'h-5 w-5');
        slot.appendChild(icon);
    }
    const name =
        active.querySelector('.sim-network-toolbar__label')?.textContent?.trim() ||
        '';
    const text = document.createElement('span');
    text.className = 'sim-network-toolbar__slot-text';
    text.textContent = name;
    slot.append(text, chevron);
    slot.setAttribute(
        'aria-label',
        name ? `Tool: ${name}. Change tool` : 'Choose a tool'
    );
    slot.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    console.log(
        `[partDrop.js]: [N/A] - [refreshPaletteTrigger] - activeName has a value of ${name || 'empty'}.`
    ); //This is logged when the slot copies the selected tool.
}

/**
 * Close the dial when the player clicks the scene. The menu does not open by itself.
 * @param {HTMLElement} palette
 */
function bindPaletteDial(palette) {
    unbindPaletteDial();
    paletteDialPointerDown = (event) => {
        if (!paletteEl || !paletteEl.classList.contains('is-open')) {
            return;
        }
        if (event.target instanceof Node && paletteEl.contains(event.target)) {
            return;
        }
        closePaletteDial();
    };
    document.addEventListener('pointerdown', paletteDialPointerDown);
    palette.addEventListener('keydown', onPaletteDialKeydown);
}

/**
 * @param {KeyboardEvent} event
 */
function onPaletteDialKeydown(event) {
    if (event.key === 'Escape') {
        closePaletteDial();
    }
}

/**
 * Drop dial listeners. Called when the palette is removed.
 */
function unbindPaletteDial() {
    if (paletteDialPointerDown) {
        document.removeEventListener('pointerdown', paletteDialPointerDown);
        paletteDialPointerDown = null;
    }
    paletteEl?.removeEventListener('keydown', onPaletteDialKeydown);
}

/**
 * Put a tool button in the menu. The button keeps its classes and data attributes.
 * @param {HTMLElement} palette
 * @param {HTMLButtonElement} button
 * @param {string} labelText
 * @returns {HTMLElement | null}
 */
export function appendPaletteToolButton(palette, button, labelText) {
    const menu = palette?.querySelector('.sim-network-toolbar__menu');
    if (!menu || !(button instanceof HTMLButtonElement)) {
        return null;
    }
    const row = document.createElement('li');
    row.appendChild(button);
    button.addEventListener('click', () => {
        closePaletteDial();
    });
    menu.appendChild(row);
    const rowCount = menu.querySelectorAll(':scope > li').length;
    console.log(
        `[partDrop.js]: [N/A] - [appendPaletteToolButton] - labelText has a value of ${labelText}, rowCount has a value of ${rowCount}.`
    ); //This is logged when a tool joins the toolbar menu so the order can be checked.
    return row;
}

/**
 * Keep each palette part button on its theme; mark the active one with btn-active.
 * @param {string | null} activePartId
 */
function syncDroppableButtonSelection(activePartId) {
    if (!paletteEl) {
        return;
    }
    for (const btn of paletteEl.querySelectorAll('button[data-part-id]')) {
        const active = btn.getAttribute('data-part-id') === activePartId;
        setPaletteToolRowActive(btn, active);
    }
    refreshPaletteTrigger();
}

/**
 * Close the menu and hide the whole toolbar (test running, or results open).
 */
export function hideDropPalette() {
    closePaletteDial();
    if (paletteEl) {
        paletteEl.hidden = true;
    }
    console.log(
        `[partDrop.js]: [N/A] - [hideDropPalette] - hidden has a value of true.`
    ); //This is logged when the toolbar hides for the connection test or the results panel.
}

/**
 * Show the toolbar again. The menu stays closed.
 */
export function showDropPalette() {
    if (paletteEl) {
        paletteEl.hidden = false;
    }
    console.log(
        `[partDrop.js]: [N/A] - [showDropPalette] - hidden has a value of false.`
    ); //This is logged when the toolbar returns after the results panel closes.
}

/**
 * @param {import('@babylonjs/core').AbstractMesh} mesh
 * @param {object} host
 */
export function makeCellOverlayMesh(mesh, host) {
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
 * Make the no-drop icon draw above other stamped layers.
 * @param {import('@babylonjs/core').TransformNode} wrap
 * @param {object} host
 */
function makeBlockedGhostOverlay(wrap, host) {
    for (const mesh of wrap.getChildMeshes?.(false) || []) {
        makeCellOverlayMesh(mesh, host);
    }
}

/**
 * Load / instantiate the no-drop icon ghost once per session.
 * @param {import('@babylonjs/core').Scene} scene
 * @returns {Promise<{ wrap: import('@babylonjs/core').TransformNode, dispose: () => void } | null>}
 */
async function ensureBlockedGhost(scene) {
    if (blockedGhost) {
        return blockedGhost;
    }
    if (blockedGhostLoadPromise) {
        return blockedGhostLoadPromise;
    }

    blockedGhostLoadPromise = (async () => {
        const host = getHost();
        try {
            if (!noDropIconContainer) {
                noDropIconContainer = await host.loadAssetContainerFromPath(
                    NO_DROP_ICON_PATH,
                    scene
                );
            }
            const stampName = 'simnetGhost_noDropIcon';
            const entries = noDropIconContainer.instantiateModelsToScene(
                (name) => `${stampName}_${name}`,
                false
            );
            const wrap = new host.TransformNode(stampName, scene);
            for (const root of entries.rootNodes || []) {
                if (root) {
                    root.parent = wrap;
                }
            }
            makeBlockedGhostOverlay(wrap, host);
            wrap.setEnabled(false);

            if (boundScene !== scene) {
                try {
                    entries.dispose?.();
                } catch (error) {
                    console.warn(
                        `[partDrop.js]: [N/A] - [ensureBlockedGhost] - staleEntriesDisposeError has a value of ${error?.message || error}.`
                    ); //This is logged when a late no-icon load is aborted after partDrop disposed.
                }
                try {
                    wrap.dispose?.(false, true);
                } catch (error) {
                    console.warn(
                        `[partDrop.js]: [N/A] - [ensureBlockedGhost] - staleWrapDisposeError has a value of ${error?.message || error}.`
                    ); //This is logged when a late no-icon wrap is aborted after partDrop disposed.
                }
                return null;
            }

            const dispose = () => {
                try {
                    entries.dispose?.();
                } catch (error) {
                    console.warn(
                        `[partDrop.js]: [N/A] - [blockedGhost.dispose] - entriesDisposeError has a value of ${error?.message || error}.`
                    ); //This is logged when the no-drop icon ghost entries fail to dispose.
                }
                try {
                    wrap.dispose?.(false, true);
                } catch (error) {
                    console.warn(
                        `[partDrop.js]: [N/A] - [blockedGhost.dispose] - wrapDisposeError has a value of ${error?.message || error}.`
                    ); //This is logged when the no-drop icon wrap fails to dispose.
                }
            };

            blockedGhost = { wrap, dispose };
            return blockedGhost;
        } catch (error) {
            console.warn(
                `[partDrop.js]: [N/A] - [ensureBlockedGhost] - loadError has a value of ${error?.message || error}.`
            ); //This is logged when the no-drop icon GLB fails to load.
            return null;
        } finally {
            blockedGhostLoadPromise = null;
        }
    })();

    return blockedGhostLoadPromise;
}

function disposeBlockedGhost() {
    blockedGhost?.dispose();
    blockedGhost = null;
    blockedGhostLoadPromise = null;
    // Master lives in the session asset cupboard — never dispose it here (poisons cache).
    if (noDropIconContainer) {
        const pathKey = noDropIconContainer._xrsRegistryPathKey;
        const host = globalThis[HOST_KEY];
        if (pathKey && typeof host?.releaseAssetContainer === 'function') {
            host.releaseAssetContainer(pathKey);
        }
        noDropIconContainer = null;
    }
}

/**
 * @param {number} half
 * @param {number} y
 * @param {object} host
 */
function cellSquarePoints(half, y, host) {
    return [
        new host.Vector3(-half, y, -half),
        new host.Vector3(half, y, -half),
        new host.Vector3(half, y, half),
        new host.Vector3(-half, y, half),
        new host.Vector3(-half, y, -half),
    ];
}

/**
 * @param {number} half
 * @param {number} y
 * @param {number} phase01
 * @param {object} host
 */
function cellSquarePointsPhased(half, y, phase01, host) {
    const edge = half * 2;
    const d = Math.min(Math.max(phase01, 0), 1) * edge;
    return [
        new host.Vector3(-half + d, y, -half),
        new host.Vector3(half, y, -half),
        new host.Vector3(half, y, half),
        new host.Vector3(-half, y, half),
        new host.Vector3(-half, y, -half),
        new host.Vector3(-half + d, y, -half),
    ];
}

/**
 * @param {string} name
 * @param {import('@babylonjs/core').TransformNode} parent
 * @param {number} cell
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} host
 */
export function addCheckerCellOutlines(name, parent, cell, scene, host) {
    const y = 0.06;
    const dashNb = 36;
    const black = host.MeshBuilder.CreateDashedLines(
        `${name}_outlineBlack`,
        {
            points: cellSquarePoints((cell * 0.98) / 2, y, host),
            dashSize: 1,
            gapSize: 1,
            dashNb,
        },
        scene
    );
    black.color = new host.Color3(0, 0, 0);
    black.parent = parent;
    makeCellOverlayMesh(black, host);

    const white = host.MeshBuilder.CreateDashedLines(
        `${name}_outlineWhite`,
        {
            points: cellSquarePointsPhased((cell * 0.92) / 2, y + 0.002, 0.5, host),
            dashSize: 1,
            gapSize: 1,
            dashNb,
        },
        scene
    );
    white.color = new host.Color3(1, 1, 1);
    white.parent = parent;
    makeCellOverlayMesh(white, host);
}

/**
 * Drop / ghost yaw: same-cell layer-2 rotationY (+180 if that part is mirrored), else 270°.
 * Does not copy mirror onto the droppable — yaw only.
 * @param {number} x
 * @param {number} z
 * @returns {number}
 */
function resolveDropRotationY(x, z) {
    const placement = getPlacementAtCell(x, z, ROTATION_REFERENCE_LAYER);
    if (!placement) {
        return DEFAULT_DROP_ROTATION_Y;
    }
    const baseRotationY =
        typeof placement.rotationY === 'number' ? placement.rotationY : 0;
    if (placement.mirror === true) {
        return baseRotationY + MIRRORED_LAYER2_ROTATION_Y_EXTRA;
    }
    return baseRotationY;
}

/**
 * Drop / ghost height boost: same-cell layer-3 catalog droppableYOffset, else 0.
 * @param {number} x
 * @param {number} z
 * @returns {number}
 */
function resolveDropYOffset(x, z) {
    const fromLayer3 = getDroppableYOffsetAtCell(x, z, Y_OFFSET_REFERENCE_LAYER);
    if (fromLayer3 != null) {
        return fromLayer3;
    }
    return DEFAULT_DROP_Y_OFFSET;
}

/**
 * @param {string} message
 */
export function showDropToast(message) {
    if (!toastEl) {
        return;
    }
    toastEl.textContent = message;
    toastEl.hidden = false;
    if (toastTimerId != null) {
        window.clearTimeout(toastTimerId);
    }
    toastTimerId = window.setTimeout(() => {
        if (toastEl) {
            toastEl.hidden = true;
        }
        toastTimerId = null;
    }, TOAST_MS);
}

/**
 * @param {import('@babylonjs/core').PickingInfo | null | undefined} pickInfo
 * @returns {boolean}
 */
function pickHitsInteractable(pickInfo) {
    let node = pickInfo?.pickedMesh || null;
    while (node) {
        if (node.metadata?.simNetworkInteraction) {
            return true;
        }
        node = node.parent;
    }
    return false;
}

/**
 * Convert a world XZ point into a layout cell, or null if outside the grid.
 * @param {object} layout
 * @param {{ x: number, z: number }} point
 * @returns {{ x: number, z: number } | null}
 */
function worldPointToCell(layout, point) {
    if (!layout || !point) {
        return null;
    }
    const cellSize = layout.cellSize ?? 1;
    const width = layout.width ?? 0;
    const depth = layout.depth ?? 0;
    const x = Math.floor(point.x / cellSize);
    const z = Math.floor(point.z / cellSize);
    if (x < 0 || z < 0 || x >= width || z >= depth) {
        return null;
    }
    return { x, z };
}

/**
 * Intersect the pointer ray with the y=0 floor plane and map to a grid cell.
 * Does not depend on scenery meshes being pickable.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, z: number } | null}
 */
function pickCellFromFloorPlane(clientX, clientY) {
    const layout = getActiveLayout();
    if (!boundScene || !layout) {
        return null;
    }
    const camera = boundScene.activeCamera;
    if (!camera || typeof boundScene.createPickingRay !== 'function') {
        return null;
    }
    const ray = boundScene.createPickingRay(clientX, clientY, null, camera);
    const dirY = ray?.direction?.y;
    if (!ray?.origin || typeof dirY !== 'number' || Math.abs(dirY) < 1e-6) {
        return null;
    }
    const t = -ray.origin.y / dirY;
    if (!Number.isFinite(t) || t < 0) {
        return null;
    }
    const hitX = ray.origin.x + ray.direction.x * t;
    const hitZ = ray.origin.z + ray.direction.z * t;
    if (!Number.isFinite(hitX) || !Number.isFinite(hitZ)) {
        return null;
    }
    return worldPointToCell(layout, { x: hitX, z: hitZ });
}

/**
 * Closest stamp under the pointer via ray vs mesh bounds (works when isPickable is false).
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, z: number } | null}
 */
function pickCellFromStampBounds(clientX, clientY) {
    if (!boundScene || typeof boundScene.createPickingRay !== 'function') {
        return null;
    }
    const camera = boundScene.activeCamera;
    if (!camera) {
        return null;
    }
    const ray = boundScene.createPickingRay(clientX, clientY, null, camera);
    if (!ray?.origin || !ray?.direction) {
        return null;
    }

    /** @type {{ x: number, z: number } | null} */
    let bestCell = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const stamp of getAllStamps()) {
        if (
            typeof stamp?.x !== 'number' ||
            typeof stamp?.z !== 'number' ||
            !Number.isFinite(stamp.x) ||
            !Number.isFinite(stamp.z)
        ) {
            continue;
        }
        const meshes = stamp.wrap?.getChildMeshes?.(false) || [];
        for (const mesh of meshes) {
            if (!mesh || typeof mesh.getBoundingInfo !== 'function') {
                continue;
            }
            // fastCheck=true → bounding box only (cheap; ignores isPickable).
            const hit = ray.intersectsMesh(mesh, true);
            if (!hit?.hit || typeof hit.distance !== 'number') {
                continue;
            }
            if (hit.distance >= bestDistance) {
                continue;
            }
            bestDistance = hit.distance;
            bestCell = { x: stamp.x, z: stamp.z };
        }
    }

    return bestCell;
}

/**
 * Floor cell under the pointer (math y=0 plane).
 * Kept for drop/cable callers; same result as floor fallback in {@link pickCellAtPointer}.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, z: number } | null}
 */
export function pickDropCell(clientX, clientY) {
    return pickCellFromFloorPlane(clientX, clientY);
}

/**
 * Resolve grid cell: closest stamp under the pointer (bounds), else floor-plane math.
 * Keeps L1–L3 unpickable for normal scene.pick while still selecting the cell you aim at.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, z: number } | null}
 */
export function pickCellAtPointer(clientX, clientY) {
    if (!boundScene) {
        return null;
    }
    return pickCellFromStampBounds(clientX, clientY) || pickCellFromFloorPlane(clientX, clientY);
}

/**
 * @param {import('@babylonjs/core').TransformNode | null} marker
 * @param {{ x: number, z: number } | null} cell
 */
function positionMarker(marker, cell) {
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
 * @param {boolean} allowed
 */
function setHoverAllowedLook(allowed) {
    // Phase 2.2: purple/red cell FX replace the old wash tint. Kept as a no-op
    // so call sites stay readable; theme is applied via requestDroppableCellFx.
    void allowed;
}

function updateGhostAtHover() {
    const layout = getActiveLayout();
    const host = getHost();
    if (!hoverCell || !layout || !selectedPartId) {
        ghost?.wrap.setEnabled(false);
        blockedGhost?.wrap.setEnabled(false);
        return;
    }

    if (!isCellDropAllowed(hoverCell.x, hoverCell.z)) {
        ghost?.wrap.setEnabled(false);
        if (blockedGhost) {
            const cellSize = layout.cellSize ?? 1;
            const half = host.layoutCellHalfOffset(cellSize);
            blockedGhost.wrap.position = new host.Vector3(
                hoverCell.x * cellSize + half,
                0,
                hoverCell.z * cellSize + half
            );
            blockedGhost.wrap.rotation.y = 0;
            blockedGhost.wrap.setEnabled(true);
        }
        return;
    }

    blockedGhost?.wrap.setEnabled(false);
    if (!ghost) {
        return;
    }
    const partDef = getPartDef(selectedPartId);
    if (!partDef) {
        return;
    }
    const yOffset = resolveDropYOffset(hoverCell.x, hoverCell.z);
    const world = cellToWorld(
        layout,
        { x: hoverCell.x, z: hoverCell.z, yOffset },
        partDef
    );
    ghost.wrap.position = new host.Vector3(world.x, world.y, world.z);
    const rotationY = resolveDropRotationY(hoverCell.x, hoverCell.z);
    ghost.wrap.rotation.y = (rotationY * Math.PI) / 180;
    ghost.wrap.setEnabled(true);
}

function clearHover() {
    hoverCell = null;
    positionMarker(hoverTile, null);
    requestDroppableCellFx(null, 'purple');
    if (ghost) {
        ghost.wrap.setEnabled(false);
    }
    if (blockedGhost) {
        blockedGhost.wrap.setEnabled(false);
    }
}

function clearSelectedCell() {
    selectedCell = null;
    positionMarker(selectedMarker, null);
}

function disposeGhost() {
    ghost?.dispose();
    ghost = null;
}

function clearDropSelection() {
    selectedPartId = null;
    pointerDownInfo = null;
    clearHover();
    clearSelectedCell();
    disposeGhost();
    syncDroppableButtonSelection(null);
    unlockSimNetworkCamera();
    // Invisible pick ground kept for legacy / overlays; cell resolve uses floor-plane math.
}

/**
 * @returns {boolean}
 */
export function isDroppableToolActive() {
    return selectedPartId != null;
}

export { clearDropSelection };

/** Ask explore highlight to set or clear sticky green select (no import cycle). */
const EXPLORE_SELECTION_EVENT = 'sim-network-explore-selection';
/** Ask explore highlight to show purple/red droppable hover FX (no import cycle). */
const DROPPABLE_CELL_FX_EVENT = 'sim-network-droppable-cell-fx';

/**
 * @param {{ x: number, z: number } | null} cell
 */
function requestExploreCellSelection(cell) {
    window.dispatchEvent(
        new CustomEvent(EXPLORE_SELECTION_EVENT, { detail: { cell } })
    );
}

/**
 * @param {{ x: number, z: number } | null} cell
 * @param {'purple' | 'red'} [theme]
 */
function requestDroppableCellFx(cell, theme = 'purple') {
    window.dispatchEvent(
        new CustomEvent(DROPPABLE_CELL_FX_EVENT, {
            detail: { cell, theme },
        })
    );
}

/**
 * Left drop palette root (Cable + parts), or null if not mounted.
 * @returns {HTMLElement | null}
 */
export function getDropPaletteElement() {
    return paletteEl;
}

/**
 * Enable/disable left-palette droppable part buttons (not the Cable toggle).
 * @param {boolean} enabled
 */
export function setDroppableButtonsEnabled(enabled) {
    const on = enabled !== false;
    if (!paletteEl) {
        return;
    }
    for (const btn of paletteEl.querySelectorAll('button[data-part-id]')) {
        btn.disabled = !on;
        btn.setAttribute('aria-disabled', on ? 'false' : 'true');
    }
}

/**
 * @param {string} partId
 */
function selectDroppable(partId) {
    if (paletteEl?.querySelector(`button[data-part-id="${partId}"]`)?.disabled) {
        return;
    }
    if (selectedPartId === partId) {
        clearDropSelection();
        requestExploreCellSelection(null);
        return;
    }

    setCableMode(false);
    clearDropSelection();
    selectedPartId = partId;
    if (pickGround?.mesh) {
        pickGround.mesh.isPickable = true;
    }

    syncDroppableButtonSelection(partId);

    if (boundScene) {
        disposeGhost();
        ghost = createGhostStamp(boundScene, partId);
        if (ghost) {
            ghost.wrap.setEnabled(false);
            for (const mesh of ghost.wrap.getChildMeshes?.(false) || []) {
                mesh.isPickable = false;
            }
        }
        void ensureBlockedGhost(boundScene).then(() => {
            if (selectedPartId === partId && hoverCell) {
                updateGhostAtHover();
            }
        });
    }

    if (partId === 'router') {
        showDropToast('Click on a cell to place a Modem/Router');
    } else if (partId === 'switch') {
        showDropToast('Click on a cell to place a Switch');
    }
}

/**
 * @param {{ x: number, z: number }} cell
 */
function tryPlaceAtCell(cell) {
    const layout = getActiveLayout();
    if (!boundScene || !layout || !selectedPartId) {
        return;
    }

    if (!isCellDropAllowed(cell.x, cell.z)) {
        playSfx('no-drop');
        console.log(
            `[partDrop.js]: [N/A] - [tryPlaceAtCell] - noDropReason has a value of not-allowed, cell has a value of ${cell.x},${cell.z}.`
        ); //This is logged when a drop tool click is rejected on a blocked cell (red X).
        return;
    }

    if (isCellOccupied(cell.x, cell.z, DROP_LAYER)) {
        playSfx('no-drop');
        console.log(
            `[partDrop.js]: [N/A] - [tryPlaceAtCell] - noDropReason has a value of occupied, cell has a value of ${cell.x},${cell.z}.`
        ); //This is logged when a drop tool click is rejected because the cell already has a droppable.
        return;
    }

    const rotationY = resolveDropRotationY(cell.x, cell.z);
    const yOffset = resolveDropYOffset(cell.x, cell.z);
    const result = stampPlacement(
        boundScene,
        layout,
        {
            part: selectedPartId,
            x: cell.x,
            z: cell.z,
            layer: DROP_LAYER,
            rotationY,
            yOffset,
        },
        { playerDrop: true }
    );
    if (!result) {
        showDropToast('Could not place that part.');
        return;
    }

    if (result.interactionContent) {
        bindInteractableRoot(boundScene, result.wrap);
    }
    if (result.stampId) {
        const stamp = getStampById(result.stampId);
        if (stamp) {
            void attachConnectionStatusForStamp(stamp);
        }
    }

    selectedCell = { ...cell };
    playSfx('drop-component');
    console.log(
        `[partDrop.js]: [N/A] - [tryPlaceAtCell] - placedPartId has a value of ${selectedPartId}, cell has a value of ${cell.x},${cell.z}, rotationY has a value of ${rotationY}, yOffset has a value of ${yOffset}.`
    ); //This is logged when a session-only droppable stamp is committed.
    notifyTutorialAction({
        type: 'drop',
        partId: selectedPartId,
        x: cell.x,
        z: cell.z,
        layer: DROP_LAYER,
    });
    clearDropSelection();
    // Sticky green explore cell = drop cell (not the cell selected before the tool).
    requestExploreCellSelection(cell);
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} layout
 * @param {object} host
 */
function buildGridHelpers(scene, layout, host) {
    const cell = layout.cellSize ?? 1;
    const width = layout.width ?? 10;
    const depth = layout.depth ?? 10;

    const ground = host.MeshBuilder.CreateGround(
        'simNetworkPickGround',
        { width: width * cell, height: depth * cell },
        scene
    );
    ground.position = new host.Vector3((width * cell) / 2, 0, (depth * cell) / 2);
    const groundMat = new host.StandardMaterial('simNetworkPickGroundMat', scene);
    groundMat.diffuseColor = new host.Color3(0, 0, 0);
    groundMat.alpha = 0;
    groundMat.transparencyMode = 2;
    groundMat.disableDepthWrite = true;
    ground.material = groundMat;
    ground.isPickable = true;
    pickGround = { mesh: ground };

    hoverTile = new host.TransformNode('simNetworkHoverCell', scene);
    const hoverFill = host.MeshBuilder.CreateGround(
        'simNetworkHoverFill',
        { width: cell * 0.98, height: cell * 0.98 },
        scene
    );
    hoverFill.parent = hoverTile;
    hoverFill.position.y = 0.03;
    const hoverMat = new host.StandardMaterial('simNetworkHoverMat', scene);
    hoverMat.diffuseColor = new host.Color3(
        HOVER_LAYER_RGB.r,
        HOVER_LAYER_RGB.g,
        HOVER_LAYER_RGB.b
    );
    hoverMat.emissiveColor = new host.Color3(
        HOVER_LAYER_RGB.r * 0.35,
        HOVER_LAYER_RGB.g * 0.35,
        HOVER_LAYER_RGB.b * 0.35
    );
    hoverMat.alpha = 0.4;
    hoverMat.transparencyMode = 2;
    hoverFill.material = hoverMat;
    hoverFillMat = hoverMat;
    makeCellOverlayMesh(hoverFill, host);
    addCheckerCellOutlines('simNetworkHover', hoverTile, cell, scene, host);
    hoverTile.setEnabled(false);

    selectedMarker = new host.TransformNode('simNetworkSelectedCell', scene);
    const selectedFill = host.MeshBuilder.CreateGround(
        'simNetworkSelectedFill',
        { width: cell * 0.96, height: cell * 0.96 },
        scene
    );
    selectedFill.parent = selectedMarker;
    selectedFill.position.y = 0.025;
    const selectedMat = new host.StandardMaterial('simNetworkSelectedMat', scene);
    selectedMat.diffuseColor = new host.Color3(1, 1, 1);
    selectedMat.emissiveColor = new host.Color3(0.85, 0.9, 1);
    selectedMat.alpha = 0.22;
    selectedMat.transparencyMode = 2;
    selectedFill.material = selectedMat;
    makeCellOverlayMesh(selectedFill, host);
    addCheckerCellOutlines('simNetworkSelected', selectedMarker, cell, scene, host);
    selectedMarker.setEnabled(false);
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
function attachPointerObserver(scene) {
    const host = getHost();

    function syncHoverAtPointer() {
        const cell = pickCellAtPointer(scene.pointerX, scene.pointerY);
        if (!cell) {
            clearHover();
            return;
        }
        if (!hoverCell || hoverCell.x !== cell.x || hoverCell.z !== cell.z) {
            hoverCell = cell;
            const allowed = isCellDropAllowed(cell.x, cell.z);
            setHoverAllowedLook(allowed);
            // Old wash + dashed outlines stay disabled; Phase 2.2 purple/red FX instead.
            positionMarker(hoverTile, null);
            requestDroppableCellFx(hoverCell, allowed ? 'purple' : 'red');
            updateGhostAtHover();
        }
    }

    function endPress(placeIfClick) {
        if (!pointerDownInfo) {
            return;
        }
        const orbiting = pointerDownInfo.orbiting === true;
        const dx = scene.pointerX - pointerDownInfo.x;
        const dy = scene.pointerY - pointerDownInfo.y;
        const moved = Math.hypot(dx, dy);
        const downCell = pointerDownInfo.cell;
        pointerDownInfo = null;
        unlockSimNetworkCamera();
        if (orbiting) {
            syncHoverAtPointer();
            return;
        }
        if (!placeIfClick || moved >= TOOL_CAMERA_DRAG_SLOP_PX || !downCell) {
            return;
        }
        tryPlaceAtCell(downCell);
    }

    pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        if (!selectedPartId) {
            return;
        }
        const type = pointerInfo.type;

        if (type === host.PointerEventTypes.POINTERMOVE) {
            if (pointerDownInfo?.orbiting) {
                return;
            }
            if (pointerDownInfo && !pointerDownInfo.orbiting) {
                const dx = scene.pointerX - pointerDownInfo.x;
                const dy = scene.pointerY - pointerDownInfo.y;
                if (Math.hypot(dx, dy) >= TOOL_CAMERA_DRAG_SLOP_PX) {
                    pointerDownInfo.orbiting = true;
                    unlockSimNetworkCamera();
                    clearHover();
                    console.log(
                        `[partDrop.js]: [N/A] - [attachPointerObserver] - cameraOrbitDrag has a value of true.`
                    ); //This is logged to debug a place-tool drag that turns the camera instead of dropping a part.
                    return;
                }
            }
            syncHoverAtPointer();
            return;
        }

        if (type === host.PointerEventTypes.POINTERDOWN) {
            const cell = pickCellAtPointer(scene.pointerX, scene.pointerY);
            pointerDownInfo = {
                x: scene.pointerX,
                y: scene.pointerY,
                cell,
                orbiting: false,
            };
            lockSimNetworkCamera({ showBanner: false });
            return;
        }

        if (type === host.PointerEventTypes.POINTERUP) {
            endPress(true);
            return;
        }

        if (type === host.PointerEventTypes.POINTERCAPTURELOST) {
            endPress(false);
        }
    });
}

/**
 * @param {object[]} droppableParts
 */
function buildPalette(droppableParts) {
    const host = getHost();
    const root = host.getPlayerUiRoot();
    paletteEl = document.createElement('div');
    paletteEl.className = 'sim-network-toolbar';
    paletteEl.setAttribute('role', 'toolbar');
    paletteEl.setAttribute('aria-label', 'Build tools');

    const menu = document.createElement('ul');
    menu.className = 'menu sim-network-toolbar__menu';
    menu.id = 'sim-network-toolbar-menu';
    paletteEl.appendChild(menu);

    const slot = createToolbarFactoryButton(
        'sim-network-toolbar-slot',
        'primary',
        'icon_chevron_up',
        'Tools',
        () => {
            if (paletteEl?.classList.contains('is-open')) {
                closePaletteDial();
                return;
            }
            openPaletteDial();
        }
    );
    slot.className = 'btn sim-network-toolbar__slot sim-network-toolbar__slot--empty';
    slot.setAttribute('aria-expanded', 'false');
    slot.setAttribute('aria-controls', 'sim-network-toolbar-menu');
    slot.setAttribute('aria-label', 'Choose a tool');
    slot.removeAttribute('data-tip');
    paletteEl.appendChild(slot);

    mountCableToggle(paletteEl);

    for (const part of droppableParts) {
        const label = partLabel(part);
        const btn = createToolbarFactoryButton(
            `sim-network-toolbar-${part.id}`,
            'primary',
            dropToolIconName(part.id),
            label,
            () => {
                selectDroppable(part.id);
            }
        );
        fillToolbarRow(btn, dropToolIconName(part.id), label);
        btn.setAttribute('aria-label', label);
        btn.setAttribute('data-part-id', part.id);
        applyPaletteButtonTooltip(btn, PALETTE_BUTTON_TOOLTIPS[part.id]);
        appendPaletteToolButton(paletteEl, btn, label);
    }

    refreshPaletteTrigger();
    bindPaletteDial(paletteEl);

    toastEl = document.createElement('div');
    toastEl.className = 'alert alert-warning sim-network-drop-toast';
    toastEl.hidden = true;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'polite');

    root.appendChild(paletteEl);
    root.appendChild(toastEl);
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} layout
 */
export function initializePartDrop(scene, layout) {
    disposePartDrop();

    const parts = Array.isArray(layout?.parts) ? layout.parts : [];
    const droppableParts = parts.filter((part) => part?.droppable === true && part?.id);

    const host = getHost();
    boundScene = scene;
    buildPalette(droppableParts);
    buildGridHelpers(scene, layout, host);
    attachPointerObserver(scene);
    void ensureBlockedGhost(scene);

    console.log(
        `[partDrop.js]: [N/A] - [initializePartDrop] - droppableCount has a value of ${droppableParts.length}, dropLayer has a value of ${DROP_LAYER}.`
    ); //This is logged when the player drop palette and grid helpers are ready.
}

/**
 * Tear down palette, ghost, grid helpers, and pointer observer.
 */
export function disposePartDrop() {
    clearDropSelection();

    if (boundScene && pointerObserver) {
        boundScene.onPointerObservable.remove(pointerObserver);
    }
    pointerObserver = null;

    if (toastTimerId != null) {
        window.clearTimeout(toastTimerId);
        toastTimerId = null;
    }

    unbindPaletteDial();
    paletteEl?.remove();
    paletteEl = null;
    toastEl?.remove();
    toastEl = null;

    hoverTile?.dispose(false, true);
    hoverTile = null;
    hoverFillMat = null;
    selectedMarker?.dispose(false, true);
    selectedMarker = null;
    pickGround?.mesh?.dispose();
    pickGround = null;

    disposeBlockedGhost();
    boundScene = null;
}
