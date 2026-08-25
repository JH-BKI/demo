/**
 * Tutorial-role coach for sim-network — arms goals from sequence emits and
 * fires event:continue-animation only when the learner completes the action
 * while that goal is armed (typically when the wait gate is listening).
 *
 * Early actions before arm do not count. No “already done” auto-continue.
 *
 * Active only while simNetworkFlow inits this module (tutorial role phases).
 * Office never inits → notifyTutorialAction is a no-op there.
 *
 * Goals are keyed by id so future tutorial maps can reuse this coach with
 * their own sequence arm emits.
 *
 * Arm emit detail: { goalId: "drop-router-5-2" | "cable-…" | "look-…" }
 *
 * lookAt goals: soft ArcRotateCamera pose zone + holdSeconds, with graceSeconds
 * so brief exits do not wipe progress.
 */

const EVENT_CONTINUE_ANIMATION = 'event:continue-animation';
/** Sequence emit: detail { goalId } */
const EVENT_ARM_GOAL = 'event:tutorial-arm-goal';

const DROP_LAYER = 5;
const DEFAULT_HOLD_SECONDS = 1;
const DEFAULT_GRACE_SECONDS = 0.5;
const DEFAULT_LOOK_TOL = {
    alpha: 0.45,
    target: 1.5,
};

/**
 * Known goals. Add entries for later tutorial maps; arm via sequence emit.
 * Cable endpoints match either direction (a↔b).
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
    'drop-router-5-2': {
        type: 'drop',
        partId: 'router',
        x: 5,
        z: 2,
        layer: DROP_LAYER,
    },
    'cable-router-5-2-pc-0-1': {
        type: 'cable',
        a: { partId: 'router', x: 5, z: 2 },
        b: { partId: 'desktop-pc', x: 0, z: 1 },
    },
    'cable-comms-5-6-router-5-2': {
        type: 'cable',
        a: { partId: 'comms-cupboard', x: 5, z: 6 },
        b: { partId: 'router', x: 5, z: 2 },
    },
    'dblclick-cell-3-3': {
        type: 'cellDoubleClick',
        x: 3,
        z: 3,
    },
    'network-test-try-again': {
        type: 'networkTestTryAgain',
    },
};

/** @type {boolean} */
let coachActive = false;

/** @type {string | null} */
let boundStageId = null;

/** @type {import('@babylonjs/core').Scene | null} */
let boundScene = null;

/** @type {string | null} */
let armedGoalId = null;

/** @type {(() => void) | null} */
let removeListeners = null;

/** @type {import('@babylonjs/core').Observer<import('@babylonjs/core').Scene> | null} */
let lookAtObserver = null;

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
function getGoal(goalId) {
    if (!goalId || typeof goalId !== 'string') {
        return null;
    }
    return KNOWN_GOALS[goalId] ?? null;
}

/**
 * @param {{ partId?: string, x?: number, z?: number }} endpoint
 * @param {{ partId?: string, x?: number, z?: number }} detailEnd
 * @returns {boolean}
 */
function endpointMatches(endpoint, detailEnd) {
    if (!endpoint || !detailEnd) {
        return false;
    }
    return (
        detailEnd.partId === endpoint.partId &&
        detailEnd.x === endpoint.x &&
        detailEnd.z === endpoint.z
    );
}

/**
 * @param {object} goal
 * @param {{ partId?: string, x?: number, z?: number, layer?: number }} detail
 * @returns {boolean}
 */
function dropDetailMatchesGoal(goal, detail) {
    if (!goal || goal.type !== 'drop' || !detail) {
        return false;
    }
    const layer = detail.layer ?? DROP_LAYER;
    const goalLayer = goal.layer ?? DROP_LAYER;
    return (
        detail.partId === goal.partId &&
        detail.x === goal.x &&
        detail.z === goal.z &&
        layer === goalLayer
    );
}

/**
 * Either direction: a→b or b→a.
 * @param {object} goal
 * @param {{ a?: object, b?: object }} detail
 * @returns {boolean}
 */
function cableDetailMatchesGoal(goal, detail) {
    if (!goal || goal.type !== 'cable' || !detail) {
        return false;
    }
    const forward =
        endpointMatches(goal.a, detail.a) && endpointMatches(goal.b, detail.b);
    const reverse =
        endpointMatches(goal.a, detail.b) && endpointMatches(goal.b, detail.a);
    return forward || reverse;
}

/**
 * @param {import('@babylonjs/core').ArcRotateCamera} camera
 * @param {object} goal
 * @returns {boolean}
 */

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
        if (!coachActive || !armedGoalId) {
            return;
        }
        const liveGoal = getGoal(armedGoalId);
        if (!liveGoal || liveGoal.type !== 'lookAt') {
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
        const inZone = cameraInLookAtZone(camera, liveGoal);

        if (inZone) {
            lookAwaySeconds = 0;
            lookHoldSeconds += dt;
            if (lookHoldSeconds >= holdNeed) {
                console.log(
                    `[sim-network-tutorial-coach.js]: [N/A] - [lookAtWatch] - holdComplete has a value of true, holdSeconds has a value of ${lookHoldSeconds.toFixed(2)}, goalId has a value of ${armedGoalId}.`
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
        `[sim-network-tutorial-coach.js]: [N/A] - [startLookAtWatch] - holdSeconds has a value of ${holdNeed}, graceSeconds has a value of ${graceNeed}, goalId has a value of ${armedGoalId}.`
    ); //This is logged when the lookAt soft-zone observer starts.
}

function fireContinue(reason) {
    const completedGoalId = armedGoalId;
    stopLookAtWatch();
    armedGoalId = null;
    window.dispatchEvent(new CustomEvent(EVENT_CONTINUE_ANIMATION));
    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [fireContinue] - reason has a value of ${reason}, completedGoalId has a value of ${completedGoalId}, stageId has a value of ${boundStageId}.`
    ); //This is logged when the tutorial coach releases a sequence wait gate.
}

/**
 * Arm a goal from the sequence. Does not auto-continue for prior actions.
 * @param {string} goalId
 */
function armGoal(goalId) {
    const goal = getGoal(goalId);
    if (!goal) {
        console.warn(
            `[sim-network-tutorial-coach.js]: [N/A] - [armGoal] - unknownGoalId has a value of ${goalId}.`
        ); //This is logged when the sequence arms a goal id the coach does not know.
        return;
    }

    stopLookAtWatch();
    armedGoalId = goalId;
    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [armGoal] - goalId has a value of ${goalId}, type has a value of ${goal.type}, stageId has a value of ${boundStageId}.`
    ); //This is logged when a tutorial wait goal becomes active.

    if (goal.type === 'lookAt') {
        startLookAtWatch(goal);
    }
}

/**
 * Called from partDrop / partCables after a successful action.
 * Continues only if a goal is armed and matches.
 * @param {{
 *   type: string,
 *   partId?: string,
 *   x?: number,
 *   z?: number,
 *   layer?: number,
 *   a?: { partId?: string, x?: number, z?: number },
 *   b?: { partId?: string, x?: number, z?: number }
 * }} detail
 */
export function notifyTutorialAction(detail) {
    if (!coachActive || !detail || !armedGoalId) {
        return;
    }

    const goal = getGoal(armedGoalId);
    if (!goal || goal.type !== detail.type) {
        return;
    }

    let match = false;
    if (goal.type === 'drop' && detail.type === 'drop') {
        match = dropDetailMatchesGoal(goal, detail);
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of ${match}, partId has a value of ${detail.partId}, cell has a value of ${detail.x},${detail.z}.`
        ); //This is logged when a drop is reported to the tutorial coach.
        if (match) {
            fireContinue('drop-matched');
        }
        return;
    }

    if (goal.type === 'cable' && detail.type === 'cable') {
        match = cableDetailMatchesGoal(goal, detail);
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of ${match}, aCell has a value of ${detail.a?.x},${detail.a?.z}, bCell has a value of ${detail.b?.x},${detail.b?.z}, aPartId has a value of ${detail.a?.partId}, bPartId has a value of ${detail.b?.partId}.`
        ); //This is logged when a cable commit is reported to the tutorial coach.
        if (match) {
            fireContinue('cable-matched');
        }
        return;
    }

    if (goal.type === 'cellDoubleClick' && detail.type === 'cellDoubleClick') {
        match = cellDoubleClickMatchesGoal(goal, detail);
        console.log(
            `[sim-network-tutorial-coach.js]: [N/A] - [notifyTutorialAction] - match has a value of ${match}, cell has a value of ${detail.x},${detail.z}.`
        ); //This is logged when a cell double-click is reported to the tutorial coach.
        if (match) {
            fireContinue('cellDoubleClick-matched');
        }
        return;
    }

    if (goal.type === 'networkTestTryAgain' && detail.type === 'networkTestTryAgain') {
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
        const goalId =
            typeof event?.detail?.goalId === 'string'
                ? event.detail.goalId.trim()
                : '';
        if (!goalId) {
            console.warn(
                `[sim-network-tutorial-coach.js]: [N/A] - [onArm] - goalIdMissing has a value of true.`
            ); //This is logged when arm-goal fires without a goalId.
            return;
        }
        armGoal(goalId);
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
    armedGoalId = null;
    removeListeners = registerArmListener();

    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [initTutorialCoach] - stageId has a value of ${boundStageId}, scenePresent has a value of ${Boolean(boundScene)}, knownGoalCount has a value of ${Object.keys(KNOWN_GOALS).length}.`
    ); //This is logged when the tutorial coach is enabled for a tutorial-role map.
}

/**
 * Tear down coach (leave tutorial / office / scene dispose).
 */
export function disposeTutorialCoach() {
    stopLookAtWatch();
    if (typeof removeListeners === 'function') {
        removeListeners();
        removeListeners = null;
    }
    coachActive = false;
    armedGoalId = null;
    boundStageId = null;
    boundScene = null;
    console.log(
        `[sim-network-tutorial-coach.js]: [N/A] - [disposeTutorialCoach] - cleanupCompleted has a value of true.`
    ); //This is logged when the tutorial coach is torn down.
}
