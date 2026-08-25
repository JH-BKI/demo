/**
 * Sim-network in-scene UX flow.
 * StateManager screens: splash → instructions → levelSelect → play → complete.
 * Play maps are driven by layouts-index.json difficulties[].maps[] (session progress only).
 */

import { assembleLayout, disposeLayout } from './layoutAssembler.js';
import {
    disposePartInteraction,
    initializePartInteraction,
} from './partInteraction.js';
import { disposePartDrop, initializePartDrop } from './partDrop.js';
import {
    disposePartCables,
    disposePartNetworkTest,
    EVENT_SIM_NETWORK_TEST_FLOW,
    initializePartCables,
    initializePartNetworkTest,
} from './partCables.js';
import {
    disposePartCellInspector,
    initializePartCellInspector,
} from './partCellInspector.js';
import {
    disposePartCellHighlight,
    initializePartCellHighlight,
} from './partCellHighlight.js';
import { disposePartCamera, initializePartCamera } from './partCamera.js';
import {
    disposePartConnectionStatus,
    initializePartConnectionStatus,
} from './partConnectionStatus.js';
import {
    createSequenceTargets,
    disposeSequenceTargets,
} from './simNetworkSequenceTargets.js';
import {
    disposeTutorialStepContent,
    hideTutorialStepContent,
    initTutorialStepContent,
    showTutorialStepContent,
} from './sim-network-tutorial-step-content.js';
import {
    disposeTutorialCoach,
    initTutorialCoach,
} from './sim-network-tutorial-coach.js';
import {
    snapshotSimNetworkPerfProbe,
    startSimNetworkPerfProbe,
    stopSimNetworkPerfProbe,
} from './simNetworkPerfProbe.js';
import { createSimNetworkScreens } from './simNetworkScreens.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const LAYOUTS_INDEX_URL =
    './assets/experiences/cyber-c2/sim-network/layouts/layouts-index.json';

/** @typedef {'splash' | 'instructions' | 'levelSelect' | 'play' | 'complete'} SimNetworkScreenState */
/** @typedef {{ id: string, kind: 'tutorial' | 'level' | string, title: string, url: string, description?: string, sequenceFileName?: string }} SimNetworkMapEntry */
/** @typedef {{ id: string, title: string, sortOrder: number, maps: SimNetworkMapEntry[] }} SimNetworkDifficulty */

/** @type {object | null} */
let flowManager = null;
/** @type {ReturnType<typeof createSimNetworkScreens> | null} */
let screens = null;
/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {string | null} */
let boundSceneId = null;
/** @type {object | null} */
let catalog = null;
/** @type {SimNetworkDifficulty[]} */
let difficulties = [];
/** @type {SimNetworkMapEntry | null} */
let activeMap = null;
/** @type {boolean} */
let playActive = false;
/** @type {((event: Event) => void) | null} */
let testFlowListener = null;
/** @type {((info: { ready: boolean }) => void) | null} */
let flowReadyResolve = null;
/** @type {boolean} */
let flowReadySignalled = false;

/** @type {{ selectedDifficultyId: string | null, mapIndex: number, completedDifficulties: Set<string> }} */
const session = {
    selectedDifficultyId: null,
    mapIndex: 0,
    completedDifficulties: new Set(),
};

/**
 * @returns {{
 *   StateManager: new (initialState: string) => object,
 *   getPlayerUiRoot: () => HTMLElement,
 *   playNamedSequence?: Function,
 *   disposeActiveSequence?: Function
 * }}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (!host || typeof host.StateManager !== 'function' || typeof host.getPlayerUiRoot !== 'function') {
        throw new Error(
            'Experience host API missing StateManager or getPlayerUiRoot. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @param {boolean} visible
 */
function setCanvasVisible(visible) {
    const canvas = document.getElementById('renderCanvas');
    if (!canvas) {
        return;
    }
    canvas.classList.toggle('sim-network-canvas-hidden', !visible);
    console.log(
        `[simNetworkFlow.js]: [N/A] - [setCanvasVisible] - visible has a value of ${visible}.`
    ); //This is logged when HTML screens hide or show the Babylon canvas.
}

/**
 * @param {string} url
 * @returns {Promise<object>}
 */
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

/**
 * @param {object} mapDoc
 * @param {object} catalogDoc
 * @returns {object}
 */
function joinCatalogAndMap(mapDoc, catalogDoc) {
    const parts = Array.isArray(catalogDoc?.parts) ? catalogDoc.parts : [];
    return { ...mapDoc, parts };
}

/**
 * @param {object} indexDoc
 * @returns {SimNetworkDifficulty[]}
 */
function parseDifficulties(indexDoc) {
    const list = Array.isArray(indexDoc?.difficulties) ? indexDoc.difficulties : [];
    return list
        .filter((entry) => entry && typeof entry.id === 'string' && entry.id)
        .map((entry) => {
            const maps = Array.isArray(entry.maps)
                ? entry.maps.filter(
                      (map) =>
                          map &&
                          typeof map.id === 'string' &&
                          typeof map.url === 'string' &&
                          typeof map.kind === 'string'
                  )
                : [];
            return {
                id: entry.id,
                title: typeof entry.title === 'string' ? entry.title : entry.id,
                sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : 99,
                maps,
            };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * @returns {SimNetworkDifficulty[]}
 */
function getSortedDifficulties() {
    return [...difficulties].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * @param {string} difficultyId
 * @returns {boolean}
 */
function isDifficultyUnlocked(difficultyId) {
    const sorted = getSortedDifficulties();
    const index = sorted.findIndex((entry) => entry.id === difficultyId);
    if (index <= 0) {
        return index === 0;
    }
    for (let i = 0; i < index; i += 1) {
        if (!session.completedDifficulties.has(sorted[i].id)) {
            return false;
        }
    }
    return true;
}

/**
 * @returns {boolean}
 */
function allDifficultiesComplete() {
    const sorted = getSortedDifficulties();
    return sorted.length > 0 && sorted.every((entry) => session.completedDifficulties.has(entry.id));
}

/**
 * @returns {SimNetworkDifficulty | null}
 */
function getSelectedDifficulty() {
    if (!session.selectedDifficultyId) {
        return null;
    }
    return difficulties.find((entry) => entry.id === session.selectedDifficultyId) || null;
}

/**
 * @returns {SimNetworkMapEntry | null}
 */
function getCurrentMapEntry() {
    const difficulty = getSelectedDifficulty();
    if (!difficulty) {
        return null;
    }
    return difficulty.maps[session.mapIndex] || null;
}

/**
 * @returns {boolean}
 */
function isLastMapInTrack() {
    const difficulty = getSelectedDifficulty();
    if (!difficulty || difficulty.maps.length === 0) {
        return true;
    }
    return session.mapIndex >= difficulty.maps.length - 1;
}

function signalFlowReady() {
    if (flowReadySignalled) {
        return;
    }
    flowReadySignalled = true;
    const resolve = flowReadyResolve;
    flowReadyResolve = null;
    console.log(
        `[simNetworkFlow.js]: [N/A] - [signalFlowReady] - ready has a value of true.`
    ); //This is logged when createScene may finish after the splash screen is up.
    resolve?.({ ready: true });
}

function disposeStageSequence() {
    const host = globalThis[HOST_KEY];
    if (typeof host?.disposeActiveSequence === 'function') {
        host.disposeActiveSequence();
    }
}

/**
 * @param {SimNetworkMapEntry} entry
 * @returns {Promise<void>}
 */
async function playMapSequenceIfConfigured(entry) {
    const sequenceFileName =
        typeof entry?.sequenceFileName === 'string' ? entry.sequenceFileName.trim() : '';
    if (!sequenceFileName || !boundScene || !boundSceneId) {
        return;
    }
    const host = getHost();
    if (typeof host.playNamedSequence !== 'function') {
        return;
    }
    await host.playNamedSequence({
        scene: boundScene,
        sceneId: boundSceneId,
        sequenceFileName,
    });
}

function unbindTestFlowListener() {
    if (testFlowListener) {
        window.removeEventListener(EVENT_SIM_NETWORK_TEST_FLOW, testFlowListener);
        testFlowListener = null;
    }
}

function bindTestFlowListener() {
    unbindTestFlowListener();
    testFlowListener = (event) => {
        const action = /** @type {CustomEvent} */ (event).detail?.action;
        console.log(
            `[simNetworkFlow.js]: [N/A] - [testFlowListener] - action has a value of ${action}, mapIndex has a value of ${session.mapIndex}, difficultyId has a value of ${session.selectedDifficultyId}.`
        ); //This is logged when the Test dialog asks the flow to retry or continue.

        if (action === 'retry') {
            void flowManager?.restart();
            return;
        }

        if (action === 'continue') {
            if (isLastMapInTrack()) {
                if (session.selectedDifficultyId) {
                    session.completedDifficulties.add(session.selectedDifficultyId);
                }
                session.selectedDifficultyId = null;
                session.mapIndex = 0;
                void flowManager?.transitionTo(allDifficultiesComplete() ? 'complete' : 'levelSelect');
                return;
            }
            session.mapIndex += 1;
            void flowManager?.restart();
        }
    };
    window.addEventListener(EVENT_SIM_NETWORK_TEST_FLOW, testFlowListener);
}

/**
 * @param {{ clearLayout?: boolean }} [options]
 */
function teardownPlay(options = {}) {
    const clearLayout = options.clearLayout !== false;
    snapshotSimNetworkPerfProbe(`teardown:${flowManager?.getCurrentState?.() ?? 'none'}`);
    stopSimNetworkPerfProbe();
    disposeStageSequence();
    unbindTestFlowListener();
    disposeTutorialStepContent();
    disposeTutorialCoach();
    disposePartNetworkTest();
    disposePartCellInspector();
    disposePartCellHighlight();
    disposePartConnectionStatus();
    disposePartCables();
    disposePartDrop();
    disposePartInteraction();
    disposePartCamera();
    if (clearLayout) {
        disposeSequenceTargets();
        disposeLayout();
    }
    playActive = false;
    activeMap = null;
}

/**
 * @param {SimNetworkMapEntry} entry
 * @returns {Promise<void>}
 */
async function startPlay(entry) {
    if (!boundScene || !catalog || !flowManager) {
        throw new Error('simNetworkFlow startPlay requires scene, catalog, and flow manager.');
    }

    teardownPlay({ clearLayout: true });
    setCanvasVisible(true);

    const mapDoc = await fetchJson(entry.url);
    const layout = joinCatalogAndMap(mapDoc, catalog);
    activeMap = entry;
    const mapKind = entry.kind === 'tutorial' ? 'tutorial' : 'level';

    console.log(
        `[simNetworkFlow.js]: [N/A] - [startPlay] - layoutId has a value of ${layout?.id ?? entry.id}, mapKind has a value of ${mapKind}, mapIndex has a value of ${session.mapIndex}, difficultyId has a value of ${session.selectedDifficultyId}.`
    ); //This is logged when a map is stamped for play.

    if (mapKind === 'tutorial') {
        initTutorialStepContent();
        initTutorialCoach({ stageId: entry.id, scene: boundScene });
    }

    initializePartCamera(boundScene, layout);
    const interactableRoots = await assembleLayout(boundScene, layout);
    createSequenceTargets(boundScene);
    initializePartInteraction(boundScene, interactableRoots);
    initializePartDrop(boundScene, layout);
    initializePartCables(boundScene);
    await initializePartConnectionStatus(boundScene);
    initializePartCellHighlight(boundScene, layout);
    initializePartCellInspector(boundScene);
    initializePartNetworkTest(boundScene, { stageRole: mapKind });
    bindTestFlowListener();
    playActive = true;
    startSimNetworkPerfProbe(boundScene, {
        label: `play:${session.selectedDifficultyId}:map:${entry.id}`,
    });
}

function resetSessionProgress() {
    session.selectedDifficultyId = null;
    session.mapIndex = 0;
    session.completedDifficulties.clear();
}

function registerFlowStates() {
    if (!flowManager || !screens) {
        return;
    }

    flowManager.addState('splash', {
        onEnter: async () => {
            setCanvasVisible(false);
            teardownPlay({ clearLayout: true });
            screens.showSplash(() => {
                void flowManager?.transitionTo('instructions');
            });
        },
        onStateReady: async () => {
            signalFlowReady();
        },
        onExit: async () => {
            screens.hide();
        },
    });

    flowManager.addState('instructions', {
        onEnter: async () => {
            setCanvasVisible(false);
            screens.showInstructions(() => {
                void flowManager?.transitionTo('levelSelect');
            });
            initTutorialStepContent();
            await showTutorialStepContent('instructions');
        },
        onExit: async () => {
            await hideTutorialStepContent();
            screens.hide();
        },
    });

    flowManager.addState('levelSelect', {
        onEnter: async () => {
            setCanvasVisible(false);
            teardownPlay({ clearLayout: true });

            if (allDifficultiesComplete()) {
                await flowManager?.transitionTo('complete');
                return;
            }

            screens.showLevelSelect(
                getSortedDifficulties(),
                session.completedDifficulties,
                isDifficultyUnlocked,
                (difficultyId) => {
                    session.selectedDifficultyId = difficultyId;
                    session.mapIndex = 0;
                    void flowManager?.transitionTo('play');
                }
            );
            initTutorialStepContent();
            await showTutorialStepContent('level-select');
        },
        onExit: async () => {
            await hideTutorialStepContent();
            disposeTutorialStepContent();
            screens.hide();
        },
    });

    flowManager.addState('play', {
        onEnter: async () => {
            const entry = getCurrentMapEntry();
            if (!entry) {
                console.warn(
                    `[simNetworkFlow.js]: [N/A] - [play.onEnter] - mapMissing has a value of true, difficultyId has a value of ${session.selectedDifficultyId}, mapIndex has a value of ${session.mapIndex}.`
                ); //This is logged when the selected track has no map at the current index.
                await flowManager?.transitionTo('levelSelect');
                return;
            }
            await startPlay(entry);
        },
        onStateReady: async () => {
            const entry = getCurrentMapEntry();
            if (entry) {
                await playMapSequenceIfConfigured(entry);
            }
        },
        onExit: async () => {
            teardownPlay({ clearLayout: true });
            setCanvasVisible(false);
        },
    });

    flowManager.addState('complete', {
        onEnter: async () => {
            setCanvasVisible(false);
            teardownPlay({ clearLayout: true });
            screens.showComplete(() => {
                resetSessionProgress();
                void flowManager?.transitionTo('levelSelect');
            });
        },
        onExit: async () => {
            screens.hide();
        },
    });
}

/**
 * Boot the in-scene flow. Resolves when the splash screen is ready (createScene no longer waits for first stamp).
 * @param {import('@babylonjs/core').Scene} scene
 * @param {object} catalogDoc
 * @param {string} sceneId
 * @returns {Promise<{ ready: boolean }>}
 */
export async function startSimNetworkFlow(scene, catalogDoc, sceneId) {
    boundScene = scene;
    boundSceneId = typeof sceneId === 'string' ? sceneId : null;
    catalog = catalogDoc;
    playActive = false;
    activeMap = null;
    flowReadySignalled = false;
    flowReadyResolve = null;
    resetSessionProgress();

    const indexDoc = await fetchJson(LAYOUTS_INDEX_URL);
    difficulties = parseDifficulties(indexDoc);
    console.log(
        `[simNetworkFlow.js]: [N/A] - [startSimNetworkFlow] - sceneId has a value of ${boundSceneId}, difficultyCount has a value of ${difficulties.length}, catalogId has a value of ${catalogDoc?.id ?? 'unnamed'}.`
    ); //This is logged when the flow boots and difficulties are loaded from layouts-index.json.

    const host = getHost();
    screens = createSimNetworkScreens(host);
    flowManager = new host.StateManager('splash');
    registerFlowStates();

    const flowReadyPromise = new Promise((resolve) => {
        flowReadyResolve = resolve;
    });

    return flowReadyPromise;
}

/**
 * Full teardown when leaving the sim-network scene.
 */
export function disposeSimNetworkFlow() {
    console.log(
        `[simNetworkFlow.js]: [N/A] - [disposeSimNetworkFlow] - currentState has a value of ${flowManager?.getCurrentState?.() ?? 'none'}.`
    ); //This is logged when the scene exits and the UX flow is torn down.

    signalFlowReady();
    unbindTestFlowListener();
    teardownPlay({ clearLayout: true });
    setCanvasVisible(true);
    screens?.dispose();
    screens = null;
    flowManager = null;
    difficulties = [];
    resetSessionProgress();
    catalog = null;
    boundScene = null;
    boundSceneId = null;
}
