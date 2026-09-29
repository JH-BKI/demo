/**
 * Sim Network level-select scene (type 2d) — pick a layout → in-game.
 * Three difficulty columns with a vertical button per layout; daisyUI steps at the bottom.
 * Plays level-select-enter-sequence.json after mount.
 * Inits tutorial dialogue so sequence emits (event:show-dialogue) can open STEP_CONTENT.
 *
 * Temporary debug cheat: with ?debug=true|on, press C to mark all non-comingSoon
 * maps complete and refresh the board (black buttons + green ticks).
 */

import {
    getCurrentProgressMapId,
    getFlatMaps,
    getPlayableFlatMaps,
    getSortedDifficulties,
    isMapComplete,
    isMapUnlocked,
    markMapComplete,
    parseDifficulties,
    selectMap,
} from './simNetworkSession.js';
import {
    disposeTutorialDialogue,
    initTutorialDialogue,
} from './sim-network-tutorial-dialogue.js';
import {
    disposeExitButton,
    initExitButton,
} from './sim-network-exit-button.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const OVERLAY_ID = 'sim-network-level-select-overlay';
const LAYOUTS_INDEX_URL =
    './assets/experiences/sim-network/layouts/layouts-index.json';
const ENTER_SEQUENCE_FILE = 'level-select-enter-sequence.json';

/** Material lock icon — shown over comingSoon columns (WiFi / Hybrid). */
const COMING_SOON_LOCK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f" aria-hidden="true">' +
    '<path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z"/>' +
    '</svg>';

/** @type {HTMLElement | null} */
let overlayEl = null;

/** @type {((event: KeyboardEvent) => void) | null} */
let debugCompleteKeyHandler = null;

/**
 * Mirrors src/utils/debugGate.js isDebugEnabled — kept local so this experience
 * script does not import from /src (temporary cheat only).
 * @returns {boolean}
 */
function isUrlDebugEnabled() {
    try {
        const debugValue = new URLSearchParams(window.location.search).get('debug');
        return debugValue === 'true' || debugValue === 'on';
    } catch {
        return false;
    }
}

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
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {{ maps: Array<{ id: string }> }} difficulty
 * @param {string} mapId
 * @returns {number}
 */
function mapIndexAttr(difficulty, mapId) {
    const index = difficulty.maps.findIndex((map) => map.id === mapId);
    return index >= 0 ? index : 0;
}

/**
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 * @returns {string}
 */
function buildColumnsHtml(difficulties) {
    // Next level in the track (unlocked, not complete) — only this button gets btn-ping.
    const currentId = getCurrentProgressMapId(difficulties);
    return getSortedDifficulties(difficulties)
        .map((difficulty) => {
            const comingSoon = difficulty.comingSoon === true;
            const buttons = difficulty.maps
                .map((map) => {
                    const unlocked = !comingSoon && isMapUnlocked(difficulties, map.id);
                    const done = !comingSoon && isMapComplete(map.id);
                    const playable = unlocked;
                    // Completed = dark; next/unlocked incomplete = blue; locked = grey.
                    const colourClass = done
                        ? 'btn-neutral'
                        : playable
                          ? 'btn-primary'
                          : 'btn-disabled';
                    const stateClass = done
                        ? 'sim-network-map-btn--complete'
                        : playable
                          ? 'sim-network-map-btn--unlocked'
                          : 'sim-network-map-btn--locked';
                    const pingClass = map.id === currentId ? 'btn-ping' : '';
                    const disabled = playable ? '' : 'disabled';
                    const label = escapeHtml(map.title || map.id);
                    const tickHtml = done
                        ? '<span class="sim-network-map-btn__tick" aria-hidden="true">✓</span>'
                        : '';
                    return (
                        `<button type="button" class="btn ${colourClass} sim-network-map-btn ${stateClass} ${pingClass}" ` +
                        `data-difficulty="${escapeHtml(difficulty.id)}" ` +
                        `data-map-index="${mapIndexAttr(difficulty, map.id)}" ` +
                        `data-map-id="${escapeHtml(map.id)}" ${disabled}>` +
                        `<span class="sim-network-map-btn__title">${label}</span>` +
                        tickHtml +
                        '</button>'
                    );
                })
                .join('');
            const columnClass = comingSoon
                ? 'sim-network-level-column sim-network-level-column--coming-soon'
                : 'sim-network-level-column';
            const lockHtml = comingSoon
                ? `<div class="sim-network-level-column__lock" aria-hidden="true">` +
                  `<div class="sim-network-level-column__lock-inner">` +
                  COMING_SOON_LOCK_SVG +
                  `<span class="sim-network-level-column__lock-label">Coming soon!</span>` +
                  `</div>` +
                  `</div>`
                : '';
            const ariaDisabled = comingSoon ? ' aria-disabled="true"' : '';
            return (
                `<div class="${columnClass}" data-difficulty-column="${escapeHtml(difficulty.id)}"${ariaDisabled}>` +
                `<h2 class="sim-network-level-column__heading">${escapeHtml(difficulty.title || difficulty.id)}</h2>` +
                `<div class="sim-network-level-column__stack">${buttons}</div>` +
                lockHtml +
                '</div>'
            );
        })
        .join('');
}

/**
 * daisyUI steps: completed ✓, current ●, locked ?
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 * @returns {string}
 */
function buildStepsHtml(difficulties) {
    const flat = getFlatMaps(difficulties);
    const currentId = getCurrentProgressMapId(difficulties);
    const items = flat
        .map((entry) => {
            // comingSoon tracks stay locked in the steps bar until those levels ship.
            const comingSoon = entry.comingSoon === true;
            const done = !comingSoon && isMapComplete(entry.id);
            const isCurrent = !comingSoon && entry.id === currentId;
            let dataContent = '?';
            let stepClass = 'step';
            if (done) {
                // Completed = black circle + green tick (styled in CSS, not step-primary).
                dataContent = '✓';
                stepClass = 'step sim-network-level-steps__step--complete';
            } else if (isCurrent) {
                // Current = blue (matches unlocked list button).
                dataContent = '●';
                stepClass = 'step step-primary sim-network-level-steps__step--current';
            }
            const label = escapeHtml(entry.title || entry.id);
            return `<li data-content="${dataContent}" class="${stepClass}">${label}</li>`;
        })
        .join('');
    return (
        `<div class="sim-network-level-steps overflow-x-auto">` +
        `<ul class="steps steps-horizontal sim-network-level-steps__list">${items}</ul>` +
        `</div>`
    );
}

/**
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 * @returns {string}
 */
function buildBoardInnerHtml(difficulties) {
    const columnsHtml = buildColumnsHtml(difficulties);
    const stepsHtml = buildStepsHtml(difficulties);
    return (
        '<div class="sim-network-split">' +
        '<div class="sim-network-split__card sim-network-2d-surface">' +
        '<h1 class="sim-network-split__title sim-network-2d-heading">Choose Network Type:</h1>' +
        '<p class="sim-network-split__lead sim-network-2d-lead w:full mx-auto">Complete each level in order to unlock the next.</p><BR>' +
        `<div class="sim-network-level-columns">${columnsHtml}</div>` +
        '</div>' +
        '</div>' +
        stepsHtml
    );
}

/**
 * @param {HTMLElement} contentEl
 * @param {ReturnType<typeof getHost>} host
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 */
function bindMapButtons(contentEl, host, difficulties) {
    contentEl.querySelectorAll('[data-map-id]').forEach((btn) => {
        btn.addEventListener('pointerenter', () => {
            if (btn.hasAttribute('disabled')) {
                return;
            }
            playSfx(host, 'default-ui-hover');
        });
        btn.addEventListener('click', () => {
            const difficultyId = btn.getAttribute('data-difficulty');
            const mapId = btn.getAttribute('data-map-id');
            const mapIndex = Number(btn.getAttribute('data-map-index'));
            if (!difficultyId || !mapId || btn.hasAttribute('disabled')) {
                return;
            }
            if (!isMapUnlocked(difficulties, mapId)) {
                return;
            }
            console.log(
                `[sim-network-level-select.js]: [N/A] - [bindMapButtons] - mapSelected has a value of ${mapId}, difficultyId has a value of ${difficultyId}, mapIndex has a value of ${mapIndex}, targetSceneId has a value of 04-in-game.`
            ); //This is logged when a layout button is chosen and play scene is opened.
            playSfx(host, 'default-ui-click');
            playSfx(host, 'default-sys-next');
            selectMap(difficultyId, mapIndex);
            void host.switchToScene('04-in-game');
        });
    });
}

/**
 * Temporary debug: mark every non-comingSoon map complete and redraw the board.
 * @param {HTMLElement} contentEl
 * @param {ReturnType<typeof getHost>} host
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 */
function applyDebugCompleteAllPlayable(contentEl, host, difficulties) {
    const playable = getPlayableFlatMaps(difficulties);
    for (const entry of playable) {
        markMapComplete(difficulties, entry.id);
    }
    console.log(
        `[sim-network-level-select.js]: [N/A] - [applyDebugCompleteAllPlayable] - cheatApplied has a value of true, playableCount has a value of ${playable.length}.`
    ); //This is logged when the debug C key marks all playable maps complete.
    contentEl.innerHTML = buildBoardInnerHtml(difficulties);
    bindMapButtons(contentEl, host, difficulties);
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
    const difficultyList = getSortedDifficulties(difficulties);

    // Always show level-select (even when every playable map is done) so Play again
    // can return here with completions intact instead of bouncing back to 05-complete.

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.className = 'sim-network-flow-overlay';
    overlayEl.setAttribute('role', 'region');

    const backdrop = document.createElement('div');
    backdrop.className = 'sim-network-flow-overlay__backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const contentEl = document.createElement('div');
    contentEl.className = 'sim-network-flow-overlay__content sim-network-level-select-content';
    contentEl.innerHTML = buildBoardInnerHtml(difficulties);

    overlayEl.appendChild(backdrop);
    overlayEl.appendChild(contentEl);
    root.appendChild(overlayEl);

    bindMapButtons(contentEl, host, difficulties);

    if (isUrlDebugEnabled()) {
        debugCompleteKeyHandler = (event) => {
            if (event.key !== 'c' && event.key !== 'C') {
                return;
            }
            if (event.repeat) {
                return;
            }
            event.preventDefault();
            applyDebugCompleteAllPlayable(contentEl, host, difficulties);
        };
        window.addEventListener('keydown', debugCompleteKeyHandler);
        console.log(
            `[sim-network-level-select.js]: [N/A] - [createScene] - debugCheatArmed has a value of true, cheatKey has a value of C.`
        ); //This is logged when ?debug=true|on arms the temporary complete-all cheat on level-select.
    }

    console.log(
        `[sim-network-level-select.js]: [N/A] - [createScene] - sceneId has a value of ${sceneId}, difficultyCount has a value of ${difficultyList.length}, mapCount has a value of ${getFlatMaps(difficulties).length}.`
    ); //This is logged when the level-select 2d scene mounts.

    initExitButton({
        targetSceneId: '01-splash',
        title: 'Start again?',
        message: 'Are you sure you want to go back to the start?',
        clearCurrentTrack: false,
    });
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
    if (debugCompleteKeyHandler) {
        window.removeEventListener('keydown', debugCompleteKeyHandler);
        debugCompleteKeyHandler = null;
    }
    const host = globalThis[HOST_KEY];
    if (host && typeof host.disposeActiveSequence === 'function') {
        host.disposeActiveSequence();
    }
    disposeExitButton();
    disposeTutorialDialogue();
    if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
    }
    console.log(
        `[sim-network-level-select.js]: [N/A] - [dispose] - overlayRemoved has a value of true.`
    ); //This is logged when leaving the level-select scene.
}
