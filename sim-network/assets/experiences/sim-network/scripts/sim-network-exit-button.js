/**
 * Sim-network EXIT button - top-right confirm + scene switch.
 * Used on in-game maps and on level-select (different target / copy per mount).
 */

import { clearCurrentTrackSelection } from './simNetworkSession.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const EXIT_BUTTON_ID = 'sim-network-exit-button';
const EXIT_DIALOG_ID = 'sim-network-exit-confirm-dialog';
/** Narrow width (phone portrait) or short height (phone landscape). Same idea as dialogue compact. */
const PHONE_SIZE_MQ = '(max-width: 767px), (max-height: 500px)';
/** Matches EVENTS.DEVICE_BODY_CLASSES_SYNCED in src/utils/eventConstants.js. */
const DEVICE_BODY_CLASSES_SYNCED = 'deviceBodyClassesSynced';
const COMPACT_BUTTON_CLASS = 'sim-network-exit-button__btn--compact';
/** Width, height, padding, and gap the shared button helper adds so the label fits. */
const LABEL_LAYOUT_CLASSES = ['h-10', 'w-fit', 'min-w-24', 'px-4', 'gap-2'];

/** Default mount: leave in-game map back to level-select. Callers pass label and icon. */
const DEFAULT_OPTIONS = {
    targetSceneId: '03-level-select',
    title: 'Leave this level?',
    message: 'Progress in this level will not be saved if you leave now. Are you sure? ',
    clearCurrentTrack: true,
    label: 'EXIT',
    iconName: '',
    iconPosition: 'before',
};

/** @type {HTMLElement | null} */
let exitButtonWrap = null;
/** @type {{ open: Function, close: Function, dispose: Function, getDialogElement?: Function } | null} */
let exitDialogApi = null;
/** @type {boolean} */
let confirmOpen = false;
/** @type {(() => void) | null} */
let removeDialogCloseListener = null;
/** @type {MediaQueryList | null} */
let phoneSizeMql = null;
/** @type {(() => void) | null} */
let onExitButtonLayoutChange = null;
/** @type {boolean | null} */
let exitButtonCompact = null;
/** @type {{ targetSceneId: string, title: string, message: string, clearCurrentTrack: boolean, label: string, iconName: string, iconPosition: string }} */
let activeOptions = { ...DEFAULT_OPTIONS };

/**
 * @returns {{
 *   button: Function,
 *   createGenericDialogPanel: Function,
 *   switchToScene: (sceneId: string, fadeDuration?: number) => Promise<string|null>,
 * }}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (
        !host ||
        typeof host.button !== 'function' ||
        typeof host.createGenericDialogPanel !== 'function' ||
        typeof host.switchToScene !== 'function'
    ) {
        throw new Error(
            'Experience host API missing button, createGenericDialogPanel, or switchToScene. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * @param {object} [options]
 * @returns {{ targetSceneId: string, title: string, message: string, clearCurrentTrack: boolean, label: string, iconName: string, iconPosition: string }}
 */
function resolveOptions(options = {}) {
    const targetSceneId =
        typeof options.targetSceneId === 'string' && options.targetSceneId.trim()
            ? options.targetSceneId.trim()
            : DEFAULT_OPTIONS.targetSceneId;
    const title =
        typeof options.title === 'string' && options.title.trim()
            ? options.title.trim()
            : DEFAULT_OPTIONS.title;
    const message =
        typeof options.message === 'string' && options.message.trim()
            ? options.message.trim()
            : DEFAULT_OPTIONS.message;
    const clearCurrentTrack =
        options.clearCurrentTrack !== undefined
            ? !!options.clearCurrentTrack
            : DEFAULT_OPTIONS.clearCurrentTrack;
    const label =
        typeof options.label === 'string' && options.label.trim()
            ? options.label.trim()
            : DEFAULT_OPTIONS.label;
    const iconName =
        typeof options.iconName === 'string' && options.iconName.trim()
            ? options.iconName.trim()
            : DEFAULT_OPTIONS.iconName;
    const iconPosition = options.iconPosition === 'after' ? 'after' : 'before';
    return { targetSceneId, title, message, clearCurrentTrack, label, iconName, iconPosition };
}

function detachDialogCloseListener() {
    if (typeof removeDialogCloseListener === 'function') {
        removeDialogCloseListener();
        removeDialogCloseListener = null;
    }
}

function ensureExitDialog() {
    const host = getHost();
    if (exitDialogApi) {
        return exitDialogApi;
    }
    // Blocking confirm: backdrop / ESC / X all close without leaving (same as No).
    exitDialogApi = host.createGenericDialogPanel({
        id: EXIT_DIALOG_ID,
        allowBackdropClose: true,
        closeOnEscape: true,
        hideCloseButton: false,
        footerAlign: 'end',
        nonBlocking: false,
    });
    console.log(
        `[sim-network-exit-button.js]: [N/A] - [ensureExitDialog] - dialogId has a value of ${EXIT_DIALOG_ID}.`
    ); //This is logged when the leave confirm panel is created.
    return exitDialogApi;
}

function openLeaveConfirmDialog() {
    if (confirmOpen) {
        console.log(
            `[sim-network-exit-button.js]: [N/A] - [openLeaveConfirmDialog] - confirmOpen has a value of true.`
        ); //This is logged when EXIT is clicked while the confirm dialog is already open.
        return;
    }

    const host = getHost();
    const dialogApi = ensureExitDialog();
    const { targetSceneId, title, message, clearCurrentTrack } = activeOptions;
    confirmOpen = true;
    detachDialogCloseListener();

    const dialogEl = dialogApi.getDialogElement?.();
    if (dialogEl) {
        const onClose = () => {
            confirmOpen = false;
            console.log(
                `[sim-network-exit-button.js]: [N/A] - [onClose] - confirmOpen has a value of false.`
            ); //This is logged when the leave confirm closes (No, X, backdrop, ESC, or Yes).
            dialogEl.removeEventListener('close', onClose);
            removeDialogCloseListener = null;
        };
        dialogEl.addEventListener('close', onClose);
        removeDialogCloseListener = () => dialogEl.removeEventListener('close', onClose);
    }

    const bodyHtml = `<p>${message}</p>`;
    dialogApi.open({
        title,
        bodyHtml,
        footerHtml: '',
        nonBlocking: false,
        bind: ({ footerEl, close }) => {
            const yesWrap = host.button(
                'sim-network-exit-yes',
                'primary',
                { iconName: '', iconOnly: false, iconPosition: 'before' },
                { text: 'Yes', tooltipPosition: 'top' },
                () => {
                    console.log(
                        `[sim-network-exit-button.js]: [N/A] - [openLeaveConfirmDialog] - confirmResponse has a value of YES, targetSceneId has a value of ${targetSceneId}, clearCurrentTrack has a value of ${clearCurrentTrack}.`
                    ); //This is logged when the learner confirms EXIT and a scene switch starts.
                    if (clearCurrentTrack) {
                        clearCurrentTrackSelection();
                    }
                    confirmOpen = false;
                    close();
                    void host.switchToScene(targetSceneId);
                }
            );
            const noWrap = host.button(
                'sim-network-exit-no',
                'neutral',
                { iconName: '', iconOnly: false, iconPosition: 'before' },
                { text: 'No', tooltipPosition: 'top' },
                () => {
                    console.log(
                        `[sim-network-exit-button.js]: [N/A] - [openLeaveConfirmDialog] - confirmResponse has a value of NO.`
                    ); //This is logged when the learner cancels EXIT and stays on the current screen.
                    confirmOpen = false;
                    close();
                }
            );
            footerEl.appendChild(yesWrap);
            footerEl.appendChild(noWrap);
        },
    });

    console.log(
        `[sim-network-exit-button.js]: [N/A] - [openLeaveConfirmDialog] - confirmOpen has a value of true, title has a value of ${title}.`
    ); //This is logged when the EXIT confirm dialog is shown.
}

/**
 * Phone, or a window that is phone-sized. A tablet keeps the words.
 * @returns {boolean}
 */
function shouldUseCompactExitButton() {
    const body = document.body;
    if (!(body instanceof HTMLElement)) {
        return false;
    }
    if (body.classList.contains('device-info-type-tablet')) {
        return false;
    }
    if (body.classList.contains('device-info-type-mobile')) {
        return true;
    }
    return Boolean(phoneSizeMql && phoneSizeMql.matches);
}

/**
 * Swap btn-lg for btn-md and drop the label padding when the screen is phone-sized.
 */
function applyExitButtonLayout() {
    const innerBtn = exitButtonWrap?.querySelector('button');
    if (!(innerBtn instanceof HTMLButtonElement)) {
        return;
    }
    const compact = shouldUseCompactExitButton();
    if (exitButtonCompact === compact) {
        return;
    }
    exitButtonCompact = compact;
    innerBtn.classList.toggle('btn-lg', !compact);
    innerBtn.classList.toggle('btn-md', compact);
    innerBtn.classList.toggle('btn-square', compact);
    innerBtn.classList.toggle(COMPACT_BUTTON_CLASS, compact);
    LABEL_LAYOUT_CLASSES.forEach((className) => {
        innerBtn.classList.toggle(className, !compact);
    });
    if (compact) {
        innerBtn.setAttribute('aria-label', activeOptions.label);
    } else {
        innerBtn.removeAttribute('aria-label');
    }
    console.log(
        `[sim-network-exit-button.js]: [N/A] - [applyExitButtonLayout] - compact has a value of ${compact}, sizeClass has a value of ${compact ? 'btn-md' : 'btn-lg'}.`
    ); //This is logged when the EXIT button switches between the word label and the phone icon-only size.
}

function bindExitButtonLayout() {
    phoneSizeMql = window.matchMedia(PHONE_SIZE_MQ);
    onExitButtonLayoutChange = () => {
        applyExitButtonLayout();
    };
    if (typeof phoneSizeMql.addEventListener === 'function') {
        phoneSizeMql.addEventListener('change', onExitButtonLayoutChange);
    }
    window.addEventListener(DEVICE_BODY_CLASSES_SYNCED, onExitButtonLayoutChange);
    exitButtonCompact = null;
    applyExitButtonLayout();
}

function unbindExitButtonLayout() {
    if (phoneSizeMql && onExitButtonLayoutChange && typeof phoneSizeMql.removeEventListener === 'function') {
        phoneSizeMql.removeEventListener('change', onExitButtonLayoutChange);
    }
    if (onExitButtonLayoutChange) {
        window.removeEventListener(DEVICE_BODY_CLASSES_SYNCED, onExitButtonLayoutChange);
    }
    phoneSizeMql = null;
    onExitButtonLayoutChange = null;
    exitButtonCompact = null;
}

/**
 * Mount the EXIT button in the top-right header.
 * @param {object} [options]
 * @param {string} [options.targetSceneId='03-level-select'] Scene to open on Yes.
 * @param {string} [options.title='Leave this level?'] Confirm dialog title.
 * @param {string} [options.message] Confirm dialog body. Falls back to the default leave message.
 * @param {boolean} [options.clearCurrentTrack=true] Clear in-progress track before switch (in-game).
 * @param {string} [options.label='EXIT'] Words on the button.
 * @param {string} [options.iconName=''] Icon name from icons.js. Empty means no icon.
 * @param {'before'|'after'} [options.iconPosition='before'] Icon left of the label, or right of it.
 */
export function initExitButton(options = {}) {
    disposeExitButton();
    activeOptions = resolveOptions(options);

    const host = getHost();
    const headerEnd = document.getElementById('uiContainer-header-end');
    if (!headerEnd) {
        console.warn(
            `[sim-network-exit-button.js]: [N/A] - [initExitButton] - headerEndMissing has a value of true.`
        ); //This is logged when the EXIT button cannot mount because the header slot is missing.
        return;
    }

    exitButtonWrap = host.button(
        EXIT_BUTTON_ID,
        'neutral',
        { iconName: activeOptions.iconName, iconOnly: false, iconPosition: activeOptions.iconPosition },
        { text: activeOptions.label, tooltipPosition: 'left' },
        () => {
            console.log(
                `[sim-network-exit-button.js]: [N/A] - [initExitButton] - exitClicked has a value of true, targetSceneId has a value of ${activeOptions.targetSceneId}.`
            ); //This is logged when the learner presses EXIT to open the confirm dialog.
            openLeaveConfirmDialog();
        }
    );
    exitButtonWrap.classList.add('sim-network-exit-button');
    const innerBtn = exitButtonWrap.querySelector('button');
    if (innerBtn) {
        innerBtn.classList.add('sim-network-exit-button__btn');
    }
    headerEnd.appendChild(exitButtonWrap);
    bindExitButtonLayout();
    ensureExitDialog();

    console.log(
        `[sim-network-exit-button.js]: [N/A] - [initExitButton] - exitButtonMounted has a value of true, label has a value of ${activeOptions.label}, iconName has a value of ${activeOptions.iconName}, iconPosition has a value of ${activeOptions.iconPosition}, title has a value of ${activeOptions.title}.`
    ); //This is logged when the EXIT button is mounted in the top-right header.
}

/**
 * Remove EXIT button and confirm dialog (scene / map teardown).
 */
export function disposeExitButton() {
    unbindExitButtonLayout();
    detachDialogCloseListener();
    confirmOpen = false;
    activeOptions = { ...DEFAULT_OPTIONS };

    if (exitDialogApi) {
        exitDialogApi.dispose();
        exitDialogApi = null;
    }

    if (exitButtonWrap) {
        exitButtonWrap.remove();
        exitButtonWrap = null;
    } else {
        document.getElementById(EXIT_BUTTON_ID)?.remove();
    }

    console.log(
        `[sim-network-exit-button.js]: [N/A] - [disposeExitButton] - cleanupCompleted has a value of true.`
    ); //This is logged when the EXIT button and leave confirm are torn down.
}
