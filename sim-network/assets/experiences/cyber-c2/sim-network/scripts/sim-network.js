/**
 * Sim-network scene script — in-scene UX flow + kit stamp play.
 *
 * Flow (StateManager): splash → instructions → levelSelect → play → complete.
 * Maps come from layouts-index.json difficulties[].maps[].
 * createScene resolves when the splash HTML screen is ready (not when the first map stamps).
 *
 * Edit → play loop for maps:
 * 1. Author placements in layout-editor.html (parts come from kit-parts.json)
 * 2. Save writes the map file and upserts map meta into layouts-index.json difficulties[]
 * 3. Open sim-network in the player
 */

import { startSimNetworkFlow, disposeSimNetworkFlow } from './simNetworkFlow.js';

/** Hand-owned part catalog (kind / group / paths). Editor never overwrites this. */
const KIT_PARTS_URL =
    './assets/experiences/cyber-c2/sim-network/layouts/kit-parts.json';

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
    ); //This is logged to debug sim-network boot before the in-scene UX flow starts.

    const catalog = await fetchJson(KIT_PARTS_URL);
    console.log(
        `[sim-network.js]: [N/A] - [createScene] - catalogId has a value of ${catalog?.id ?? 'unnamed'}, partsCount has a value of ${catalog?.parts?.length ?? 0}.`
    ); //This is logged when the kit catalog has loaded for the flow.

    const flowReady = await startSimNetworkFlow(scene, catalog, sceneId);
    console.log(
        `[sim-network.js]: [N/A] - [createScene] - flowReady has a value of ${flowReady?.ready}.`
    ); //This is logged when the sim-network flow splash screen is ready and createScene can finish.
}

/**
 * Cleanup when leaving the scene.
 */
export function dispose() {
    console.log(
        `[sim-network.js]: [N/A] - [dispose] - boundSceneId has a value of ${boundSceneId}.`
    ); //This is logged to debug sim-network teardown.
    disposeSimNetworkFlow();
    boundSceneId = null;
}
