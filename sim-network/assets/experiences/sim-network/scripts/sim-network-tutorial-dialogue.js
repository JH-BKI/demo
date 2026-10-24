/**
 * Sim-network tutorial dialogue (character / coach speech).
 * Driven by sequence emits OR flow helpers: event:show-dialogue / event:hide-dialogue.
 * Flow screens (instructions / levelSelect) and tutorial play both use STEP_CONTENT.
 * Placeholder copy — designer will refine.
 */

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';

const EVENT_SHOW_DIALOGUE = 'event:show-dialogue';
const EVENT_HIDE_DIALOGUE = 'event:hide-dialogue';

/**
 * Optional per-step typewriter (passed through to createDialogue setContent).
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
 *   positionFull?: string,
 *   side?: 'left'|'right',
 *   minWidth?: number|string,
 *   showActionButton?: boolean,
 *   onCompleteEvent?: string,
 *   avatar?: string,
 *   avatarFull?: string,
 *   avatarAlt?: string,
 *   look?: 'compact'|'full',
 *   typewriter?: StepTypewriterOptions
 * }} StepContentEntry
 */

/** Shared typewriter defaults for tutorial steps that opt in. */
const DEFAULT_STEP_TYPEWRITER = {
    enabled: true,
    targets: ['body'],
    charDelayMs: { min: 10, max: 30 },
    punctuationPauseMs: 30,
    startOn: 'open',
    skipOnPanelClick: true,
    skipOnSpace: false,
    sfxClipId: 'default-ui-typewriter',
};

/** Default panel min width (px) when a step omits `minWidth`. Keeps typewriter from growing the box. */
const DEFAULT_STEP_MIN_WIDTH = 500;

/** Portrait paths under sim-network/images (player-relative). */
const AVATAR_TRAINER =
    './assets/experiences/sim-network/images/trainer-avatar.jpg';
const AVATAR_TRAINER_FULL =
    './assets/experiences/sim-network/images/trainer-full.jpg';
const AVATAR_MANAGER =
    './assets/experiences/sim-network/images/manager-avatar.jpg';
const AVATAR_MANAGER_FULL =
    './assets/experiences/sim-network/images/manager-full.jpg';
const AVATAR_CLIENT =
    './assets/experiences/sim-network/images/client-avatar.jpg';
const AVATAR_CLIENT_FULL =
    './assets/experiences/sim-network/images/client-full.jpg';

/**
 * Placeholder tutorial steps. Timeline emit detail: { "contentKey": "step-1" }
 * Optional `position` — compact dock (9-slot). Legacy `side` left|right still accepted.
 * Optional `positionFull` — full dock; omit → core defaults to top-center. Phone-forced compact uses `position`.
 * Optional `look` — `'compact'` (default) or `'full'` (avatar above larger box; phones force compact).
 * Optional `typewriter` — per-step; omit for instant body text.
 * Optional `minWidth` — panel width in px (default 500). Keeps typewriter from growing the box.
 * Optional `showActionButton` — false hides Skip/Next. Default true.
 * Optional `onCompleteEvent` — window event name when Next is clicked (event name only).
 * Optional `avatar` / `avatarFull` / `avatarAlt` — compact beside text; full above box (falls back to avatar).
 * @type {Record<string, StepContentEntry>}
 */
const STEP_CONTENT = {
    'instructions-01': {
        title: 'Trainer:',
        body: 'Hi! Welcome to sim-network! I\'m one of our senior network engineers and also your trainer. Let\'s go through what you need to know.',
        position: 'center',
        look: 'full',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        positionFull: 'top-center',
        onCompleteEvent: 'event:dialogue-complete-instructions-01',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'instructions-02': {
        title: 'Trainer:',
        body: 'Read the brief below and select "Continue" to get started on your first job.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        onCompleteEvent: 'event:dialogue-complete-instructions-02',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'levelselect-01': {
        title: 'Trainer:',
        body: 'Okay! It\'s time to go out on our next client call. Select a job below to get started!',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-01-1': {
        title: 'Trainer:',
        body: 'Time for your first task. Select the router on the left and drop it somewhere in the office.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-01-2': {
        title: 'Trainer:',
        body: 'Great! Now let\'s connect these wired devices. Select the ethernet cable on the left.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-01-3': {
        title: 'Trainer:',
        body: 'Select the router or comms box and drag along the ground to lay the cable.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-01-4': {
        title: 'Trainer:',
        body: 'Time to test! Select the \'Test Connection\' button to validate your work.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },  
    'level-01-tutorial-02-try-again': {
        title: 'Trainer:',
        body: 'Look\'s like we forgot to connect something. The job is not done unless the network is reachable by the internet. Investigate and try again!',
        position: 'center-left',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },                
    'level-01-tutorial-02-1': {
        title: 'Trainer:',
        body: 'Nicely done! Let\'s try something a little more challenging, place another router in this office.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-02-2': {
        title: 'Trainer:',
        body: 'As you can see, we have two desktop PCs that need to be connected.  Pick one and connect it to the router.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-02-3': {
        title: 'Trainer:',
        body: 'Great! That device is now connected. Did you notice that the floating connection status of the router and PC has changed? That means a connection has been made.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },    
    'level-01-tutorial-02-4': {
        title: 'Trainer:',
        body: 'Doing well so far. More information on connection status for a device is available when selected.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },    
    'level-01-tutorial-02-5': {
        title: 'Trainer:',
        body: 'Are we done here? Select the \'Test Connection\' button to validate your work.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-03-1': {
        title: 'Trainer:',
        body: 'Quick recap. Place a router, run ethernet cables, then press Test Connection. Same moves as the last two jobs.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-03-2': {
        title: 'Trainer:',
        body: 'Place a router in this office first. Same as last time.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-03-3': {
        title: 'Trainer:',
        body: 'This office has more wired devices than one router can hold. A router has 4 ports. A switch has 8. Select the switch and drop it in the office.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-tutorial-03-4': {
        title: 'Trainer:',
        body: 'A switch does not replace the router. Run an ethernet cable from the switch to the router, so the extra devices can reach the internet.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-01-level-04': {
        title: 'Trainer:',
        body: 'Okay! For this job, we have many wired devices that need a connection.  You know what to do, go for it!',
        position: 'center',
        look: 'compact',
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'level-02-tutorial-01': {
        title: 'Trainer:',
        body: 'Let\'s see how you do on another task. Connect these 2 desktop PC\'s. Select the \'Test Connection\' button when done to validate your work.',
        position: 'center',
        look: 'compact',
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_MANAGER_FULL,
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
    'complete-01': {
        title: 'Trainer:',
        body: 'That\'s all jobs successfullly completed! All eNetworks\' office sites are connected and working well. Time to review your work with the CEO.',
        position: 'center',
        look: 'full',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        positionFull: 'top-center',
        onCompleteEvent: 'event:dialogue-complete-complete-01',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },    
    'complete-02': {
        title: 'CEO:',
        body: 'Hello! I\'m the CEO of Sim-Network. The client just called and they are very happy with the work. I wanted to congratulate you personally on a job well done. YOU\'RE HIRED!',
        position: 'center',
        look: 'full',
        showActionButton: false,
        avatar: AVATAR_CLIENT,
        avatarFull: AVATAR_CLIENT_FULL,
        avatarAlt: 'CEO',
        positionFull: 'top-center',
        onCompleteEvent: 'event:dialogue-complete-complete-02',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },
    'complete-03': {
        title: 'Trainer:',
        body: 'Welcome to the team! I\'m looking forward to working with you.',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_TRAINER,
        avatarFull: AVATAR_TRAINER_FULL,
        avatarAlt: 'Trainer',
        positionFull: 'top-center',
        onCompleteEvent: 'event:dialogue-complete-complete-03',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    },    
    'complete-04': {
        title: 'CEO:',
        body: 'You\'re going to be a great asset to Sim-Network. Keep up the good work and you\'ll be a senior network engineer in no time!',
        position: 'top-center',
        look: 'compact',
        showActionButton: false,
        avatar: AVATAR_CLIENT,
        avatarFull: AVATAR_CLIENT_FULL,
        avatarAlt: 'CEO',
        positionFull: 'top-center',
        onCompleteEvent: 'event:dialogue-complete-complete-04',
        typewriter: { ...DEFAULT_STEP_TYPEWRITER },
    }       
};

/**
 * Default dock for every step unless that step sets `position` (or legacy `side`) in STEP_CONTENT.
 * Change this one value — also used when createDialogue boots.
 */
const DEFAULT_DIALOGUE_POSITION = 'center';

/** @type {{ setContent: Function, setPosition: Function, getPosition: Function, setSide: Function, getSide: Function, show: Function, hide: Function, isOpen: Function, openAsync: Function, closeAsync: Function, dispose: Function } | null} */
let dialogue = null;

/** @type {(() => void) | null} */
let removeListeners = null;

/** @type {string} */
let activeContentKey = '';

/**
 * @returns {{ GLOBAL_DATA: object, createDialogue: Function }}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        !host.GLOBAL_DATA ||
        typeof host.createDialogue !== 'function'
    ) {
        throw new Error(
            'Experience host API missing GLOBAL_DATA / createDialogue for tutorial dialogue.'
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
 * Compact dock from STEP_CONTENT. No default here — caller supplies create/default fallback.
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
 * Optional full-look dock. Empty/missing → undefined so core uses top-center default.
 * @param {StepContentEntry} entry
 * @returns {string|undefined}
 */
function resolveEntryPositionFull(entry) {
    if (typeof entry?.positionFull !== 'string') {
        return undefined;
    }
    const trimmed = entry.positionFull.trim();
    return trimmed ? trimmed.toLowerCase() : undefined;
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
    if (!dialogue) {
        return;
    }
    const entry = getStepContent(nextKey);
    if (!entry) {
        dialogue.hide();
        activeContentKey = '';
        console.log(
            `[sim-network-tutorial-dialogue.js]: [N/A] - [showContentKey] - contentKey has a value of ${nextKey}, found has a value of false.`
        ); //This is logged when a show-dialogue emit names an unknown key.
        return;
    }

    if (dialogue.isOpen()) {
        await dialogue.closeAsync();
    }

    // Compact + optional full docks — core picks from effective look (phone forces compact → position).
    const compactPosition = resolveEntryPositionOverride(entry) ?? DEFAULT_DIALOGUE_POSITION;
    const positionFull = resolveEntryPositionFull(entry);

    const showActionButton = entry.showActionButton !== false;
    const onCompleteEvent =
        typeof entry.onCompleteEvent === 'string' && entry.onCompleteEvent.trim()
            ? entry.onCompleteEvent.trim()
            : undefined;
    const avatar =
        typeof entry.avatar === 'string' && entry.avatar.trim()
            ? entry.avatar.trim()
            : undefined;
    const avatarFull =
        typeof entry.avatarFull === 'string' && entry.avatarFull.trim()
            ? entry.avatarFull.trim()
            : undefined;
    const look =
        typeof entry.look === 'string' && entry.look.trim()
            ? entry.look.trim().toLowerCase()
            : undefined;
    dialogue.setContent({
        title: entry.title,
        body: entry.body,
        typewriter: entry.typewriter,
        minWidth: resolveEntryMinWidth(entry),
        showActionButton,
        onCompleteEvent,
        look,
        position: compactPosition,
        positionFull,
        avatar,
        avatarFull,
        avatarAlt: typeof entry.avatarAlt === 'string' ? entry.avatarAlt : '',
    });
    dialogue.show();
    await dialogue.openAsync();

    activeContentKey = nextKey;
    const typewriterOn = entry.typewriter?.enabled === true;
    const appliedMinWidth = resolveEntryMinWidth(entry);
    const appliedPosition = dialogue.getPosition();
    console.log(
        `[sim-network-tutorial-dialogue.js]: [N/A] - [showContentKey] - contentKey has a value of ${nextKey}, title has a value of ${entry.title}, position has a value of ${appliedPosition}, compactPosition has a value of ${compactPosition}, positionFull has a value of ${positionFull || 'default'}, look has a value of ${look || 'default'}, typewriterEnabled has a value of ${typewriterOn}, minWidth has a value of ${appliedMinWidth}, showActionButton has a value of ${showActionButton}, onCompleteEvent has a value of ${onCompleteEvent || 'none'}, avatar has a value of ${avatar || 'none'}, avatarFull has a value of ${avatarFull || 'none'}.`
    ); //This is logged when the tutorial dialogue shows a content key.
}

async function hideDialoguePanel() {
    if (!dialogue) {
        return;
    }
    if (dialogue.isOpen()) {
        await dialogue.closeAsync();
    }
    dialogue.hide();
    activeContentKey = '';
    console.log(
        `[sim-network-tutorial-dialogue.js]: [N/A] - [hideDialoguePanel] - hidden has a value of true.`
    ); //This is logged when hide-dialogue collapses the tutorial dialogue.
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
        await hideDialoguePanel();
    };

    window.addEventListener(EVENT_SHOW_DIALOGUE, onShow);
    window.addEventListener(EVENT_HIDE_DIALOGUE, onHide);

    return () => {
        window.removeEventListener(EVENT_SHOW_DIALOGUE, onShow);
        window.removeEventListener(EVENT_HIDE_DIALOGUE, onHide);
    };
}

/**
 * Show a STEP_CONTENT key from flow code (no timeline required).
 * Prefers an already-inited dialogue; no-ops if init was skipped (e.g. WebXR).
 * @param {string} contentKey
 * @returns {Promise<void>}
 */
export async function showTutorialDialogue(contentKey) {
    const key = normalizeContentKey(contentKey);
    if (!key || !dialogue) {
        console.log(
            `[sim-network-tutorial-dialogue.js]: [N/A] - [showTutorialDialogue] - contentKey has a value of ${key}, dialogueReady has a value of ${Boolean(dialogue)}.`
        ); //This is logged when flow asks to show dialogue but the panel is not ready.
        return;
    }
    if (key === activeContentKey) {
        return;
    }
    await showContentKey(key);
}

/**
 * Hide the tutorial dialogue from flow code (no timeline required).
 * @returns {Promise<void>}
 */
export async function hideTutorialDialogue() {
    await hideDialoguePanel();
}

/**
 * Finish the open line and fire that line's own completion event.
 * One footer Next button can advance the trainer line, then the CEO line.
 * @returns {boolean}
 */
export function advanceActiveTutorialDialogue() {
    const ready = Boolean(dialogue?.isOpen() && typeof dialogue.advance === 'function');
    console.log(
        `[sim-network-tutorial-dialogue.js]: [N/A] - [advanceActiveTutorialDialogue] - ready has a value of ${ready}, activeContentKey has a value of ${activeContentKey}.`
    ); //This is logged when a footer Next click asks the open dialogue line to finish.
    if (!ready) {
        return false;
    }
    dialogue.advance();
    return true;
}

/**
 * Start listening for tutorial dialogue emits. Safe to call again (rebuilds panel).
 */
export function initTutorialDialogue() {
    const { GLOBAL_DATA, createDialogue } = getHost();

    disposeTutorialDialogue();

    if (GLOBAL_DATA.getAppDataWebxrStatus?.()) {
        console.log(
            `[sim-network-tutorial-dialogue.js]: [N/A] - [initTutorialDialogue] - webxrActive has a value of true.`
        ); //This is logged when VR is active and the HTML dialogue is skipped.
        return;
    }

    dialogue = createDialogue({
        id: 'sim-network-tutorial-dialogue',
        position: DEFAULT_DIALOGUE_POSITION,
        icon: 'icon_circle_info',
        ariaLabelClosed: 'Open dialogue',
        ariaLabelOpen: 'Close dialogue',
    });
    dialogue.hide();
    removeListeners = registerContentEventListeners();

    console.log(
        `[sim-network-tutorial-dialogue.js]: [N/A] - [initTutorialDialogue] - ready has a value of true, stepCount has a value of ${Object.keys(STEP_CONTENT).length}.`
    ); //This is logged when tutorial dialogue + listeners are ready.
}

/**
 * Tear down dialogue and listeners (leave tutorial / leave scene).
 */
export function disposeTutorialDialogue() {
    clearListeners();
    activeContentKey = '';
    if (dialogue) {
        dialogue.dispose();
        dialogue = null;
    }
    console.log(
        `[sim-network-tutorial-dialogue.js]: [N/A] - [disposeTutorialDialogue] - cleanupCompleted has a value of true.`
    ); //This is logged when tutorial dialogue is torn down.
}
