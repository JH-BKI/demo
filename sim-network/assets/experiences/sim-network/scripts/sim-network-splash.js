/**
 * Sim Network splash scene (type 2d) — gate + START → instructions.
 * Enter show (gate → main → logo) lives in splash-enter-placeholder-sequence.json.
 * This script mounts HTML, translates any click/key into a wait-gate event, and keeps START.
 */

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const OVERLAY_ID = 'sim-network-splash-overlay';
const ENTER_SEQUENCE_FILE = 'splash-enter-sequence.json';
/** Window event the enter-sequence wait gate listens for (any click or key). */
const SPLASH_GATE_CONTINUE_EVENT = 'sim-network:splash-gate-continue';

/** @type {HTMLElement | null} */
let overlayEl = null;
/** @type {(() => void) | null} */
let clearSplashGateInput = null;
/** True after enter sequence is playing and its wait gate can hear the continue event. */
let splashSequenceReadyForGate = false;
/** True when the learner already continued before the wait gate was listening. */
let splashGateContinueRequested = false;
/**
 * True after the learner has dismissed the splash gate once this browser-tab visit.
 * Not cleared on dispose — return visits (e.g. EXIT from level-select) skip the gate card
 * but still play the title/logo enter sequence. Cleared only on full page reload.
 */
let splashGateUnlockedThisVisit = false;

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

function teardownSplashGateInput() {
    if (clearSplashGateInput) {
        clearSplashGateInput();
        clearSplashGateInput = null;
    }
    overlayEl?.classList.remove('sim-network-flow-overlay--splash-gate');
}

/**
 * Fire the wait-gate event once the enter sequence can hear it.
 * If the learner continued during sequence load, retry for a few frames —
 * the wait-gate listener is only attached after the player's first clock tick.
 */
function dispatchSplashGateContinueIfReady() {
    if (!splashSequenceReadyForGate || !splashGateContinueRequested) {
        return;
    }
    window.dispatchEvent(new CustomEvent(SPLASH_GATE_CONTINUE_EVENT));
    console.log(
        `[sim-network-splash.js]: [N/A] - [dispatchSplashGateContinueIfReady] - eventDispatched has a value of true.`
    ); //This is logged when the splash wait-gate continue event is sent to the sequence player.
}

/**
 * After a continue that happened during sequence load, keep pinging briefly so the
 * wait gate still hears us once its listener exists.
 */
function flushPendingSplashGateContinue() {
    if (!splashSequenceReadyForGate || !splashGateContinueRequested) {
        return;
    }
    let attempts = 0;
    const maxAttempts = 12;
    const ping = () => {
        window.dispatchEvent(new CustomEvent(SPLASH_GATE_CONTINUE_EVENT));
        attempts += 1;
        console.log(
            `[sim-network-splash.js]: [N/A] - [flushPendingSplashGateContinue] - attempt has a value of ${attempts}.`
        ); //This is logged while retrying the continue event until the wait gate can attach.
        if (attempts < maxAttempts) {
            window.requestAnimationFrame(ping);
        }
    };
    window.requestAnimationFrame(ping);
}

/**
 * Any click on the overlay or any key → SFX, aria reveal, then fire the wait-gate event.
 * Timeline owns the class show after that event.
 * @param {{ dispatchAppEvent: Function, EVENTS: { AUDIO_CONTROL: string } }} host
 * @param {HTMLElement} mainEl
 */
function armSplashGateInput(host, mainEl) {
    let gateDone = false;

    const onContinue = () => {
        if (gateDone) {
            return;
        }
        gateDone = true;
        splashGateContinueRequested = true;
        splashGateUnlockedThisVisit = true;
        teardownSplashGateInput();
        console.log(
            `[sim-network-splash.js]: [N/A] - [armSplashGateInput] - gateContinue has a value of true, sequenceReady has a value of ${splashSequenceReadyForGate}, splashGateUnlockedThisVisit has a value of true.`
        ); //This is logged when the learner dismisses the splash gate via click or key.
        playSfx(host, 'default-sys-next');
        mainEl.setAttribute('aria-hidden', 'false');
        dispatchSplashGateContinueIfReady();
    };

    const onKeyDown = () => {
        onContinue();
    };

    const onClick = () => {
        onContinue();
    };

    overlayEl?.classList.add('sim-network-flow-overlay--splash-gate');
    overlayEl?.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);

    clearSplashGateInput = () => {
        overlayEl?.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onKeyDown);
    };
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
        `<div class="sim-network-splash">
            <div class="sim-network-splash__gate sim-network-2d-surface is-visible" data-splash-gate>
                <div class="sim-network-splash__gate-logo"></div>
                <p class="sim-network-splash__gate-text">Press a key or click anywhere to begin...</p>
            </div>
            <div class="sim-network-splash__main sim-network-2d-surface" data-splash-main aria-hidden="true">
                <div class="sim-network-splash__hero">
                    <picture class="sim-network-splash__hero-logo" data-splash-logo>
                        <source media="(max-width: 767px) and (orientation: portrait)" srcset="./assets/experiences/sim-network/images/sim-network-title-compact.png">
                        <img src="./assets/experiences/sim-network/images/sim-network-title.png" alt="SIM NETWORK">
                    </picture>
                    <div class="sim-network-splash__strip">
                        <button type="button" class="btn btn-neutral btn-xl btn-ping sim-network-splash__cta" data-action="begin">LET'S GO!</button>
                        <p class="sim-network-splash__title sim-network-2d-heading">A gamified immersive learning experience by eWorks.</p>
                    </div>
                </div>
            </div>
        </div>`;

    overlayEl.appendChild(backdrop);
    overlayEl.appendChild(contentEl);
    root.appendChild(overlayEl);

    const mainEl = contentEl.querySelector('[data-splash-main]');
    if (!(mainEl instanceof HTMLElement)) {
        throw new Error('Splash main panel missing after mount.');
    }

    splashSequenceReadyForGate = false;
    splashGateContinueRequested = false;

    const splashRootEl = contentEl.querySelector('.sim-network-splash');
    const gateEl = contentEl.querySelector('[data-splash-gate]');
    const skipGateCard = splashGateUnlockedThisVisit === true;

    if (skipGateCard) {
        // Return visit: no touch-to-begin card; auto-release the sequence wait so title/logo still animate.
        splashGateContinueRequested = true;
        if (splashRootEl instanceof HTMLElement) {
            splashRootEl.classList.add('sim-network-splash--skip-gate');
        }
        if (gateEl instanceof HTMLElement) {
            gateEl.classList.remove('is-visible');
        }
        mainEl.setAttribute('aria-hidden', 'false');
        console.log(
            `[sim-network-splash.js]: [N/A] - [createScene] - skipGateCard has a value of true, splashGateUnlockedThisVisit has a value of true.`
        ); //This is logged when splash reopens mid-visit and skips the audio-unlock gate card.
    } else {
        armSplashGateInput(host, mainEl);
        console.log(
            `[sim-network-splash.js]: [N/A] - [createScene] - skipGateCard has a value of false, splashGateUnlockedThisVisit has a value of false.`
        ); //This is logged when splash arms the first-visit touch/key gate for audio unlock.
    }

    const beginBtn = contentEl.querySelector('[data-action="begin"]');
    beginBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        console.log(
            `[sim-network-splash.js]: [N/A] - [createScene] - beginClicked has a value of true, targetSceneId has a value of 02-instructions.`
        ); //This is logged when START leaves splash for the instructions scene.
        playSfx(host, 'default-ui-click');
        playSfx(host, 'default-sys-next');
        void host.switchToScene('02-instructions');
    });
    beginBtn?.addEventListener('pointerenter', () => {
        playSfx(host, 'default-ui-hover');
    });

    console.log(
        `[sim-network-splash.js]: [N/A] - [createScene] - sceneId has a value of ${sceneId}, overlayMounted has a value of true.`
    ); //This is logged when the splash 2d scene mounts.

    if (typeof host.playNamedSequence === 'function') {
        const playResult = await host.playNamedSequence({
            scene,
            sceneId,
            sequenceFileName: ENTER_SEQUENCE_FILE,
        });
        splashSequenceReadyForGate = Boolean(playResult?.ok);
        console.log(
            `[sim-network-splash.js]: [N/A] - [createScene] - enterSequenceOk has a value of ${Boolean(playResult?.ok)}, sequenceFileName has a value of ${ENTER_SEQUENCE_FILE}.`
        ); //This is logged when the splash enter sequence is armed after the overlay exists.
        // Sequence starts on the next frames — if the learner already continued, retry the event.
        if (splashGateContinueRequested) {
            flushPendingSplashGateContinue();
        }
    } else {
        console.warn(
            `[sim-network-splash.js]: [N/A] - [createScene] - playNamedSequenceMissing has a value of true.`
        ); //This is logged when the host cannot play the splash enter sequence.
    }
}

export function dispose() {
    const host = globalThis[HOST_KEY];
    if (host && typeof host.disposeActiveSequence === 'function') {
        host.disposeActiveSequence();
    }
    teardownSplashGateInput();
    splashSequenceReadyForGate = false;
    splashGateContinueRequested = false;
    if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
    }
    console.log(
        `[sim-network-splash.js]: [N/A] - [dispose] - overlayRemoved has a value of true.`
    ); //This is logged when leaving the splash scene.
}
