/**
 * Sim-network step prompts (info drawer).
 * Driven by sequence emits OR flow helpers: event:show-step-content / event:hide-step-content.
 * Flow screens (instructions / levelSelect) and tutorial play both use STEP_CONTENT.
 * Placeholder copy — designer will refine.
 */

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';

const EVENT_SHOW_STEP_CONTENT = 'event:show-step-content';
const EVENT_HIDE_STEP_CONTENT = 'event:hide-step-content';

/**
 * Optional per-step typewriter (passed through to infoDrawer setContent).
 * Omit or set enabled:false for instant text.
 * @typedef {{
 *   enabled?: boolean,
 *   targets?: Array<'title'|'body'>,
 *   charDelayMs?: number|{ min: number, max: number },
 *   punctuationPauseMs?: number,
 *   startOn?: 'open'|'content',
 *   skipOnPanelClick?: boolean,
 *   skipOnSpace?: boolean,
 *   sfxClipId?: string
 * }} StepTypewriterOptions
 */

/**
 * @typedef {{
 *   title: string,
 *   body: string,
 *   position?: string,
 *   side?: 'left'|'right',
 *   minWidth?: number|string,
 *   showToggle?: boolean,
 *   avatar?: string,
 *   avatarAlt?: string,
 *   typewriter?: StepTypewriterOptions
 * }} StepContentEntry
 */

/** Shared typewriter defaults for tutorial steps that opt in. */
const DEFAULT_STEP_TYPEWRITER = {
    enabled: true,
    targets: ['body'],
    charDelayMs: { min: 25, max: 55 },
    punctuationPauseMs: 80,
    startOn: 'open',
    skipOnPanelClick: true,
    skipOnSpace: true,
    sfxClipId: 'dialog',
};

/** Default panel min width (px) when a step omits `minWidth`. Keeps typewriter from growing the box. */
const DEFAULT_STEP_MIN_WIDTH = 500;

/** Portrait paths under sim-network/images (player-relative). */
const AVATAR_TRAINER =
    './assets/experiences/cyber-c2/sim-network/images/trainer-avatar.jpg';
const AVATAR_MANAGER =
    './assets/experiences/cyber-c2/sim-network/images/manager-avatar.jpg';
const AVATAR_CLIENT =
    './assets/experiences/cyber-c2/sim-network/images/client-avatar.jpg';

/**
 * Placeholder tutorial steps. Timeline emit detail: { "contentKey": "step-1" }
 * Optional `position` (9-slot). Legacy `side` left|right still accepted.
 * Optional `typewriter` — per-step; omit for instant body text.
 * Optional `minWidth` — panel width in px (default 300). Keeps typewriter from growing the box.
 * Optional `showToggle` — false hides the info/X button (close via timeline/code only). Default true.
 * Optional `avatar` / `avatarAlt` — left portrait; omit to hide the slot.
 * @type {Record<string, StepContentEntry>}
 */
const STEP_CONTENT = {
    instructions: {
        title: 'Manager:',
        body: 'Welcome to sim-network! You come highly recommended and I see you have been studying Cybersecurity at Bendigo Kangan Tafe! I hear great things about the course! I\'m sure you\'ll do us proud. Read your job brief and report for training. Good luck!',
        position: 'bottom-left',
        showToggle: false,
        avatar: AVATAR_MANAGER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-select': {
        title: 'Trainer:',
        body: 'Hello there! I\'ll be your trainer today - you will join me out on a client call to set up a new network.  Ready when you are, let\'s get started!',
        position: 'bottom-left',
        showToggle: false,
        avatar: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'step-1': {
        title: 'Trainer:',
        body: 'Let\'s see how you do on your first mission. Connect these 2 desktop PC\'s. Select the \'Test Connection\' button when done to validate your work.',
        position: 'top-right',
        showToggle: false,
        avatar: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'step-2': {
        title: 'Step: 2',
        body: 'arm-drop-router-5-2',
        position: 'bottom-center',
        avatar: AVATAR_MANAGER,
        avatarAlt: 'Manager',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'step-3': {
        title: 'Step: 3',
        body: 'arm-cable-comms-5-6-router-5-2',
        position: 'bottom-center',
        avatar: AVATAR_CLIENT,
        avatarAlt: 'Client',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'step-4': {
        title: 'Step: 4',
        body: 'arm-cable-router-5-2-pc-0-1',
        position: 'bottom-center',
        avatar: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
};

/**
 * Default dock for every step unless that step sets `position` (or legacy `side`) in STEP_CONTENT.
 * Change this one value — also used when createInfoDrawer boots.
 */
const DEFAULT_DRAWER_POSITION = 'center';

/** @type {{ setContent: Function, setPosition: Function, getPosition: Function, setSide: Function, getSide: Function, show: Function, hide: Function, isOpen: Function, openAsync: Function, closeAsync: Function, dispose: Function } | null} */
let drawer = null;

/** @type {(() => void) | null} */
let removeListeners = null;

/** @type {string} */
let activeContentKey = '';

/**
 * @returns {{ GLOBAL_DATA: object, createInfoDrawer: Function }}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        !host.GLOBAL_DATA ||
        typeof host.createInfoDrawer !== 'function'
    ) {
        throw new Error(
            'Experience host API missing GLOBAL_DATA / createInfoDrawer for tutorial step content.'
        );
    }
    return host;
}

/**
 * @param {string} key
 * @returns {StepContentEntry|null}
 */
function getStepContent(key) {
    if (!key || typeof key !== 'string') {
        return null;
    }
    return STEP_CONTENT[key] ?? null;
}

/**
 * Optional per-step override only. No default here — that lives on createInfoDrawer
 * ({@link DEFAULT_DRAWER_POSITION}). Returns null when the step leaves dock alone.
 * @param {StepContentEntry} entry
 * @returns {string|null}
 */
function resolveEntryPositionOverride(entry) {
    const hasPosition =
        entry?.position !== undefined &&
        entry?.position !== null &&
        String(entry.position).trim() !== '';
    if (hasPosition) {
        return String(entry.position).trim().toLowerCase();
    }
    if (entry?.side === 'right') {
        return 'center-right';
    }
    if (entry?.side === 'left') {
        return 'center-left';
    }
    return null;
}

/**
 * @param {StepContentEntry} entry
 * @returns {number|string}
 */
function resolveEntryMinWidth(entry) {
    if (entry?.minWidth === undefined || entry?.minWidth === null) {
        return DEFAULT_STEP_MIN_WIDTH;
    }
    if (typeof entry.minWidth === 'number' && Number.isFinite(entry.minWidth) && entry.minWidth >= 0) {
        return entry.minWidth;
    }
    if (typeof entry.minWidth === 'string' && entry.minWidth.trim()) {
        return entry.minWidth.trim();
    }
    return DEFAULT_STEP_MIN_WIDTH;
}

/**
 * @param {unknown} rawKey
 * @returns {string}
 */
function normalizeContentKey(rawKey) {
    return typeof rawKey === 'string' ? rawKey.trim() : '';
}

function clearListeners() {
    if (typeof removeListeners === 'function') {
        removeListeners();
    }
    removeListeners = null;
}

/**
 * @param {string} nextKey
 * @returns {Promise<void>}
 */
async function showContentKey(nextKey) {
    if (!drawer) {
        return;
    }
    const entry = getStepContent(nextKey);
    if (!entry) {
        drawer.hide();
        activeContentKey = '';
        console.log(
            `[sim-network-tutorial-step-content.js]: [N/A] - [showContentKey] - contentKey has a value of ${nextKey}, found has a value of false.`
        ); //This is logged when a show-step emit names an unknown key.
        return;
    }

    if (drawer.isOpen()) {
        await drawer.closeAsync();
    }

    // Override from STEP_CONTENT when set; otherwise keep/restore create default.
    const overridePosition = resolveEntryPositionOverride(entry);
    const nextPosition = overridePosition ?? DEFAULT_DRAWER_POSITION;
    if (drawer.getPosition() !== nextPosition) {
        drawer.setPosition(nextPosition);
    }

    const showToggle = entry.showToggle !== false;
    const avatar =
        typeof entry.avatar === 'string' && entry.avatar.trim()
            ? entry.avatar.trim()
            : undefined;
    drawer.setContent({
        title: entry.title,
        body: entry.body,
        typewriter: entry.typewriter,
        minWidth: resolveEntryMinWidth(entry),
        showToggle,
        avatar,
        avatarAlt: typeof entry.avatarAlt === 'string' ? entry.avatarAlt : '',
    });
    drawer.show();
    await drawer.openAsync();

    activeContentKey = nextKey;
    const typewriterOn = entry.typewriter?.enabled === true;
    const appliedMinWidth = resolveEntryMinWidth(entry);
    console.log(
        `[sim-network-tutorial-step-content.js]: [N/A] - [showContentKey] - contentKey has a value of ${nextKey}, title has a value of ${entry.title}, position has a value of ${nextPosition}, usedOverride has a value of ${Boolean(overridePosition)}, typewriterEnabled has a value of ${typewriterOn}, minWidth has a value of ${appliedMinWidth}, showToggle has a value of ${showToggle}, avatar has a value of ${avatar || 'none'}.`
    ); //This is logged when the tutorial step drawer shows a content key.
}

async function hideDrawer() {
    if (!drawer) {
        return;
    }
    if (drawer.isOpen()) {
        await drawer.closeAsync();
    }
    drawer.hide();
    activeContentKey = '';
    console.log(
        `[sim-network-tutorial-step-content.js]: [N/A] - [hideDrawer] - hidden has a value of true.`
    ); //This is logged when hide-step-content collapses the tutorial drawer.
}

function registerContentEventListeners() {
    /** @param {CustomEvent} event */
    const onShow = async (event) => {
        const detail = event?.detail ?? {};
        const key = normalizeContentKey(detail.contentKey);
        if (!key) {
            return;
        }
        if (key === activeContentKey) {
            return;
        }
        await showContentKey(key);
    };

    const onHide = async () => {
        await hideDrawer();
    };

    window.addEventListener(EVENT_SHOW_STEP_CONTENT, onShow);
    window.addEventListener(EVENT_HIDE_STEP_CONTENT, onHide);

    return () => {
        window.removeEventListener(EVENT_SHOW_STEP_CONTENT, onShow);
        window.removeEventListener(EVENT_HIDE_STEP_CONTENT, onHide);
    };
}

/**
 * Show a STEP_CONTENT key from flow code (no timeline required).
 * Prefers an already-inited drawer; no-ops if init was skipped (e.g. WebXR).
 * @param {string} contentKey
 * @returns {Promise<void>}
 */
export async function showTutorialStepContent(contentKey) {
    const key = normalizeContentKey(contentKey);
    if (!key || !drawer) {
        console.log(
            `[sim-network-tutorial-step-content.js]: [N/A] - [showTutorialStepContent] - contentKey has a value of ${key}, drawerReady has a value of ${Boolean(drawer)}.`
        ); //This is logged when flow asks to show step content but the drawer is not ready.
        return;
    }
    if (key === activeContentKey) {
        return;
    }
    await showContentKey(key);
}

/**
 * Hide the step drawer from flow code (no timeline required).
 * @returns {Promise<void>}
 */
export async function hideTutorialStepContent() {
    await hideDrawer();
}

/**
 * Start listening for tutorial step emits. Safe to call again (rebuilds drawer).
 */
export function initTutorialStepContent() {
    const { GLOBAL_DATA, createInfoDrawer } = getHost();

    disposeTutorialStepContent();

    if (GLOBAL_DATA.getAppDataWebxrStatus?.()) {
        console.log(
            `[sim-network-tutorial-step-content.js]: [N/A] - [initTutorialStepContent] - webxrActive has a value of true.`
        ); //This is logged when VR is active and the HTML step drawer is skipped.
        return;
    }

    drawer = createInfoDrawer({
        id: 'sim-network-tutorial-step-drawer',
        position: DEFAULT_DRAWER_POSITION,
        icon: 'icon_circle_info',
        ariaLabelClosed: 'Open step note',
        ariaLabelOpen: 'Close step note',
    });
    drawer.hide();
    removeListeners = registerContentEventListeners();

    console.log(
        `[sim-network-tutorial-step-content.js]: [N/A] - [initTutorialStepContent] - ready has a value of true, stepCount has a value of ${Object.keys(STEP_CONTENT).length}.`
    ); //This is logged when tutorial step drawer + listeners are ready.
}

/**
 * Tear down drawer and listeners (leave tutorial / leave scene).
 */
export function disposeTutorialStepContent() {
    clearListeners();
    activeContentKey = '';
    if (drawer) {
        drawer.dispose();
        drawer = null;
    }
    console.log(
        `[sim-network-tutorial-step-content.js]: [N/A] - [disposeTutorialStepContent] - cleanupCompleted has a value of true.`
    ); //This is logged when tutorial step content is torn down.
}
