/**
 * Sim Network complete scene (type 2d) — all tracks done; Play again → level-select.
 * Phase 5.5: plays complete-enter-placeholder-sequence.json after mount.
 */

import { resetSimNetworkSession } from './simNetworkSession.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const OVERLAY_ID = 'sim-network-complete-overlay';
const ENTER_SEQUENCE_FILE = 'complete-enter-placeholder-sequence.json';

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
 * @param {import('@babylonjs/core').Scene} scene
 * @param {string} sceneId
 */
export async function createScene(scene, sceneId) {
    const host = getHost();
    const root = host.getPlayerUiRoot();

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
        '<div class="sim-network-flow-overlay__panel sim-network-flow-overlay__panel--complete">' +
        '<h1 class="sim-network-flow-overlay__title">Congratulations!</h1>' +
        '<p class="sim-network-flow-overlay__lead">You completed every difficulty track.</p>' +
        '<button type="button" class="btn btn-primary btn-lg sim-network-flow-overlay__cta" data-action="play-again">Play again</button>' +
        '</div>';

    overlayEl.appendChild(backdrop);
    overlayEl.appendChild(contentEl);
    root.appendChild(overlayEl);

    const playAgainBtn = contentEl.querySelector('[data-action="play-again"]');
    playAgainBtn?.addEventListener('click', () => {
        console.log(
            `[sim-network-complete.js]: [N/A] - [createScene] - playAgainClicked has a value of true, targetSceneId has a value of 03-level-select.`
        ); //This is logged when Play again clears progress and returns to level-select.
        playSfx(host, 'default-ui-click');
        playSfx(host, 'default-sys-next');
        resetSimNetworkSession();
        void host.switchToScene('03-level-select');
    });
    playAgainBtn?.addEventListener('pointerenter', () => {
        playSfx(host, 'default-ui-hover');
    });

    console.log(
        `[sim-network-complete.js]: [N/A] - [createScene] - sceneId has a value of ${sceneId}, overlayMounted has a value of true.`
    ); //This is logged when the complete 2d scene mounts.

    if (typeof host.playNamedSequence === 'function') {
        const playResult = await host.playNamedSequence({
            scene,
            sceneId,
            sequenceFileName: ENTER_SEQUENCE_FILE,
        });
        console.log(
            `[sim-network-complete.js]: [N/A] - [createScene] - enterSequenceOk has a value of ${Boolean(playResult?.ok)}, sequenceFileName has a value of ${ENTER_SEQUENCE_FILE}.`
        ); //This is logged when the complete enter placeholder sequence is armed after the overlay exists.
    } else {
        console.warn(
            `[sim-network-complete.js]: [N/A] - [createScene] - playNamedSequenceMissing has a value of true.`
        ); //This is logged when the host cannot play the complete enter sequence.
    }
}

export function dispose() {
    const host = globalThis[HOST_KEY];
    if (host && typeof host.disposeActiveSequence === 'function') {
        host.disposeActiveSequence();
    }
    if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
    }
    console.log(
        `[sim-network-complete.js]: [N/A] - [dispose] - overlayRemoved has a value of true.`
    ); //This is logged when leaving the complete scene.
}
