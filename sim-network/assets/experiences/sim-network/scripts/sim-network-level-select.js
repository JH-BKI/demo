/**
 * Sim Network level-select scene (type 2d) — pick a track → in-game.
 * Plays level-select-enter-sequence.json after mount.
 * Inits tutorial dialogue so sequence emits (event:show-dialogue) can open STEP_CONTENT.
 */

import {
    allDifficultiesComplete,
    getSimNetworkSession,
    isDifficultyUnlocked,
    parseDifficulties,
    selectDifficultyTrack,
    getSortedDifficulties,
} from './simNetworkSession.js';
import {
    disposeTutorialDialogue,
    initTutorialDialogue,
} from './sim-network-tutorial-dialogue.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const OVERLAY_ID = 'sim-network-level-select-overlay';
const LAYOUTS_INDEX_URL =
    './assets/experiences/sim-network/layouts/layouts-index.json';
const LEVEL_SELECT_PHOTO_SRC =
    './assets/experiences/sim-network/images/trainer-full.jpg';
const ENTER_SEQUENCE_FILE = 'level-select-enter-sequence.json';

/** @type {HTMLElement | null} */
let overlayEl = null;

/**
 * @returns {{
 *   getPlayerUiRoot: () => HTMLElement,
 *   switchToScene: (sceneId: string, fadeDuration?: number) => Promise<string|null>,
 *   dispatchAppEvent: (eventName: string, detail?: object|null) => void,
 *   EVENTS: { AUDIO_CONTROL: string },
 *   playNamedSequence?: (options: object) => Promise<object>,
 *   disposeActiveSequence?: () => void
 * }}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.getPlayerUiRoot !== 'function' ||
        typeof host.switchToScene !== 'function' ||
        typeof host.dispatchAppEvent !== 'function' ||
        !host.EVENTS?.AUDIO_CONTROL
    ) {
        throw new Error(
            'Experience host API missing getPlayerUiRoot, switchToScene, or audio helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @param {{ dispatchAppEvent: Function, EVENTS: { AUDIO_CONTROL: string } }} host
 * @param {string} clipId
 */
function playSfx(host, clipId) {
    host.dispatchAppEvent(host.EVENTS.AUDIO_CONTROL, {
        action: 'play',
        clipId,
    });
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
 * @param {import('@babylonjs/core').Scene} scene
 * @param {string} sceneId
 */
export async function createScene(scene, sceneId) {
    const host = getHost();
    const root = host.getPlayerUiRoot();

    const indexDoc = await fetchJson(LAYOUTS_INDEX_URL);
    const difficulties = parseDifficulties(indexDoc);
    const session = getSimNetworkSession();
    const difficultyList = getSortedDifficulties(difficulties);

    if (allDifficultiesComplete(difficulties)) {
        console.log(
            `[sim-network-level-select.js]: [N/A] - [createScene] - allComplete has a value of true, targetSceneId has a value of 05-complete.`
        ); //This is logged when every track is done so level-select forwards to congratulations.
        void host.switchToScene('05-complete');
        return;
    }

    const cards = difficultyList
        .map((entry) => {
            const unlocked = isDifficultyUnlocked(difficulties, entry.id);
            const done = session.completedDifficulties.has(entry.id);
            const mapCount = Array.isArray(entry.maps) ? entry.maps.length : 0;
            const playable = unlocked && !done && mapCount > 0;
            const stateClass = done
                ? 'sim-network-flow-card--complete'
                : playable
                  ? 'sim-network-flow-card--unlocked'
                  : 'sim-network-flow-card--locked';
            const disabled = playable ? '' : 'disabled';
            const status = done
                ? 'Complete'
                : mapCount === 0
                  ? 'Coming soon'
                  : unlocked
                    ? `${mapCount} map${mapCount === 1 ? '' : 's'}`
                    : 'Locked';
            return (
                `<button type="button" class="sim-network-flow-card ${stateClass}" data-difficulty="${entry.id}" ${disabled}>` +
                `<span class="sim-network-flow-card__title">${entry.title || entry.id}</span>` +
                `<span class="sim-network-flow-card__status">${status}</span>` +
                '</button>'
            );
        })
        .join('');

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.className = 'sim-network-flow-overlay';
    overlayEl.setAttribute('role', 'region');

    const backdrop = document.createElement('div');
    backdrop.className = 'sim-network-flow-overlay__backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const contentEl = document.createElement('div');
    contentEl.className = 'sim-network-flow-overlay__content';
    contentEl.innerHTML =
        '<div class="sim-network-split">' +
        '<div class="sim-network-split__card sim-network-2d-surface">' +
        '<h1 class="sim-network-split__title sim-network-2d-heading">Choose Network Type</h1>' +
        '<p class="sim-network-split__lead sim-network-2d-lead">Complete each track in order to unlock the next.</p>' +
        `<div class="sim-network-flow-card-grid">${cards}</div>` +
        '</div>' +
        '</div>';

    overlayEl.appendChild(backdrop);
    overlayEl.appendChild(contentEl);
    root.appendChild(overlayEl);

    contentEl.querySelectorAll('[data-difficulty]').forEach((btn) => {
        btn.addEventListener('pointerenter', () => {
            if (btn.hasAttribute('disabled')) {
                return;
            }
            playSfx(host, 'default-ui-hover');
        });
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-difficulty');
            if (!id || btn.hasAttribute('disabled')) {
                return;
            }
            if (!isDifficultyUnlocked(difficulties, id) || session.completedDifficulties.has(id)) {
                return;
            }
            const entry = difficultyList.find((item) => item.id === id);
            const mapCount = Array.isArray(entry?.maps) ? entry.maps.length : 0;
            if (mapCount <= 0) {
                return;
            }
            console.log(
                `[sim-network-level-select.js]: [N/A] - [createScene] - difficultySelected has a value of ${id}, targetSceneId has a value of 04-in-game.`
            ); //This is logged when a track is chosen and play scene is opened.
            playSfx(host, 'default-ui-click');
            playSfx(host, 'default-sys-next');
            selectDifficultyTrack(id);
            void host.switchToScene('04-in-game');
        });
    });

    console.log(
        `[sim-network-level-select.js]: [N/A] - [createScene] - sceneId has a value of ${sceneId}, difficultyCount has a value of ${difficulties.length}.`
    ); //This is logged when the level-select 2d scene mounts.

    initTutorialDialogue();

    if (typeof host.playNamedSequence === 'function') {
        const playResult = await host.playNamedSequence({
            scene,
            sceneId,
            sequenceFileName: ENTER_SEQUENCE_FILE,
        });
        console.log(
            `[sim-network-level-select.js]: [N/A] - [createScene] - enterSequenceOk has a value of ${Boolean(playResult?.ok)}, sequenceFileName has a value of ${ENTER_SEQUENCE_FILE}.`
        ); //This is logged when the level-select enter placeholder sequence is armed after the overlay exists.
    } else {
        console.warn(
            `[sim-network-level-select.js]: [N/A] - [createScene] - playNamedSequenceMissing has a value of true.`
        ); //This is logged when the host cannot play the level-select enter sequence.
    }
}

export function dispose() {
    const host = globalThis[HOST_KEY];
    if (host && typeof host.disposeActiveSequence === 'function') {
        host.disposeActiveSequence();
    }
    disposeTutorialDialogue();
    if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
    }
    console.log(
        `[sim-network-level-select.js]: [N/A] - [dispose] - overlayRemoved has a value of true.`
    ); //This is logged when leaving the level-select scene.
}
