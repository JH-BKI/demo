/**
 * Phase 1 proof scene — type "2d" instructions screen.
 * Continue switches to the main sim-network 3d-viewer scene via host switchToScene.
 */

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const OVERLAY_ID = 'sim-network-instructions-overlay';
const INSTRUCTIONS_PHOTO_SRC =
    './assets/experiences/sim-network/images/manager-full.jpg';

const INSTRUCTIONS_HTML =
    '<p>You are an IT network technician. The company "eNetworks" is setting up a new office and you are tasked with bringing internet connectivity to all devices.</p>' +
    '<p>Place devices on the grid, connect cables along the floor, and press <strong>Test</strong> to check connectivity from the Comms Cupboard.</p>' +
    '<ol class="list-decimal pl-5 space-y-2 sim-network-flow-overlay__list">' +
    '<li>Use the left palette to place network devices on the grid.</li>' +
    '<li>Use <strong>Cable</strong> mode to connect devices.</li>' +
    '<li>Press <strong>Test</strong> to verify the network.</li>' +
    '<li>Complete each difficulty track to unlock the next.</li>' +
    '</ol>';

/** @type {HTMLElement | null} */
let overlayEl = null;

/**
 * @returns {{ getPlayerUiRoot: () => HTMLElement, switchToScene: (sceneId: string, fadeDuration?: number) => Promise<string|null> }}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (!host || typeof host.getPlayerUiRoot !== 'function' || typeof host.switchToScene !== 'function') {
        throw new Error(
            'Experience host API missing getPlayerUiRoot or switchToScene. Is installExperienceHostApi() running?'
        );
    }
    return host;
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
        '<div class="sim-network-split">' +
        `<div class="sim-network-split__photo" style="background-image: url('${INSTRUCTIONS_PHOTO_SRC}')" aria-hidden="true"></div>` +
        '<div class="sim-network-split__card">' +
        '<h1 class="sim-network-split__title">How to play</h1>' +
        '<div class="sim-network-split__body">' +
        INSTRUCTIONS_HTML +
        '</div>' +
        '<button type="button" class="btn btn-primary btn-lg sim-network-split__cta" data-action="continue">Continue</button>' +
        '</div>' +
        '</div>';

    overlayEl.appendChild(backdrop);
    overlayEl.appendChild(contentEl);
    root.appendChild(overlayEl);

    contentEl.querySelector('[data-action="continue"]')?.addEventListener('click', () => {
        console.log(
            `[sim-network-instructions.js]: [N/A] - [createScene] - continueClicked has a value of true, targetSceneId has a value of sim-network.`
        ); //This is logged when the learner leaves the 2d instructions proof scene for the main sim-network scene.
        void host.switchToScene('sim-network');
    });

    console.log(
        `[sim-network-instructions.js]: [N/A] - [createScene] - sceneId has a value of ${sceneId}, overlayMounted has a value of true.`
    ); //This is logged when the Phase 1 proof instructions screen is mounted inside the player frame.
}

export function dispose() {
    if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
    }
    console.log(
        `[sim-network-instructions.js]: [N/A] - [dispose] - overlayRemoved has a value of true.`
    ); //This is logged when leaving the 2d instructions proof scene.
}
