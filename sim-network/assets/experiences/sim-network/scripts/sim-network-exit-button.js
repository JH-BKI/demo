/**
 * Sim-network EXIT button - top-right confirm + scene switch.
 * Used on in-game maps and on level-select (different target / copy per mount).
 */

import { clearCurrentTrackSelection } from './simNetworkSession.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';
const EXIT_BUTTON_ID = 'sim-network-exit-button';
const EXIT_DIALOG_ID = 'sim-network-exit-confirm-dialog';

/** Default mount: leave in-game map back to level-select. */
const DEFAULT_OPTIONS = {
    targetSceneId: '03-level-select',
    title: 'Leave this level?',
    message: 'Are you sure you want to go back?',
    clearCurrentTrack: true,
};

/** @type {HTMLElement | null} */
let exitButtonWrap = null;
/** @type {{ open: Function, close: Function, dispose: Function, getDialogElement?: Function } | null} */
let exitDialogApi = null;
/** @type {boolean} */
let confirmOpen = false;
/** @type {(() => void) | null} */
let removeDialogCloseListener = null;
/** @type {{ targetSceneId: string, title: string, message: string, clearCurrentTrack: boolean }} */
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
 * @returns {{ targetSceneId: string, title: string, message: string, clearCurrentTrack: boolean }}
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
    return { targetSceneId, title, message, clearCurrentTrack };
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
 * Mount the EXIT button in the top-right header.
 * @param {object} [options]
 * @param {string} [options.targetSceneId='03-level-select'] Scene to open on Yes.
 * @param {string} [options.title='Leave this level?'] Confirm dialog title.
 * @param {string} [options.message='Are you sure you want to go back?'] Confirm dialog body.
 * @param {boolean} [options.clearCurrentTrack=true] Clear in-progress track before switch (in-game).
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
        { iconName: '', iconOnly: false, iconPosition: 'before' },
        { text: 'EXIT', tooltipPosition: 'left' },
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
    ensureExitDialog();

    console.log(
        `[sim-network-exit-button.js]: [N/A] - [initExitButton] - exitButtonMounted has a value of true, targetSceneId has a value of ${activeOptions.targetSceneId}.`
    ); //This is logged when the EXIT button is mounted in the top-right header.
}

/**
 * Remove EXIT button and confirm dialog (scene / map teardown).
 */
export function disposeExitButton() {
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
