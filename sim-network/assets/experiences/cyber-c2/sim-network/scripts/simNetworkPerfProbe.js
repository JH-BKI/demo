/**
 * Temporary sim-network perf sampler (measure only — not for ship).
 * Filter the browser console for: SimNetworkPerf
 *
 * Reads Babylon SceneInstrumentation after each frame, then logs a summary
 * about once per second. Think of it like a speedometer: we watch while you
 * idle-orbit vs hover-orbit, then compare the numbers.
 */

import { getAllStamps } from './layoutAssembler.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
/**
 * Temp kill-switch for test builds — set true to resume SimNetworkPerf sampling/logs.
 * When false, start/snapshot are no-ops (no interval, no console spam).
 */
const PERF_PROBE_ENABLED = false;
/** How often to print a summary line (ms). */
const SAMPLE_INTERVAL_MS = 1000;

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {InstanceType<import('@babylonjs/core').SceneInstrumentation> | null} */
let instrumentation = null;
/** @type {import('@babylonjs/core').Observer | null} */
let afterRenderObserver = null;
/** @type {ReturnType<typeof setInterval> | null} */
let sampleTimerId = null;
/** @type {string} */
let activeLabel = 'unlabeled';

/** Last frame samples (instrumentation counters reset each frame). */
let lastDrawCalls = 0;
let lastFrameMs = 0;
let lastRenderMs = 0;
let lastParticlesMs = 0;

/**
 * @returns {object}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (!host || typeof host.SceneInstrumentation !== 'function') {
        throw new Error(
            'Experience host API missing SceneInstrumentation. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * Count particle systems and live particles in the scene.
 * @param {import('@babylonjs/core').Scene} scene
 * @returns {{ systemCount: number, activeParticles: number }}
 */
function countParticles(scene) {
    const systems = scene.particleSystems || [];
    let activeParticles = 0;
    for (const system of systems) {
        if (typeof system?.getActiveCount === 'function') {
            activeParticles += system.getActiveCount();
        }
    }
    return {
        systemCount: systems.length,
        activeParticles,
    };
}

/**
 * @param {string} tag
 */
function logSample(tag) {
    if (!boundScene) {
        return;
    }
    const engine = boundScene.getEngine?.();
    const fps =
        engine && typeof engine.getFps === 'function' ? engine.getFps() : -1;
    const deltaMs =
        engine && typeof engine.getDeltaTime === 'function'
            ? engine.getDeltaTime()
            : -1;
    const meshCount = boundScene.meshes?.length ?? -1;
    const stampCount = getAllStamps().length;
    const { systemCount, activeParticles } = countParticles(boundScene);
    const fpsText = typeof fps === 'number' ? fps.toFixed(1) : String(fps);
    const deltaText =
        typeof deltaMs === 'number' ? deltaMs.toFixed(2) : String(deltaMs);
    const frameText =
        typeof lastFrameMs === 'number' ? lastFrameMs.toFixed(2) : String(lastFrameMs);
    const renderText =
        typeof lastRenderMs === 'number' ? lastRenderMs.toFixed(2) : String(lastRenderMs);
    const particlesText =
        typeof lastParticlesMs === 'number'
            ? lastParticlesMs.toFixed(2)
            : String(lastParticlesMs);

    console.log(
        `[simNetworkPerfProbe.js]: [N/A] - [SimNetworkPerf] - tag has a value of ${tag}, label has a value of ${activeLabel}, drawCalls has a value of ${lastDrawCalls}, frameMs has a value of ${frameText}, renderMs has a value of ${renderText}, particlesMs has a value of ${particlesText}, meshCount has a value of ${meshCount}, stampCount has a value of ${stampCount}, particleSystemCount has a value of ${systemCount}, activeParticles has a value of ${activeParticles}, fps has a value of ${fpsText}, deltaMs has a value of ${deltaText}.`
    ); //This is logged to compare idle-orbit vs hover-orbit cost (measure-only probe).
}

/**
 * Pull the latest frame counters (must run after render — counters reset each frame).
 */
function captureLastFrameCounters() {
    if (!instrumentation) {
        return;
    }
    lastDrawCalls = instrumentation.drawCallsCounter?.current ?? 0;
    lastFrameMs = instrumentation.frameTimeCounter?.current ?? 0;
    lastRenderMs = instrumentation.renderTimeCounter?.current ?? 0;
    lastParticlesMs = instrumentation.particlesRenderTimeCounter?.current ?? 0;
}

/**
 * Start (or restart) periodic sampling for the active play scene.
 * @param {import('@babylonjs/core').Scene} scene
 * @param {{ label?: string }} [options]
 */
export function startSimNetworkPerfProbe(scene, options = {}) {
    stopSimNetworkPerfProbe();
    if (!PERF_PROBE_ENABLED) {
        return;
    }
    if (!scene) {
        console.warn(
            `[simNetworkPerfProbe.js]: [N/A] - [startSimNetworkPerfProbe] - sceneMissing has a value of true.`
        ); //This is logged when the probe cannot start without a scene.
        return;
    }

    const host = getHost();
    boundScene = scene;
    activeLabel =
        typeof options.label === 'string' && options.label.trim()
            ? options.label.trim()
            : 'unlabeled';

    instrumentation = new host.SceneInstrumentation(scene);
    instrumentation.captureFrameTime = true;
    instrumentation.captureRenderTime = true;
    instrumentation.captureParticlesRenderTime = true;

    afterRenderObserver = scene.onAfterRenderObservable.add(() => {
        captureLastFrameCounters();
    });

    sampleTimerId = setInterval(() => {
        logSample('interval');
    }, SAMPLE_INTERVAL_MS);

    console.log(
        `[simNetworkPerfProbe.js]: [N/A] - [startSimNetworkPerfProbe] - label has a value of ${activeLabel}, sampleIntervalMs has a value of ${SAMPLE_INTERVAL_MS}.`
    ); //This is logged when the temporary SimNetworkPerf sampler starts.
    // One immediate line so the designer sees the probe is alive before the first interval.
    logSample('start');
}

/**
 * Log one snapshot now (e.g. on phase change). Safe if probe is not running.
 * @param {string} [tag='snapshot']
 */
export function snapshotSimNetworkPerfProbe(tag = 'snapshot') {
    if (!PERF_PROBE_ENABLED || !boundScene || !instrumentation) {
        return;
    }
    captureLastFrameCounters();
    logSample(tag);
}

/**
 * Stop sampling and dispose instrumentation.
 */
export function stopSimNetworkPerfProbe() {
    if (sampleTimerId != null) {
        clearInterval(sampleTimerId);
        sampleTimerId = null;
    }
    if (boundScene && afterRenderObserver) {
        boundScene.onAfterRenderObservable.remove(afterRenderObserver);
    }
    afterRenderObserver = null;
    if (instrumentation) {
        try {
            instrumentation.dispose?.();
        } catch (error) {
            console.warn(
                `[simNetworkPerfProbe.js]: [N/A] - [stopSimNetworkPerfProbe] - disposeError has a value of ${error?.message || error}.`
            ); //This is logged when SceneInstrumentation dispose fails during probe stop.
        }
        instrumentation = null;
    }
    if (boundScene) {
        console.log(
            `[simNetworkPerfProbe.js]: [N/A] - [stopSimNetworkPerfProbe] - label has a value of ${activeLabel}, stopped has a value of true.`
        ); //This is logged when the temporary SimNetworkPerf sampler stops.
    }
    boundScene = null;
    activeLabel = 'unlabeled';
    lastDrawCalls = 0;
    lastFrameMs = 0;
    lastRenderMs = 0;
    lastParticlesMs = 0;
}
