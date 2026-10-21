/**
 * Tutorial-role coach for sim-network — arms goals from sequence emits and
 * fires event:continue-animation only when the learner completes the action
 * while that goal is armed (typically when the wait gate is listening).
 *
 * Early actions before arm do not count. No “already done” auto-continue.
 *
 * Optional arm detail.timeSkip (seconds ≥ 0): on validate, jump the sequence
 * via event:replay-from-seconds, then still fire continue. Past emits stay
 * silent on seek — author catch-up UI emits at the landing time in the timeline.
 * Omit timeSkip → continue only (unchanged).
 *
 * Active only while simNetworkFlow inits this module (tutorial role phases).
 * Levels never init → notifyTutorialAction is a no-op there.
 *
 * Hybrid arming:
 * - Generic filters in emit detail (drop / cable / networkTest / Try again / htmlClick):
 *   { type: "drop", partId: "router" }
 *   { type: "cable" }  OR  { type: "cable", aPartId, bPartId } (both required if either set)
 *   { type: "networkTest", result: "pass" | "fail" }  (+ optional top-level timeSkip)
 *   { type: "networkTest", outcomes: [
 *       { result: "pass", timeSkip: 40 },
 *       { result: "fail", timeSkip: 50 }
 *     ] }  — match either result; per-outcome timeSkip (omit → continue only for that branch)
 *   { type: "networkTestTryAgain" }
 *   { type: "htmlClick", selector: ".my-button" }  (one element; bubble click; missing → warn, no listen)
 * - Named presets (lookAt / cellDoubleClick): { goalId: "look-…" | "dblclick-…" }
 * - Optional on any arm detail: { timeSkip: 10.01 }  (ignored for networkTest when outcomes[] is set)
 *
 * lookAt goals: soft ArcRotateCamera pose zone + holdSeconds, with graceSeconds
 * so brief exits do not wipe progress.
 */

const EVENT_CONTINUE_ANIMATION = 'event:continue-animation';
/** Sequence emit: detail = filter object OR { goalId } for named presets */
const EVENT_ARM_GOAL = 'event:tutorial-arm-goal';
/** Jump master clock (SequencePlayer listens; same event Restart uses). */
const EVENT_REPLAY_FROM_SECONDS = 'event:replay-from-seconds';

const DEFAULT_HOLD_SECONDS = 1;
const DEFAULT_GRACE_SECONDS = 0.5;
const DEFAULT_LOOK_TOL = {
    alpha: 0.45,
    target: 1.5,
};

/**
 * Named presets only (lookAt / cellDoubleClick). Arm with detail.goalId.
 * Drop / cable / networkTest / Try again use filter detail directly (no table entry).
 * @type {Record<string, object>}
 */
const KNOWN_GOALS = {
    'look-comms-cupboard-back': {
        type: 'lookAt',
        holdSeconds: 0.01,
        graceSeconds: 0.5,
        view: {
            alpha: 1.0282,
            beta: 1.2123,
            radius: 12.7683,
            target: [3, 0.5, 3.5],
        },
        // Soft zone uses alpha (spin) + target distance only (beta tilt and radius ignored).
        tol: { ...DEFAULT_LOOK_TOL },
    },
    'look-reset-home': {
        type: 'lookAt',
        holdSeconds: 0.01,
        graceSeconds: 0.5,
        view: {
            alpha: -1.5625,
            beta: 1.1516,
            radius: 12,
            fov: 0.9,
            target: [3, 0.5, 3.5],
        },
        // Soft zone uses alpha (spin) + target distance only (beta tilt and radius ignored).
        tol: { ...DEFAULT_LOOK_TOL },
    },
    'dblclick-cell-3-3': {
        type: 'cellDoubleClick',
        x: 3,
        z: 3,
    },
};

/** @type {boolean} */
let coachActive = false;

/** @type {string | null} */
let boundStageId = null;

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;

/** Armed filter or preset goal object. */
/** @type {object | null} */
let armedGoal = null;

/** Short label for logs (goalId or type summary). */
/** @type {string | null} */
let armedGoalLabel = null;

/**
 * Optional skip target (seconds) from arm detail.timeSkip.
 * Kept separate so shared KNOWN_GOALS presets are never mutated.
 * @type {number | null}
 */
let armedTimeSkip = null;

/** @type {(() => void) | null} */
let removeListeners = null;

/** @type {import('@babylonjs/core').Observer<import('@babylonjs/core').Scene> | null} */
let lookAtObserver = null;

/** Active htmlClick target (one element only while armed). */
/** @type {Element | null} */
let htmlClickElement = null;

/** Bound click handler for teardown (bubble phase). */
/** @type {((event: Event) => void) | null} */
let htmlClickHandler = null;

/** Accumulated seconds inside the soft pose zone while armed. */
let lookHoldSeconds = 0;

/** Accumulated seconds outside the zone (brief exits allowed up to grace). */
let lookAwaySeconds = 0;

/**
 * Shortest signed delta from `from` to `to` in [-π, π] (ArcRotate alpha wrap).
 * Local copy — experience scripts cannot import from src/.
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
function shortestAngleDelta(from, to) {
    let delta = to - from;
    while (delta > Math.PI) {
        delta -= 2 * Math.PI;
    }
    while (delta < -Math.PI) {
        delta += 2 * Math.PI;
    }
    return delta;
}

/**
 * @param {string} goalId
 * @returns {object | null}
 */
function getPresetGoal(goalId) {
    if (!goalId || typeof goalId !== 'string') {
        return null;
    }
    return KNOWN_GOALS[goalId] ?? null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Optional arm detail.timeSkip → seconds ≥ 0, or null if omitted/invalid.
 * @param {object} detail
 * @returns {number | null}
 */
function parseTimeSkip(detail) {
    if (!detail || typeof detail !== 'object') {
        return null;
    }
    if (detail.timeSkip === undefined || detail.timeSkip === null || detail.timeSkip === '') {
        return null;
    }
    const seconds = Number(detail.timeSkip);
    if (!Number.isFinite(seconds) || seconds < 0) {
        console.warn(
            `[sim-network-tutorial-coach.js]: [N/A] - [parseTimeSkip] - timeSkipInvalid has a value of ${detail.timeSkip}.`
        ); //This is logged when arm detail.timeSkip is present but not a usable non-negative number.
        return null;
    }
    return seconds;
}

/**
 * Build a generic filter goal from arm-emit detail, or null if invalid.
 * @param {object} detail
 * @returns {{ goal: object, label: string } | null}
 */
function parseFilterGoal(detail) {
    if (!detail || typeof detail !== 'object') {
        return null;
    }

    const type = trimString(detail.type);
    if (!type) {
        return null;
    }

    if (type === 'drop') {
        const partId = trimString(detail.partId);
        if (!partId) {
            console.warn(
                `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - dropPartIdMissing has a value of true.`
            ); //This is logged when a drop filter is armed without partId.
            return null;
        }
        return {
            goal: { type: 'drop', partId },
            label: `drop:${partId}`,
        };
    }

    if (type === 'cable') {
        const aPartId = trimString(detail.aPartId);
        const bPartId = trimString(detail.bPartId);
        const hasA = Boolean(aPartId);
        const hasB = Boolean(bPartId);
        if (hasA !== hasB) {
            console.warn(
                `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - cablePartIdsIncomplete has a value of true, aPartId has a value of ${aPartId || '(empty)'}, bPartId has a value of ${bPartId || '(empty)'}.`
            ); //This is logged when cable filter sets only one endpoint type — both are required.
            return null;
        }
        if (hasA && hasB) {
            return {
                goal: { type: 'cable', aPartId, bPartId },
                label: `cable:${aPartId}<->${bPartId}`,
            };
        }
        return {
            goal: { type: 'cable' },
            label: 'cable:any',
        };
    }

    if (type === 'networkTest') {
        if (Array.isArray(detail.outcomes)) {
            const hasLegacyResult =
                detail.result !== undefined &&
                detail.result !== null &&
                String(detail.result).trim() !== '';
            if (hasLegacyResult) {
                console.warn(
                    `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - networkTestOutcomesPreferLegacyResultIgnored has a value of true, legacyResult has a value of ${detail.result}.`
                ); //This is logged when both outcomes[] and top-level result are set — outcomes win.
            }

            if (detail.outcomes.length === 0) {
                console.warn(
                    `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - networkTestOutcomesEmpty has a value of true.`
                ); //This is logged when networkTest outcomes is an empty array.
                return null;
            }

            /** @type {string[]} */
            const allowedResults = [];
            /** @type {Record<string, number>} */
            const timeSkipByResult = {};

            for (let i = 0; i < detail.outcomes.length; i++) {
                const item = detail.outcomes[i];
                if (!item || typeof item !== 'object') {
                    console.warn(
                        `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - networkTestOutcomeInvalid has a value of true, index has a value of ${i}.`
                    ); //This is logged when an outcomes[] entry is not an object.
                    continue;
                }
                const result = trimString(item.result);
                if (result !== 'pass' && result !== 'fail') {
                    console.warn(
                        `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - networkTestOutcomeResultInvalid has a value of ${result || '(empty)'}, index has a value of ${i}.`
                    ); //This is logged when an outcomes[] entry result is not pass or fail.
                    continue;
                }
                if (allowedResults.includes(result)) {
                    console.warn(
                        `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - networkTestOutcomeDuplicate has a value of ${result}, index has a value of ${i}.`
                    ); //This is logged when the same result appears twice in outcomes[] — later entry wins for timeSkip.
                } else {
                    allowedResults.push(result);
                }
                const outcomeSkip = parseTimeSkip(item);
                if (outcomeSkip != null) {
                    timeSkipByResult[result] = outcomeSkip;
                } else {
                    delete timeSkipByResult[result];
                }
            }

            if (allowedResults.length === 0) {
                console.warn(
                    `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - networkTestOutcomesNoneValid has a value of true.`
                ); //This is logged when outcomes[] had no usable pass/fail entries.
                return null;
            }

            console.log(
                `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - networkTestOutcomes has a value of ${allowedResults.join('|')}, timeSkipKeys has a value of ${Object.keys(timeSkipByResult).join('|') || '(none)'}.`
            ); //This is logged when a multi-outcome networkTest filter is parsed successfully.

            return {
                goal: {
                    type: 'networkTest',
                    allowedResults,
                    timeSkipByResult,
                },
                label: `networkTest:${allowedResults.join('|')}`,
            };
        }

        const result = trimString(detail.result);
        if (result !== 'pass' && result !== 'fail') {
            console.warn(
                `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - networkTestResultInvalid has a value of ${result || '(empty)'}.`
            ); //This is logged when networkTest filter result is not pass or fail.
            return null;
        }
        return {
            goal: { type: 'networkTest', result },
            label: `networkTest:${result}`,
        };
    }

    if (type === 'networkTestTryAgain') {
        return {
            goal: { type: 'networkTestTryAgain' },
            label: 'networkTestTryAgain',
        };
    }

    if (type === 'htmlClick') {
        const selector = trimString(detail.selector);
        if (!selector) {
            console.warn(
                `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - htmlClickSelectorMissing has a value of true.`
            ); //This is logged when an htmlClick filter is armed without selector.
            return null;
        }
        return {
            goal: { type: 'htmlClick', selector },
            label: `htmlClick:${selector}`,
        };
    }

    console.warn(
        `[sim-network-tutorial-coach.js]: [N/A] - [parseFilterGoal] - unknownFilterType has a value of ${type}.`
    ); //This is logged when arm detail.type is not a supported generic filter.
    return null;
}

/**
 * @param {object} goal
 * @param {{ partId?: string }} detail
 * @returns {boolean}
 */
function dropDetailMatchesGoal(goal, detail) {
    if (!goal || goal.type !== 'drop' || !detail) {
        return false;
    }
    return detail.partId === goal.partId;
}

/**
 * Any cable, or both endpoint types (either direction). Cells ignored.
 * @param {object} goal
 * @param {{ a?: { partId?: string }, b?: { partId?: string } }} detail
 * @returns {boolean}
 */
function cableDetailMatchesGoal(goal, detail) {
    if (!goal || goal.type !== 'cable' || !detail) {
        return false;
    }
    const wantA = trimString(goal.aPartId);
    const wantB = trimString(goal.bPartId);
    if (!wantA && !wantB) {
        return true;
    }
    const gotA = detail.a?.partId;
    const gotB = detail.b?.partId;
    const forward = gotA === wantA && gotB === wantB;
    const reverse = gotA === wantB && gotB === wantA;
    return forward || reverse;
}

/**
 * @param {object} goal
 * @param {{ x?: number, z?: number }} detail
 * @returns {boolean}
 */
function cellDoubleClickMatchesGoal(goal, detail) {
    if (!goal || goal.type !== 'cellDoubleClick' || !detail) {
        return false;
    }
    return detail.x === goal.x && detail.z === goal.z;
}

/**
 * @param {import('@babylonjs/core').ArcRotateCamera} camera
 * @param {object} goal
 * @returns {boolean}
 */
function cameraInLookAtZone(camera, goal) {
    const view = goal?.view;
    const tol = goal?.tol || DEFAULT_LOOK_TOL;
    if (!camera || !view) {
        return false;
    }
    if (typeof camera.alpha !== 'number') {
        return false;
    }

    const alphaDelta = Math.abs(shortestAngleDelta(camera.alpha, view.alpha));

    const tx = Array.isArray(view.target) ? view.target[0] : 0;
    const ty = Array.isArray(view.target) ? view.target[1] : 0;
    const tz = Array.isArray(view.target) ? view.target[2] : 0;
    const camTarget = camera.target;
    const targetDx = (camTarget?.x ?? 0) - tx;
    const targetDy = (camTarget?.y ?? 0) - ty;
    const targetDz = (camTarget?.z ?? 0) - tz;
    const targetDist = Math.sqrt(
        targetDx * targetDx + targetDy * targetDy + targetDz * targetDz
    );

    return (
        alphaDelta <= (tol.alpha ?? DEFAULT_LOOK_TOL.alpha) &&
        targetDist <= (tol.target ?? DEFAULT_LOOK_TOL.target)
    );
}

function stopLookAtWatch() {
    if (lookAtObserver && boundScene) {
        boundScene.onBeforeRenderObservable.remove(lookAtObserver);
    }
    lookAtObserver = null;
    lookHoldSeconds = 0;
    lookAwaySeconds = 0;
}

function stopHtmlClickWatch() {
    if (htmlClickElement && htmlClickHandler) {
        htmlClickElement.removeEventListener('click', htmlClickHandler);
    }
    htmlClickElement = null;
    htmlClickHandler = null;
}

/**
 * One-shot bubble click on the single element matching goal.selector.
 * @param {object} goal
 */
function startHtmlClickWatch(goal) {
    stopHtmlClickWatch();

    const selector = trimString(goal?.selector);
    if (!selector) {
        console.warn(
            `[sim-network-tutorial-coach.js]: [N/A] - [startHtmlClickWatch] - selectorMissing has a value of true.`
        ); //This is logged when htmlClick arm has no selector string.
        return;
    }

    /** @type {Element | null} */
    let element = null;
    try {
        element = document.querySelector(selector);
    } catch (error) {
        console.warn(
            `[sim-network-tutorial-coach.js]: [N/A] - [startHtmlClickWatch] - selectorInvalid has a value of ${selector}, errorMessage has a value of ${error?.message || error}.`
        ); //This is logged when the CSS selector throws in querySelector.
        return;
    }

    if (!element) {
        console.warn(
            `[sim-network-tutorial-coach.js]: [N/A] - [startHtmlClickWatch] - elementMissing has a value of true, selector has a value of ${selector}.`
        ); //This is logged when the htmlClick target is not in the DOM at arm time — no listener attached.
        return;
    }

    htmlClickHandler = () => {
        if (!coachActive || !armedGoal || armedGoal.type !== 'htmlClick') {
            return;
        }
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [htmlClickWatch] - match has a value of true, selector has a value of ${selector}, goalLabel has a value of ${armedGoalLabel}.`
        ); //This is logged when the armed htmlClick target receives a bubble click.
        fireContinue('htmlClick-matched');
    };
    htmlClickElement = element;
    htmlClickElement.addEventListener('click', htmlClickHandler);

    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [startHtmlClickWatch] - selector has a value of ${selector}, goalLabel has a value of ${armedGoalLabel}.`
    ); //This is logged when the one-shot htmlClick bubble listener is attached.
}

/**
 * @param {object} goal
 */
function startLookAtWatch(goal) {
    stopLookAtWatch();

    if (!boundScene) {
        console.warn(
            `[sim-network-tutorial-coach.js]: [N/A] - [startLookAtWatch] - sceneMissing has a value of true.`
        ); //This is logged when a lookAt goal is armed but no Babylon scene was passed to the coach.
        return;
    }

    const holdNeed =
        typeof goal.holdSeconds === 'number' && goal.holdSeconds > 0
            ? goal.holdSeconds
            : DEFAULT_HOLD_SECONDS;
    const graceNeed =
        typeof goal.graceSeconds === 'number' && goal.graceSeconds >= 0
            ? goal.graceSeconds
            : DEFAULT_GRACE_SECONDS;

    lookAtObserver = boundScene.onBeforeRenderObservable.add(() => {
        if (!coachActive || !armedGoal || armedGoal.type !== 'lookAt') {
            return;
        }

        const camera = /** @type {import('@babylonjs/core').ArcRotateCamera|null} */ (
            boundScene?.activeCamera ?? null
        );
        if (!camera) {
            return;
        }

        const dtMs = boundScene.getEngine()?.getDeltaTime?.() ?? 16.67;
        const dt = Math.max(0, dtMs / 1000);
        const inZone = cameraInLookAtZone(camera, armedGoal);

        if (inZone) {
            lookAwaySeconds = 0;
            lookHoldSeconds += dt;
            if (lookHoldSeconds >= holdNeed) {
                console.log(
                    `[sim-network-tutorial-coach.js]: [N/A] - [lookAtWatch] - holdComplete has a value of true, holdSeconds has a value of ${lookHoldSeconds.toFixed(2)}, goalLabel has a value of ${armedGoalLabel}.`
                ); //This is logged when the soft pose zone has been held long enough.
                fireContinue('lookAt-matched');
            }
            return;
        }

        lookAwaySeconds += dt;
        if (lookAwaySeconds >= graceNeed) {
            if (lookHoldSeconds > 0) {
                console.log(
                    `[sim-network-tutorial-coach.js]: [N/A] - [lookAtWatch] - holdReset has a value of true, lookAwaySeconds has a value of ${lookAwaySeconds.toFixed(2)}, graceSeconds has a value of ${graceNeed}.`
                ); //This is logged when the camera left the soft zone longer than the grace window.
            }
            lookHoldSeconds = 0;
            lookAwaySeconds = 0;
        }
    });

    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [startLookAtWatch] - holdSeconds has a value of ${holdNeed}, graceSeconds has a value of ${graceNeed}, goalLabel has a value of ${armedGoalLabel}.`
    ); //This is logged when the lookAt soft-zone observer starts.
}

/**
 * @param {string} reason
 */
function fireContinue(reason) {
    const completedLabel = armedGoalLabel;
    const skipTo = armedTimeSkip;
    stopLookAtWatch();
    stopHtmlClickWatch();
    armedGoal = null;
    armedGoalLabel = null;
    armedTimeSkip = null;

    if (skipTo != null) {
        window.dispatchEvent(
            new CustomEvent(EVENT_REPLAY_FROM_SECONDS, {
                detail: { seconds: skipTo },
            })
        );
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [fireContinue] - timeSkipSeconds has a value of ${skipTo}, completedGoalLabel has a value of ${completedLabel}, stageId has a value of ${boundStageId}.`
        ); //This is logged when a validated goal jumps the sequence clock before continue.
    }

    window.dispatchEvent(new CustomEvent(EVENT_CONTINUE_ANIMATION));
    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [fireContinue] - reason has a value of ${reason}, completedGoalLabel has a value of ${completedLabel}, stageId has a value of ${boundStageId}, didTimeSkip has a value of ${skipTo != null}.`
    ); //This is logged when the tutorial coach releases a sequence wait gate.
}

/**
 * Arm a filter or named preset. Does not auto-continue for prior actions.
 * @param {object} goal
 * @param {string} label
 * @param {number | null} [timeSkipSeconds]
 */
function armGoal(goal, label, timeSkipSeconds = null) {
    stopLookAtWatch();
    stopHtmlClickWatch();
    armedGoal = goal;
    armedGoalLabel = label;
    armedTimeSkip =
        typeof timeSkipSeconds === 'number' && Number.isFinite(timeSkipSeconds)
            ? timeSkipSeconds
            : null;
    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [armGoal] - goalLabel has a value of ${label}, type has a value of ${goal.type}, timeSkipSeconds has a value of ${armedTimeSkip}, stageId has a value of ${boundStageId}.`
    ); //This is logged when a tutorial wait goal becomes active.

    if (goal.type === 'lookAt') {
        startLookAtWatch(goal);
    } else if (goal.type === 'htmlClick') {
        startHtmlClickWatch(goal);
    }
}

/**
 * Called from partDrop / partCables / partCellInspector after a successful action.
 * Continues only if a goal is armed and matches.
 * @param {{
 *   type: string,
 *   partId?: string,
 *   x?: number,
 *   z?: number,
 *   layer?: number,
 *   result?: 'pass' | 'fail',
 *   a?: { partId?: string, x?: number, z?: number },
 *   b?: { partId?: string, x?: number, z?: number }
 * }} detail
 */
export function notifyTutorialAction(detail) {
    if (!coachActive || !detail || !armedGoal) {
        return;
    }

    if (armedGoal.type !== detail.type) {
        return;
    }

    let match = false;
    if (armedGoal.type === 'drop' && detail.type === 'drop') {
        match = dropDetailMatchesGoal(armedGoal, detail);
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of ${match}, partId has a value of ${detail.partId}, cell has a value of ${detail.x},${detail.z}.`
        ); //This is logged when a drop is reported to the tutorial coach.
        if (match) {
            fireContinue('drop-matched');
        }
        return;
    }

    if (armedGoal.type === 'cable' && detail.type === 'cable') {
        match = cableDetailMatchesGoal(armedGoal, detail);
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of ${match}, aPartId has a value of ${detail.a?.partId}, bPartId has a value of ${detail.b?.partId}.`
        ); //This is logged when a cable commit is reported to the tutorial coach.
        if (match) {
            fireContinue('cable-matched');
        }
        return;
    }

    if (armedGoal.type === 'cellDoubleClick' && detail.type === 'cellDoubleClick') {
        match = cellDoubleClickMatchesGoal(armedGoal, detail);
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of ${match}, cell has a value of ${detail.x},${detail.z}.`
        ); //This is logged when a cell double-click is reported to the tutorial coach.
        if (match) {
            fireContinue('cellDoubleClick-matched');
        }
        return;
    }

    if (armedGoal.type === 'networkTest' && detail.type === 'networkTest') {
        const gotResult = trimString(detail.result);
        const allowed = Array.isArray(armedGoal.allowedResults)
            ? armedGoal.allowedResults
            : null;
        if (allowed) {
            match = allowed.includes(gotResult);
            if (match) {
                const skipMap = armedGoal.timeSkipByResult;
                const hasSkip =
                    skipMap &&
                    typeof skipMap === 'object' &&
                    Object.prototype.hasOwnProperty.call(skipMap, gotResult) &&
                    typeof skipMap[gotResult] === 'number' &&
                    Number.isFinite(skipMap[gotResult]);
                armedTimeSkip = hasSkip ? skipMap[gotResult] : null;
            }
            console.log(
                `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of ${match}, result has a value of ${gotResult}, allowedResults has a value of ${allowed.join('|')}, timeSkipSeconds has a value of ${match ? armedTimeSkip : '(n/a)'}.`
            ); //This is logged when a network test result is checked against an outcomes[] arm.
        } else {
            match = gotResult === armedGoal.result;
            console.log(
                `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of ${match}, result has a value of ${gotResult}, wantedResult has a value of ${armedGoal.result}.`
            ); //This is logged when a network test result is reported to the tutorial coach (legacy single result).
        }
        if (match) {
            fireContinue('networkTest-matched');
        }
        return;
    }

    if (armedGoal.type === 'networkTestTryAgain' && detail.type === 'networkTestTryAgain') {
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of true, type has a value of networkTestTryAgain.`
        ); //This is logged when Network test Try again is reported to the tutorial coach.
        fireContinue('networkTestTryAgain-matched');
    }
}

function registerArmListener() {
    /** @param {CustomEvent} event */
    const onArm = (event) => {
        if (!coachActive) {
            return;
        }
        const detail = event?.detail;
        if (!detail || typeof detail !== 'object') {
            console.warn(
                `[sim-network-tutorial-coach.js]: [N/A] - [onArm] - detailMissing has a value of true.`
            ); //This is logged when arm-goal fires without detail.
            return;
        }

        let timeSkipSeconds = parseTimeSkip(detail);

        const goalId = trimString(detail.goalId);
        if (goalId) {
            const preset = getPresetGoal(goalId);
            if (!preset) {
                console.warn(
                    `[sim-network-tutorial-coach.js]: [N/A] - [onArm] - unknownGoalId has a value of ${goalId}.`
                ); //This is logged when goalId is not a known lookAt/cellDoubleClick preset.
                return;
            }
            armGoal(preset, goalId, timeSkipSeconds);
            return;
        }

        const parsed = parseFilterGoal(detail);
        if (!parsed) {
            console.warn(
                `[sim-network-tutorial-coach.js]: [N/A] - [onArm] - filterParseFailed has a value of true.`
            ); //This is logged when arm detail is neither a known goalId nor a valid filter.
            return;
        }

        // Outcomes carry their own per-result skips — ignore top-level timeSkip for that arm.
        if (
            parsed.goal.type === 'networkTest' &&
            Array.isArray(parsed.goal.allowedResults)
        ) {
            if (timeSkipSeconds != null) {
                console.warn(
                    `[sim-network-tutorial-coach.js]: [N/A] - [onArm] - topLevelTimeSkipIgnoredForOutcomes has a value of ${timeSkipSeconds}.`
                ); //This is logged when arm detail has both outcomes[] and top-level timeSkip — outcomes win.
            }
            timeSkipSeconds = null;
        }

        armGoal(parsed.goal, parsed.label, timeSkipSeconds);
    };

    window.addEventListener(EVENT_ARM_GOAL, onArm);
    return () => {
        window.removeEventListener(EVENT_ARM_GOAL, onArm);
    };
}

/**
 * Start coach for a tutorial-role stage (any tutorial map; goals come from sequence).
 * @param {{ stageId?: string, scene?: import('@babylonjs/core').Scene | null }} [options]
 */
export function initTutorialCoach(options = {}) {
    disposeTutorialCoach();

    coachActive = true;
    boundStageId =
        typeof options.stageId === 'string' ? options.stageId : null;
    boundScene = options.scene || null;
    armedGoal = null;
    armedGoalLabel = null;
    armedTimeSkip = null;
    removeListeners = registerArmListener();

    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [initTutorialCoach] - stageId has a value of ${boundStageId}, scenePresent has a value of ${Boolean(boundScene)}, knownPresetCount has a value of ${Object.keys(KNOWN_GOALS).length}.`
    ); //This is logged when the tutorial coach is enabled for a tutorial-role map.
}

/**
 * Tear down coach (leave tutorial / office / scene dispose).
 */
export function disposeTutorialCoach() {
    stopLookAtWatch();
    stopHtmlClickWatch();
    if (typeof removeListeners === 'function') {
        removeListeners();
        removeListeners = null;
    }
    coachActive = false;
    armedGoal = null;
    armedGoalLabel = null;
    armedTimeSkip = null;
    boundStageId = null;
    boundScene = null;
    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [disposeTutorialCoach] - cleanupCompleted has a value of true.`
    ); //This is logged when the tutorial coach is torn down.
}
