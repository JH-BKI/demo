/**
 * Sim-network in-game play flow (maps only).
 * HTML chrome lives in separate 2d scenes (splash / instructions / level-select / complete).
 * Session progress lives in simNetworkSession.js so it survives leaving in-game.
 */

import { assembleLayout, disposeLayout } from './layoutAssembler.js';
import {
    disposePartInteraction,
    initializePartInteraction
} from './partInteraction.js';
import { disposePartDrop, initializePartDrop } from './partDrop.js';
import {
    disposePartCables,
    disposePartNetworkTest,
    EVENT_SIM_NETWORK_TEST_FLOW,
    initializePartCables,
    initializePartNetworkTest
} from './partCables.js';
import {
    disposePartCellInspector,
    initializePartCellInspector
} from './partCellInspector.js';
import {
    disposePartCellHighlight,
    initializePartCellHighlight
} from './partCellHighlight.js';
import { disposePartCamera, initializePartCamera } from './partCamera.js';
import {
    disposePartConnectionStatus,
    initializePartConnectionStatus
} from './partConnectionStatus.js';
import {
    createSequenceTargets,
    disposeSequenceTargets
} from './simNetworkSequenceTargets.js';
import {
    disposeTutorialDialogue,
    initTutorialDialogue
} from './sim-network-tutorial-dialogue.js';
import {
    disposeTutorialCoach,
    initTutorialCoach
} from './sim-network-tutorial-coach.js';
import {
    disposeExitButton,
    initExitButton
} from './sim-network-exit-button.js';
import {
    snapshotSimNetworkPerfProbe,
    startSimNetworkPerfProbe,
    stopSimNetworkPerfProbe
} from './simNetworkPerfProbe.js';
import {
    allDifficultiesComplete,
    clearCurrentTrackSelection,
    getCurrentMapEntry,
    getSimNetworkSession,
    isLastMapInTrack,
    markMapComplete,
    parseDifficulties
} from './simNetworkSession.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const LAYOUTS_INDEX_URL =
    './assets/experiences/sim-network/layouts/layouts-index.json';

/** @type {object | null} */
let flowManager = null;
/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;
/** @type {string | null} */
let boundSceneId = null;
/** @type {object | null} */
let catalog = null;
/** @type {ReturnType<typeof parseDifficulties>} */
let difficulties = [];
/** @type {object | null} */
let activeMap = null;
/** @type {boolean} */
let playActive = false;
/** @type {((event: Event) => void) | null} */
let testFlowListener = null;
/** @type {((info: { ready: boolean }) => void) | null} */
let flowReadyResolve = null;
/** @type {boolean} */
let flowReadySignalled = false;

/**
 * @returns {{
 *   StateManager: new (initialState: string) => object,
 *   switchToScene: (sceneId: string, fadeDuration?: number) => Promise<string|null>,
 *   playNamedSequence?: Function,
 *   disposeActiveSequence?: Function,
 *   hasLoadedModelSets?: () => boolean,
 *   getActiveLayout?: () => object|null,
 *   getInteractableRoots?: () => import('@babylonjs/core').TransformNode[]
 * }}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (!host || typeof host.StateManager !== 'function' || typeof host.switchToScene !== 'function') {
        throw new Error(
            'Experience host API missing StateManager or switchToScene. Is installExperienceHostApi() running?'
        );
    }
    return host;
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

function signalFlowReady() {
    if (flowReadySignalled) {
        return;
    }
    flowReadySignalled = true;
    if (typeof flowReadyResolve === 'function') {
        flowReadyResolve({ ready: true });
        flowReadyResolve = null;
    }
}

function disposeStageSequence() {
    const host = globalThis[HOST_KEY];
    if (typeof host?.disposeActiveSequence === 'function') {
        host.disposeActiveSequence();
    }
}

/**
 * @param {object} entry
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
        sequenceFileName
    });
}

function unbindTestFlowListener() {
    if (testFlowListener) {
        window.removeEventListener(EVENT_SIM_NETWORK_TEST_FLOW, testFlowListener);
        testFlowListener = null;
    }
}

/**
 * Credit the active layout as complete for this page visit (idempotent).
 * Completed maps stay complete even if the player later EXIT mid-replay.
 */
function creditCurrentMapComplete() {
    const entry = getCurrentMapEntry(difficulties);
    if (!entry) {
        return;
    }
    markMapComplete(difficulties, entry.id);
}

function bindTestFlowListener() {
    unbindTestFlowListener();
    const session = getSimNetworkSession();
    testFlowListener = (event) => {
        const action = /** @type {CustomEvent} */ (event).detail?.action;
        console.log(
            `[simNetworkFlow.js]: [N/A] - [testFlowListener] - action has a value of ${action}, mapIndex has a value of ${session.mapIndex}, difficultyId has a value of ${session.selectedDifficultyId}.`
        ); //This is logged when the Test dialog asks the flow to retry, continue, or go back.

        if (action === 'map-passed') {
            creditCurrentMapComplete();
            return;
        }

        if (action === 'retry') {
            void flowManager?.restart();
            return;
        }

        if (action === 'go-back') {
            creditCurrentMapComplete();
            clearCurrentTrackSelection();
            console.log(
                `[simNetworkFlow.js]: [N/A] - [testFlowListener] - goBackConfirmed has a value of true, targetSceneId has a value of 03-level-select.`
            ); //This is logged when Go Back Yes returns to level-select after a pass (credit kept).
            void getHost().switchToScene('03-level-select');
            return;
        }

        if (action === 'continue') {
            creditCurrentMapComplete();
            if (isLastMapInTrack(difficulties)) {
                clearCurrentTrackSelection();
                const nextScene = allDifficultiesComplete(difficulties)
                    ? '05-complete'
                    : '03-level-select';
                console.log(
                    `[simNetworkFlow.js]: [N/A] - [testFlowListener] - trackOrAllDone has a value of true, targetSceneId has a value of ${nextScene}.`
                ); //This is logged when leaving in-game after finishing a track (or all tracks).
                void getHost().switchToScene(nextScene);
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
    disposeExitButton();
    disposeTutorialDialogue();
    disposeTutorialCoach();
    disposePartNetworkTest();
    disposePartCellInspector();
    disposePartCellHighlight();
    disposePartConnectionStatus();
    disposePartCables();
    disposePartDrop();
    disposePartInteraction();
    disposePartCamera();
    disposeSequenceTargets();
    if (clearLayout) {
        disposeLayout();
    }
    playActive = false;
    activeMap = null;
}

/**
 * @param {object} entry
 * @returns {Promise<void>}
 */
async function startPlay(entry) {
    if (!boundScene || !catalog || !flowManager) {
        throw new Error('simNetworkFlow startPlay requires scene, catalog, and flow manager.');
    }

    const session = getSimNetworkSession();

    // Always stamp the selected map. (Skip-assemble was for old in-scene HTML overlays.)
    teardownPlay({ clearLayout: true });

    activeMap = entry;
    const mapKind = entry.kind === 'tutorial' ? 'tutorial' : 'level';

    const mapDoc = await fetchJson(entry.url);
    const layout = joinCatalogAndMap(mapDoc, catalog);
    console.log(
        `[simNetworkFlow.js]: [N/A] - [startPlay] - layoutId has a value of ${layout?.id ?? entry.id}, mapKind has a value of ${mapKind}, mapIndex has a value of ${session.mapIndex}, difficultyId has a value of ${session.selectedDifficultyId}.`
    ); //This is logged when a map is stamped for play.
    const interactableRoots = await assembleLayout(boundScene, layout);

    console.log(
        `[simNetworkFlow.js]: [N/A] - [startPlay] - layoutId has a value of ${layout?.id ?? entry.id}, interactableCount has a value of ${interactableRoots.length}.`
    ); //This is logged when play systems initialize for the active map.

    if (mapKind === 'tutorial') {
        initTutorialDialogue();
        initTutorialCoach({ stageId: entry.id, scene: boundScene });
    }

    initializePartCamera(boundScene, layout);
    createSequenceTargets(boundScene);
    initializePartInteraction(boundScene, interactableRoots);
    initializePartDrop(boundScene, layout);
    initializePartCables(boundScene);
    await initializePartConnectionStatus(boundScene);
    initializePartCellHighlight(boundScene, layout);
    initializePartCellInspector(boundScene);
    initializePartNetworkTest(boundScene, { stageRole: mapKind });
    initExitButton();
    bindTestFlowListener();
    playActive = true;
    startSimNetworkPerfProbe(boundScene, {
        label: `play:${session.selectedDifficultyId}:map:${entry.id}`
    });
}

function registerPlayState() {
    if (!flowManager) {
        return;
    }

    flowManager.addState('play', {
        onEnter: async () => {
            const entry = getCurrentMapEntry(difficulties);
            if (!entry) {
                console.warn(
                    `[simNetworkFlow.js]: [N/A] - [play.onEnter] - mapMissing has a value of true, targetSceneId has a value of 03-level-select.`
                ); //This is logged when in-game opened with no selected map — bounce to level-select.
                await getHost().switchToScene('03-level-select');
                return;
            }
            await startPlay(entry);
        },
        onStateReady: async () => {
            const entry = getCurrentMapEntry(difficulties);
            if (entry) {
                await playMapSequenceIfConfigured(entry);
            }
            signalFlowReady();
        },
        onExit: async () => {
            teardownPlay({ clearLayout: true });
        }
    });
}

/**
 * Boot play-only flow. Resolves when the first map systems are ready.
 * Does not reset session (level-select sets the track before switchToScene).
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

    const indexDoc = await fetchJson(LAYOUTS_INDEX_URL);
    difficulties = parseDifficulties(indexDoc);
    const session = getSimNetworkSession();
    console.log(
        `[simNetworkFlow.js]: [N/A] - [startSimNetworkFlow] - sceneId has a value of ${boundSceneId}, difficultyCount has a value of ${difficulties.length}, selectedDifficultyId has a value of ${session.selectedDifficultyId}, mapIndex has a value of ${session.mapIndex}.`
    ); //This is logged when in-game play flow boots with session track selection.

    const host = getHost();
    flowManager = new host.StateManager('play');
    registerPlayState();

    const flowReadyPromise = new Promise((resolve) => {
        flowReadyResolve = resolve;
    });

    return flowReadyPromise;
}

/**
 * Teardown play systems when leaving in-game. Keeps session progress.
 */
export function disposeSimNetworkFlow() {
    console.log(
        `[simNetworkFlow.js]: [N/A] - [disposeSimNetworkFlow] - currentState has a value of ${flowManager?.getCurrentState?.() ?? 'none'}, playActive has a value of ${playActive}.`
    ); //This is logged when leaving in-game; session progress is intentionally kept.

    signalFlowReady();
    unbindTestFlowListener();
    teardownPlay({ clearLayout: true });
    flowManager = null;
    difficulties = [];
    catalog = null;
    boundScene = null;
    boundSceneId = null;
}
