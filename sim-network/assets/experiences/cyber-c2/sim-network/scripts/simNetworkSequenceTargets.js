/**
 * Sequence target bridge for sim-network stamps.
 * Creates model3d_<part>_<x>_<z>_L<layer>[_m] wrappers so chapterStepsSequencer
 * / SequencePlayer can find stamps the same way as normal tour models.
 * Lives only in sim-network custom code — no src/ sequencer changes.
 */

import { getAllStamps } from './layoutAssembler.js';

const HOST_KEY = '__XRS_EXPERIENCE_HOST__';

/** @type {import('@babylonjs/core').TransformNode[]} */
let sequenceAliases = [];

/**
 * @returns {{ TransformNode: Function, Vector3: Function }}
 */
function getHost() {
    const host = globalThis[HOST_KEY];
    if (!host || typeof host.TransformNode !== 'function' || typeof host.Vector3 !== 'function') {
        throw new Error(
            'Experience host API missing TransformNode / Vector3. Is installExperienceHostApi() running?'
        );
    }
    return host;
}

/**
 * Stable sequence modelId for a stamp (matches hand-edited sequence JSON).
 * Example: desktop-pc_0_0_L5 or router_3_4_L4_m
 * @param {string} partId
 * @param {number} x
 * @param {number} z
 * @param {number} layer
 * @param {boolean} [mirror]
 * @returns {string}
 */
export function buildSequenceModelId(partId, x, z, layer, mirror = false) {
    return `${partId}_${x}_${z}_L${layer}${mirror ? '_m' : ''}`;
}

/**
 * True when the stamp wrap name was built with a mirror suffix.
 * @param {import('@babylonjs/core').TransformNode | null | undefined} wrap
 * @returns {boolean}
 */
function wrapIsMirrored(wrap) {
    const name = typeof wrap?.name === 'string' ? wrap.name : '';
    return name.endsWith('_m');
}

/**
 * Remove previous model3d_* aliases without disposing the stamp wraps.
 */
export function disposeSequenceTargets() {
    const count = sequenceAliases.length;
    for (const alias of sequenceAliases) {
        try {
            const children = alias.getChildren?.() || [];
            for (const child of children) {
                if (!child || !('parent' in child)) {
                    continue;
                }
                // Keep world pose if layout dispose is delayed; setParent(null, true) = keep world.
                if (typeof child.setParent === 'function') {
                    child.setParent(null, true);
                } else {
                    child.parent = null;
                }
            }
            alias.dispose?.(false, false);
        } catch (error) {
            console.warn(
                `[simNetworkSequenceTargets.js]: [N/A] - [disposeSequenceTargets] - aliasDisposeError has a value of ${error?.message || error}.`
            ); //This is logged when a sequence alias failed to dispose cleanly.
        }
    }
    sequenceAliases = [];
    console.log(
        `[simNetworkSequenceTargets.js]: [N/A] - [disposeSequenceTargets] - disposedAliasCount has a value of ${count}.`
    ); //This is logged when sequence model3d wrappers are cleared before rebuild or scene exit.
}

/**
 * Parent each tracked map stamp under a model3d_* TransformNode for the sequencer.
 * Leaves wraps unfrozen so parent model-move clips can drive them.
 * @param {import('@babylonjs/core').Scene} scene
 * @returns {number} how many aliases were created
 */
export function createSequenceTargets(scene) {
    if (!scene) {
        console.warn(
            `[simNetworkSequenceTargets.js]: [N/A] - [createSequenceTargets] - sceneMissing has a value of true.`
        ); //This is logged when sequence targets cannot be built without a scene.
        return 0;
    }

    disposeSequenceTargets();

    const host = getHost();
    const stamps = getAllStamps().filter((stamp) => stamp && stamp.playerDrop !== true);
    let created = 0;

    for (const stamp of stamps) {
        const wrap = stamp.wrap;
        if (!wrap) {
            continue;
        }

        const mirror = wrapIsMirrored(wrap);
        const modelId = buildSequenceModelId(
            stamp.partId,
            stamp.x,
            stamp.z,
            stamp.layer,
            mirror
        );
        const aliasName = `model3d_${modelId}`;

        wrap.unfreezeWorldMatrix?.();
        wrap.computeWorldMatrix?.(true);

        const alias = new host.TransformNode(aliasName, scene);
        alias.position = new host.Vector3(
            wrap.position.x,
            wrap.position.y,
            wrap.position.z
        );
        alias.rotation = new host.Vector3(
            wrap.rotation.x,
            wrap.rotation.y,
            wrap.rotation.z
        );

        wrap.parent = alias;
        wrap.position = new host.Vector3(0, 0, 0);
        wrap.rotation = new host.Vector3(0, 0, 0);

        sequenceAliases.push(alias);
        created += 1;
    }

    console.log(
        `[simNetworkSequenceTargets.js]: [N/A] - [createSequenceTargets] - createdAliasCount has a value of ${created}, stampCandidateCount has a value of ${stamps.length}.`
    ); //This is logged when stamps are wrapped as model3d_* targets for chapter sequence playback.
    return created;
}
