/**
 * Sim-network Phase 3 — tight beam particles around floating connection-status icons.
 * Only stamps that show a status GLB get FX. Colour follows the icon (purple / blue / red).
 */

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';

/** Same flare as hover / cable-flow particles. */
const FLARE_TEXTURE_URL = 'https://assets.babylonjs.com/core/textures/flare.png';

/** ~33% of hover edge density (doubled Phase 3 v1, then cut 33%). */
const STATUS_BEAM_CAPACITY = 84;
const STATUS_BEAM_EMIT_RATE = 96;
/** Tight cloud around the icon (~0.4 m across). */
const STATUS_EMIT_HALF = 0.2;
const STATUS_BEAM_SIZE = { min: 0.014, max: 0.07 };
const STATUS_SCALE_X = { min: 0.14, max: 0.95 };
const STATUS_SCALE_Y = { min: 0.9, max: 2.8 };

/** Brighter than cell-hover purple so beams read on white walls. */
const THEME_RGB = {
    purple: { r: 0.92, g: 0.35, b: 1.0 },
    blue: { r: 0.45, g: 0.78, b: 1.0 },
    red: { r: 1.0, g: 0.28, b: 0.22 },
};

/**
 * @typedef {'play-connected' | 'play-not-connected' | 'test-connected' | 'test-not-connected'} StatusVisualKey
 * @typedef {'purple' | 'blue' | 'red'} StatusFxTheme
 */

/**
 * @typedef {{
 *   system: import('@babylonjs/core').ParticleSystem,
 *   theme: StatusFxTheme,
 *   running: boolean
 * }} StatusFxSlot
 */

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {import('@babylonjs/core').Texture | null} */
let sharedFlareTexture = null;
/** @type {Map<string, StatusFxSlot>} */
const fxByStampId = new Map();

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
        typeof host.Vector3 !== 'function'
    ) {
        throw new Error(
            'Experience host API missing status-particle helpers. Is installExperienceHostApi() running?'
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
 * @param {StatusVisualKey} visualKey
 * @returns {StatusFxTheme}
 */
function themeForVisualKey(visualKey) {
    if (visualKey === 'test-connected') {
        return 'blue';
    }
    if (visualKey === 'test-not-connected') {
        return 'red';
    }
    // play-connected + play-not-connected → purple
    return 'purple';
}

/**
 * @param {object} host
 * @param {StatusFxTheme} theme
 */
function beamColors(host, theme) {
    const base = THEME_RGB[theme] || THEME_RGB.purple;
    return {
        color1: new host.Color4(
            Math.min(base.r * 1.15, 1),
            Math.min(base.g * 1.15, 1),
            Math.min(base.b * 1.15, 1),
            1
        ),
        color2: new host.Color4(
            Math.min(base.r * 0.75, 1),
            Math.min(base.g * 0.75, 1),
            Math.min(base.b * 0.75, 1),
            0.55
        ),
        colorDead: new host.Color4(base.r * 0.25, base.g * 0.25, base.b * 0.25, 0),
    };
}

/**
 * @param {import('@babylonjs/core').ParticleSystem} system
 * @param {StatusFxTheme} theme
 */
function paintBeamColors(system, theme) {
    const host = getHost();
    const colors = beamColors(host, theme);
    system.color1 = colors.color1;
    system.color2 = colors.color2;
    system.colorDead = colors.colorDead;
}

/**
 * @param {string} stampId
 * @param {import('@babylonjs/core').Scene} scene
 * @param {import('@babylonjs/core').TransformNode} emitterRoot
 * @param {StatusFxTheme} theme
 * @returns {StatusFxSlot}
 */
function createSlot(stampId, scene, emitterRoot, theme) {
    const host = getHost();
    const system = new host.ParticleSystem(
        `simNetworkStatusBeams_${stampId}`,
        STATUS_BEAM_CAPACITY,
        scene
    );
    system.particleTexture = getFlareTexture(scene);
    system.emitter = emitterRoot;
    paintBeamColors(system, theme);
    system.minSize = STATUS_BEAM_SIZE.min;
    system.maxSize = STATUS_BEAM_SIZE.max;
    system.minLifeTime = 0.35;
    system.maxLifeTime = 1.8;
    system.emitRate = STATUS_BEAM_EMIT_RATE;
    system.gravity = new host.Vector3(0, -0.12, 0);
    system.minEmitPower = 0.12;
    system.maxEmitPower = 1.1;
    system.direction1 = new host.Vector3(-0.04, 0.45, -0.04);
    system.direction2 = new host.Vector3(0.04, 1.2, 0.04);
    system.updateSpeed = 0.016;
    system.blendMode = host.ParticleSystem.BLENDMODE_ADD;
    if (host.ParticleSystem.BILLBOARDMODE_STRETCHED != null) {
        system.billboardMode = host.ParticleSystem.BILLBOARDMODE_STRETCHED;
    }
    system.minScaleX = STATUS_SCALE_X.min;
    system.maxScaleX = STATUS_SCALE_X.max;
    system.minScaleY = STATUS_SCALE_Y.min;
    system.maxScaleY = STATUS_SCALE_Y.max;
    const h = STATUS_EMIT_HALF;
    system.createBoxEmitter(
        new host.Vector3(-0.05, 0.4, -0.05),
        new host.Vector3(0.05, 1.1, 0.05),
        new host.Vector3(-h, -h * 0.5, -h),
        new host.Vector3(h, h * 0.5, h)
    );
    return { system, theme, running: false };
}

/**
 * Show or recolour beams around a status icon root.
 * @param {import('@babylonjs/core').Scene} scene
 * @param {string} stampId
 * @param {import('@babylonjs/core').TransformNode} statusRoot
 * @param {StatusVisualKey} visualKey
 */
export function syncStatusIconFx(scene, stampId, statusRoot, visualKey) {
    if (!scene || !stampId || !statusRoot || statusRoot.isDisposed?.()) {
        return;
    }
    boundScene = scene;
    const theme = themeForVisualKey(visualKey);
    let slot = fxByStampId.get(stampId);

    if (!slot) {
        slot = createSlot(stampId, scene, statusRoot, theme);
        fxByStampId.set(stampId, slot);
        slot.system.start();
        slot.running = true;
        console.log(
            `[partCellStatusFx.js]: [N/A] - [syncStatusIconFx] - stampId has a value of ${stampId}, theme has a value of ${theme}, created has a value of true.`
        ); //This is logged when status-icon beam FX are created for a stamp.
        return;
    }

    slot.system.emitter = statusRoot;
    if (slot.theme !== theme) {
        slot.theme = theme;
        paintBeamColors(slot.system, theme);
        slot.system.stop();
        slot.system.reset();
        slot.system.start();
        slot.running = true;
        console.log(
            `[partCellStatusFx.js]: [N/A] - [syncStatusIconFx] - stampId has a value of ${stampId}, theme has a value of ${theme}, recoloured has a value of true.`
        ); //This is logged when status beams switch colour with the status GLB.
        return;
    }

    if (!slot.running) {
        slot.system.start();
        slot.running = true;
    }
}

/**
 * Stop and dispose beams for one stamp.
 * @param {string} stampId
 */
export function clearStatusIconFx(stampId) {
    const slot = fxByStampId.get(stampId);
    if (!slot) {
        return;
    }
    try {
        slot.system.stop();
        slot.system.reset();
        // false = keep shared flare texture (dispose(true) was wiping every other stamp's beams).
        slot.system.dispose(false);
    } catch (error) {
        console.warn(
            `[partCellStatusFx.js]: [N/A] - [clearStatusIconFx] - disposeError has a value of ${error?.message || error}.`
        ); //This is logged when status beam disposal fails for a stamp.
    }
    fxByStampId.delete(stampId);
}

/**
 * Tear down every status beam system.
 */
export function disposeAllStatusIconFx() {
    for (const stampId of [...fxByStampId.keys()]) {
        clearStatusIconFx(stampId);
    }
    boundScene = null;
    if (sharedFlareTexture && !sharedFlareTexture.isDisposed?.()) {
        try {
            sharedFlareTexture.dispose();
        } catch {
            /* ignore */
        }
    }
    sharedFlareTexture = null;
    console.log(
        `[partCellStatusFx.js]: [N/A] - [disposeAllStatusIconFx] - cleared has a value of true.`
    ); //This is logged when all status-icon particle systems are torn down.
}
