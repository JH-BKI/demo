/**
 * Sim-network in-game scene — play maps only (kit stamp + map systems).
 * Flow chrome: splash / instructions / level-select / complete are separate 2d scenes.
 * Maps come from layouts-index.json; selection lives in simNetworkSession.js.
 *
 * EA: office maps are stamped only by simNetworkFlow (not core modelSets).
 * Core modelSetManager stays in the repo dormant for a later phase.
 */

import { startSimNetworkFlow, disposeSimNetworkFlow } from './simNetworkFlow.js';

/** Hand-owned part catalog (kind / group / paths). Editor never overwrites this. */
const KIT_PARTS_URL =
    './assets/experiences/sim-network/layouts/kit-parts.json';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';

/** @type {string|null} */
let boundSceneId = null;

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
 * @param {import('@babylonjs/core').Scene} scene
 * @param {string} sceneId
 */
export async function createScene(scene, sceneId) {
    boundSceneId = sceneId;
    console.log(
        `[sim-network.js]: [N/A] - [createScene] - sceneId has a value of ${sceneId}, kitPartsUrl has a value of ${KIT_PARTS_URL}, hostPresent has a value of ${Boolean(globalThis[HOST_KEY])}.`
    ); //This is logged when in-game boots into play-only mode (no core modelSets stamp).

    const catalog = await fetchJson(KIT_PARTS_URL);
    console.log(
        `[sim-network.js]: [N/A] - [createScene] - catalogId has a value of ${catalog?.id ?? 'unnamed'}, partsCount has a value of ${catalog?.parts?.length ?? 0}.`
    ); //This is logged when the kit catalog has loaded for play.

    const flowReady = await startSimNetworkFlow(scene, catalog, sceneId);
    console.log(
        `[sim-network.js]: [N/A] - [createScene] - flowReady has a value of ${flowReady?.ready}.`
    ); //This is logged when the first map play systems are ready.
}

/**
 * Cleanup when leaving the scene.
 */
export function dispose() {
    console.log(
        `[sim-network.js]: [N/A] - [dispose] - boundSceneId has a value of ${boundSceneId}.`
    ); //This is logged when leaving in-game.
    disposeSimNetworkFlow();
    boundSceneId = null;
}
