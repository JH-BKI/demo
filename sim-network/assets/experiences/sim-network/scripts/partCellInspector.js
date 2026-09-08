/**
 * Sim-network cell inspector — bottom-middle list for interactable device copy,
 * cables, and removable player droppables.
 */

import {
    getPartDef,
    getStampsAtCell,
    getStampLabel,
    removeStampById,
} from './layoutAssembler.js';
import {
    getCablesTouchingCell,
    getCableLabel,
    getSelectedCableId,
    isCableModeActive,
    removeCableById,
    removeCablesForStamp,
    selectCableById,
    clearCableSelection,
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
/** Max connection rows per Connections column before starting another column. */
const CONNECTIONS_PER_COLUMN = 2;
/** @type {((this: Window, ev: Event) => void) | null} */
let networkEditsLockListener = null;
/** @type {((this: Window, ev: Event) => void) | null} */
let cablesChangedListener = null;

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
        'btn btn-neutral btn-circle btn-xs tooltip tooltip-left sim-network-cell-inspector__remove';
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
    removeBtn.addEventListener('click', onClick);
    return removeBtn;
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

function hidePanel() {
    clearCableSelection();
    if (panelEl) {
        panelEl.hidden = true;
        panelEl.innerHTML = '';
    }
    inspectedCell = null;
}

/**
 * Mark the selected cable row across all Connections columns (single selection).
 */
function syncSelectedRowClass() {
    if (!panelEl) {
        return;
    }
    const selectedId = getSelectedCableId();
    for (const row of panelEl.querySelectorAll(
        '.sim-network-cell-inspector__row[data-cable-id]'
    )) {
        const isSelected = row.dataset.cableId === selectedId;
        row.classList.toggle(
            'sim-network-cell-inspector__row--selected',
            isSelected
        );
    }
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

    const columns = document.createElement('div');
    columns.className = 'sim-network-cell-inspector__columns';

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
                document.createTextNode('Available connections: '),
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

        columns.appendChild(deviceSection);
    }

    if (cellCables.length > 0) {
        const cableSection = document.createElement('div');
        cableSection.className = 'sim-network-cell-inspector__section';

        const cableHeading = document.createElement('div');
        cableHeading.className = 'sim-network-cell-inspector__section-label';
        cableHeading.textContent = 'Connections';
        cableSection.appendChild(cableHeading);

        const cableColumns = document.createElement('div');
        cableColumns.className =
            'sim-network-cell-inspector__connections-columns';

        /** @type {HTMLUListElement | null} */
        let currentList = null;
        for (let i = 0; i < cellCables.length; i++) {
            if (i % CONNECTIONS_PER_COLUMN === 0) {
                currentList = document.createElement('ul');
                currentList.className = 'sim-network-cell-inspector__list';
                cableColumns.appendChild(currentList);
            }

            const cable = cellCables[i];
            const li = document.createElement('li');
            li.className = 'sim-network-cell-inspector__row';
            li.dataset.cableId = cable.id;
            const label = document.createElement('button');
            label.type = 'button';
            label.className = 'sim-network-cell-inspector__label';
            label.textContent = getCableLabel(cable.id);
            label.setAttribute(
                'aria-label',
                `Highlight ${getCableLabel(cable.id)}`
            );
            label.addEventListener('click', () => {
                selectCableById(cable.id);
                syncSelectedRowClass();
                console.log(
                    `[partCellInspector.js]: [N/A] - [renderPanel] - selectedCableId has a value of ${cable.id}.`
                ); //This is logged when the player clicks a cable label to highlight it in 3D.
            });
            li.appendChild(label);
            if (!areNetworkEditsLocked()) {
                li.appendChild(
                    createRemoveButton(`Remove ${getCableLabel(cable.id)}`, () => {
                        removeCableById(cable.id);
                        renderPanel(cell);
                    })
                );
            }
            currentList.appendChild(li);
        }

        cableSection.appendChild(cableColumns);
        columns.appendChild(cableSection);
    }

    panelEl.appendChild(columns);
    syncSelectedRowClass();

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

        // Cable mode owns interactable clicks (start/end). Free play: cell inspector.
        const meshPick = scene.pick(scene.pointerX, scene.pointerY);
        let node = meshPick?.pickedMesh || null;
        let hitInteractable = false;
        while (node) {
            if (node.metadata?.simNetworkInteraction) {
                hitInteractable = true;
                break;
            }
            node = node.parent;
        }
        if (hitInteractable && isCableModeActive()) {
            return;
        }

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

    const footerCenter = document.getElementById('uiContainer-footer-center');
    if (!footerCenter) {
        console.warn(
            `[partCellInspector.js]: [N/A] - [initializePartCellInspector] - footerCenterMissing has a value of true.`
        ); //This is logged when the player frame footer slot is missing.
        return;
    }

    panelEl = document.createElement('div');
    panelEl.className =
        'sim-network-cell-inspector flex flex-col items-stretch gap-1 min-w-[14rem] max-w-[min(36rem,94vw)] bg-base-100/20 backdrop-blur-2xl rounded-2xl p-2 pointer-events-auto select-none absolute bottom-4';
    panelEl.setAttribute('role', 'region');
    panelEl.setAttribute('aria-label', 'Cell device and connections');
    panelEl.hidden = true;
    footerCenter.appendChild(panelEl);

    networkEditsLockListener = () => {
        refreshOpenPanelForEditLock();
    };
    window.addEventListener('sim-network-network-edits-lock', networkEditsLockListener);

    cablesChangedListener = () => {
        refreshOpenPanel();
    };
    window.addEventListener(CABLES_CHANGED_EVENT, cablesChangedListener);

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
