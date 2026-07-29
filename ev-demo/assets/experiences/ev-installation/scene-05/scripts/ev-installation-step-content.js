/** Bump when changing this script so console logs prove the browser loaded the latest bundle. */
const SCRIPT_BUILD_TAG = 'ev-installation-step-content-2026-07-29-public-only';

/**
 * Must match HOST_KEY in src/core/experienceHostApi.js.
 * This file is copied into public/ and cannot import from src/.
 */
const EXPERIENCE_HOST_KEY = '__XRS_EXPERIENCE_HOST__';

/**
 * Shared core APIs installed by the player before this script runs.
 * @returns {{ GLOBAL_DATA: object, createGenericDialogPanel: Function, createInfoDrawer: Function }}
 */
function getExperienceHostApi() {
    const host = globalThis[EXPERIENCE_HOST_KEY];
    if (
        !host ||
        !host.GLOBAL_DATA ||
        typeof host.createGenericDialogPanel !== 'function' ||
        typeof host.createInfoDrawer !== 'function'
    ) {
        throw new Error(
            'Experience host API is not installed. The player must call installExperienceHostApi() before loading this customScript.'
        );
    }
    return host;
}

const EVENT_SHOW_STEP_CONTENT = 'event:show-step-content';
const EVENT_HIDE_STEP_CONTENT = 'event:hide-step-content';

/** Timeline emit names for dialogs — defined only in this scene script (not in the timeline player). */
const EVENT_SHOW_SCENE_DIALOG = 'event:show-scene-dialog';
const EVENT_HIDE_SCENE_DIALOG = 'event:hide-scene-dialog';

/** Same event wait-gates already listen for (play / continue). */
const EVENT_CONTINUE_ANIMATION = 'event:continue-animation';

/** Sequence player listens for this and jumps the clock (see sequencePlayer.js). */
const EVENT_REPLAY_FROM_SECONDS = 'event:replay-from-seconds';

/** Timeline time (seconds) used by the end dialog "Restart simulation" button. */
const RESTART_TIME_SECONDS = 0.5;

/** @typedef {{ title: string, body: string, side?: 'left'|'right' }} StepContentEntry */

/**
 * One dialog entry: title + body HTML, optional dock position (left/right/center/…).
 * @typedef {{ title: string, bodyHtml: string, position?: string, footerHtml?: string }} SceneDialogEntry
 */

const START_CONTENT = {
    title: '3D Simulation - Guided DC Charger Installation',
    bodyHtml:
        '<p><div role="alert" class="alert alert-error alert-outline"><svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span><strong>WARNING:</strong><BR>Please read the disclaimer below.</span></div></p><p>&nbsp;</p>'+
        '<p class="text-2xl font-bold">DISCLAIMER</p>' +
        '<p>This is a 3D simulation and an approximation of the installation process for an EV DC charger.</p>' +
        '<p>Please make sure to seek out and read the <strong>current offical user and installation guides</strong> for your relevant EV charger model before attempting installation in a real world setting.</p>' +
        '<p>The manufacturer of this courseware is <strong>not liable for any damages or injuries</strong> resulting from the use of this simulation and/or courseware.</p>' +
        '<p>That said, great care has been made to ensure this simulation is accurate and can take you through a generic installation process.</p><p>&nbsp;</p>' +
        '<p>Select the <strong>"I agree"</strong> button below to accept these terms and start the guided simulation.</p>',
    position: 'center',
    footerHtml:
        '<button type="button" class="btn btn-error btn-xl" data-action="agree">I AGREE</button>',
};

const END_CONTENT = {
    title: 'Installation 3D Simulation Completed',
    bodyHtml:
        '<p>You have reached the end of this 3D simulation.</p>'+
        '<p>Press the "Restart simulation" button to start over from the beginning.</p>',
    position: 'center',
    footerHtml:
        '<button type="button" class="btn btn-primary" data-action="restart">Restart simulation</button>',
};

/**
 * Scene-05 step drawer copy. One entry per contentKey; missing key = no drawer.
 * Timeline emit detail: { "contentKey": "step-8" } (phase keys like "phase-1" too).
 * Optional `side: 'right'` per entry; omit or use `'left'` for default left edge.
 */
/** @type {Record<string, StepContentEntry>} */
const STEP_CONTENT = {
    'phase-1': {
        title: '1: Unboxing & Preparation',
        body:
            'The charger arrives secured inside a wooden shipping crate. ' +
            'This phase shows the crate being dismantled and the charger separated from its packaging, ' +
            'culminating in the front door being opened and all accessories laid out ready for installation.<BR><BR><strong>Press the play button below to continue.</strong>'
    },
    'step-1': { title: 'Step: 1', body: 'Dismantle the wooden box/crate surrounding the charger.'},
    'step-2': { title: 'Step: 2', body: 'Remove the M5×12 (×24) bolts securing the base cover of the charger base.' },
    'step-3': { title: 'Step: 3', body: 'Remove the panels and locate the wooden bracket fixing bolts.' },
    'step-4': {
        title: 'Step: 4',
        body: 'Unscrew the wooden bracket fixing bolts, M10×60 (×8).',
    },
    'step-5': { title: 'Step: 5', body: 'Insert key into front door lock and open the front door.' },
    'step-6': { title: 'Step: 6', body: 'Remove the accessory bag from inside the unit, then close and lock the front door.' },
    'step-7': { title: 'Step: 7', body: '<div role="alert" class="alert alert-error alert-outline"><svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span><strong>WARNING:</strong><BR>Handle with care - the charger unit is extremely heavy.<BR>Do not attempt charger separation without the proper equipment.</span></div><BR>Use a crane or forklift to separate the charger from the wooden bracket.' },

    'phase-2': {
        title: '2: Site clearance requirements',
        body: 'Before any installation work begins, the site must be verified against all clearance requirements.<BR>' +
                'There are clearance requirements for all sides of the charger to allow for proper placement and maintenance access. ' +
                'A total clearance area of 2400 mm (L) x 700 mm (W) is required per charger. There are clearance requirements for all sides of the charger to allow for proper placement and maintenance access. ' +
                '<BR><BR><strong>Press the play button below to continue.</strong>'
    },
    'step-8': { title: 'Step: 8', body: 'The charger needs at least 150mm of clear space above its top, 800mm on each side for maintenance access, and 50mm at the rear. Leave at least 400mm clearance at the front of the charger to any parking bays, ideally leave enough for the door to fully open (~700mm)' },

    'phase-3': {
        title: '3: Foundation and conduit installation',
        body:
            'Before the charger can be mounted, power cables must be fed through the underground conduit and the concrete foundation built from scratch. ' +
            'This phase covers all groundwork — marking out, excavating, running the conduit ' +
            'and pouring the concrete slab that the charger will sit on permanently.' +
            '<BR><BR><strong>Press the play button below to continue.</strong>',
    },
    'step-9': {
        title: 'Step: 9',
        body: 'Mark out the foundation footprint on the ground: 800mm (L) × 340mm (W).',
    },
    'step-10': { title: 'Step: 10', body: 'Excavate to underground depth of 500mm (D).' },
    'step-11': {
        title: 'Step: 11',
        body:
            'Position the embedded PVC conduit pipe (DN80) inside the formwork, ensuring it protrudes above the  ' +
            'visible concrete foundation (≥200mm).<BR>Aim for a length of 250 mm - 280 mm from ground level for best wiring access.',
    },
    'step-12': {
        title: 'Step: 12',
        body: 'Pour the concrete and build up the foundation so it sits ≥200mm above ground level.',
    },
    'step-13': {
        title: 'Step: 13',
        body: 'Feed the power cable (L1/L2/L3/N/PE) up through the embedded PVC conduit from underground.  ' +
        '<BR>Leave sufficient cable length exposed above the foundation for internal connection.',
    },
    
    
    'phase-4': {
        title: '4: Drilling anchors & charger mounting',
        body:
        'The anchoring bolt holes are first drilled into the foundation.<BR>Then, the charger unit is lifted into position and bolted permanently to the foundation.' +
        '<BR>This phase will require specialised lifting equipment such as a forklift or crane. Do not attempt movement of the charger without help from professionals.'+
        '<BR><BR><strong>Press the play button below to continue.</strong>',
    },
    'step-14': {
        title: 'Step: 14',
        body: 'Measure the designated anchor bolt positions. ',
    },
    'step-15': {
        title: 'Step: 15',
        body: 'Drill 8× φ14mm holes to a depth of 100mm.',
    },
    'step-16': { title: 'Step: 16', 
        body: 'Insert 8× M12×100 expansion bolts (stainless steel SUS304) into the drilled holes.',
    },
    'step-17': {
        title: 'Step: 17',
        body: '<div role="alert" class="alert alert-error alert-outline"><svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span><strong>WARNING:</strong><BR>Handle with care - the charger unit is extremely heavy.<BR>Do not attempt charger movement without the proper equipment.</span></div><BR>Use a crane or forklift to lift the charging stake and position the unit over the foundation. Lower the unit carefully, aligning with the M12×100 expansion bolts.' 
    },
    'step-18': { title: 'Step: 18', 
        body: 'Place flat washers, spring washers over each bolt and tighten 8× M12 nuts onto the expansion bolts.' 
    },
    'step-19': { title: 'Step: 19', 
        body: 'Replace the charger base cover and all 24x M5x12 botls.' 
    },
    
    'phase-5': {
        title: '5: Power Module Installation',
        body:
            "The internal DC power modules are fitted into the charger's right-hand bay. " +
            'The right door is unlocked and opened, and each module is slid into its numbered slot '+
            'and screwed in place.'+
            '<BR><BR><strong>Press the play button below to continue.</strong>'
    },
    'step-20': { title: 'Step: 20', body: 'Use the key to open the right-side door of the charger.' },
    'step-21': { title: 'Step: 21', body: 'Slide the power modules into the corresponding module slots. Tighten the upper and lower screws (4x M4×10) for each power module.' },
    'step-22': { title: 'Step: 22', body: 'Close and lock the right-side door of the charger.' },
    
    'phase-6': {
        title: '6: Internal Setup & Wiring',
        body:
            'Open the front compartment, remove the input PC shield, and install the RTC backup battery. ' +
            'Route the five incoming conductors (L1, L2, L3, N, PE) to their labelled terminals, attach the correct cable lugs ' +
            '(DT-50 for L1/L2/L3/N; DT-25 for PE), connect and verify each connection, then refit the PC shield.' +
            '<BR><BR><strong>Press the play button below to continue.</strong>',
    },
    'step-23': { title: 'Step: 23', body: 'Unlock and open the front door of the charger. Install the CR2032 button battery into the battery holder on the mother board (positive pole facing upwards).',
    },
    'step-24': { title: 'Step: 24', body: 'Unscrew the 2× M6×16 screws and remove the input PC shield.' },
    'step-25': {
        title: 'Step: 25',
        body: '<div role="alert" class="alert alert-error alert-outline"><svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span><strong>WARNING:</strong><BR>Turn off the power when handling the wiring. The input and output voltages of this device are high voltage, which threaten safety.<BR>Always consult with a licensed contractor/electrician or trained installation expert when operating these products.</span></div><BR>At the bottom of the charger unit, route the cables to their respective terminals. Attach cable lugs if not already attached.<BR>Use <strong>DT-50</strong> for the <strong>L1/L2/L3/N</strong> cables, and <strong>DT-25</strong> for the <strong>PE</strong> cable.' },
    'step-26': {
        title: 'Step: 26',
        body: '<div role="alert" class="alert alert-error alert-outline"><svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span><strong>WARNING:</strong><BR>Turn off the power when handling the wiring. The input and output voltages of this device are high voltage, which threaten safety.<BR>Always consult with a licensed contractor/electrician or trained installation expert when operating these products.</span></div><BR>Connect and secure each conductor to its labelled terminal (L1, L2, L3, N, PE).<BR>Verify all terminals are tightened and connections are correct against the instalation documentation.',
    },
    'step-27': {
        title: 'Step: 27',
        body: 'Re-secure the PC shield over the input terminals and replace the 2× M6×16 screws.',
    },

    'phase-7': {
        title: '7: Sealing & Finishing up',
        body:
            'The final phase makes the installation weatherproof and complete. ' +
            'The cable entry points are packed with fireproof sealant to prevent fire spread and seal against moisture, '+
            'then both doors are locked shut.'+
            '<BR><BR><strong>Press the play button below to continue.</strong>',
    },
    'step-28': {
        title: 'Step: 28',
        body: 'Pack fireproof/intumescent sealant around the conduit opening and the conduit entrance at the bottom of the charger.' },
    'step-29': { title: 'Step: 29', body: 'Close and lock the front door.' },
};

/**
 * Dialogs opened from the timeline. Keys are dialogId values in emit detail.
 * - show: event `event:show-scene-dialog`, detail `{ "dialogId": "start" }` or `"end"`
 * - hide: event `event:hide-scene-dialog`, detail `{ "dialogId": "start" }` or `"end"`
 * @type {Record<string, SceneDialogEntry>}
 */
const DIALOG_CONTENT = {
    start: START_CONTENT,
    end: END_CONTENT,
};

/** @type {import('../core/ui/infoDrawer.js').InfoDrawerApi | null} */
let drawer = null;

/** @type {import('../core/ui/genericDialogPanel.js').GenericDialogPanelApi | null} */
let sceneDialog = null;

/** @type {(() => void) | null} */
let removeListeners = null;

/** @type {string} */
let activeContentKey = '';

/** @type {string} */
let activeDialogId = '';

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
 * @param {StepContentEntry} entry
 * @returns {'left'|'right'}
 */
function resolveEntrySide(entry) {
    return entry?.side === 'right' ? 'right' : 'left';
}

function clearListeners() {
    if (typeof removeListeners === 'function') {
        removeListeners();
        removeListeners = null;
    }
}

/**
 * @param {unknown} rawKey
 * @returns {string}
 */
function normalizeContentKey(rawKey) {
    return typeof rawKey === 'string' ? rawKey.trim() : '';
}

/**
 * @param {string} nextKey
 * @returns {Promise<void>}
 */
async function showContentKey(nextKey) {
    if (!drawer) return;
    const entry = getStepContent(nextKey);
    if (!entry) {
        drawer.hide();
        activeContentKey = '';
        console.log(
            `[ev-installation-step-content.js]: [N/A] - [showContentKey] - contentKey has a value of ${nextKey}, found has a value of false.`
        ); //This is logged to debug content lookups and verify drawer hides for missing keys.
        return;
    }

    // Replace current content (close → set side → set → open) so the slide animation reads clearly.
    if (drawer.isOpen()) {
        await drawer.closeAsync();
    }

    const nextSide = resolveEntrySide(entry);
    if (drawer.getSide() !== nextSide) {
        drawer.setSide(nextSide);
    }

    drawer.setContent({ title: entry.title, body: entry.body });
    drawer.show();
    await drawer.openAsync();

    activeContentKey = nextKey;
    console.log(
        `[ev-installation-step-content.js]: [N/A] - [showContentKey] - contentKey has a value of ${nextKey}, title has a value of ${entry.title}.`
    ); //This is logged to debug drawer updates when a show-step-content marker fires.
}

async function hideDrawer() {
    if (!drawer) return;
    if (drawer.isOpen()) {
        await drawer.closeAsync();
    }
    drawer.hide();
    activeContentKey = '';
    console.log(
        `[ev-installation-step-content.js]: [N/A] - [hideDrawer] - hidden has a value of true.`
    ); //This is logged to debug hide-step-content handling and verify drawer collapses then hides.
}

/**
 * @param {string} dialogId
 * @returns {SceneDialogEntry|null}
 */
function getDialogContent(dialogId) {
    if (!dialogId) {
        return null;
    }
    return DIALOG_CONTENT[dialogId] ?? null;
}

/**
 * Turn plain newlines into HTML line breaks so multi-line body text displays correctly.
 * @param {string} bodyHtml
 * @returns {string}
 */
function bodyHtmlWithLineBreaks(bodyHtml) {
    if (typeof bodyHtml !== 'string' || bodyHtml.length === 0) {
        return '';
    }
    return bodyHtml.replace(/\n/g, '<br>');
}

/**
 * Wire footer buttons for the open dialog (option D: bind in this scene script).
 * @param {{ footerEl: HTMLElement, close: () => void }} ctx
 */
function bindSceneDialogFooterActions(ctx) {
    const { footerEl, close } = ctx;

    const agreeBtn = footerEl.querySelector('[data-action="agree"]');
    if (agreeBtn) {
        agreeBtn.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent(EVENT_CONTINUE_ANIMATION));
            console.log(
                `[ev-installation-step-content.js]: [N/A] - [bindSceneDialogFooterActions] - agreeClicked has a value of true.`
            ); //This is logged when I agree fires continue-animation and closes the start dialog.
            activeDialogId = '';
            close();
        });
    }

    const restartBtn = footerEl.querySelector('[data-action="restart"]');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            window.dispatchEvent(
                new CustomEvent(EVENT_REPLAY_FROM_SECONDS, {
                    detail: { seconds: RESTART_TIME_SECONDS },
                })
            );
            console.log(
                `[ev-installation-step-content.js]: [N/A] - [bindSceneDialogFooterActions] - restartSeconds has a value of ${RESTART_TIME_SECONDS}.`
            ); //This is logged when Restart asks the sequence player to jump to RESTART_TIME_SECONDS.
            activeDialogId = '';
            close();
        });
    }
}

/**
 * @param {string} dialogId
 * @returns {Promise<void>}
 */
async function showSceneDialog(dialogId) {
    if (!sceneDialog) {
        return;
    }
    const entry = getDialogContent(dialogId);
    if (!entry) {
        console.log(
            `[ev-installation-step-content.js]: [N/A] - [showSceneDialog] - dialogId has a value of ${dialogId}, found has a value of false.`
        ); //This is logged when a show-scene-dialog emit uses an id that is not in DIALOG_CONTENT.
        return;
    }

    const dialogEl = sceneDialog.getDialogElement();
    const isOpen = Boolean(dialogEl?.open);
    if (!isOpen) {
        activeDialogId = '';
    }

    if (activeDialogId === dialogId && isOpen) {
        console.log(
            `[ev-installation-step-content.js]: [N/A] - [showSceneDialog] - dialogId has a value of ${dialogId}, alreadyOpen has a value of true.`
        ); //This is logged when show is ignored because that dialog is already open.
        return;
    }

    if (activeDialogId && isOpen) {
        await sceneDialog.closeAsync('replace');
        activeDialogId = '';
    }

    await sceneDialog.openAsync({
        title: entry.title,
        bodyHtml: bodyHtmlWithLineBreaks(entry.bodyHtml),
        footerHtml: entry.footerHtml ?? '',
        position: entry.position ?? 'center',
        nonBlocking: false,
        bind: bindSceneDialogFooterActions,
    });
    activeDialogId = dialogId;
    console.log(
        `[ev-installation-step-content.js]: [N/A] - [showSceneDialog] - dialogId has a value of ${dialogId}, title has a value of ${entry.title}.`
    ); //This is logged when a timeline show-scene-dialog emit opens the panel.
}

/**
 * Closes the panel only when dialogId matches the one currently open.
 * @param {string} dialogId
 * @returns {Promise<void>}
 */
async function hideSceneDialogIfMatching(dialogId) {
    if (!sceneDialog || !dialogId) {
        return;
    }
    if (activeDialogId !== dialogId) {
        console.log(
            `[ev-installation-step-content.js]: [N/A] - [hideSceneDialogIfMatching] - dialogId has a value of ${dialogId}, activeDialogId has a value of ${activeDialogId}, matched has a value of false.`
        ); //This is logged when hide is skipped because dialogId does not match the open dialog.
        return;
    }
    await sceneDialog.closeAsync('timeline-hide');
    activeDialogId = '';
    console.log(
        `[ev-installation-step-content.js]: [N/A] - [hideSceneDialogIfMatching] - dialogId has a value of ${dialogId}, closed has a value of true.`
    ); //This is logged when a matching hide-scene-dialog emit closes the panel.
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

    /** @param {CustomEvent} event */
    const onShowDialog = async (event) => {
        const detail = event?.detail ?? {};
        const dialogId = normalizeContentKey(detail.dialogId);
        if (!dialogId) {
            console.log(
                `[ev-installation-step-content.js]: [N/A] - [onShowDialog] - dialogIdMissing has a value of true.`
            ); //This is logged when show-scene-dialog fires without a dialogId.
            return;
        }
        await showSceneDialog(dialogId);
    };

    /** @param {CustomEvent} event */
    const onHideDialog = async (event) => {
        const detail = event?.detail ?? {};
        const dialogId = normalizeContentKey(detail.dialogId);
        if (!dialogId) {
            console.log(
                `[ev-installation-step-content.js]: [N/A] - [onHideDialog] - dialogIdMissing has a value of true.`
            ); //This is logged when hide-scene-dialog fires without a dialogId.
            return;
        }
        await hideSceneDialogIfMatching(dialogId);
    };

    window.addEventListener(EVENT_SHOW_STEP_CONTENT, onShow);
    window.addEventListener(EVENT_HIDE_STEP_CONTENT, onHide);
    window.addEventListener(EVENT_SHOW_SCENE_DIALOG, onShowDialog);
    window.addEventListener(EVENT_HIDE_SCENE_DIALOG, onHideDialog);

    return () => {
        window.removeEventListener(EVENT_SHOW_STEP_CONTENT, onShow);
        window.removeEventListener(EVENT_HIDE_STEP_CONTENT, onHide);
        window.removeEventListener(EVENT_SHOW_SCENE_DIALOG, onShowDialog);
        window.removeEventListener(EVENT_HIDE_SCENE_DIALOG, onHideDialog);
    };
}

/**
 * Scene-05 custom script: step drawer + timeline dialogs driven by emit markers.
 * @param {import('@babylonjs/core').Scene} scene
 * @param {string} [sceneId]
 */
export async function createScene(scene, sceneId = null) {
    console.log(
        `[ev-installation-step-content.js]: [N/A] - [createScene] - scriptBuildTag has a value of ${SCRIPT_BUILD_TAG}, sceneId has a value of ${sceneId || 'null'}.`
    ); //This is logged on scene entry to confirm the step-content drawer script loaded.

    const { GLOBAL_DATA, createInfoDrawer, createGenericDialogPanel } = getExperienceHostApi();

    if (GLOBAL_DATA.getAppDataWebxrStatus()) {
        console.log(
            `[ev-installation-step-content.js]: [N/A] - [createScene] - webxrActive has a value of true.`
        ); //This is logged when the drawer UI is skipped in VR mode.
        return;
    }

    clearListeners();
    activeContentKey = '';
    activeDialogId = '';

    drawer = createInfoDrawer({
        id: 'scene05-step-content-drawer',
        side: 'left',
        icon: 'icon_circle_info',
        ariaLabelClosed: 'Open step note',
        ariaLabelOpen: 'Close step note',
    });
    drawer.hide();

    sceneDialog = createGenericDialogPanel({
        id: 'scene05-timeline-dialog',
        nonBlocking: false,
        position: 'center',
        allowBackdropClose: false,
        closeOnEscape: false,
        hideCloseButton: true,
        footerAlign: 'center',
    });

    removeListeners = registerContentEventListeners();
}

export async function dispose() {
    clearListeners();
    activeContentKey = '';
    activeDialogId = '';
    if (drawer) {
        drawer.dispose();
        drawer = null;
    }
    if (sceneDialog) {
        sceneDialog.dispose();
        sceneDialog = null;
    }
    console.log(
        `[ev-installation-step-content.js]: [N/A] - [dispose] - cleanupCompleted has a value of true.`
    ); //This is logged when leaving the scene and the drawer script is torn down.
}
