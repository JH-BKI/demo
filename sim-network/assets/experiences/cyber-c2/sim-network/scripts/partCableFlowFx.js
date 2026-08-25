/**
 * Sim-network Test cable-flow particles — bright blue packets along cable paths.
 * Pass B: one shared ParticleSystem for all cables (conveyor, evenly spaced).
 * Timed to the Test progress bar: Wave A ~first half, Wave B ~second half, then loop.
 */

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';

/** Babylon CDN flare — soft round particle (Phase 1 prototype). */
const FLARE_TEXTURE_URL = 'https://assets.babylonjs.com/core/textures/flare.png';

/** Evenly spaced packets per cable (conveyor). */
const FLOW_PACKET_COUNT = 16;
/** Fallback speed if a path has no timed duration (world units per second). */
const FLOW_TRAVEL_SPEED_FALLBACK = 2.4;
/** 0.5 = half the timed speed (one trip takes ~2× longer). */
const FLOW_SPEED_SCALE = 0.5;
const FLOW_MIN_SIZE = 0.08;
const FLOW_MAX_SIZE = 0.12;
/** Bright cyan + additive flare for a soft self-glow look. */
const FLOW_COLOR = { r: 0.75, g: 0.95, b: 1.0, a: 1.0 };
/** How often to log FPS / particle counts while flows are active. */
const CABLE_FLOW_PERF_SAMPLE_MS = 1000;
/** Default full Test progress window (ms); Wave A/B each use half. */
const DEFAULT_PROGRESS_MS = 3000;
/** Same draw layer as Test / Cable-mode tubes so packets show through furniture. */
const FLOW_RENDER_GROUP_ON_TOP = 1;

/**
 * @typedef {{
 *   id: string,
 *   points: import('@babylonjs/core').Vector3[],
 *   cumLength: number[],
 *   totalLength: number,
 *   travelSpeed: number
 * }} CableFlowPath
 */

/**
 * Per-particle conveyor state (path index + progress 0..1).
 * WeakMap avoids Babylon overwriting direction during particle creation.
 * @type {WeakMap<object, { pathIndex: number, t: number }>}
 */
const particleStateByParticle = new WeakMap();

/** @type {CableFlowPath[]} */
let pathRegistry = [];
/**
 * Queue of spawn jobs consumed by startPositionFunction.
 * @type {Array<{ pathIndex: number, t: number }>}
 */
let seedJobs = [];
/** @type {import('@babylonjs/core').ParticleSystem | null} */
let sharedSystem = null;
/** @type {import('@babylonjs/core').Texture | null} */
let sharedFlareTexture = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let waveBTimer = null;
/** @type {ReturnType<typeof setInterval> | null} */
let perfSampleTimer = null;
/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** Scratch vector reused in update (avoid per-particle alloc). */
let scratchPos = null;

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
            'Experience host API missing particle helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @param {import('@babylonjs/core').Vector3[]} points
 * @returns {{ cumLength: number[], totalLength: number }}
 */
function buildCumulativeLengths(points) {
    /** @type {number[]} */
    const cumLength = [0];
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dz = points[i].z - points[i - 1].z;
        total += Math.sqrt(dx * dx + dy * dy + dz * dz);
        cumLength.push(total);
    }
    return { cumLength, totalLength: total };
}

/**
 * Sample a point along a polyline. t is 0..1 (wraps).
 * @param {import('@babylonjs/core').Vector3[]} points
 * @param {number[]} cumLength
 * @param {number} totalLength
 * @param {number} t
 * @param {import('@babylonjs/core').Vector3} out
 */
function samplePathAt(points, cumLength, totalLength, t, out) {
    if (!points.length) {
        out.set(0, 0, 0);
        return;
    }
    if (points.length === 1 || totalLength <= 1e-6) {
        out.copyFrom(points[0]);
        return;
    }
    let wrapped = t % 1;
    if (wrapped < 0) {
        wrapped += 1;
    }
    const target = wrapped * totalLength;
    let seg = 1;
    while (seg < cumLength.length && cumLength[seg] < target) {
        seg += 1;
    }
    if (seg >= cumLength.length) {
        out.copyFrom(points[points.length - 1]);
        return;
    }
    const prev = seg - 1;
    const segLen = cumLength[seg] - cumLength[prev];
    const localT = segLen > 1e-6 ? (target - cumLength[prev]) / segLen : 1;
    const a = points[prev];
    const b = points[seg];
    out.x = a.x + (b.x - a.x) * localT;
    out.y = a.y + (b.y - a.y) * localT;
    out.z = a.z + (b.z - a.z) * localT;
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
 * @param {{ id: string, points: import('@babylonjs/core').Vector3[] }} flow
 * @param {number} travelDurationMs One full trip along this cable should take this long.
 * @returns {CableFlowPath | null}
 */
function toCableFlowPath(flow, travelDurationMs) {
    if (!flow?.points || flow.points.length < 2) {
        return null;
    }
    const { cumLength, totalLength } = buildCumulativeLengths(flow.points);
    if (totalLength <= 1e-6) {
        return null;
    }
    const durationSec =
        typeof travelDurationMs === 'number' && travelDurationMs > 0
            ? travelDurationMs / 1000
            : 0;
    const baseSpeed =
        durationSec > 1e-6
            ? totalLength / durationSec
            : FLOW_TRAVEL_SPEED_FALLBACK;
    const travelSpeed = baseSpeed * FLOW_SPEED_SCALE;
    return {
        id: flow.id,
        points: flow.points,
        cumLength,
        totalLength,
        travelSpeed,
    };
}

/**
 * @param {number} pathIndex
 */
function enqueueConveyorSeedsForPath(pathIndex) {
    for (let i = 0; i < FLOW_PACKET_COUNT; i += 1) {
        seedJobs.push({
            pathIndex,
            t: FLOW_PACKET_COUNT > 0 ? i / FLOW_PACKET_COUNT : 0,
        });
    }
}

function stopCableFlowPerfSampling() {
    if (perfSampleTimer != null) {
        clearInterval(perfSampleTimer);
        perfSampleTimer = null;
    }
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 */
function startCableFlowPerfSampling(scene) {
    stopCableFlowPerfSampling();
    if (!scene) {
        return;
    }
    perfSampleTimer = setInterval(() => {
        if (!sharedSystem || pathRegistry.length === 0) {
            return;
        }
        const engine = scene.getEngine?.();
        const fps =
            engine && typeof engine.getFps === 'function' ? engine.getFps() : -1;
        const deltaMs =
            engine && typeof engine.getDeltaTime === 'function'
                ? engine.getDeltaTime()
                : -1;
        const activeParticles =
            typeof sharedSystem.getActiveCount === 'function'
                ? sharedSystem.getActiveCount()
                : 0;
        const fpsText = typeof fps === 'number' ? fps.toFixed(1) : String(fps);
        const deltaText =
            typeof deltaMs === 'number' ? deltaMs.toFixed(2) : String(deltaMs);
        console.log(
            `[partCableFlowFx.js]: [N/A] - [CableFlowPerf] - flowCount has a value of ${pathRegistry.length}, activeParticles has a value of ${activeParticles}, packetsPerCable has a value of ${FLOW_PACKET_COUNT}, sharedSystemCount has a value of 1, fps has a value of ${fpsText}, deltaMs has a value of ${deltaText}.`
        ); //This is logged every second while cable-flow particles run, to correlate lag with particle load / FPS.
    }, CABLE_FLOW_PERF_SAMPLE_MS);
    console.log(
        `[partCableFlowFx.js]: [N/A] - [CableFlowPerf] - samplingStarted has a value of true, intervalMs has a value of ${CABLE_FLOW_PERF_SAMPLE_MS}, mode has a value of sharedSystem.`
    ); //This is logged when CableFlow performance sampling begins.
}

/**
 * Create the single shared system sized for all planned paths.
 * @param {import('@babylonjs/core').Scene} scene
 * @param {number} totalPathCount
 */
function ensureSharedSystem(scene, totalPathCount) {
    const host = getHost();
    if (sharedSystem && !sharedSystem.isDisposed?.()) {
        return;
    }
    const capacity = Math.max(
        FLOW_PACKET_COUNT,
        totalPathCount * FLOW_PACKET_COUNT
    );
    if (!scratchPos) {
        scratchPos = new host.Vector3(0, 0, 0);
    }

    const system = new host.ParticleSystem(
        'simNetworkCableFlow_shared',
        capacity,
        scene
    );
    system.particleTexture = getFlareTexture(scene);
    system.emitter = new host.Vector3(0, 0, 0);
    system.minEmitBox = new host.Vector3(0, 0, 0);
    system.maxEmitBox = new host.Vector3(0, 0, 0);
    system.minSize = FLOW_MIN_SIZE;
    system.maxSize = FLOW_MAX_SIZE;
    system.color1 = new host.Color4(
        FLOW_COLOR.r,
        FLOW_COLOR.g,
        FLOW_COLOR.b,
        FLOW_COLOR.a
    );
    system.color2 = new host.Color4(
        FLOW_COLOR.r,
        FLOW_COLOR.g,
        FLOW_COLOR.b,
        FLOW_COLOR.a
    );
    system.colorDead = new host.Color4(
        FLOW_COLOR.r * 0.4,
        FLOW_COLOR.g * 0.4,
        FLOW_COLOR.b * 0.4,
        0
    );
    system.minLifeTime = 9999;
    system.maxLifeTime = 9999;
    system.emitRate = 0;
    system.manualEmitCount = 0;
    system.gravity = new host.Vector3(0, 0, 0);
    system.direction1 = new host.Vector3(0, 0, 0);
    system.direction2 = new host.Vector3(0, 0, 0);
    system.minEmitPower = 0;
    system.maxEmitPower = 0;
    system.updateSpeed = 0.01;
    // Flare texture needs ADD so black texels do not draw as black squares.
    system.blendMode = host.ParticleSystem.BLENDMODE_ADD;
    // Match cable x-ray: draw after scenery so packets stay visible through furniture.
    system.renderingGroupId = FLOW_RENDER_GROUP_ON_TOP;

    system.startPositionFunction = (
        _worldMatrix,
        positionToUpdate,
        particle
    ) => {
        const job = seedJobs.shift();
        const pathIndex = job?.pathIndex ?? 0;
        const t = typeof job?.t === 'number' ? job.t : 0;
        particleStateByParticle.set(particle, { pathIndex, t });
        const path = pathRegistry[pathIndex];
        if (path) {
            samplePathAt(
                path.points,
                path.cumLength,
                path.totalLength,
                t,
                scratchPos
            );
            positionToUpdate.copyFrom(scratchPos);
        } else {
            positionToUpdate.set(0, 0, 0);
        }
    };

    system.updateFunction = function updateSharedCableFlowParticles(particles) {
        const engine = scene.getEngine?.();
        const dt =
            engine && typeof engine.getDeltaTime === 'function'
                ? engine.getDeltaTime() / 1000
                : 1 / 60;

        for (let index = 0; index < particles.length; index += 1) {
            const particle = particles[index];
            let state = particleStateByParticle.get(particle);
            if (!state) {
                state = { pathIndex: 0, t: 0 };
                particleStateByParticle.set(particle, state);
            }
            const path = pathRegistry[state.pathIndex];
            if (!path || path.totalLength <= 1e-6) {
                continue;
            }
            const speed =
                typeof path.travelSpeed === 'number' && path.travelSpeed > 0
                    ? path.travelSpeed
                    : FLOW_TRAVEL_SPEED_FALLBACK;
            let t = state.t + (speed * dt) / path.totalLength;
            if (t >= 1) {
                t -= Math.floor(t);
            }
            state.t = t;
            samplePathAt(
                path.points,
                path.cumLength,
                path.totalLength,
                t,
                scratchPos
            );
            particle.position.copyFrom(scratchPos);
            particle.color.a = FLOW_COLOR.a;
            particle.age = 0;
        }
    };

    sharedSystem = system;
    system.start();
    console.log(
        `[partCableFlowFx.js]: [N/A] - [ensureSharedSystem] - capacity has a value of ${capacity}, mode has a value of sharedConveyor.`
    ); //This is logged when the single shared cable-flow particle system is created.
}

/**
 * Register paths and emit their conveyor packets into the shared system.
 * @param {Array<{ id: string, points: import('@babylonjs/core').Vector3[] }>} flows
 * @param {number} travelDurationMs
 * @returns {number} how many paths were added
 */
function addFlowsToSharedSystem(flows, travelDurationMs) {
    if (!sharedSystem || !Array.isArray(flows) || flows.length === 0) {
        return 0;
    }
    let added = 0;
    let emitCount = 0;
    for (const flow of flows) {
        const path = toCableFlowPath(flow, travelDurationMs);
        if (!path) {
            continue;
        }
        const pathIndex = pathRegistry.length;
        pathRegistry.push(path);
        enqueueConveyorSeedsForPath(pathIndex);
        emitCount += FLOW_PACKET_COUNT;
        added += 1;
        console.log(
            `[partCableFlowFx.js]: [N/A] - [addFlowsToSharedSystem] - flowId has a value of ${path.id}, totalLength has a value of ${path.totalLength.toFixed(2)}, travelSpeed has a value of ${path.travelSpeed.toFixed(2)}, packetCount has a value of ${FLOW_PACKET_COUNT}, pathIndex has a value of ${pathIndex}.`
        ); //This is logged when a cable path is registered on the shared particle system.
    }
    if (emitCount > 0) {
        sharedSystem.manualEmitCount = emitCount;
    }
    return added;
}

/**
 * Stop and clear the shared cable-flow system immediately.
 */
export function stopCableFlowFx() {
    stopCableFlowPerfSampling();
    if (waveBTimer != null) {
        clearTimeout(waveBTimer);
        waveBTimer = null;
    }
    if (sharedSystem) {
        try {
            sharedSystem.stop();
            sharedSystem.reset();
            sharedSystem.dispose(false);
        } catch (error) {
            console.warn(
                `[partCableFlowFx.js]: [N/A] - [stopCableFlowFx] - disposeError has a value of ${error?.message || error}.`
            ); //This is logged when the shared cable-flow particle system fails to dispose cleanly.
        }
    }
    sharedSystem = null;
    pathRegistry = [];
    seedJobs = [];
    console.log(
        `[partCableFlowFx.js]: [N/A] - [stopCableFlowFx] - cleared has a value of true.`
    ); //This is logged when Test cable-flow particles are hard-cleared.
}

/**
 * Full teardown (scene leave / Test dispose).
 */
export function disposeCableFlowFx() {
    stopCableFlowFx();
    if (sharedFlareTexture && !sharedFlareTexture.isDisposed?.()) {
        try {
            sharedFlareTexture.dispose();
        } catch (error) {
            console.warn(
                `[partCableFlowFx.js]: [N/A] - [disposeCableFlowFx] - textureDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when the shared flare texture fails to dispose.
        }
    }
    sharedFlareTexture = null;
    scratchPos = null;
    boundScene = null;
}

/**
 * Play Wave A immediately, then Wave B after half the Test progress window.
 * Speeds are scaled so one full trip fits each half; streams keep looping after.
 *
 * @param {import('@babylonjs/core').Scene} scene
 * @param {Array<{ id: string, points: import('@babylonjs/core').Vector3[] }>} waveA
 * @param {Array<{ id: string, points: import('@babylonjs/core').Vector3[] }>} waveB
 * @param {{ progressMs?: number }} [options]
 */
export function playCableFlowWaves(scene, waveA, waveB, options = {}) {
    stopCableFlowFx();
    if (!scene) {
        return;
    }
    boundScene = scene;
    const a = Array.isArray(waveA) ? waveA : [];
    const b = Array.isArray(waveB) ? waveB : [];
    const totalPaths = a.length + b.length;
    if (totalPaths === 0) {
        return;
    }

    const progressMs =
        typeof options.progressMs === 'number' && options.progressMs > 0
            ? options.progressMs
            : DEFAULT_PROGRESS_MS;
    const waveAMs = Math.max(200, progressMs / 2);
    const waveBMs = Math.max(200, progressMs / 2);

    ensureSharedSystem(scene, totalPaths);
    addFlowsToSharedSystem(a, waveAMs);
    startCableFlowPerfSampling(scene);

    const startWaveB = () => {
        waveBTimer = null;
        const added = addFlowsToSharedSystem(b, waveBMs);
        console.log(
            `[partCableFlowFx.js]: [N/A] - [playCableFlowWaves] - waveBCount has a value of ${added}, waveBTravelMs has a value of ${waveBMs}.`
        ); //This is logged when Router→device streams are added to the shared system.
    };

    if (b.length === 0) {
        console.log(
            `[partCableFlowFx.js]: [N/A] - [playCableFlowWaves] - waveACount has a value of ${a.length}, waveBCount has a value of 0, waveATravelMs has a value of ${waveAMs}, sharedSystemCount has a value of 1.`
        ); //This is logged when only Cupboard→Router streams are active.
        return;
    }

    if (a.length === 0) {
        startWaveB();
        return;
    }

    waveBTimer = setTimeout(startWaveB, waveAMs);
    console.log(
        `[partCableFlowFx.js]: [N/A] - [playCableFlowWaves] - waveACount has a value of ${a.length}, waveBDelayMs has a value of ${waveAMs}, progressMs has a value of ${progressMs}, sharedSystemCount has a value of 1.`
    ); //This is logged when Wave A starts and Wave B is scheduled for the second half of the Test progress bar.
}
