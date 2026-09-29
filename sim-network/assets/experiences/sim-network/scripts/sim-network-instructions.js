/**
 * Sim Network instructions scene (type 2d) — How to play → level-select.
 * Plays instructions-html-proof-sequence.json after mount.
 * Inits tutorial dialogue so sequence emits (event:show-dialogue) can open STEP_CONTENT.
 */

import {
    disposeTutorialDialogue,
    initTutorialDialogue,
} from './sim-network-tutorial-dialogue.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const OVERLAY_ID = 'sim-network-instructions-overlay';
const PROOF_SEQUENCE_FILE = 'instructions-enter-sequence.json';


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
        '<div class="sim-network-split__card sim-network-2d-surface opacity-0">' +
        '<img class="max-w-sm mx-auto" src="./assets/experiences/sim-network/images/sim-network-title.png" alt="SIM NETWORK" />'+
        '<h2 class="sim-network-split__title sim-network-2d-heading">Your Objective:</h2>' +
        '<h3>THE BRIEF:</h3>' +
        '<p>Our new client, "eNetworks", is setting up new offices in multiple locations.</p>' +
        '<p>As our new trainee, you are tasked with bringing internet connectivity to all company devices.</p>' +
        '<p>Each office has a different type of network and quantities of devices to connect.</p>'+
        '<p>There are 7 levels to complete, each with a different difficulty and challenge.</p>' +
        '<p>Complete each level to unlock the next.</p><BR>' +
        '<h2 class="sim-network-split__title sim-network-2d-heading">How to play:</h2>' +
        '<p>Using common networking devices, create and configure <strong>WIRED</strong>, <strong>WIRELESS</strong> and <strong>HYBRID</strong> networks to suit the office devices.</p>' +
        '<ol class="list-decimal pl-5 space-y-2 sim-network-flow-overlay__list">' +
        '<li>Use the left menu to select and place network devices on the grid.</li>' +
        '<li>Use <strong>cables</strong> to connect <strong>wired/LAN</strong> network devices.</li>' +
        '<li>Use <strong>wireless</strong> devices to connect <strong>WIFI</strong> network devices.</li>' +
        '<li>Select <strong>Test Connection</strong> to verify the status of the network at anytime.</li>' +
        '<li>Training, tips and tricks will be made available as you progress through each of the 7 levels.</li>' +
        '<li>Select the </strong>Help</strong> button, bottom left at anytime if you get stuck.</li>' +
        '</ol>'+    
        '<button type="button" class="btn btn-primary btn-lg sim-network-split__cta btn-ping" data-action="continue">Next</button>' +
        '</div>' +
        '</div>';

    overlayEl.appendChild(backdrop);
    overlayEl.appendChild(contentEl);
    root.appendChild(overlayEl);

    const continueBtn = contentEl.querySelector('[data-action="continue"]');
    continueBtn?.addEventListener('click', () => {
        console.log(
            `[sim-network-instructions.js]: [N/A] - [createScene] - continueClicked has a value of true, targetSceneId has a value of 03-level-select.`
        ); //This is logged when the learner leaves instructions for level-select.
        playSfx(host, 'default-ui-click');
        playSfx(host, 'default-sys-next');
        void host.switchToScene('03-level-select');
    });
    continueBtn?.addEventListener('pointerenter', () => {
        playSfx(host, 'default-ui-hover');
    });

    console.log(
        `[sim-network-instructions.js]: [N/A] - [createScene] - sceneId has a value of ${sceneId}, overlayMounted has a value of true.`
    ); //This is logged when the instructions screen is mounted inside the player frame.

    initTutorialDialogue();

    if (typeof host.playNamedSequence === 'function') {
        const playResult = await host.playNamedSequence({
            scene,
            sceneId,
            sequenceFileName: PROOF_SEQUENCE_FILE,
        });
        console.log(
            `[sim-network-instructions.js]: [N/A] - [createScene] - proofSequenceOk has a value of ${Boolean(playResult?.ok)}, sequenceFileName has a value of ${PROOF_SEQUENCE_FILE}.`
        ); //This is logged when the HTML proof sequence is armed after the overlay exists.
    } else {
        console.warn(
            `[sim-network-instructions.js]: [N/A] - [createScene] - playNamedSequenceMissing has a value of true.`
        ); //This is logged when the host cannot play the HTML proof sequence.
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
        `[sim-network-instructions.js]: [N/A] - [dispose] - overlayRemoved has a value of true.`
    ); //This is logged when leaving the 2d instructions scene.
}
