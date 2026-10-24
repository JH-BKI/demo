/**
 * Complete-screen fanfare. CSS animates each burst.
 * This file only adds and removes the burst elements.
 * The layer lives inside the green backdrop, so portraits and dialogue stay on top.
 */

const MAX_LIVE_BURSTS = 12;
const SPAWN_EVERY_MS = 440;
const STREAK_LIFE_MS = 1200;
const DOT_LIFE_MS = 1500;
const STREAK_SPOKE_COUNT = 14;
const DOT_INNER_COUNT = 10;
const DOT_OUTER_COUNT = 16;
const CONFETTI_COUNT = 48;
const CONFETTI_FALL_MIN_S = 3.5;
const CONFETTI_FALL_MAX_S = 6.5;

/** Bright colours that still read on the teal grid. */
const BURST_COLORS = ['#facc15', '#f472b6', '#22d3ee', '#fb7185', '#c084fc', '#60a5fa', '#fde047'];
const CONFETTI_COLORS = [...BURST_COLORS, '#ffffff', '#fb923c'];

/** @type {HTMLElement | null} */
let layerEl = null;
/** @type {ReturnType<typeof setInterval> | null} */
let spawnTimer = null;
/** @type {boolean} */
let running = false;

/**
 * @param {HTMLElement} backdropEl
 */
export function mountCompleteFireworks(backdropEl) {
    layerEl = document.createElement('div');
    layerEl.className = 'sim-network-complete-fireworks';
    layerEl.setAttribute('aria-hidden', 'true');
    backdropEl.appendChild(layerEl);
    console.log(
        `[sim-network-complete-fireworks.js]: [N/A] - [mountCompleteFireworks] - layerMounted has a value of true.`
    ); //This is logged when the empty fireworks layer is inside the green backdrop.
}

/**
 * Start the loop once. Later calls do nothing.
 * Skipped when the browser asks for less motion.
 */
export function startCompleteFireworks() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    console.log(
        `[sim-network-complete-fireworks.js]: [N/A] - [startCompleteFireworks] - alreadyRunning has a value of ${running}, layerReady has a value of ${Boolean(layerEl)}, reduceMotion has a value of ${reduceMotion}.`
    ); //This is logged when the CEO line asks the fanfare to begin.
    if (running || !layerEl || reduceMotion) {
        return;
    }
    running = true;
    spawnConfetti();
    spawnStreakBurst();
    spawnStreakBurst();
    spawnDotBurst();
    spawnDotBurst();
    spawnTimer = setInterval(spawnOneOrTwo, SPAWN_EVERY_MS);
}

/**
 * Stop spawning and remove the layer. Safe to call more than once.
 */
export function disposeCompleteFireworks() {
    if (spawnTimer) {
        clearInterval(spawnTimer);
        spawnTimer = null;
    }
    running = false;
    if (layerEl) {
        layerEl.remove();
        layerEl = null;
    }
    console.log(
        `[sim-network-complete-fireworks.js]: [N/A] - [disposeCompleteFireworks] - stopped has a value of true.`
    ); //This is logged when leaving the complete screen tears the fanfare down.
}

/**
 * Create the paper scraps once. CSS loops each fall.
 */
function spawnConfetti() {
    if (!layerEl) {
        return;
    }
    const field = document.createElement('div');
    field.className = 'sim-network-confetti-field';
    field.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < CONFETTI_COUNT; index += 1) {
        field.appendChild(createConfettiScrap());
    }
    layerEl.appendChild(field);
    console.log(
        `[sim-network-complete-fireworks.js]: [N/A] - [spawnConfetti] - scrapCount has a value of ${CONFETTI_COUNT}.`
    ); //This is logged when the looping paper scraps are added to the fanfare sheet.
}

/**
 * @returns {HTMLElement}
 */
function createConfettiScrap() {
    const scrap = document.createElement('span');
    const duration = CONFETTI_FALL_MIN_S + Math.random() * (CONFETTI_FALL_MAX_S - CONFETTI_FALL_MIN_S);
    const sway = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 18);
    const spin = (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 380);
    scrap.className = 'sim-network-confetti';
    scrap.style.left = `${randomPoint().x}%`;
    scrap.style.width = `${6 + Math.random() * 6}px`;
    scrap.style.height = `${8 + Math.random() * 8}px`;
    scrap.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    scrap.style.animationDuration = `${duration.toFixed(2)}s`;
    scrap.style.animationDelay = `${(-Math.random() * duration).toFixed(2)}s`;
    scrap.style.setProperty('--sway', `${Math.round(sway)}px`);
    scrap.style.setProperty('--spin', `${Math.round(spin)}deg`);
    return scrap;
}

function spawnOneOrTwo() {
    spawnBurst();
    if (Math.random() < 0.45) {
        spawnBurst();
    }
}

function liveBurstCount() {
    if (!layerEl) {
        return 0;
    }
    return layerEl.querySelectorAll(':scope > .sim-network-firework').length;
}

function spawnBurst() {
    if (!layerEl || liveBurstCount() >= MAX_LIVE_BURSTS) {
        return;
    }
    if (Math.random() < 0.5) {
        spawnDotBurst();
        return;
    }
    spawnStreakBurst();
}

function spawnStreakBurst() {
    if (!layerEl || liveBurstCount() >= MAX_LIVE_BURSTS) {
        return;
    }
    const point = randomPoint();
    const color = pickColor();
    const travel = 70 + Math.random() * 70;
    const burst = createBurst('sim-network-firework sim-network-firework--streak', point, color);

    for (let index = 0; index < STREAK_SPOKE_COUNT; index += 1) {
        const spoke = document.createElement('span');
        spoke.className = 'sim-network-firework__spoke';
        const angle = (360 / STREAK_SPOKE_COUNT) * index;
        spoke.style.setProperty('--angle', `${angle}deg`);
        spoke.style.setProperty('--travel', `${Math.round(travel * (0.72 + Math.random() * 0.4))}px`);
        burst.appendChild(spoke);
    }

    burst.appendChild(createCore());
    layerEl.appendChild(burst);
    window.setTimeout(() => burst.remove(), STREAK_LIFE_MS);
}

function spawnDotBurst() {
    if (!layerEl || liveBurstCount() >= MAX_LIVE_BURSTS) {
        return;
    }
    const point = randomPoint();
    const burst = createBurst('sim-network-firework sim-network-firework--dots', point, pickColor());
    appendDotRing(burst, DOT_INNER_COUNT, 28 + Math.random() * 18);
    appendDotRing(burst, DOT_OUTER_COUNT, 62 + Math.random() * 36);
    burst.appendChild(createCore());
    layerEl.appendChild(burst);
    window.setTimeout(() => burst.remove(), DOT_LIFE_MS);
}

/**
 * @param {HTMLElement} burst
 * @param {number} count
 * @param {number} travel
 */
function appendDotRing(burst, count, travel) {
    for (let index = 0; index < count; index += 1) {
        const dot = document.createElement('span');
        dot.className = 'sim-network-firework__dot';
        const angle = (360 / count) * index + Math.random() * 12;
        const size = 3 + Math.random() * 3;
        dot.style.color = pickColor();
        dot.style.width = `${size}px`;
        dot.style.height = `${size}px`;
        dot.style.marginLeft = `${-size / 2}px`;
        dot.style.marginTop = `${-size / 2}px`;
        dot.style.setProperty('--angle', `${angle}deg`);
        dot.style.setProperty('--travel', `${Math.round(travel)}px`);
        dot.style.animationDelay = `${Math.round(Math.random() * 90)}ms`;
        burst.appendChild(dot);
    }
}

/**
 * @param {string} className
 * @param {{ x: number, y: number }} point
 * @param {string} color
 * @returns {HTMLElement}
 */
function createBurst(className, point, color) {
    const burst = document.createElement('div');
    burst.className = className;
    burst.style.left = `${point.x}%`;
    burst.style.top = `${point.y}%`;
    burst.style.color = color;
    return burst;
}

/**
 * @returns {HTMLElement}
 */
function createCore() {
    const core = document.createElement('span');
    core.className = 'sim-network-firework__core';
    return core;
}

/**
 * Screen is split into three equal columns.
 * Most bursts land in the left or right column. A few still land in the middle.
 * @returns {{ x: number, y: number }}
 */
function randomPoint() {
    const y = 8 + Math.random() * 84;
    const onSide = Math.random() < 0.9;
    if (!onSide) {
        return { x: 36 + Math.random() * 28, y };
    }
    const onLeft = Math.random() < 0.5;
    const x = onLeft ? 4 + Math.random() * 27 : 69 + Math.random() * 27;
    return { x, y };
}

/**
 * @returns {string}
 */
function pickColor() {
    const index = Math.floor(Math.random() * BURST_COLORS.length);
    return BURST_COLORS[index];
}
