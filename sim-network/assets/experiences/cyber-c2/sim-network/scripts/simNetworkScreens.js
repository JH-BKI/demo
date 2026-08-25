/**
 * Full-panel HTML screens for sim-network flow (splash, instructions, level select, complete).
 * Shared div overlay shell (backdrop + content slot). Mounted inside #uiContainer via getPlayerUiRoot().
 */

const OVERLAY_ID = 'sim-network-flow-overlay';
const SPLASH_TITLE_SRC =
    './assets/experiences/cyber-c2/sim-network/images/sim-network-title.png';
const SPLASH_HERO_SRC =
    './assets/experiences/cyber-c2/sim-network/images/splash-full.jpg';
const INSTRUCTIONS_PHOTO_SRC =
    './assets/experiences/cyber-c2/sim-network/images/manager-full.jpg';
const LEVEL_SELECT_PHOTO_SRC =
    './assets/experiences/cyber-c2/sim-network/images/trainer-full.jpg';
/** Gate card fade-out duration (ms) — keep in sync with CSS. */
const SPLASH_GATE_FADE_MS = 300;
/** Main panel fade-in duration (ms) — keep in sync with CSS. */
const SPLASH_MAIN_FADE_MS = 300;

const INSTRUCTIONS_HTML =
    '<p>You are an IT network technician. The company "eNetworks" is setting up a new office and you are tasked with bringing internet connectivity to all devices.</p>' +
    '<p>Place devices on the grid, connect cables along the floor, and press <strong>Test</strong> to check connectivity from the Comms Cupboard.</p>' +
    '<ol class="list-decimal pl-5 space-y-2 sim-network-flow-overlay__list">' +
    '<li>Use the left palette to place network devices on the grid.</li>' +
    '<li>Use <strong>Cable</strong> mode to connect devices.</li>' +
    '<li>Press <strong>Test</strong> to verify the network.</li>' +
    '<li>Complete each difficulty track to unlock the next.</li>' +
    '</ol>';

/**
 * @param {{ getPlayerUiRoot: () => HTMLElement }} host
 */
export function createSimNetworkScreens(host) {
    const root = host.getPlayerUiRoot();
    /** @type {HTMLElement | null} */
    let overlay = null;
    /** @type {HTMLElement | null} */
    let contentEl = null;
    /** @type {((event: MouseEvent) => void) | null} */
    let splashGateClickHandler = null;

    function clearSplashGateListener() {
        if (overlay && splashGateClickHandler) {
            overlay.removeEventListener('click', splashGateClickHandler);
        }
        splashGateClickHandler = null;
        overlay?.classList.remove('sim-network-flow-overlay--splash-gate');
    }

    function ensureOverlay() {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = OVERLAY_ID;
            overlay.className = 'sim-network-flow-overlay hidden';
            overlay.setAttribute('role', 'region');

            const backdrop = document.createElement('div');
            backdrop.className = 'sim-network-flow-overlay__backdrop';
            backdrop.setAttribute('aria-hidden', 'true');

            contentEl = document.createElement('div');
            contentEl.className = 'sim-network-flow-overlay__content';

            overlay.appendChild(backdrop);
            overlay.appendChild(contentEl);
            root.appendChild(overlay);
            console.log(
                `[simNetworkScreens.js]: [N/A] - [ensureOverlay] - overlayMounted has a value of true.`
            ); //This is logged when the sim-network full-panel overlay shell is created inside the player frame.
        }
        return overlay;
    }

    /**
     * Swap only the foreground content; keep the shared backdrop shell.
     * @param {string} innerHtml
     */
    function showPanel(innerHtml) {
        clearSplashGateListener();
        ensureOverlay();
        if (!contentEl) {
            contentEl = overlay?.querySelector('.sim-network-flow-overlay__content') ?? null;
        }
        if (!contentEl || !overlay) {
            return;
        }
        contentEl.innerHTML = innerHtml;
        overlay.classList.remove('hidden');
    }

    function hide() {
        clearSplashGateListener();
        if (overlay) {
            overlay.classList.add('hidden');
        }
        if (contentEl) {
            contentEl.innerHTML = '';
        }
    }

    return {
        /**
         * Two-step splash: gate card → large photo panel + white strip + START.
         * @param {() => void} onBegin
         */
        showSplash(onBegin) {
            showPanel(
                '<div class="sim-network-splash">' +
                    '<div class="sim-network-splash__gate is-visible" data-splash-gate>' +
                    '<figure class="sim-network-splash__gate-logo">' +
                    `<img src="${SPLASH_TITLE_SRC}" alt="Sim Network" />` +
                    '</figure>' +
                    '<p class="sim-network-splash__gate-text">Press/click anywhere to begin...</p>' +
                    '</div>' +
                    '<div class="sim-network-splash__main" data-splash-main aria-hidden="true">' +
                    '<div class="sim-network-splash__hero">' +
                    `<img class="sim-network-splash__hero-logo" data-splash-logo src="${SPLASH_TITLE_SRC}" alt="" />` +
                    '</div>' +
                    '<div class="sim-network-splash__strip">' +
                    '<h1 class="sim-network-splash__title">Construct a network and test it!</h1><BR>' +
                    '<button type="button" class="btn btn-accent btn-xl btn-ping sim-network-splash__cta" data-action="begin">START</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>'
            );

            const gateEl = contentEl?.querySelector('[data-splash-gate]');
            const mainEl = contentEl?.querySelector('[data-splash-main]');
            const logoEl = contentEl?.querySelector('[data-splash-logo]');
            let gateDone = false;

            overlay?.classList.add('sim-network-flow-overlay--splash-gate');

            splashGateClickHandler = () => {
                if (gateDone) {
                    return;
                }
                gateDone = true;
                clearSplashGateListener();
                console.log(
                    `[simNetworkScreens.js]: [N/A] - [showSplash] - gateClicked has a value of true.`
                ); //This is logged when the learner dismisses the splash gate card.

                gateEl?.classList.remove('is-visible');
                window.setTimeout(() => {
                    gateEl?.classList.add('is-gone');
                    mainEl?.classList.add('is-ready');
                    mainEl?.setAttribute('aria-hidden', 'false');
                    // Double rAF so the browser applies display:flex before opacity transitions.
                    window.requestAnimationFrame(() => {
                        window.requestAnimationFrame(() => {
                            mainEl?.classList.add('is-visible');
                            window.setTimeout(() => {
                                logoEl?.classList.add('is-visible');
                                console.log(
                                    `[simNetworkScreens.js]: [N/A] - [showSplash] - heroLogoFadeStarted has a value of true.`
                                ); //This is logged when the splash title logo begins fading in over the hero photo.
                            }, SPLASH_MAIN_FADE_MS);
                        });
                    });
                }, SPLASH_GATE_FADE_MS);
            };

            overlay?.addEventListener('click', splashGateClickHandler);

            contentEl
                ?.querySelector('[data-action="begin"]')
                ?.addEventListener('click', (event) => {
                    event.stopPropagation();
                    console.log(
                        `[simNetworkScreens.js]: [N/A] - [showSplash] - beginClicked has a value of true.`
                    ); //This is logged when the learner starts from the sim-network splash screen.
                    onBegin();
                });
        },

        /**
         * How to play — photo panel (left ~60%) + instructions card (right ~40%).
         * @param {() => void} onContinue
         */
        showInstructions(onContinue) {
            showPanel(
                '<div class="sim-network-split">' +
                    `<div class="sim-network-split__photo" style="background-image: url('${INSTRUCTIONS_PHOTO_SRC}')" aria-hidden="true"></div>` +
                    '<div class="sim-network-split__card">' +
                    '<h1 class="sim-network-split__title">How to play</h1>' +
                    '<div class="sim-network-split__body">' +
                    INSTRUCTIONS_HTML +
                    '</div>' +
                    '<button type="button" class="btn btn-primary btn-lg sim-network-split__cta" data-action="continue">Continue</button>' +
                    '</div>' +
                    '</div>'
            );
            contentEl
                ?.querySelector('[data-action="continue"]')
                ?.addEventListener('click', () => {
                    console.log(
                        `[simNetworkScreens.js]: [N/A] - [showInstructions] - continueClicked has a value of true.`
                    ); //This is logged when the learner leaves the instructions screen.
                    onContinue();
                });
        },

        /**
         * Choose difficulty — same split layout as instructions; trainer photo on the left.
         * @param {Array<{ id: string, title: string, sortOrder?: number, maps: unknown[] }>} difficultyList
         * @param {Set<string>} completedIds
         * @param {(difficultyId: string) => boolean} isUnlocked
         * @param {(difficultyId: string) => void} onSelect
         */
        showLevelSelect(difficultyList, completedIds, isUnlocked, onSelect) {
            const cards = difficultyList
                .map((entry) => {
                    const unlocked = isUnlocked(entry.id);
                    const done = completedIds.has(entry.id);
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

            showPanel(
                '<div class="sim-network-split">' +
                    `<div class="sim-network-split__photo" style="background-image: url('${LEVEL_SELECT_PHOTO_SRC}')" aria-hidden="true"></div>` +
                    '<div class="sim-network-split__card">' +
                    '<h1 class="sim-network-split__title">Choose Network Type</h1>' +
                    '<p class="sim-network-split__lead">Complete each track in order to unlock the next.</p>' +
                    `<div class="sim-network-flow-card-grid">${cards}</div>` +
                    '</div>' +
                    '</div>'
            );

            contentEl?.querySelectorAll('[data-difficulty]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-difficulty');
                    if (!id || btn.hasAttribute('disabled')) {
                        return;
                    }
                    if (!isUnlocked(id) || completedIds.has(id)) {
                        return;
                    }
                    const entry = difficultyList.find((item) => item.id === id);
                    const mapCount = Array.isArray(entry?.maps) ? entry.maps.length : 0;
                    if (mapCount <= 0) {
                        return;
                    }
                    console.log(
                        `[simNetworkScreens.js]: [N/A] - [showLevelSelect] - difficultySelected has a value of ${id}.`
                    ); //This is logged when the learner picks an unlocked difficulty track.
                    onSelect(id);
                });
            });
        },

        /**
         * @param {() => void} onPlayAgain
         */
        showComplete(onPlayAgain) {
            showPanel(
                '<div class="sim-network-flow-overlay__panel sim-network-flow-overlay__panel--complete">' +
                    '<h1 class="sim-network-flow-overlay__title">Congratulations!</h1>' +
                    '<p class="sim-network-flow-overlay__lead">You completed every difficulty track.</p>' +
                    '<button type="button" class="btn btn-primary btn-lg sim-network-flow-overlay__cta" data-action="play-again">Play again</button>' +
                    '</div>'
            );
            contentEl
                ?.querySelector('[data-action="play-again"]')
                ?.addEventListener('click', () => {
                    console.log(
                        `[simNetworkScreens.js]: [N/A] - [showComplete] - playAgainClicked has a value of true.`
                    ); //This is logged when the learner restarts from the all-complete screen.
                    onPlayAgain();
                });
        },

        hide,
        dispose() {
            hide();
            overlay?.remove();
            overlay = null;
            contentEl = null;
        },
    };
}
