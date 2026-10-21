/**
 * Sim Network instructions scene (type 2d) — How to play → level-select.
 * Plays instructions-enter-sequence.json after mount.
 * Inits tutorial dialogue so sequence emits (event:show-dialogue) can open STEP_CONTENT.
 *
 * UI is built inline in this file (full #uiSection HTML + backdrop). No flow-overlay helper.
 */

import {
    disposeTutorialDialogue,
    initTutorialDialogue,
} from './sim-network-tutorial-dialogue.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const SECTION_CLASS = 'sim-network-instructions-overlay';
const ITEM_STRIP_ID = 'instructions-item-strip';
const PROOF_SEQUENCE_FILE = 'instructions-enter-sequence.json';


/** @type {HTMLElement | null} */
let backdropEl = null;
/** @type {HTMLElement | null} */
let sectionEl = null;
/** Example HUD button in `#uiContainer-footer-center` (removed on dispose). */
/** @type {HTMLElement | null} */
let footerCenterBtnEl = null;

/** @type {{ html?: string, attach?: Function, dispose: Function } | null} */
let itemStrip = null;

/**
 * @returns {{
 *   getPlayerUiRoot: () => HTMLElement,
 *   getUIContainerSlot: (slot: string) => HTMLElement,
 *   switchToScene: (sceneId: string, fadeDuration?: number) => Promise<string|null>,
 *   dispatchAppEvent: (eventName: string, detail?: object|null) => void,
 *   createItemStrip: (options: object) => { html?: string, attach?: Function, dispose: Function },
 *   button: Function,
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
        typeof host.getUIContainerSlot !== 'function' ||
        typeof host.switchToScene !== 'function' ||
        typeof host.dispatchAppEvent !== 'function' ||
        typeof host.createItemStrip !== 'function' ||
        typeof host.button !== 'function' ||
        !host.EVENTS?.AUDIO_CONTROL
    ) {
        throw new Error(
            'Experience host API missing getUIContainerSlot, switchToScene, createItemStrip, button, or audio helpers. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/** Same split-card sizing as the playground item strip. */
const STRIP_CARD_CLASS = 'split-card w-md max-w-full h-[min(22rem,56dvh)] bg-base-100 shadow-sm rounded-md text-primary-content sim-network-intructions-split-card';

/**
 * How-to-play strip cards. Same markup as the playground samples.
 * @returns {string[]}
 */
function buildInstructionStripItems() {
    return [
        `<div class="${STRIP_CARD_CLASS} split-card--media-75">
            <div class="equal-split">
            <div class="split-card__media">
                    <div class="badge badge-lg badge-accent btn-circle font-bold text-2xl animate-pulse">1</div>
                    <img src="./assets/experiences/sim-network/02-instructions/images/instructions-01.png" alt="instructions-01-image" decoding="async">
                </div>
                <div class="split-card__body text-center">
                    <p class="text-lg lg:text-xl font-bold">Many sites to explore!</p>
                    <p>Test your skills over 7 job sites all with unique requirements.</p>
                </div>
            </div>
        </div>`,
        `<div class="${STRIP_CARD_CLASS} split-card--media-75">
            <div class="equal-split">
                <div class="split-card__media">
                    <div class="badge badge-lg badge-accent btn-circle font-bold text-2xl animate-pulse">2</div>
                    <img src="./assets/experiences/sim-network/02-instructions/images/instructions-02.png" alt="instructions-02-image" decoding="async">
                </div>
                <div class="split-card__body text-center">
                    <p class="text-lg lg:text-xl font-bold">Use the tools!</p>
                    <p>Use the right networking tool for the job!</p>
                </div>
            </div>
        </div>`,
        `<div class="${STRIP_CARD_CLASS} split-card--media-75">
            <div class="equal-split">
                <div class="split-card__media">
                    <div class="badge badge-lg badge-accent btn-circle font-bold text-2xl animate-pulse">3</div>
                    <img src="./assets/experiences/sim-network/02-instructions/images/instructions-03.png" alt="instructions-03-image" decoding="async">
                </div>
                <div class="split-card__body text-center">
                    <p class="text-lg lg:text-xl font-bold">Wired, wireless and hybrid!</p>
                    <p>Mix and match network types to get the job done.</p>
                </div>
            </div>
        </div>`,
        `<div class="${STRIP_CARD_CLASS} split-card--media-75">
            <div class="equal-split">
                <div class="split-card__media">
                    <div class="badge badge-lg badge-accent btn-circle font-bold text-2xl animate-pulse">4</div>
                    <img src="./assets/experiences/sim-network/02-instructions/images/instructions-04.png" alt="instructions-04-image" decoding="async">
                </div>
                <div class="split-card__body text-center">
                    <p class="text-lg lg:text-xl font-bold">Make a connection!</p>
                    <p>The job's not done until all devices are connected.</p>
                </div>
            </div>
        </div>`,
        `<div class="${STRIP_CARD_CLASS} split-card--media-75">
            <div class="equal-split">
                <div class="split-card__media">
                    <div class="badge badge-lg badge-accent btn-circle font-bold text-2xl animate-pulse">5</div>
                    <img src="./assets/experiences/sim-network/02-instructions/images/instructions-05.png" alt="Album" decoding="async">
                </div>
                <div class="split-card__body text-center">
                    <p class="text-lg lg:text-xl font-bold">Impress the trainer!</p>
                    <p>Demonstrate your networking skills and land the job.</p>
                </div>
            </div>
        </div>`
    ];
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
 * Hover and click sounds for the strip arrows and page dots.
 * One listener on the strip so rebuilt dots still play.
 * @param {{ dispatchAppEvent: Function, EVENTS: { AUDIO_CONTROL: string } }} host
 * @param {HTMLElement} stripRoot
 */
function wireItemStripSfx(host, stripRoot) {
    const controlSelector = '.item-strip__prev, .item-strip__next, .item-strip__dot';

    stripRoot.addEventListener('click', (event) => {
        const target = event.target;
        const control = target instanceof Element ? target.closest(controlSelector) : null;
        if (!control || !stripRoot.contains(control)) return;
        playSfx(host, 'default-ui-click');
    });

    stripRoot.addEventListener('pointerover', (event) => {
        const target = event.target;
        const control = target instanceof Element ? target.closest(controlSelector) : null;
        if (!control || !stripRoot.contains(control)) return;
        const from = event.relatedTarget;
        if (from instanceof Node && control.contains(from)) return;
        playSfx(host, 'default-ui-hover');
    });
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {string} sceneId
 */
export async function createScene(scene, sceneId) {
    const host = getHost();
    const rootSlot = host.getUIContainerSlot('root');
    const centerSlot = host.getUIContainerSlot('center');

    // Build strip as HTML text first, then paste into the screen string, then attach.
    itemStrip = host.createItemStrip({
        id: ITEM_STRIP_ID,
        items: buildInstructionStripItems(),
        buttonClass: 'btn-neutral',
        returnHtml: true,
    });

    backdropEl = document.createElement('div');
    backdropEl.className = 'sim-network-flow-overlay__backdrop';
    backdropEl.setAttribute('aria-hidden', 'true');
    rootSlot.appendChild(backdropEl);

    centerSlot.innerHTML = `
        <div id="uiSection" class="ui-section ${SECTION_CLASS} hidden no-header no-footer">
            <div id="uiSection-header" class="ui-section-cell">
            </div>
            <div id="uiSection-center" class="ui-section-cell">
                <p class="text-primary-content text-center text-lg lg:text-2xl font-bold px-4 py-1">Complete all client jobs and get hired!</p>
                ${itemStrip.html}
            </div>
            <div id="uiSection-footer" class="ui-section-cell">
                
            </div>
        </div>
        `;

    sectionEl = centerSlot.querySelector('#uiSection');
    const centerEl = centerSlot.querySelector('#uiSection-center');
    if (!(sectionEl instanceof HTMLElement) || !(centerEl instanceof HTMLElement)) {
        throw new Error(
            '[sim-network-instructions.js] #uiSection / #uiSection-center missing after innerHTML mount.'
        );
    }

    itemStrip.attach(centerEl);

    const stripRoot = centerEl.querySelector(`#${ITEM_STRIP_ID}`);
    if (stripRoot instanceof HTMLElement) {
        wireItemStripSfx(host, stripRoot);
    }
    console.log(
        `[sim-network-instructions.js]: [N/A] - [createScene] - itemStripSfxWired has a value of ${stripRoot instanceof HTMLElement}.`
    ); //This is logged to confirm hover and click sounds are wired on the strip arrows and dots.

    console.log(
        `[sim-network-instructions.js]: [N/A] - [createScene] - itemStripAttached has a value of true, itemStripId has a value of ${ITEM_STRIP_ID}.`
    ); //This is logged to confirm the how-to-play strip was pasted and attached.

    // HUD footer-center buttons (not #uiSection-footer). Build DOM first, then wire clicks.
    const footerCenter = host.getUIContainerSlot('footer-center');
    footerCenterBtnEl = document.createElement('div');
    footerCenterBtnEl.id = 'instructions-footer-center-actions';
    footerCenterBtnEl.innerHTML = `
        <button type="button" id="instructions-skip-dialogue" class="btn btn-neutral btn-lg lg:btn-xl btn-ping invisible" data-action="skip-dialogue">Next</button>
        <button type="button" id="instructions-continue" class="btn btn-neutral btn-lg lg:btn-xl btn-ping invisible hidden" data-action="continue-to-level-select">Continue</button>
    `;
    footerCenter.appendChild(footerCenterBtnEl);

    /** Same event the tutorial dialogue Next fires — unblocks sequence wait gate-1. */
    const DIALOGUE_01_COMPLETE_EVENT = 'event:dialogue-complete-instructions-01';

    const skipDialogueBtn = footerCenterBtnEl.querySelector('[data-action="skip-dialogue"]');
    skipDialogueBtn?.addEventListener('click', () => {
        console.log(
            `[sim-network-instructions.js]: [N/A] - [skipDialogue] - eventName has a value of ${DIALOGUE_01_COMPLETE_EVENT}.`
        ); //This is logged when the HUD Next skips dialogue and continues the enter sequence.
        playSfx(host, 'default-ui-click');
        playSfx(host, 'default-sys-next');
        host.dispatchAppEvent(DIALOGUE_01_COMPLETE_EVENT);
    });
    skipDialogueBtn?.addEventListener('pointerenter', () => {
        playSfx(host, 'default-ui-hover');
    });

    const continueToLevelBtn = footerCenterBtnEl.querySelector(
        '[data-action="continue-to-level-select"]'
    );
    continueToLevelBtn?.addEventListener('click', () => {
        console.log(
            `[sim-network-instructions.js]: [N/A] - [createScene] - continueClicked has a value of true, targetSceneId has a value of 03-level-select.`
        ); //This is logged when the learner leaves instructions for level-select.
        playSfx(host, 'default-ui-click');
        playSfx(host, 'default-sys-next');
        void host.switchToScene('03-level-select');
    });
    continueToLevelBtn?.addEventListener('pointerenter', () => {
        playSfx(host, 'default-ui-hover');
    });
    console.log(
        `[sim-network-instructions.js]: [N/A] - [createScene] - footerCenterActionsMounted has a value of true, skipWired has a value of ${Boolean(skipDialogueBtn)}, continueWired has a value of ${Boolean(continueToLevelBtn)}.`
    ); //This is logged when footer-center actions exist in the DOM and both buttons are wired.

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
    if (itemStrip) {
        itemStrip.dispose();
        itemStrip = null;
    }
    if (footerCenterBtnEl) {
        footerCenterBtnEl.remove();
        footerCenterBtnEl = null;
    }
    if (backdropEl) {
        backdropEl.remove();
        backdropEl = null;
    }
    if (sectionEl) {
        sectionEl.remove();
        sectionEl = null;
    }
    console.log(
        `[sim-network-instructions.js]: [N/A] - [dispose] - overlayRemoved has a value of true.`
    ); //This is logged when leaving the 2d instructions scene.
}
