/**
 * Sim-network custom camera — grid-center home, cell-click focus, short press-freeze.
 * Player only. Keeps scene JSON orbit limits; panning stays off.
 * A place/cable press can freeze orbit for that gesture. A real drag releases it,
 * except a cable drag that starts on a device (that one stays frozen).
 */

import { getActiveLayout } from './layoutAssembler.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
/** Match scene camera default target Y in cyber-c2.json. */
const HOME_TARGET_Y = 0.5;
/** Huge angular sensibility ≈ no drag-rotate (wheel zoom still works). */
const LOCKED_ANGULAR_SENSIBILITY = 1e12;
const DEFAULT_LERP_MS = 1000;
const BANNER_ID = 'sim-network-camera-locked-banner';
/**
 * How far a press must move before it is a camera drag instead of a tool click.
 * Shared by the place tool and Cable-on-empty-cell. A shaky tap stays a click.
 */
export const TOOL_CAMERA_DRAG_SLOP_PX = 10;

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {import('@babylonjs/core').ArcRotateCamera | null} */
let boundCamera = null;
/** @type {{ x: number, y: number, z: number } | null} */
let homeTarget = null;
/** @type {number} */
let homeAlpha = 0;
/** @type {number} */
let homeBeta = 0;
/** @type {number} */
let homeRadius = 10;
/** Cell double-click focus radius from scene `camera.defaultFocusRadius`. */
/** @type {number} */
let focusRadius = 10;
/** @type {number} */
let lerpDurationMs = DEFAULT_LERP_MS;
/** @type {boolean} */
let locked = false;
/** @type {number | null} */
let savedAngularX = null;
/** @type {number | null} */
let savedAngularY = null;
/** @type {number} */
let lockedAlpha = 0;
/** @type {number} */
let lockedBeta = 0;
/** @type {import('@babylonjs/core').Vector3 | null} */
let lockedTarget = null;
/** @type {import('@babylonjs/core').Observer | null} */
let lockObserver = null;
/** @type {import('@babylonjs/core').Observer | null} */
let lerpObserver = null;
/** @type {HTMLElement | null} */
let bannerEl = null;
/** @type {((event: Event) => void) | null} */
let onPluginsSummary = null;
/** @type {((event: Event) => void) | null} */
let onReset3dView = null;

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.Vector3 !== 'function' ||
        typeof host.layoutCellHalfOffset !== 'function' ||
        typeof host.getPlayerUiRoot !== 'function' ||
        !host.EVENTS ||
        typeof host.dispatchAppEvent !== 'function' ||
        !host.GLOBAL_DATA ||
        !host.PointerEventTypes
    ) {
        throw new Error(
            'Experience host API missing camera helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @param {import('@babylonjs/core').Camera | null | undefined} camera
 * @returns {camera is import('@babylonjs/core').ArcRotateCamera}
 */
function isOrbitCamera(camera) {
    return Boolean(
        camera &&
            typeof camera.alpha === 'number' &&
            typeof camera.beta === 'number' &&
            typeof camera.radius === 'number' &&
            camera.target
    );
}

/**
 * @param {object} layout
 * @returns {{ x: number, y: number, z: number }}
 */
function computeGridCenterTarget(layout) {
    const cellSize = layout?.cellSize ?? 1;
    const width = layout?.width ?? 0;
    const depth = layout?.depth ?? 0;
    return {
        x: (width * cellSize) / 2,
        y: HOME_TARGET_Y,
        z: (depth * cellSize) / 2,
    };
}

/**
 * @param {{ x: number, z: number }} cell
 * @param {object} layout
 * @returns {{ x: number, y: number, z: number }}
 */
function cellWorldCenter(cell, layout) {
    const host = getHost();
    const cellSize = layout?.cellSize ?? 1;
    const half = host.layoutCellHalfOffset(cellSize);
    return {
        x: cell.x * cellSize + half,
        y: HOME_TARGET_Y,
        z: cell.z * cellSize + half,
    };
}

function ensureBanner() {
    if (bannerEl) {
        return;
    }
    const host = getHost();
    const root = host.getPlayerUiRoot();
    bannerEl = document.createElement('div');
    bannerEl.id = BANNER_ID;
    bannerEl.className = 'sim-network-camera-locked-banner';
    bannerEl.hidden = true;
    bannerEl.setAttribute('role', 'status');
    bannerEl.setAttribute('aria-live', 'polite');

    const titleEl = document.createElement('div');
    titleEl.className = 'sim-network-camera-locked-banner__title';
    titleEl.textContent = 'Camera locked';
    bannerEl.appendChild(titleEl);

    root.appendChild(bannerEl);
}

function showBanner(visible) {
    if (!visible) {
        if (bannerEl) {
            bannerEl.hidden = true;
        }
        return;
    }
    ensureBanner();
    if (bannerEl) {
        bannerEl.hidden = false;
    }
}

function cancelTargetLerp() {
    if (boundScene && lerpObserver) {
        boundScene.onBeforeRenderObservable.remove(lerpObserver);
    }
    lerpObserver = null;
}

/**
 * Soft-freeze alpha/beta/target each frame while locked; radius (zoom) stays free.
 */
function attachLockObserver() {
    if (!boundScene || lockObserver) {
        return;
    }
    lockObserver = boundScene.onBeforeRenderObservable.add(() => {
        if (!locked || !boundCamera || !lockedTarget) {
            return;
        }
        boundCamera.alpha = lockedAlpha;
        boundCamera.beta = lockedBeta;
        boundCamera.target.copyFrom(lockedTarget);
        boundCamera.inertialAlphaOffset = 0;
        boundCamera.inertialBetaOffset = 0;
        boundCamera.inertialPanningX = 0;
        boundCamera.inertialPanningY = 0;
    });
}

function detachLockObserver() {
    if (boundScene && lockObserver) {
        boundScene.onBeforeRenderObservable.remove(lockObserver);
    }
    lockObserver = null;
}

/**
 * Tell the resetView plugin to use the grid-center home bookmark.
 */
function publishResetHome() {
    if (!homeTarget) {
        return;
    }
    const host = getHost();
    host.dispatchAppEvent(host.EVENTS.SET_RESET_VIEW_HOME, {
        alpha: homeAlpha,
        beta: homeBeta,
        radius: homeRadius,
        target: [homeTarget.x, homeTarget.y, homeTarget.z],
        durationMs: lerpDurationMs,
    });
}

function registerPluginHomeSync() {
    const host = getHost();
    onPluginsSummary = (event) => {
        const detail = /** @type {{ sceneId?: string, ok?: string[] }} */ (event?.detail);
        const sceneId = host.GLOBAL_DATA.getCurrentSceneId?.();
        if (detail?.sceneId && sceneId && detail.sceneId !== sceneId) {
            return;
        }
        if (Array.isArray(detail?.ok) && !detail.ok.includes('resetView')) {
            return;
        }
        publishResetHome();
    };
    window.addEventListener(host.EVENTS.PLUGINS_SUMMARY, onPluginsSummary);

    // Reset view while locked: unlock first so the freeze observer cannot snap
    // the camera back to the pre-home pose after the home lerp finishes.
    onReset3dView = () => {
        if (!locked) {
            return;
        }
        unlockSimNetworkCamera();
    };
    window.addEventListener(host.EVENTS.RESET_3D_VIEW, onReset3dView);
}

function unregisterPluginHomeSync() {
    const host = globalThis[HOST_KEY];
    if (host?.EVENTS && onPluginsSummary) {
        window.removeEventListener(host.EVENTS.PLUGINS_SUMMARY, onPluginsSummary);
    }
    if (host?.EVENTS && onReset3dView) {
        window.removeEventListener(host.EVENTS.RESET_3D_VIEW, onReset3dView);
    }
    onPluginsSummary = null;
    onReset3dView = null;
}

/**
 * @returns {boolean}
 */
export function isSimNetworkCameraLocked() {
    return locked;
}

/**
 * Freeze orbit (alpha/beta) and target; zoom (radius) still allowed within scene limits.
 * The banner stays hidden unless `showBanner` is true. A cable drag turns it on later.
 * @param {{ showBanner?: boolean }} [options]
 */
export function lockSimNetworkCamera(options = {}) {
    if (!boundCamera) {
        return;
    }
    const host = getHost();
    if (!locked) {
        savedAngularX = boundCamera.angularSensibilityX;
        savedAngularY = boundCamera.angularSensibilityY;
        if (!lockedTarget) {
            lockedTarget = new host.Vector3(0, HOME_TARGET_Y, 0);
        }
    }
    cancelTargetLerp();
    locked = true;
    lockedAlpha = boundCamera.alpha;
    lockedBeta = boundCamera.beta;
    lockedTarget.copyFrom(boundCamera.target);
    boundCamera.angularSensibilityX = LOCKED_ANGULAR_SENSIBILITY;
    boundCamera.angularSensibilityY = LOCKED_ANGULAR_SENSIBILITY;
    boundCamera.inertialAlphaOffset = 0;
    boundCamera.inertialBetaOffset = 0;
    boundCamera.inertialPanningX = 0;
    boundCamera.inertialPanningY = 0;
    attachLockObserver();
    showBanner(options.showBanner === true);
}

/**
 * Show or hide the Camera locked banner while orbit is frozen.
 * @param {boolean} visible
 */
export function setSimNetworkCameraLockBanner(visible) {
    if (!locked) {
        showBanner(false);
        return;
    }
    showBanner(visible === true);
}

/**
 * Restore orbit drag and hide the lock banner.
 */
export function unlockSimNetworkCamera() {
    if (!boundCamera) {
        locked = false;
        showBanner(false);
        return;
    }
    locked = false;
    detachLockObserver();
    if (savedAngularX != null) {
        boundCamera.angularSensibilityX = savedAngularX;
    }
    if (savedAngularY != null) {
        boundCamera.angularSensibilityY = savedAngularY;
    }
    savedAngularX = null;
    savedAngularY = null;
    showBanner(false);
}

/**
 * Lerp camera target to a cell’s world center and radius to `defaultFocusRadius`.
 * Keep alpha/beta (isometric feel). No-op while locked.
 * @param {{ x: number, z: number }} cell
 */
export function focusSimNetworkCell(cell) {
    if (locked || !boundCamera || !boundScene || !cell) {
        return;
    }
    const activeLayout = getActiveLayout();
    if (!activeLayout) {
        console.warn(
            `[partCamera.js]: [N/A] - [focusSimNetworkCell] - layoutMissing has a value of true.`
        ); //This is logged when cell focus cannot resolve the active layout for world-center math.
        return;
    }

    const host = getHost();
    const goal = cellWorldCenter(cell, activeLayout);
    cancelTargetLerp();

    const start = boundCamera.target.clone();
    const goalVec = new host.Vector3(goal.x, goal.y, goal.z);
    const startRadius = boundCamera.radius;
    const goalRadius = focusRadius;
    const startTime = performance.now();
    const duration = lerpDurationMs;


    lerpObserver = boundScene.onBeforeRenderObservable.add(() => {
        if (!boundCamera) {
            cancelTargetLerp();
            return;
        }
        const t = Math.min(1, (performance.now() - startTime) / duration);
        const x = start.x + (goalVec.x - start.x) * t;
        const y = start.y + (goalVec.y - start.y) * t;
        const z = start.z + (goalVec.z - start.z) * t;
        // copyFrom components — do not use setTarget (would rewrite alpha/beta/radius).
        boundCamera.target.x = x;
        boundCamera.target.y = y;
        boundCamera.target.z = z;
        // Radius is distance-from-target on ArcRotateCamera; set directly so alpha/beta stay put.
        boundCamera.radius = startRadius + (goalRadius - startRadius) * t;
        if (t >= 1) {
            boundCamera.target.copyFrom(goalVec);
            boundCamera.radius = goalRadius;
            cancelTargetLerp();
        }
    });
}

/**
 * Shortest turn from one orbit angle to another, so the camera does not spin the long way.
 * @param {number} from
 * @param {number} to
 * @param {number} t
 * @returns {number}
 */
function lerpAngle(from, to, t) {
    const tau = Math.PI * 2;
    let delta = to - from;
    delta = ((delta % tau) + tau) % tau;
    if (delta > Math.PI) {
        delta -= tau;
    }
    return from + delta * t;
}

/**
 * Move to a steep overhead view of the grid centre.
 * Uses the camera's own lowest up-down angle, the saved home distance, and the saved compass direction.
 * No-op while the camera is locked. Does not press Reset view.
 */
export function focusSimNetworkOverview() {
    if (locked || !boundCamera || !boundScene || !homeTarget) {
        return;
    }
    const host = getHost();
    const goalBeta =
        typeof boundCamera.lowerBetaLimit === 'number' ? boundCamera.lowerBetaLimit : homeBeta;
    cancelTargetLerp();
    const startTarget = boundCamera.target.clone();
    const goalTarget = new host.Vector3(homeTarget.x, homeTarget.y, homeTarget.z);
    const startAlpha = boundCamera.alpha;
    const startBeta = boundCamera.beta;
    const startRadius = boundCamera.radius;
    const goalRadius = homeRadius;
    const startTime = performance.now();
    const duration = lerpDurationMs;
    boundCamera.inertialAlphaOffset = 0;
    boundCamera.inertialBetaOffset = 0;
    boundCamera.inertialRadiusOffset = 0;
    console.log(
        `[partCamera.js]: [N/A] - [focusSimNetworkOverview] - goalBeta has a value of ${goalBeta}, goalRadius has a value of ${goalRadius}.`
    ); //This is logged when the results HUD asks for the overhead camera home.
    lerpObserver = boundScene.onBeforeRenderObservable.add(() => {
        if (!boundCamera) {
            cancelTargetLerp();
            return;
        }
        const t = Math.min(1, (performance.now() - startTime) / duration);
        boundCamera.target.x = startTarget.x + (goalTarget.x - startTarget.x) * t;
        boundCamera.target.y = startTarget.y + (goalTarget.y - startTarget.y) * t;
        boundCamera.target.z = startTarget.z + (goalTarget.z - startTarget.z) * t;
        boundCamera.alpha = lerpAngle(startAlpha, homeAlpha, t);
        boundCamera.beta = startBeta + (goalBeta - startBeta) * t;
        boundCamera.radius = startRadius + (goalRadius - startRadius) * t;
        if (t >= 1) {
            boundCamera.target.copyFrom(goalTarget);
            boundCamera.alpha = homeAlpha;
            boundCamera.beta = goalBeta;
            boundCamera.radius = goalRadius;
            cancelTargetLerp();
        }
    });
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} layout
 */
export function initializePartCamera(scene, layout) {
    disposePartCamera();

    const host = getHost();
    boundScene = scene;
    const camera = scene.activeCamera;
    if (!isOrbitCamera(camera)) {
        console.warn(
            `[partCamera.js]: [N/A] - [initializePartCamera] - orbitCameraMissing has a value of true.`
        ); //This is logged when sim-network camera helpers cannot bind because there is no ArcRotateCamera.
        return;
    }
    boundCamera = camera;

    const sceneId = host.GLOBAL_DATA.getCurrentSceneId?.();
    const sceneConfig = sceneId ? host.GLOBAL_DATA.getSceneDataSingle?.(sceneId) : null;
    const cameraConfig = sceneConfig?.camera || null;
    lerpDurationMs =
        typeof cameraConfig?.lerpDurationMs === 'number' && cameraConfig.lerpDurationMs > 0
            ? cameraConfig.lerpDurationMs
            : DEFAULT_LERP_MS;

    homeTarget = computeGridCenterTarget(layout);
    homeAlpha = typeof cameraConfig?.alpha === 'number' ? cameraConfig.alpha : camera.alpha;
    homeBeta = typeof cameraConfig?.beta === 'number' ? cameraConfig.beta : camera.beta;
    homeRadius = typeof cameraConfig?.radius === 'number' ? cameraConfig.radius : camera.radius;
    focusRadius =
        typeof cameraConfig?.defaultFocusRadius === 'number' &&
        cameraConfig.defaultFocusRadius > 0
            ? cameraConfig.defaultFocusRadius
            : homeRadius;

    // Apply center look-at now; keep JSON alpha/beta/radius / limits.
    camera.target.x = homeTarget.x;
    camera.target.y = homeTarget.y;
    camera.target.z = homeTarget.z;

    ensureBanner();
    registerPluginHomeSync();
    // Early publish; PLUGINS_SUMMARY will republish after resetView seeds from JSON.
    publishResetHome();

    console.log(
        `[partCamera.js]: [N/A] - [initializePartCamera] - homeTarget has a value of ${homeTarget.x},${homeTarget.y},${homeTarget.z}, width has a value of ${layout?.width}, depth has a value of ${layout?.depth}, lerpDurationMs has a value of ${lerpDurationMs}.`
    ); //This is logged when sim-network camera boots with grid-center home.
}

/**
 * Tear down lock, lerp, banner, and listeners.
 */
export function disposePartCamera() {
    cancelTargetLerp();
    unlockSimNetworkCamera();
    detachLockObserver();
    unregisterPluginHomeSync();

    bannerEl?.remove();
    bannerEl = null;
    boundScene = null;
    boundCamera = null;
    homeTarget = null;
    lockedTarget = null;
    locked = false;
}
