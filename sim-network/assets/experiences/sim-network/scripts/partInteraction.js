/**
 * Sim-network part interaction — click stamped kit parts to open shared information.
 */

import {
    handleCableDevicePick,
    isCableModeActive,
} from './partCables.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const DIALOG_ID = 'sim-network-part-dialog';

/** @type {Array<{ mesh: import('@babylonjs/core').AbstractMesh, actionManager: import('@babylonjs/core').ActionManager }>} */
let interactionBindings = [];
/** @type {{ open: Function, dispose: Function } | null} */
let dialogApi = null;
/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.createGenericDialogPanel !== 'function' ||
        typeof host.ActionManager !== 'function' ||
        typeof host.ExecuteCodeAction !== 'function'
    ) {
        throw new Error(
            'Experience host API missing dialog / action helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @param {{ partId: string, title: string, bodyHtml: string }} interaction
 */
function openPartDialog(interaction) {
    // Temporarily disabled — device copy now lives in the cell status UI.
    console.log(
        `[partInteraction.js]: [N/A] - [openPartDialog] - dialogDisabledPartId has a value of ${interaction.partId}.`
    ); //This is logged when an interactable pick would have opened the shared info dialog.
    return;
}

/**
 * Open the shared info dialog for an interactable stamp root (used by status meshes too).
 * @param {import('@babylonjs/core').TransformNode | null | undefined} root
 */
export function openInteractableDialogForRoot(root) {
    const interaction = root?.metadata?.simNetworkInteraction;
    if (!interaction || !boundScene) {
        return;
    }
    ensureDialog(boundScene);
    openPartDialog(interaction);
}

/**
 * Ensure the shared dialog exists for this scene session.
 * @param {import('@babylonjs/core').Scene} scene
 */
function ensureDialog(scene) {
    const host = getHost();
    if (!dialogApi) {
        dialogApi = host.createGenericDialogPanel({
            id: DIALOG_ID,
            allowBackdropClose: true,
            closeOnEscape: true,
            footerAlign: 'end',
            nonBlocking: true,
            position: 'right',
            collapsible: true,
        });
    }
    boundScene = scene;
}

/**
 * Bind click / hover actions on one interactable stamp root.
 * @param {import('@babylonjs/core').Scene} scene
 * @param {import('@babylonjs/core').TransformNode} root
 */
export function bindInteractableRoot(scene, root) {
    const interaction = root?.metadata?.simNetworkInteraction;
    if (!interaction) {
        return;
    }
    ensureDialog(scene);
    const host = getHost();

    for (const mesh of root.getChildMeshes?.(false) || []) {
        const actionManager = new host.ActionManager(scene);
        mesh.actionManager = actionManager;
        actionManager.registerAction(
            new host.ExecuteCodeAction(host.ActionManager.OnPickTrigger, () => {
                if (isCableModeActive()) {
                    handleCableDevicePick(root);
                    return;
                }
                openPartDialog(interaction);
            })
        );
        // Hand cursor is owned by partCellHighlight (cell-based, any stamp).
        interactionBindings.push({ mesh, actionManager });
    }

    console.log(
        `[partInteraction.js]: [N/A] - [bindInteractableRoot] - partId has a value of ${interaction.partId}.`
    ); //This is logged when a newly stamped interactable root is wired for dialogs.
}

/**
 * Remove click / hover actions for one stamp root (e.g. player deletes a droppable).
 * @param {import('@babylonjs/core').TransformNode} root
 */
export function unbindInteractableRoot(root) {
    if (!root) {
        return;
    }
    const meshSet = new Set(root.getChildMeshes?.(false) || []);
    /** @type {typeof interactionBindings} */
    const kept = [];
    for (const binding of interactionBindings) {
        if (!meshSet.has(binding.mesh)) {
            kept.push(binding);
            continue;
        }
        if (binding.mesh.actionManager === binding.actionManager) {
            binding.mesh.actionManager = null;
        }
        binding.actionManager.dispose();
    }
    interactionBindings = kept;
    console.log(
        `[partInteraction.js]: [N/A] - [unbindInteractableRoot] - remainingBoundMeshCount has a value of ${interactionBindings.length}.`
    ); //This is logged when interactable actions are removed with a deleted droppable.
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {import('@babylonjs/core').TransformNode[]} interactableRoots
 */
export function initializePartInteraction(scene, interactableRoots) {
    disposePartInteraction();
    ensureDialog(scene);

    for (const root of interactableRoots) {
        bindInteractableRoot(scene, root);
    }

    console.log(
        `[partInteraction.js]: [N/A] - [initializePartInteraction] - interactableRootCount has a value of ${interactableRoots.length}, boundMeshCount has a value of ${interactionBindings.length}.`
    ); //This is logged to debug part interaction setup and verify pickable meshes were bound.
}

/**
 * Remove part actions and dispose the shared dialog.
 */
export function disposePartInteraction() {
    for (const { mesh, actionManager } of interactionBindings) {
        if (mesh.actionManager === actionManager) {
            mesh.actionManager = null;
        }
        actionManager.dispose();
    }
    interactionBindings = [];
    boundScene = null;

    dialogApi?.dispose();
    dialogApi = null;
}
