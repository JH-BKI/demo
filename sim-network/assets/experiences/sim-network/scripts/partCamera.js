/**
 * Sim-network custom camera — grid-center home, cell-click focus, place/cable lock.
 * Player only. Keeps scene JSON orbit limits; panning stays off.
 */

import { getActiveLayout } from './layoutAssembler.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
/** Match scene camera default target Y in cyber-c2.json. */
const HOME_TARGET_Y = 0.5;
/** Huge angular sensibility ≈ no drag-rotate (wheel zoom still works). */
const LOCKED_ANGULAR_SENSIBILITY = 1e12;
const DEFAULT_LERP_MS = 1000;
const BANNER_ID = 'sim-network-camera-locked-banner';
/** Decent swipe before we treat a locked drag as “trying to rotate”. */
const ORBIT_DRAG_SLOP_PX = 40;
/** How long the unlock hint stays fully visible. */
const UNLOCK_HINT_HOLD_MS = 2000;
/** Fade-out duration after the hold (matches CSS). */
const UNLOCK_HINT_FADE_MS = 250;
const UNLOCK_HINT_TEXT =
    'Un-check the selected networking component to unlock the camera';

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
/** @type {HTMLElement | null} */
let unlockHintEl = null;
/** @type {import('@babylonjs/core').Observer | null} */
let unlockHintPointerObserver = null;
/** @type {{ x: number, y: number, onInteractable: boolean, hintShown: boolean } | null} */
let unlockHintDrag = null;
/** @type {number | null} */
let unlockHintHoldTimerId = null;
/** @type {number | null} */
let unlockHintFadeTimerId = null;
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

function clearUnlockHintTimers() {
    if (unlockHintHoldTimerId != null) {
        window.clearTimeout(unlockHintHoldTimerId);
        unlockHintHoldTimerId = null;
    }
    if (unlockHintFadeTimerId != null) {
        window.clearTimeout(unlockHintFadeTimerId);
        unlockHintFadeTimerId = null;
    }
}

function hideUnlockHintImmediate() {
    clearUnlockHintTimers();
    unlockHintDrag = null;
    if (unlockHintEl) {
        unlockHintEl.classList.remove('is-visible');
        unlockHintEl.hidden = true;
    }
}

/**
 * Show / restart the unlock hint (1s hold, then ~250ms fade).
 */
function showUnlockHint() {
    ensureBanner();
    if (!unlockHintEl) {
        return;
    }
    clearUnlockHintTimers();
    unlockHintEl.hidden = false;
    // Restart CSS fade if we were mid-fade: snap off then on.
    unlockHintEl.classList.remove('is-visible');
    void unlockHintEl.offsetWidth;
    unlockHintEl.classList.add('is-visible');

    unlockHintHoldTimerId = window.setTimeout(() => {
        unlockHintHoldTimerId = null;
        if (!unlockHintEl) {
            return;
        }
        unlockHintEl.classList.remove('is-visible');
        unlockHintFadeTimerId = window.setTimeout(() => {
            unlockHintFadeTimerId = null;
            if (unlockHintEl && !unlockHintEl.classList.contains('is-visible')) {
                unlockHintEl.hidden = true;
            }
        }, UNLOCK_HINT_FADE_MS);
    }, UNLOCK_HINT_HOLD_MS);

    console.log(
        `[partCamera.js]: [N/A] - [showUnlockHint] - unlockHintShown has a value of true.`
    ); //This is logged when a locked orbit-drag shows the unlock hint under Camera locked.
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

    unlockHintEl = document.createElement('div');
    unlockHintEl.className = 'sim-network-camera-locked-banner__hint';
    unlockHintEl.textContent = UNLOCK_HINT_TEXT;
    unlockHintEl.hidden = true;
    bannerEl.appendChild(unlockHintEl);

    root.appendChild(bannerEl);
}

function showBanner(visible) {
    if (!visible) {
        hideUnlockHintImmediate();
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

function attachUnlockHintPointerObserver(scene) {
    if (unlockHintPointerObserver) {
        return;
    }
    const host = getHost();
    unlockHintPointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        if (!locked) {
            unlockHintDrag = null;
            return;
        }
        const type = pointerInfo.type;

        if (type === host.PointerEventTypes.POINTERDOWN) {
            const meshPick = scene.pick(scene.pointerX, scene.pointerY);
            unlockHintDrag = {
                x: scene.pointerX,
                y: scene.pointerY,
                onInteractable: pickHitsInteractable(meshPick),
                hintShown: false,
            };
            return;
        }

        if (!unlockHintDrag) {
            return;
        }

        if (type === host.PointerEventTypes.POINTERMOVE) {
            if (unlockHintDrag.onInteractable || unlockHintDrag.hintShown) {
                return;
            }
            const dx = scene.pointerX - unlockHintDrag.x;
            const dy = scene.pointerY - unlockHintDrag.y;
            if (Math.hypot(dx, dy) < ORBIT_DRAG_SLOP_PX) {
                return;
            }
            unlockHintDrag.hintShown = true;
            showUnlockHint();
            return;
        }

        if (
            type === host.PointerEventTypes.POINTERUP ||
            type === host.PointerEventTypes.POINTERCAPTURELOST
        ) {
            // Another decent swipe after the first can restart the hint mid hold/fade.
            if (
                unlockHintDrag &&
                !unlockHintDrag.onInteractable &&
                unlockHintDrag.hintShown
            ) {
                // leave timers running; next down+drag will restart via showUnlockHint
            }
            unlockHintDrag = null;
        }
    });
}

function detachUnlockHintPointerObserver() {
    if (boundScene && unlockHintPointerObserver) {
        boundScene.onPointerObservable.remove(unlockHintPointerObserver);
    }
    unlockHintPointerObserver = null;
    unlockHintDrag = null;
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
    console.log(
        `[partCamera.js]: [N/A] - [publishResetHome] - homeTarget has a value of ${homeTarget.x},${homeTarget.y},${homeTarget.z}, lerpDurationMs has a value of ${lerpDurationMs}.`
    ); //This is logged when sim-network updates Reset view home to the grid center.
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
        console.log(
            `[partCamera.js]: [N/A] - [onReset3dView] - unlockedForReset has a value of true.`
        ); //This is logged when Reset view clears the place/cable camera lock so home can stick.
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
 */
export function lockSimNetworkCamera() {
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
    showBanner(true);
    console.log(
        `[partCamera.js]: [N/A] - [lockSimNetworkCamera] - locked has a value of true, alpha has a value of ${lockedAlpha}, beta has a value of ${lockedBeta}.`
    ); //This is logged when sim-network locks the camera for place/cable.
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
    console.log(
        `[partCamera.js]: [N/A] - [unlockSimNetworkCamera] - locked has a value of false.`
    ); //This is logged when sim-network unlocks the camera after place/cable complete or cancel.
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

    console.log(
        `[partCamera.js]: [N/A] - [focusSimNetworkCell] - cell has a value of ${cell.x},${cell.z}, goal has a value of ${goal.x},${goal.y},${goal.z}, startRadius has a value of ${startRadius}, goalRadius has a value of ${goalRadius}, durationMs has a value of ${duration}.`
    ); //This is logged when a cell double-click starts a target+radius camera focus lerp.

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
            console.log(
                `[partCamera.js]: [N/A] - [focusSimNetworkCell] - lerpComplete has a value of true, target has a value of ${boundCamera.target}, radius has a value of ${boundCamera.radius}.`
            ); //This is logged when the cell-focus target+radius lerp finishes.
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
    attachUnlockHintPointerObserver(scene);
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
    detachUnlockHintPointerObserver();
    hideUnlockHintImmediate();
    unregisterPluginHomeSync();

    bannerEl?.remove();
    bannerEl = null;
    unlockHintEl = null;
    boundScene = null;
    boundCamera = null;
    homeTarget = null;
    lockedTarget = null;
    locked = false;
}
