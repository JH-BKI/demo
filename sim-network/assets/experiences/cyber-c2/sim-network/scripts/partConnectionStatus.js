/**
 * Sim-network connection status meshes — floating icons above interactable stamps.
 * Play: purple connected / not-connected. Test: blue connected vs red unreachable.
 *
 * Note: the on-disk GLB colours are inverted vs the filenames (play file reads blue,
 * test file reads purple). Keys below point at the file that matches the intended look.
 */

import {
    getActiveLayout,
    getAllStamps,
    getPartDef,
    getStampById,
} from './layoutAssembler.js';
import {
    countCablesOnStamp,
    handleCableDevicePick,
    isCableModeActive,
} from './partCables.js';
import {
    clearStatusIconFx,
    disposeAllStatusIconFx,
    syncStatusIconFx,
} from './partCellStatusFx.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const EXPLORE_SELECTION_EVENT = 'sim-network-explore-selection';

const STATUS_Y_OFFSET = 1.5;
const BOB_AMPLITUDE = 0.1;
/** Full Y turn every 16 seconds (radians per second). */
const ROTATE_RAD_PER_SEC = (Math.PI * 2) / 16;
/** Bob cycle length in seconds (half previous speed). */
const BOB_PERIOD_SEC = 4;
/** Keep material emissive at authored strength; GlowLayer provides the visible halo. */
const STATUS_EMISSIVE_INTENSITY = 1;
/** Soft bloom strength for status icons (Babylon GlowLayer). */
const STATUS_GLOW_INTENSITY = 0.45;

const STATUS_PATHS = {
    // Intended look: purple connected during play (file named *-test* is purple on disk).
    'play-connected':
        './assets/experiences/cyber-c2/sim-network/3D/interaction/status-connected-test.glb',
    'play-not-connected':
        './assets/experiences/cyber-c2/sim-network/3D/interaction/status-not-connected-play.glb',
    // Intended look: blue connected after Test pass/fail (file named *-play* is blue on disk).
    'test-connected':
        './assets/experiences/cyber-c2/sim-network/3D/interaction/status-connected-play.glb',
    'test-not-connected':
        './assets/experiences/cyber-c2/sim-network/3D/interaction/status-not-connected-test.glb',
};

/** @typedef {'play-connected' | 'play-not-connected' | 'test-connected' | 'test-not-connected'} StatusVisualKey */

/**
 * @typedef {{
 *   stampId: string,
 *   root: import('@babylonjs/core').TransformNode,
 *   visualKey: StatusVisualKey | null,
 *   entries: { rootNodes?: import('@babylonjs/core').Node[], dispose?: Function } | null,
 *   actionBindings: Array<{ mesh: import('@babylonjs/core').AbstractMesh, actionManager: import('@babylonjs/core').ActionManager }>,
 *   glowMeshes: import('@babylonjs/core').AbstractMesh[]
 * }} StatusEntry
 */

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {Map<string, import('@babylonjs/core').AssetContainer>} */
const templateContainers = new Map();
/** @type {Map<string, StatusEntry>} */
const statusByStampId = new Map();
/** @type {import('@babylonjs/core').Observer | null} */
let renderObserver = null;
/** @type {import('@babylonjs/core').GlowLayer | null} */
let statusGlowLayer = null;
/** @type {boolean} */
let testModeActive = false;
/** @type {Set<string>} */
let testConnectedStampIds = new Set();
/** Accumulated seconds for bob/spin (delta-time based). */
let animTimeSec = 0;

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.loadAssetContainerFromPath !== 'function' ||
        typeof host.TransformNode !== 'function' ||
        typeof host.Vector3 !== 'function' ||
        typeof host.ActionManager !== 'function' ||
        typeof host.ExecuteCodeAction !== 'function' ||
        typeof host.GlowLayer !== 'function' ||
        typeof host.layoutCellHalfOffset !== 'function'
    ) {
        throw new Error(
            'Experience host API missing connection-status helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @returns {import('@babylonjs/core').GlowLayer | null}
 */
function ensureStatusGlowLayer() {
    const host = getHost();
    if (!boundScene) {
        return null;
    }
    if (statusGlowLayer && !statusGlowLayer.isDisposed?.()) {
        return statusGlowLayer;
    }
    statusGlowLayer = new host.GlowLayer('simNetworkStatusGlow', boundScene, {
        blurKernelSize: 24,
        mainTextureRatio: 0.5,
    });
    statusGlowLayer.intensity = STATUS_GLOW_INTENSITY;
    console.log(
        `[partConnectionStatus.js]: [N/A] - [ensureStatusGlowLayer] - glowCreated has a value of true, intensity has a value of ${STATUS_GLOW_INTENSITY}.`
    ); //This is logged when the dedicated status-mesh GlowLayer is created.
    return statusGlowLayer;
}

/**
 * @param {StatusEntry} entry
 */
function removeStatusMeshesFromGlow(entry) {
    const glow = statusGlowLayer;
    if (!glow || glow.isDisposed?.()) {
        entry.glowMeshes = [];
        return;
    }
    for (const mesh of entry.glowMeshes) {
        try {
            glow.removeIncludedOnlyMesh?.(mesh);
        } catch (error) {
            console.warn(
                `[partConnectionStatus.js]: [N/A] - [removeStatusMeshesFromGlow] - removeError has a value of ${error?.message || error}.`
            ); //This is logged when a status mesh fails to leave the GlowLayer.
        }
    }
    entry.glowMeshes = [];
}

/**
 * @param {StatusEntry} entry
 */
function addStatusMeshesToGlow(entry) {
    const glow = ensureStatusGlowLayer();
    if (!glow) {
        return;
    }
    removeStatusMeshesFromGlow(entry);
    const meshes = entry.root.getChildMeshes?.(false) || [];
    for (const mesh of meshes) {
        glow.addIncludedOnlyMesh(mesh);
        entry.glowMeshes.push(mesh);
    }
    console.log(
        `[partConnectionStatus.js]: [N/A] - [addStatusMeshesToGlow] - stampId has a value of ${entry.stampId}, glowMeshCount has a value of ${entry.glowMeshes.length}.`
    ); //This is logged when status meshes are registered on the GlowLayer for bloom.
}

/**
 * Flag default-on: omit/undefined/true → show; only explicit false opts out.
 * @param {object | null | undefined} partDef
 * @returns {boolean}
 */
export function shouldShowConnectionStatus(partDef) {
    if (partDef?.interactable !== true) {
        return false;
    }
    return partDef.showConnectionStatus !== false;
}

/**
 * @param {{ x: number, z: number } | null} cell
 */
function requestExploreCellSelection(cell) {
    window.dispatchEvent(
        new CustomEvent(EXPLORE_SELECTION_EVENT, { detail: { cell } })
    );
}

/**
 * @param {object} stamp
 * @returns {StatusVisualKey}
 */
function resolveVisualKeyForStamp(stamp) {
    if (testModeActive) {
        return testConnectedStampIds.has(stamp.stampId)
            ? 'test-connected'
            : 'test-not-connected';
    }
    return countCablesOnStamp(stamp.stampId) > 0
        ? 'play-connected'
        : 'play-not-connected';
}

/**
 * @returns {Promise<void>}
 */
async function ensureTemplatesLoaded() {
    if (templateContainers.size === Object.keys(STATUS_PATHS).length) {
        return;
    }
    if (!boundScene) {
        return;
    }
    const host = getHost();
    const keys = /** @type {StatusVisualKey[]} */ (Object.keys(STATUS_PATHS));
    for (const key of keys) {
        if (templateContainers.has(key)) {
            continue;
        }
        const container = await host.loadAssetContainerFromPath(
            STATUS_PATHS[key],
            boundScene
        );
        templateContainers.set(key, container);
        console.log(
            `[partConnectionStatus.js]: [N/A] - [ensureTemplatesLoaded] - visualKey has a value of ${key}.`
        ); //This is logged when a status GLB template finishes loading once for the session.
    }
}

/**
 * @param {StatusEntry} entry
 */
function clearVisualBindings(entry) {
    removeStatusMeshesFromGlow(entry);
    clearStatusIconFx(entry.stampId);
    for (const binding of entry.actionBindings) {
        if (binding.mesh.actionManager === binding.actionManager) {
            binding.mesh.actionManager = null;
        }
        binding.actionManager.dispose();
    }
    entry.actionBindings = [];
    if (entry.entries) {
        try {
            entry.entries.dispose?.();
        } catch (error) {
            console.warn(
                `[partConnectionStatus.js]: [N/A] - [clearVisualBindings] - entriesDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when a previous status GLB instance fails to dispose.
        }
        entry.entries = null;
    }
    entry.visualKey = null;
}

/**
 * @param {StatusEntry} entry
 * @param {object} stamp
 */
function bindStatusPick(entry, stamp) {
    if (!boundScene) {
        return;
    }
    const host = getHost();
    const meshes = entry.root.getChildMeshes?.(false) || [];
    for (const mesh of meshes) {
        mesh.isPickable = true;
        const actionManager = new host.ActionManager(boundScene);
        mesh.actionManager = actionManager;
        actionManager.registerAction(
            new host.ExecuteCodeAction(host.ActionManager.OnPickTrigger, () => {
                const liveStamp = getStampById(stamp.stampId);
                if (!liveStamp?.wrap) {
                    return;
                }
                if (isCableModeActive()) {
                    handleCableDevicePick(liveStamp.wrap);
                    return;
                }
                // Info dialog disabled — select the cell; cell status UI owns device copy.
                requestExploreCellSelection({ x: liveStamp.x, z: liveStamp.z });
            })
        );
        entry.actionBindings.push({ mesh, actionManager });
    }
}

/**
 * Enable authored GLB emissive (intensity 1); visible halo comes from GlowLayer.
 * @param {import('@babylonjs/core').Material | null | undefined} material
 */
function enableBuiltInEmissiveOnMaterial(material) {
    if (!material) {
        return;
    }
    if (Array.isArray(material.subMaterials)) {
        for (const sub of material.subMaterials) {
            enableBuiltInEmissiveOnMaterial(sub);
        }
        return;
    }

    const hasEmissiveTexture = Boolean(material.emissiveTexture);
    const color = material.emissiveColor;
    const hasEmissiveColor = Boolean(
        color && (color.r > 0.001 || color.g > 0.001 || color.b > 0.001)
    );
    if (!hasEmissiveTexture && !hasEmissiveColor) {
        return;
    }

    // Emissive textures are multiplied by emissiveColor — black color hides the map.
    if (hasEmissiveTexture && !hasEmissiveColor && typeof color?.set === 'function') {
        color.set(1, 1, 1);
    }
    if (typeof material.emissiveIntensity === 'number') {
        material.emissiveIntensity = STATUS_EMISSIVE_INTENSITY;
    }
    console.log(
        `[partConnectionStatus.js]: [N/A] - [enableBuiltInEmissiveOnMaterial] - materialName has a value of ${material.name}, emissiveColor has a value of ${color?.r},${color?.g},${color?.b}, emissiveIntensity has a value of ${material.emissiveIntensity}, hasEmissiveTexture has a value of ${hasEmissiveTexture}.`
    ); //This is logged to verify the GLB emissive was loaded for status meshes (GlowLayer reads this).
}

/**
 * @param {import('@babylonjs/core').TransformNode} root
 */
function enableBuiltInEmissiveOnRoot(root) {
    const meshes = root.getChildMeshes?.(false) || [];
    for (const mesh of meshes) {
        enableBuiltInEmissiveOnMaterial(mesh.material);
    }
    console.log(
        `[partConnectionStatus.js]: [N/A] - [enableBuiltInEmissiveOnRoot] - meshCount has a value of ${meshes.length}.`
    ); //This is logged when status mesh materials have their authored emissive enabled.
}

/**
 * @param {StatusEntry} entry
 * @param {object} stamp
 * @param {StatusVisualKey} visualKey
 */
function applyVisual(entry, stamp, visualKey) {
    if (entry.visualKey === visualKey && entry.entries) {
        if (boundScene) {
            syncStatusIconFx(boundScene, stamp.stampId, entry.root, visualKey);
        }
        return;
    }
    const container = templateContainers.get(visualKey);
    if (!container) {
        console.warn(
            `[partConnectionStatus.js]: [N/A] - [applyVisual] - missingTemplate has a value of ${visualKey}.`
        ); //This is logged when a status visual is requested before its GLB template is ready.
        return;
    }

    clearVisualBindings(entry);

    const entries = container.instantiateModelsToScene(
        (name) => `simnetStatus_${stamp.stampId}_${visualKey}_${name}`,
        false
    );
    for (const node of entries.rootNodes || []) {
        if (node) {
            node.parent = entry.root;
        }
    }
    entry.entries = entries;
    entry.visualKey = visualKey;
    enableBuiltInEmissiveOnRoot(entry.root);
    addStatusMeshesToGlow(entry);
    bindStatusPick(entry, stamp);
    if (boundScene) {
        syncStatusIconFx(boundScene, stamp.stampId, entry.root, visualKey);
    }
    console.log(
        `[partConnectionStatus.js]: [N/A] - [applyVisual] - stampId has a value of ${stamp.stampId}, visualKey has a value of ${visualKey}.`
    ); //This is logged when a stamp's status mesh swaps to a new play/test GLB.
}

/**
 * @param {object} stamp
 * @param {import('@babylonjs/core').TransformNode} root
 */
function positionStatusRoot(stamp, root) {
    const layout = getActiveLayout();
    const host = getHost();
    if (!layout) {
        return;
    }
    const cellSize = layout.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    root.position = new host.Vector3(
        stamp.x * cellSize + half,
        STATUS_Y_OFFSET,
        stamp.z * cellSize + half
    );
}

/**
 * @param {object} stamp
 * @returns {StatusEntry | null}
 */
function createStatusEntry(stamp) {
    if (!boundScene || !stamp?.stampId) {
        return null;
    }
    const host = getHost();
    const root = new host.TransformNode(
        `simnetStatus_${stamp.stampId}`,
        boundScene
    );
    positionStatusRoot(stamp, root);
    /** @type {StatusEntry} */
    const entry = {
        stampId: stamp.stampId,
        root,
        visualKey: null,
        entries: null,
        actionBindings: [],
        glowMeshes: [],
    };
    statusByStampId.set(stamp.stampId, entry);
    return entry;
}

/**
 * Attach (or refresh) a status mesh for one eligible stamp.
 * @param {object | null | undefined} stamp
 */
export async function attachConnectionStatusForStamp(stamp) {
    if (!boundScene || !stamp?.stampId) {
        return;
    }
    const partDef = getPartDef(stamp.partId);
    if (!shouldShowConnectionStatus(partDef)) {
        return;
    }
    await ensureTemplatesLoaded();
    if (!boundScene) {
        return;
    }

    let entry = statusByStampId.get(stamp.stampId);
    if (!entry) {
        entry = createStatusEntry(stamp);
        if (!entry) {
            return;
        }
    } else {
        positionStatusRoot(stamp, entry.root);
    }

    applyVisual(entry, stamp, resolveVisualKeyForStamp(stamp));
}

/**
 * @param {string} stampId
 */
export function detachConnectionStatusForStamp(stampId) {
    const entry = statusByStampId.get(stampId);
    if (!entry) {
        return;
    }
    clearVisualBindings(entry);
    try {
        entry.root.dispose?.(false, true);
    } catch (error) {
        console.warn(
            `[partConnectionStatus.js]: [N/A] - [detachConnectionStatusForStamp] - rootDisposeError has a value of ${error?.message || error}.`
        ); //This is logged when a status root fails to dispose after stamp removal.
    }
    statusByStampId.delete(stampId);
    console.log(
        `[partConnectionStatus.js]: [N/A] - [detachConnectionStatusForStamp] - stampId has a value of ${stampId}, remainingCount has a value of ${statusByStampId.size}.`
    ); //This is logged when a status mesh is removed with its stamp.
}

/**
 * Recompute play/test visual for one stamp (no-op if none attached).
 * @param {string} stampId
 */
export function refreshConnectionStatusForStamp(stampId) {
    const entry = statusByStampId.get(stampId);
    const stamp = getStampById(stampId);
    if (!entry || !stamp) {
        return;
    }
    applyVisual(entry, stamp, resolveVisualKeyForStamp(stamp));
}

/**
 * Refresh every attached status mesh from current cable / test state.
 */
export function refreshAllConnectionStatuses() {
    for (const stampId of statusByStampId.keys()) {
        refreshConnectionStatusForStamp(stampId);
    }
    console.log(
        `[partConnectionStatus.js]: [N/A] - [refreshAllConnectionStatuses] - statusCount has a value of ${statusByStampId.size}, testModeActive has a value of ${testModeActive}.`
    ); //This is logged when all status icons are refreshed after cables or test state change.
}

/**
 * Test result is open: reachable stamps use blue test-connected (pass or fail);
 * unreachable use red test-not-connected.
 * @param {Iterable<string>} connectedStampIds
 */
export function enterConnectionStatusTestMode(connectedStampIds) {
    testModeActive = true;
    testConnectedStampIds = new Set(connectedStampIds || []);
    refreshAllConnectionStatuses();
    console.log(
        `[partConnectionStatus.js]: [N/A] - [enterConnectionStatusTestMode] - connectedCount has a value of ${testConnectedStampIds.size}.`
    ); //This is logged when Test overlays drive status meshes to the test GLBs.
}

/**
 * Test overlays cleared — back to play connected / not-connected.
 */
export function exitConnectionStatusTestMode() {
    if (!testModeActive && testConnectedStampIds.size === 0) {
        return;
    }
    testModeActive = false;
    testConnectedStampIds = new Set();
    refreshAllConnectionStatuses();
    console.log(
        `[partConnectionStatus.js]: [N/A] - [exitConnectionStatusTestMode] - restoredPlay has a value of true.`
    ); //This is logged when Test closes and status meshes return to play GLBs.
}

/**
 * @param {number} deltaMs
 */
function tickAnimation(deltaMs) {
    const dt = Math.max(0, deltaMs) / 1000;
    animTimeSec += dt;
    const bob =
        Math.sin((animTimeSec * Math.PI * 2) / BOB_PERIOD_SEC) * BOB_AMPLITUDE;
    const yawStep = ROTATE_RAD_PER_SEC * dt;

    for (const entry of statusByStampId.values()) {
        if (!entry.root || entry.root.isDisposed?.()) {
            continue;
        }
        entry.root.rotation.y += yawStep;
        entry.root.position.y = STATUS_Y_OFFSET + bob;
    }
}

function ensureRenderLoop() {
    if (!boundScene || renderObserver) {
        return;
    }
    renderObserver = boundScene.onBeforeRenderObservable.add(() => {
        const engine = boundScene?.getEngine?.();
        const deltaMs =
            typeof engine?.getDeltaTime === 'function'
                ? engine.getDeltaTime()
                : 16.67;
        tickAnimation(deltaMs);
    });
}

/**
 * Load status GLBs and attach icons for every eligible stamped interactable.
 * @param {import('@babylonjs/core').Scene} scene
 */
export async function initializePartConnectionStatus(scene) {
    disposePartConnectionStatus();
    boundScene = scene;
    animTimeSec = 0;
    testModeActive = false;
    testConnectedStampIds = new Set();

    await ensureTemplatesLoaded();
    if (!boundScene) {
        return;
    }

    const stamps = getAllStamps();
    for (const stamp of stamps) {
        await attachConnectionStatusForStamp(stamp);
    }
    ensureRenderLoop();

    console.log(
        `[partConnectionStatus.js]: [N/A] - [initializePartConnectionStatus] - statusCount has a value of ${statusByStampId.size}, stampCount has a value of ${stamps.length}, statusBeamFx has a value of true.`
    ); //This is logged when connection status meshes + Phase 3 icon beams are set up.
}

/**
 * Tear down all status meshes, observer, and cached templates.
 */
export function disposePartConnectionStatus() {
    if (boundScene && renderObserver) {
        boundScene.onBeforeRenderObservable.remove(renderObserver);
    }
    renderObserver = null;

    for (const stampId of [...statusByStampId.keys()]) {
        detachConnectionStatusForStamp(stampId);
    }
    statusByStampId.clear();

    if (statusGlowLayer && !statusGlowLayer.isDisposed?.()) {
        try {
            statusGlowLayer.dispose();
        } catch (error) {
            console.warn(
                `[partConnectionStatus.js]: [N/A] - [disposePartConnectionStatus] - glowDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when the status GlowLayer fails to dispose.
        }
    }
    statusGlowLayer = null;

    for (const container of templateContainers.values()) {
        try {
            container.dispose?.();
        } catch (error) {
            console.warn(
                `[partConnectionStatus.js]: [N/A] - [disposePartConnectionStatus] - containerDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when a cached status GLB container fails to dispose.
        }
    }
    templateContainers.clear();

    disposeAllStatusIconFx();

    testModeActive = false;
    testConnectedStampIds = new Set();
    animTimeSec = 0;
    boundScene = null;
}
