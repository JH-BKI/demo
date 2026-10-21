/**
 * Sim Network level-select scene (type 2d) — pick a layout → in-game.
 * One item-strip card per group in layouts-index.json. A daisyUI steps row
 * under the cards slides with them (attachParallelTrack). Unlocked steps start a level.
 * Plays level-select-enter-sequence.json after mount.
 * Inits tutorial dialogue so sequence emits (event:show-dialogue) can open STEP_CONTENT.
 *
 * Temporary debug cheat: with ?debug=true|on, press C to mark all non-comingSoon
 * maps complete and refresh the board.
 */

import {
    getCurrentProgressMapId,
    getFlatMaps,
    getPlayableFlatMaps,
    getSortedDifficulties,
    isDifficultyUnlocked,
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
const STRIP_ID = 'sim-network-level-select-strip';
/** Same cutoff as the item-strip overlay arrows (under the large desktop layout). */
const PHONE_ARROW_MQ = '(max-width: 1023px)';
/**
 * One steps line that runs to the screen edge when a chapter is off-screen.
 * Phones and upright tablets, plus short wide tablets (sideways iPad is 1024 wide).
 */
const SCREEN_LINE_MQ = '(max-width: 1023px), (min-width: 1024px) and (max-height: 900px)';

/** Material lock icon — shown over comingSoon columns (WiFi / Hybrid). */
const COMING_SOON_LOCK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#2dd4bf" aria-hidden="true">' +
    '<path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z"/>' +
    '</svg>';

/** @type {HTMLElement | null} */
let backdropEl = null;
/** @type {HTMLElement | null} */
let sectionEl = null;

/** @type {((event: KeyboardEvent) => void) | null} */
let debugCompleteKeyHandler = null;
/** @type {ReturnType<ReturnType<typeof getHost>['createItemStrip']> | null} */
let stripApi = null;
/** @type {((event: Event) => void) | null} */
let stripStatusHandler = null;
/** @type {HTMLElement | null} */
let screenLineEl = null;
/** Green piece of the steps line, from the first finished step to the current one. */
let screenLineProgressEl = null;
/** @type {number} */
let screenLineFollowId = 0;
/** Last phone-arrow size and top we logged, so resize does not spam the console. */
let lastPhoneArrowSnapshot = '';

/** Vertical center of a daisyUI step circle (40px row). */
const STEP_CIRCLE_MID_PX = 20;

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
 *   getUIContainerSlot: (slot: string) => HTMLElement,
 *   switchToScene: (sceneId: string, fadeDuration?: number) => Promise<string|null>,
 *   dispatchAppEvent: (eventName: string, detail?: object|null) => void,
 *   EVENTS: { AUDIO_CONTROL: string, ITEM_STRIP_STATUS: string },
 *   createItemStrip: (options: object) => {
 *     getElement: () => HTMLElement,
 *     attachParallelTrack: (targets: { clip: HTMLElement, track: HTMLElement }) => void,
 *     detachParallelTrack: () => void,
 *     dispose: () => void
 *   },
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
        !host.EVENTS?.AUDIO_CONTROL ||
        !host.EVENTS?.ITEM_STRIP_STATUS
    ) {
        throw new Error(
            'Experience host API missing getUIContainerSlot, switchToScene, createItemStrip, or audio helpers. Is installExperienceHostApi() running?'
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
 * @param {{ shortLabel?: string, chapterTitle?: string, title?: string, id: string }} difficulty
 * @returns {string}
 */
function cardLabel(difficulty) {
    return difficulty.shortLabel || difficulty.title || difficulty.id;
}

/**
 * @param {{ chapterTitle?: string, title?: string, id: string }} difficulty
 * @returns {string}
 */
function cardTitle(difficulty) {
    return difficulty.chapterTitle || difficulty.title || difficulty.id;
}

/**
 * Drop the strip, its parallel steps row, and the status listener.
 * @param {ReturnType<typeof getHost> | null | undefined} host
 */
function clearStrip(host) {
    if (stripStatusHandler) {
        const eventName = host?.EVENTS?.ITEM_STRIP_STATUS || 'itemStripStatus';
        window.removeEventListener(eventName, stripStatusHandler);
        stripStatusHandler = null;
    }
    if (screenLineFollowId) {
        window.cancelAnimationFrame(screenLineFollowId);
        screenLineFollowId = 0;
    }
    if (screenLineEl) {
        screenLineEl.remove();
        screenLineEl = null;
    }
    if (screenLineProgressEl) {
        screenLineProgressEl.remove();
        screenLineProgressEl = null;
    }
    if (stripApi) {
        stripApi.detachParallelTrack();
        stripApi.dispose();
        stripApi = null;
    }
    lastPhoneArrowSnapshot = '';
}

/**
 * On a phone, the previous and next buttons are the medium circle (btn-md)
 * and sit at the vertical middle of the level-select screen.
 * Wider screens keep the large circles in the card row.
 * @param {HTMLElement} stripRoot
 */
function syncPhoneArrows(stripRoot) {
    const prev = stripRoot.querySelector('.item-strip__prev');
    const next = stripRoot.querySelector('.item-strip__next');
    if (!(prev instanceof HTMLElement) || !(next instanceof HTMLElement)) return;

    const phone = window.matchMedia(PHONE_ARROW_MQ).matches;
    prev.classList.toggle('btn-md', phone);
    next.classList.toggle('btn-md', phone);
    prev.classList.toggle('btn-lg', !phone);
    next.classList.toggle('btn-lg', !phone);

    let top = '';
    if (phone && sectionEl instanceof HTMLElement) {
        const row = stripRoot.querySelector('.item-strip__row');
        if (row instanceof HTMLElement) {
            const rowRect = row.getBoundingClientRect();
            if (rowRect.height > 0) {
                const sectionRect = sectionEl.getBoundingClientRect();
                const topPx = (sectionRect.top + (sectionRect.height / 2)) - rowRect.top;
                top = `${Math.round(topPx)}px`;
            }
        }
    }
    prev.style.top = top;
    next.style.top = top;

    const snapshot = `${phone}:${top}`;
    if (snapshot === lastPhoneArrowSnapshot) return;
    lastPhoneArrowSnapshot = snapshot;
    console.log(
        `[sim-network-level-select.js]: [N/A] - [syncPhoneArrows] - phoneArrows has a value of ${phone}, arrowTop has a value of ${top || 'card-center'}.`
    ); //This is logged when the phone arrow size or vertical place changes.
}

/**
 * One line under the circles on a phone or a short tablet.
 * It starts at the first circle and stops at the last.
 * Off-screen ends run to the edge of the level-select area.
 * @param {HTMLElement} contentEl
 */
function syncScreenLine(contentEl) {
    if (!(screenLineEl instanceof HTMLElement)) return;
    const useScreenLine = window.matchMedia(SCREEN_LINE_MQ).matches;
    if (!useScreenLine) {
        screenLineEl.hidden = true;
        if (screenLineProgressEl) screenLineProgressEl.hidden = true;
        return;
    }
    const first = contentEl.querySelector(
        '.sim-network-level-steps-slice:first-child .step:first-child'
    );
    const last = contentEl.querySelector(
        '.sim-network-level-steps-slice:last-child .step:last-child'
    );
    if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) {
        if (screenLineProgressEl) screenLineProgressEl.hidden = true;
        return;
    }

    const box = contentEl.getBoundingClientRect();
    const innerLeft = box.left + contentEl.clientLeft;
    const innerTop = box.top + contentEl.clientTop;
    const innerWidth = contentEl.clientWidth;
    const firstBox = first.getBoundingClientRect();
    const lastBox = last.getBoundingClientRect();
    const firstX = firstBox.left + (firstBox.width / 2) - innerLeft;
    const lastX = lastBox.left + (lastBox.width / 2) - innerLeft;
    const start = Math.max(0, Math.min(firstX, innerWidth));
    const end = Math.max(0, Math.min(lastX, innerWidth));

    screenLineEl.hidden = false;
    screenLineEl.style.left = `${Math.round(start)}px`;
    screenLineEl.style.width = `${Math.max(0, Math.round(end - start))}px`;
    screenLineEl.style.top = `${Math.round(firstBox.top + STEP_CIRCLE_MID_PX - innerTop)}px`;
    syncProgressLine(contentEl, innerLeft, innerTop, innerWidth);
}

/**
 * Green stretch from the first finished circle to the current circle.
 * The dark line underneath still runs to the screen edge.
 * @param {HTMLElement} contentEl
 * @param {number} innerLeft
 * @param {number} innerTop
 * @param {number} innerWidth
 */
function syncProgressLine(contentEl, innerLeft, innerTop, innerWidth) {
    if (!(screenLineProgressEl instanceof HTMLElement)) return;
    const doneSteps = contentEl.querySelectorAll('.sim-network-level-steps__step--complete');
    const current = contentEl.querySelector('.sim-network-level-steps__step--current');
    const firstDone = doneSteps[0];
    const endStep = current instanceof HTMLElement ? current : doneSteps[doneSteps.length - 1];
    if (!(firstDone instanceof HTMLElement) || !(endStep instanceof HTMLElement)) {
        screenLineProgressEl.hidden = true;
        return;
    }
    const doneBox = firstDone.getBoundingClientRect();
    const currentBox = endStep.getBoundingClientRect();
    const doneX = doneBox.left + (doneBox.width / 2) - innerLeft;
    const currentX = currentBox.left + (currentBox.width / 2) - innerLeft;
    const start = Math.max(0, Math.min(Math.min(doneX, currentX), innerWidth));
    const end = Math.max(0, Math.min(Math.max(doneX, currentX), innerWidth));
    screenLineProgressEl.hidden = false;
    screenLineProgressEl.style.left = `${Math.round(start)}px`;
    screenLineProgressEl.style.width = `${Math.max(0, Math.round(end - start))}px`;
    screenLineProgressEl.style.top = `${Math.round(doneBox.top + STEP_CIRCLE_MID_PX - innerTop)}px`;
}

/**
 * Keep the line with the circles while a swipe settles (the track eases for ~0.32s).
 * @param {HTMLElement} contentEl
 */
function followScreenLine(contentEl) {
    if (screenLineFollowId) window.cancelAnimationFrame(screenLineFollowId);
    const started = performance.now();
    const tick = (now) => {
        syncScreenLine(contentEl);
        if (now - started < 400) {
            screenLineFollowId = window.requestAnimationFrame(tick);
            return;
        }
        screenLineFollowId = 0;
    };
    screenLineFollowId = window.requestAnimationFrame(tick);
}

/**
 * Copy each card’s measured width and the card-row gap onto the matching steps slice.
 * @param {HTMLElement} stripRoot
 * @param {HTMLElement} stepsTrack
 */
function syncStepSliceWidths(stripRoot, stepsTrack) {
    const cardTrack = stripRoot.querySelector('.item-strip__track');
    if (!(cardTrack instanceof HTMLElement)) return;
    const gap = window.getComputedStyle(cardTrack).columnGap;
    if (gap) stepsTrack.style.gap = gap;
    const items = stripRoot.querySelectorAll('.item-strip__item');
    const slices = stepsTrack.querySelectorAll('.sim-network-level-steps-slice');
    slices.forEach((slice, index) => {
        const item = items[index];
        if (!(slice instanceof HTMLElement) || !(item instanceof HTMLElement)) return;
        if (item.offsetWidth <= 0) return;
        slice.style.width = `${item.offsetWidth}px`;
    });
    syncStepBridges(slices);
}

/**
 * Draw the short join from the last circle of one chapter to the first circle of the next.
 * @param {NodeListOf<Element>} slices
 */
function syncStepBridges(slices) {
    slices.forEach((slice, index) => {
        if (!(slice instanceof HTMLElement)) return;
        const next = slices[index + 1];
        if (!(next instanceof HTMLElement)) {
            slice.style.removeProperty('--bridge-left');
            slice.style.removeProperty('--bridge-width');
            return;
        }
        const lastStep = slice.querySelector('.step:last-child');
        const firstStep = next.querySelector('.step:first-child');
        if (!(lastStep instanceof HTMLElement) || !(firstStep instanceof HTMLElement)) return;
        const sliceRect = slice.getBoundingClientRect();
        const lastRect = lastStep.getBoundingClientRect();
        const firstRect = firstStep.getBoundingClientRect();
        const left = lastRect.left + (lastRect.width / 2) - sliceRect.left;
        const end = firstRect.left + (firstRect.width / 2) - sliceRect.left;
        slice.style.setProperty('--bridge-left', `${Math.round(left)}px`);
        slice.style.setProperty('--bridge-width', `${Math.max(0, Math.round(end - left))}px`);
    });
}

/**
 * One poster card per group. Locked when the player has not reached that group.
 * @param {ReturnType<typeof parseDifficulties>[number]} difficulty
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 * @returns {HTMLElement}
 */
function buildChapterCard(difficulty, difficulties) {
    const card = document.createElement('article');
    card.className = 'sim-network-chapter-card';
    const locked = !isDifficultyUnlocked(difficulties, difficulty.id);
    if (locked) card.classList.add('sim-network-chapter-card--locked');

    const index = document.createElement('div');
    index.className = 'sim-network-chapter-card__index';

    const number = document.createElement('span');
    number.className = 'sim-network-chapter-card__number';
    number.textContent = String(difficulty.sortOrder);

    const label = document.createElement('p');
    label.className = 'sim-network-chapter-card__label';
    label.textContent = cardLabel(difficulty);
    index.append(number, label);

    const media = document.createElement('div');
    media.className = 'sim-network-chapter-card__media';
    if (typeof difficulty.image === 'string' && difficulty.image.trim()) {
        const image = document.createElement('img');
        image.src = difficulty.image;
        image.alt = cardTitle(difficulty);
        media.appendChild(image);
    }

    const title = document.createElement('h2');
    title.className = 'sim-network-chapter-card__title';
    title.textContent = cardTitle(difficulty);

    const body = document.createElement('p');
    body.className = 'sim-network-chapter-card__description';
    body.textContent = difficulty.description || '';

    const copy = document.createElement('div');
    copy.className = 'sim-network-chapter-card__copy';
    copy.append(title, body);

    /* Number and sideways name hang on the left edge of the picture. */
    media.append(index);
    card.append(media, copy);
    if (!locked) return card;

    const lock = document.createElement('div');
    lock.className = 'sim-network-level-column__lock';
    lock.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('div');
    inner.className = 'sim-network-level-column__lock-inner';
    inner.innerHTML = COMING_SOON_LOCK_SVG;
    if (difficulty.comingSoon) {
        const soon = document.createElement('span');
        soon.className = 'sim-network-level-column__soon-banner';
        soon.textContent = 'COMING SOON!';
        lock.appendChild(soon);
    }
    lock.appendChild(inner);
    media.appendChild(lock);
    return card;
}

/**
 * Circle contents from the shared icon list. icon_check is a plain tick.
 * icon_help is a question mark. fill-current lets the question mark take the circle color.
 * @param {string} iconName
 * @param {string} classes
 * @returns {HTMLElement}
 */
function buildStepMark(iconName, classes) {
    const mark = document.createElement('span');
    mark.className = 'step-icon';
    mark.setAttribute('aria-hidden', 'true');
    const host = globalThis[HOST_KEY];
    const svg = typeof host?.getIcon === 'function' ? host.getIcon(iconName, classes) : '';
    mark.innerHTML = svg;
    console.log(
        `[sim-network-level-select.js]: [N/A] - [buildStepMark] - iconName has a value of ${iconName}, svgLength has a value of ${svg.length}.`
    ); //This is logged to confirm the step circle received a real icon, not a text character.
    return mark;
}

/**
 * @param {ReturnType<typeof parseDifficulties>[number]} difficulty
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 * @param {string | null} currentId
 * @returns {HTMLElement}
 */
function buildStepSlice(difficulty, difficulties, currentId) {
    const slice = document.createElement('div');
    slice.className = 'sim-network-level-steps-slice';
    slice.dataset.difficulty = difficulty.id;

    const list = document.createElement('ul');
    list.className = 'steps steps-horizontal sim-network-level-steps__list';
    const comingSoon = difficulty.comingSoon === true;

    difficulty.maps.forEach((map, mapIndex) => {
        const done = !comingSoon && isMapComplete(map.id);
        const playable = !comingSoon && isMapUnlocked(difficulties, map.id);
        const isCurrent = playable && map.id === currentId;
        const step = document.createElement('li');
        step.className = 'step';
        if (done) {
            step.classList.add('sim-network-level-steps__step--complete');
            step.appendChild(buildStepMark('icon_check', ''));
        } else if (isCurrent) {
            step.classList.add('step-primary', 'sim-network-level-steps__step--current');
            step.appendChild(buildStepMark('icon_help', 'fill-current'));
        } else {
            step.dataset.content = '';
            step.classList.add('sim-network-level-steps__step--locked');
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sim-network-level-step__btn';
        button.dataset.difficulty = difficulty.id;
        button.dataset.mapIndex = String(mapIndex);
        button.dataset.mapId = map.id;
        button.textContent = map.title || map.id;
        button.disabled = !playable;
        step.appendChild(button);
        list.appendChild(step);
    });

    slice.appendChild(list);
    return slice;
}

/**
 * Full steps row — one slice per group. The clip window hides the off-screen slices.
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 * @returns {HTMLElement}
 */
function buildStepsTrack(difficulties) {
    const track = document.createElement('div');
    track.className = 'sim-network-level-steps-track';
    const currentId = getCurrentProgressMapId(difficulties);
    for (const difficulty of getSortedDifficulties(difficulties)) {
        track.appendChild(buildStepSlice(difficulty, difficulties, currentId));
    }
    return track;
}

/**
 * @param {HTMLElement} stepsRoot
 * @param {ReturnType<typeof getHost>} host
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 */
function bindStepButtons(stepsRoot, host, difficulties) {
    stepsRoot.querySelectorAll('[data-map-id]').forEach((btn) => {
        btn.addEventListener('pointerenter', () => {
            if (btn.hasAttribute('disabled')) return;
            playSfx(host, 'default-ui-hover');
        });
        btn.addEventListener('click', () => {
            const difficultyId = btn.getAttribute('data-difficulty');
            const mapId = btn.getAttribute('data-map-id');
            const mapIndex = Number(btn.getAttribute('data-map-index'));
            if (!difficultyId || !mapId || btn.hasAttribute('disabled')) return;
            if (!isMapUnlocked(difficulties, mapId)) return;
            console.log(
                `[sim-network-level-select.js]: [N/A] - [bindStepButtons] - mapSelected has a value of ${mapId}, difficultyId has a value of ${difficultyId}, mapIndex has a value of ${mapIndex}, targetSceneId has a value of 04-in-game.`
            ); //This is logged when a level step is chosen and the play scene is opened.
            playSfx(host, 'default-ui-click');
            playSfx(host, 'default-sys-next');
            selectMap(difficultyId, mapIndex);
            void host.switchToScene('04-in-game');
        });
    });
}

/**
 * Cards in the item strip, steps row clipped under them and slid in sync.
 * @param {HTMLElement} contentEl
 * @param {ReturnType<typeof getHost>} host
 * @param {ReturnType<typeof parseDifficulties>} difficulties
 */
function mountBoard(contentEl, host, difficulties) {
    clearStrip(host);
    // Keep the hire line already in #uiSection-center. Only drop a previous strip slot
    // (debug redraw). The new strip is appended after that line.
    contentEl.querySelectorAll('.sim-network-level-select-strip-slot').forEach((node) => {
        node.remove();
    });

    const slot = document.createElement('div');
    slot.className = 'sim-network-level-select-strip-slot';
    contentEl.append(slot);

    const cards = getSortedDifficulties(difficulties).map((difficulty) => {
        return buildChapterCard(difficulty, difficulties);
    });
    stripApi = host.createItemStrip({
        id: STRIP_ID,
        mountParent: slot,
        items: cards,
        buttonClass: 'btn-neutral',
        showPrevNext: true,
        showDots: true,
    });

    const clip = document.createElement('div');
    clip.className = 'sim-network-level-steps-clip';
    const stepsTrack = buildStepsTrack(difficulties);
    clip.appendChild(stepsTrack);

    const stripRoot = stripApi.getElement();
    const dots = stripRoot.querySelector('.item-strip__dots');
    if (dots) stripRoot.insertBefore(clip, dots);
    else stripRoot.appendChild(clip);

    stripApi.attachParallelTrack({ clip, track: stepsTrack });
    syncStepSliceWidths(stripRoot, stepsTrack);
    bindStepButtons(stepsTrack, host, difficulties);
    syncPhoneArrows(stripRoot);
    window.requestAnimationFrame(() => {
        syncPhoneArrows(stripRoot);
    });

    screenLineEl = document.createElement('div');
    screenLineEl.className = 'sim-network-level-steps-screenline';
    screenLineEl.setAttribute('aria-hidden', 'true');
    screenLineProgressEl = document.createElement('div');
    screenLineProgressEl.className = 'sim-network-level-steps-screenline sim-network-level-steps-screenline--progress';
    screenLineProgressEl.setAttribute('aria-hidden', 'true');
    contentEl.append(screenLineEl, screenLineProgressEl);
    followScreenLine(contentEl);
    stripRoot.addEventListener('pointermove', () => {
        syncScreenLine(contentEl);
    });
    stripRoot.addEventListener('pointerup', () => {
        followScreenLine(contentEl);
    });
    stripRoot.addEventListener('pointercancel', () => {
        followScreenLine(contentEl);
    });

    stripStatusHandler = (event) => {
        const detail = event.detail;
        if (!detail || detail.id !== STRIP_ID) return;
        syncStepSliceWidths(stripRoot, stepsTrack);
        syncPhoneArrows(stripRoot);
        followScreenLine(contentEl);
    };
    window.addEventListener(host.EVENTS.ITEM_STRIP_STATUS, stripStatusHandler);
    console.log(
        `[sim-network-level-select.js]: [N/A] - [mountBoard] - groupCount has a value of ${cards.length}.`
    ); //This is logged when the chapter cards and steps row are mounted.
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
    mountBoard(contentEl, host, difficulties);
}

/**
 * @param {import('@babylonjs/core').Scene} scene
 * @param {string} sceneId
 */
export async function createScene(scene, sceneId) {
    const host = getHost();

    const indexDoc = await fetchJson(LAYOUTS_INDEX_URL);
    const difficulties = parseDifficulties(indexDoc);
    const difficultyList = getSortedDifficulties(difficulties);

    // Always show level-select (even when every playable map is done) so Play again
    // can return here with completions intact instead of bouncing back to 05-complete.

    const rootSlot = host.getUIContainerSlot('root');
    const centerSlot = host.getUIContainerSlot('center');

    backdropEl = document.createElement('div');
    backdropEl.className = 'sim-network-flow-overlay__backdrop';
    backdropEl.setAttribute('aria-hidden', 'true');
    rootSlot.appendChild(backdropEl);

    centerSlot.innerHTML = `
        <div id="uiSection" class="ui-section ${OVERLAY_ID} no-header no-footer">
            <div id="uiSection-header" class="ui-section-cell">
            </div>
            <div id="uiSection-center" class="ui-section-cell sim-network-level-select-content">
                <p class="text-primary-content text-center text-lg lg:text-2xl font-bold px-4 lg:py-8 py-1">Complete each job to unlock the next!</p>
            </div>
            <div id="uiSection-footer" class="ui-section-cell"></div>
        </div>
    `;

    sectionEl = centerSlot.querySelector('#uiSection');
    const contentEl = centerSlot.querySelector('#uiSection-center');
    if (!(sectionEl instanceof HTMLElement) || !(contentEl instanceof HTMLElement)) {
        throw new Error(
            '[sim-network-level-select.js] #uiSection / #uiSection-center missing after innerHTML mount.'
        );
    }

    mountBoard(contentEl, host, difficulties);

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
    clearStrip(host);
    if (backdropEl) {
        backdropEl.remove();
        backdropEl = null;
    }
    if (sectionEl) {
        sectionEl.remove();
        sectionEl = null;
    }
    console.log(
        `[sim-network-level-select.js]: [N/A] - [dispose] - overlayRemoved has a value of true.`
    ); //This is logged when leaving the level-select scene.
}
