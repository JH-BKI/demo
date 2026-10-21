/**
 * Sim-network cell inspector — right-docked vertical panel for device copy,
 * cables, and removable player droppables.
 */

import {
    getPartDef,
    getStampById,
    getStampsAtCell,
    getStampLabel,
    removeStampById,
} from './layoutAssembler.js';
import {
    getCablesTouchingCell,
    getCableEndpointLabels,
    getCableLabel,
    getSelectedCableId,
    isCableModeActive,
    removeCableById,
    removeCablesForStamp,
    selectCableById,
    clearCableSelection,
    CABLE_SELECTION_CHANGED_EVENT,
    NETWORK_TEST_UI_CHANGED_EVENT,
    isNetworkTestUiBusy,
    areNetworkEditsLocked,
    countCablesOnStamp,
    maxCablesForPart,
} from './partCables.js';
import {
    isDroppableToolActive,
    pickCellAtPointer,
} from './partDrop.js';
import { unbindInteractableRoot } from './partInteraction.js';
import { detachConnectionStatusForStamp } from './partConnectionStatus.js';
import {
    focusSimNetworkCell,
    isSimNetworkCameraLocked,
} from './partCamera.js';
import { notifyTutorialAction } from './sim-network-tutorial-coach.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const SELECT_CLICK_SLOP_PX = 5;
/** Same-cell second click within this window focuses the camera (ms). */
const FOCUS_DOUBLE_CLICK_MS = 450;
/** @type {((this: Window, ev: Event) => void) | null} */
let networkEditsLockListener = null;
/** @type {((this: Window, ev: Event) => void) | null} */
let cablesChangedListener = null;
/** @type {((this: Window, ev: Event) => void) | null} */
let cableSelectionListener = null;
/** @type {((this: Window, ev: Event) => void) | null} */
let networkTestUiListener = null;

const CABLES_CHANGED_EVENT = 'sim-network-cables-changed';

/**
 * Strip HTML tags from kit interactableMessage body copy.
 * @param {string} html
 * @returns {string}
 */
function htmlToPlainText(html) {
    if (typeof html !== 'string' || !html.trim()) {
        return '';
    }
    const el = document.createElement('div');
    el.innerHTML = html;
    return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
}

/**
 * Interactable stamps in a cell (layout devices + droppables).
 * @param {number} x
 * @param {number} z
 * @returns {object[]}
 */
function getInteractableStampsAtCell(x, z) {
    return getStampsAtCell(x, z).filter((stamp) => {
        return getPartDef(stamp.partId)?.interactable === true;
    });
}

/**
 * Plain-text description from interactableMessage[1], or empty string.
 * @param {object} stamp
 * @returns {string}
 */
function getStampDescriptionPlain(stamp) {
    const bodyHtml = getPartDef(stamp.partId)?.interactableMessage?.[1];
    return htmlToPlainText(typeof bodyHtml === 'string' ? bodyHtml : '');
}

/**
 * Re-render the open inspector (edit lock, cable add/remove, etc.).
 */
function refreshOpenPanel() {
    if (inspectedCell && panelEl && !panelEl.hidden) {
        renderPanel(inspectedCell);
    }
}

/**
 * Re-render the open inspector so remove buttons match the post-Test lock.
 */
function refreshOpenPanelForEditLock() {
    refreshOpenPanel();
}

/**
 * Trash remove button with top DaisyUI tooltip "Remove".
 * @param {string} ariaLabel
 * @param {() => void} onClick
 * @returns {HTMLButtonElement}
 */
function createRemoveButton(ariaLabel, onClick) {
    const host = getHost();
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className =
        'btn btn-error btn-xs tooltip tooltip-top sim-network-cell-inspector__remove';
    removeBtn.setAttribute('data-tip', 'Remove');
    removeBtn.setAttribute('aria-label', ariaLabel);
    if (typeof host.getIcon === 'function') {
        removeBtn.innerHTML = host.getIcon(
            'icon_trash',
            'size-3.5 shrink-0'
        );
    } else {
        removeBtn.textContent = '✕';
    }
    removeBtn.addEventListener('click', () => {
        // Hand-built control (not templates.button) — action SFX only on remove.
        playSfx('remove-component');
        console.log(
            `[partCellInspector.js]: [N/A] - [createRemoveButton] - removeComponentSfxDispatched has a value of true, ariaLabel has a value of ${ariaLabel}.`
        ); //This is logged when trash remove plays the remove-component clip.
        onClick();
    });
    return removeBtn;
}

/**
 * Left = device on the inspected cell; right = the other endpoint.
 * @param {string} cableId
 * @param {{ x: number, z: number }} cell
 * @returns {{ leftLabel: string, rightLabel: string }}
 */
function getOrderedEndpointLabelsForCell(cableId, cell) {
    const endpoints = getCableEndpointLabels(cableId);
    const fromStamp = getStampById(endpoints.fromStampId);
    const toStamp = getStampById(endpoints.toStampId);
    const fromAtCell =
        fromStamp && fromStamp.x === cell.x && fromStamp.z === cell.z;
    const toAtCell = toStamp && toStamp.x === cell.x && toStamp.z === cell.z;
    if (toAtCell && !fromAtCell) {
        return {
            leftLabel: endpoints.toLabel,
            rightLabel: endpoints.fromLabel,
        };
    }
    return {
        leftLabel: endpoints.fromLabel,
        rightLabel: endpoints.toLabel,
    };
}

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {HTMLElement | null} */
let panelEl = null;
/** @type {import('@babylonjs/core').Observer | null} */
let pointerObserver = null;
/** @type {{ x: number, y: number, toolActiveAtDown: boolean } | null} */
let pointerDownInfo = null;
/** @type {{ x: number, z: number } | null} */
let inspectedCell = null;
/** First click of a pending same-cell double-click for camera focus. */
/** @type {{ x: number, z: number, atMs: number } | null} */
let pendingFocusClick = null;

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (!host || !host.PointerEventTypes) {
        throw new Error(
            'Experience host API missing pointer helpers. Is installExperienceHostApi() running?'
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

function hidePanel() {
    clearCableSelection();
    if (panelEl) {
        panelEl.hidden = true;
        panelEl.innerHTML = '';
    }
    inspectedCell = null;
}

/**
 * Sync connection "on" state: DaisyUI btn-active (filled) vs btn-outline (off).
 */
function syncSelectedRowClass() {
    if (!panelEl) {
        return;
    }
    const selectedId = getSelectedCableId();
    for (const btn of panelEl.querySelectorAll(
        '.sim-network-cell-inspector__connection-btn[data-cable-id]'
    )) {
        const isSelected = btn.dataset.cableId === selectedId;
        // Off = outline; on = filled primary (DaisyUI btn-active).
        btn.classList.toggle('btn-outline', !isSelected);
        btn.classList.toggle('btn-active', isSelected);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
}

/**
 * Grey out cable toggles and trash buttons while Test Connection is running.
 * A passed test still removes trash buttons through the edit lock.
 */
function syncInspectorTestLock() {
    if (!panelEl) {
        return;
    }
    const locked = isNetworkTestUiBusy();
    const buttons = panelEl.querySelectorAll(
        '.sim-network-cell-inspector__connection-btn, .sim-network-cell-inspector__remove'
    );
    for (const btn of buttons) {
        if (!(btn instanceof HTMLButtonElement)) {
            continue;
        }
        btn.disabled = locked;
        btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
    }
    console.log(
        `[partCellInspector.js]: [N/A] - [syncInspectorTestLock] - locked has a value of ${locked}, buttonCount has a value of ${buttons.length}.`
    ); //This is logged when Test Connection greys out or restores the cell status buttons.
}

/**
 * @param {string} labelText
 * @returns {HTMLElement}
 */
function createSection(labelText) {
    const section = document.createElement('div');
    section.className = 'sim-network-cell-inspector__section';

    const heading = document.createElement('div');
    heading.className = 'sim-network-cell-inspector__section-label';
    heading.textContent = labelText;
    section.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'sim-network-cell-inspector__list';
    section.appendChild(list);

    return section;
}

/**
 * @param {{ x: number, z: number }} cell
 */
function renderPanel(cell) {
    if (!panelEl) {
        return;
    }

    const interactableStamps = getInteractableStampsAtCell(cell.x, cell.z);
    const cellCables = getCablesTouchingCell(cell.x, cell.z);
    if (interactableStamps.length === 0 && cellCables.length === 0) {
        hidePanel();
        return;
    }

    inspectedCell = { ...cell };
    panelEl.innerHTML = '';
    panelEl.hidden = false;

    const stack = document.createElement('div');
    stack.className = 'sim-network-cell-inspector__stack';

    if (interactableStamps.length > 0) {
        const deviceSection = createSection('Device');
        const deviceList = deviceSection.querySelector('ul');

        for (const stamp of interactableStamps) {
            const canRemove = getPartDef(stamp.partId)?.droppable === true;
            const li = document.createElement('li');
            li.className =
                'sim-network-cell-inspector__row sim-network-cell-inspector__row--device';

            const deviceBlock = document.createElement('div');
            deviceBlock.className = 'sim-network-cell-inspector__device';

            const nameEl = document.createElement('div');
            nameEl.className = 'sim-network-cell-inspector__device-name';
            nameEl.textContent = getStampLabel(stamp);
            deviceBlock.appendChild(nameEl);

            // Description copy stays from kit JSON — designer edits manually.
            const description = getStampDescriptionPlain(stamp);
            if (description) {
                const descEl = document.createElement('div');
                descEl.className = 'sim-network-cell-inspector__device-desc';
                descEl.textContent = description;
                deviceBlock.appendChild(descEl);
            }

            const partDef = getPartDef(stamp.partId);
            const currentConnections = countCablesOnStamp(stamp.stampId);
            const totalConnections = maxCablesForPart(partDef);
            const connectionsEl = document.createElement('div');
            connectionsEl.className =
                'sim-network-cell-inspector__device-connections';
            connectionsEl.append(
                document.createTextNode('Connected: '),
                Object.assign(document.createElement('strong'), {
                    textContent: `${currentConnections} / ${totalConnections}`,
                })
            );
            deviceBlock.appendChild(connectionsEl);

            li.appendChild(deviceBlock);

            // Trash only for kit-catalog droppables (same flag as the left palette).
            // Hidden after a successful network Test until the scene/layout is reset.
            if (canRemove && !areNetworkEditsLocked()) {
                li.appendChild(
                    createRemoveButton(`Remove ${getStampLabel(stamp)}`, () => {
                        const stampId = stamp.stampId;
                        const removedCables = removeCablesForStamp(stampId);
                        unbindInteractableRoot(stamp.wrap);
                        detachConnectionStatusForStamp(stampId);
                        removeStampById(stampId);
                        console.log(
                            `[partCellInspector.js]: [N/A] - [renderPanel] - removedDroppableStampId has a value of ${stampId}, removedCableCount has a value of ${removedCables}.`
                        ); //This is logged when the player trashes a droppable from the cell inspector.
                        renderPanel(cell);
                    })
                );
            }
            deviceList.appendChild(li);
        }

        stack.appendChild(deviceSection);
    }

    if (cellCables.length > 0) {
        const cableSection = createSection('Connections');
        const cableList = cableSection.querySelector('ul');

        for (const cable of cellCables) {
            const li = document.createElement('li');
            li.className =
                'sim-network-cell-inspector__row sim-network-cell-inspector__row--connection';

            const ordered = getOrderedEndpointLabelsForCell(cable.id, cell);
            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.className =
                'btn btn-primary btn-outline btn-sm sim-network-cell-inspector__connection-btn';
            selectBtn.dataset.cableId = cable.id;
            selectBtn.setAttribute('aria-pressed', 'false');
            selectBtn.setAttribute(
                'aria-label',
                `Highlight ${getCableLabel(cable.id)}`
            );

            const leftEl = document.createElement('span');
            leftEl.className =
                'sim-network-cell-inspector__endpoint sim-network-cell-inspector__endpoint--left';
            leftEl.textContent = ordered.leftLabel;

            const barEl = document.createElement('progress');
            barEl.className = 'sim-network-cell-inspector__cable-bar progress progress-info w-full';
            barEl.setAttribute('aria-hidden', 'true');

            const rightEl = document.createElement('span');
            rightEl.className =
                'sim-network-cell-inspector__endpoint sim-network-cell-inspector__endpoint--right';
            rightEl.textContent = ordered.rightLabel;

            selectBtn.append(leftEl, barEl, rightEl);
            selectBtn.addEventListener('click', () => {
                // Toggle: click again clears highlight / "on" state.
                if (getSelectedCableId() === cable.id) {
                    clearCableSelection();
                    console.log(
                        `[partCellInspector.js]: [N/A] - [renderPanel] - clearedCableId has a value of ${cable.id}.`
                    ); //This is logged when the player toggles a selected cable button off.
                } else if (selectCableById(cable.id)) {
                    console.log(
                        `[partCellInspector.js]: [N/A] - [renderPanel] - selectedCableId has a value of ${cable.id}.`
                    ); //This is logged when the player toggles a cable button on to highlight it in 3D.
                }
                syncSelectedRowClass();
            });
            li.appendChild(selectBtn);

            if (!areNetworkEditsLocked()) {
                li.appendChild(
                    createRemoveButton(`Remove ${getCableLabel(cable.id)}`, () => {
                        removeCableById(cable.id);
                        renderPanel(cell);
                    })
                );
            }
            cableList.appendChild(li);
        }

        stack.appendChild(cableSection);
    }

    panelEl.appendChild(stack);
    syncSelectedRowClass();
    syncInspectorTestLock();

    console.log(
        `[partCellInspector.js]: [N/A] - [renderPanel] - cell has a value of ${cell.x},${cell.z}, interactableCount has a value of ${interactableStamps.length}, cableCount has a value of ${cellCables.length}.`
    ); //This is logged when the cell inspector panel is shown or refreshed.
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
function attachPointerObserver(scene) {
    const host = getHost();
    pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        const type = pointerInfo.type;

        if (type === host.PointerEventTypes.POINTERDOWN) {
            pointerDownInfo = {
                x: scene.pointerX,
                y: scene.pointerY,
                // Capture at down: place click clears the tool before this UP runs.
                toolActiveAtDown:
                    isDroppableToolActive() || isCableModeActive(),
            };
            return;
        }

        if (type !== host.PointerEventTypes.POINTERUP || !pointerDownInfo) {
            return;
        }

        const dx = scene.pointerX - pointerDownInfo.x;
        const dy = scene.pointerY - pointerDownInfo.y;
        const toolActiveAtDown = pointerDownInfo.toolActiveAtDown;
        pointerDownInfo = null;
        if (Math.hypot(dx, dy) > SELECT_CLICK_SLOP_PX) {
            return;
        }

        // Placing a droppable owns the click; cable mode device picks own mesh clicks.
        if (isDroppableToolActive()) {
            return;
        }

        const cell = pickCellAtPointer(scene.pointerX, scene.pointerY);
        if (!cell) {
            return;
        }

        // Double-click same cell (tools off) moves the look-at; single click does not.
        const toolsOff =
            !toolActiveAtDown &&
            !isDroppableToolActive() &&
            !isCableModeActive();
        if (toolsOff && !isSimNetworkCameraLocked()) {
            const nowMs = performance.now();
            const isDoubleClick =
                pendingFocusClick &&
                pendingFocusClick.x === cell.x &&
                pendingFocusClick.z === cell.z &&
                nowMs - pendingFocusClick.atMs <= FOCUS_DOUBLE_CLICK_MS;
            if (isDoubleClick) {
                pendingFocusClick = null;
                focusSimNetworkCell(cell);
                notifyTutorialAction({
                    type: 'cellDoubleClick',
                    x: cell.x,
                    z: cell.z,
                });
                console.log(
                    `[partCellInspector.js]: [N/A] - [attachPointerObserver] - doubleClickFocusCell has a value of ${cell.x},${cell.z}.`
                ); //This is logged when a same-cell double-click moves the camera look-at.
            } else {
                pendingFocusClick = { x: cell.x, z: cell.z, atMs: nowMs };
            }
        } else {
            pendingFocusClick = null;
        }

        const interactableStamps = getInteractableStampsAtCell(cell.x, cell.z);
        const cellCables = getCablesTouchingCell(cell.x, cell.z);
        if (interactableStamps.length === 0 && cellCables.length === 0) {
            if (inspectedCell) {
                hidePanel();
            }
            return;
        }

        // Cable mode still starts or finishes a cable on this click. The cell status
        // panel opens too, including when the click lands on the device itself.

        // Same cell already open — skip rebuild (multi-clicks / spam POINTERUP).
        if (
            panelEl &&
            !panelEl.hidden &&
            inspectedCell &&
            inspectedCell.x === cell.x &&
            inspectedCell.z === cell.z
        ) {
            console.log(
                `[partCellInspector.js]: [N/A] - [attachPointerObserver] - skippedRebuildForCell has a value of ${cell.x},${cell.z}.`
            ); //This is logged when the player re-clicks a cell that is already open in the inspector.
            return;
        }

        renderPanel(cell);
    });
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
export function initializePartCellInspector(scene) {
    disposePartCellInspector();
    boundScene = scene;

    const centerSlot = document.getElementById('uiContainer-center');
    if (!centerSlot) {
        console.warn(
            `[partCellInspector.js]: [N/A] - [initializePartCellInspector] - centerSlotMissing has a value of true.`
        ); //This is logged when the player frame center slot is missing.
        return;
    }

    panelEl = document.createElement('div');
    panelEl.className =
        'sim-network-cell-inspector pointer-events-auto select-none';
    panelEl.setAttribute('role', 'region');
    panelEl.setAttribute('aria-label', 'Cell device and connections');
    panelEl.hidden = true;
    centerSlot.appendChild(panelEl);

    networkEditsLockListener = () => {
        refreshOpenPanelForEditLock();
    };
    window.addEventListener('sim-network-network-edits-lock', networkEditsLockListener);

    cablesChangedListener = () => {
        refreshOpenPanel();
    };
    window.addEventListener(CABLES_CHANGED_EVENT, cablesChangedListener);

    cableSelectionListener = () => {
        syncSelectedRowClass();
    };
    window.addEventListener(CABLE_SELECTION_CHANGED_EVENT, cableSelectionListener);

    networkTestUiListener = () => {
        syncInspectorTestLock();
    };
    window.addEventListener(NETWORK_TEST_UI_CHANGED_EVENT, networkTestUiListener);

    attachPointerObserver(scene);
    console.log(
        `[partCellInspector.js]: [N/A] - [initializePartCellInspector] - panelMounted has a value of true.`
    ); //This is logged when the cell inspector UI is ready.
}

/**
 * Tear down inspector UI and pointer observer.
 */
export function disposePartCellInspector() {
    if (networkEditsLockListener) {
        window.removeEventListener('sim-network-network-edits-lock', networkEditsLockListener);
        networkEditsLockListener = null;
    }
    if (cablesChangedListener) {
        window.removeEventListener(CABLES_CHANGED_EVENT, cablesChangedListener);
        cablesChangedListener = null;
    }
    if (cableSelectionListener) {
        window.removeEventListener(
            CABLE_SELECTION_CHANGED_EVENT,
            cableSelectionListener
        );
        cableSelectionListener = null;
    }
    if (networkTestUiListener) {
        window.removeEventListener(
            NETWORK_TEST_UI_CHANGED_EVENT,
            networkTestUiListener
        );
        networkTestUiListener = null;
    }
    clearCableSelection();
    if (boundScene && pointerObserver) {
        boundScene.onPointerObservable.remove(pointerObserver);
    }
    pointerObserver = null;
    pointerDownInfo = null;
    pendingFocusClick = null;
    inspectedCell = null;
    panelEl?.remove();
    panelEl = null;
    boundScene = null;
}
