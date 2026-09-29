/**
 * Sim Network session progress — survives scene switches for the page visit.
 * Not cleared when leaving in-game (only Play again / explicit reset / page reload).
 * Completed maps stay completed for the session even if the player replays and EXIT mid-level.
 */

/** @typedef {{ id: string, kind: string, title: string, url: string, description?: string, sequenceFileName?: string }} SimNetworkMapEntry */
/** @typedef {{ id: string, title: string, sortOrder: number, comingSoon: boolean, maps: SimNetworkMapEntry[] }} SimNetworkDifficulty */

/** @type {{ selectedDifficultyId: string | null, mapIndex: number, completedDifficulties: Set<string>, completedMaps: Set<string> }} */
const session = {
    selectedDifficultyId: null,
    mapIndex: 0,
    completedDifficulties: new Set(),
    completedMaps: new Set()
};

export function getSimNetworkSession() {
    return session;
}

export function resetSimNetworkSession() {
    session.selectedDifficultyId = null;
    session.mapIndex = 0;
    session.completedDifficulties.clear();
    session.completedMaps.clear();
    console.log(
        `[simNetworkSession.js]: [N/A] - [resetSimNetworkSession] - reset has a value of true.`
    ); //This is logged when Play again (or an explicit reset) clears track progress.
}

/**
 * @param {string} difficultyId
 */
export function selectDifficultyTrack(difficultyId) {
    session.selectedDifficultyId = difficultyId;
    session.mapIndex = 0;
    console.log(
        `[simNetworkSession.js]: [N/A] - [selectDifficultyTrack] - difficultyId has a value of ${difficultyId}.`
    ); //This is logged when level-select chooses a track before switching to in-game.
}

/**
 * Open a specific layout inside a difficulty track (level-select map button).
 * @param {string} difficultyId
 * @param {number} mapIndex
 */
export function selectMap(difficultyId, mapIndex) {
    session.selectedDifficultyId = difficultyId;
    session.mapIndex = Math.max(0, Number(mapIndex) || 0);
    console.log(
        `[simNetworkSession.js]: [N/A] - [selectMap] - difficultyId has a value of ${difficultyId}, mapIndex has a value of ${session.mapIndex}.`
    ); //This is logged when level-select picks a specific layout button.
}

/**
 * Clear the in-progress track only (keep completedDifficulties + completedMaps).
 * Used when EXIT / Go Back confirms leave back to level-select.
 */
export function clearCurrentTrackSelection() {
    session.selectedDifficultyId = null;
    session.mapIndex = 0;
    console.log(
        `[simNetworkSession.js]: [N/A] - [clearCurrentTrackSelection] - cleared has a value of true.`
    ); //This is logged when EXIT/Go Back Yes clears the current track before returning to level-select.
}

/**
 * @param {object} indexDoc
 * @returns {SimNetworkDifficulty[]}
 */
export function parseDifficulties(indexDoc) {
    const list = Array.isArray(indexDoc?.difficulties) ? indexDoc.difficulties : [];
    return list
        .filter((entry) => entry && typeof entry.id === 'string' && entry.id)
        .map((entry) => {
            const maps = Array.isArray(entry.maps)
                ? entry.maps.filter(
                      (map) =>
                          map &&
                          typeof map.id === 'string' &&
                          typeof map.url === 'string' &&
                          typeof map.kind === 'string'
                  )
                : [];
            return {
                id: entry.id,
                title: typeof entry.title === 'string' ? entry.title : entry.id,
                sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : 99,
                // comingSoon = track is visible in level-select but not playable yet.
                comingSoon: entry.comingSoon === true,
                maps
            };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * @param {SimNetworkDifficulty | null | undefined} difficulty
 * @returns {boolean}
 */
export function isDifficultyComingSoon(difficulty) {
    return Boolean(difficulty?.comingSoon);
}

/**
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {SimNetworkDifficulty[]}
 */
export function getSortedDifficulties(difficulties) {
    return [...difficulties].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * Flat list of every map in difficulty order (progress bar + unlock sequence).
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {Array<SimNetworkMapEntry & { difficultyId: string, mapIndex: number, comingSoon: boolean }>}
 */
export function getFlatMaps(difficulties) {
    const flat = [];
    for (const difficulty of getSortedDifficulties(difficulties)) {
        difficulty.maps.forEach((map, mapIndex) => {
            flat.push({
                ...map,
                difficultyId: difficulty.id,
                mapIndex,
                comingSoon: difficulty.comingSoon === true
            });
        });
    }
    return flat;
}

/**
 * Maps that count for unlock / “all done” (excludes comingSoon tracks).
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {Array<SimNetworkMapEntry & { difficultyId: string, mapIndex: number, comingSoon: boolean }>}
 */
export function getPlayableFlatMaps(difficulties) {
    return getFlatMaps(difficulties).filter((entry) => !entry.comingSoon);
}

/**
 * @param {string} mapId
 * @returns {boolean}
 */
export function isMapComplete(mapId) {
    return typeof mapId === 'string' && session.completedMaps.has(mapId);
}

/**
 * Strict sequence across playable maps only: first playable map unlocked;
 * later maps unlock only after the previous playable map is complete.
 * comingSoon maps are never unlocked. Completed playable maps stay replayable.
 * @param {SimNetworkDifficulty[]} difficulties
 * @param {string} mapId
 * @returns {boolean}
 */
export function isMapUnlocked(difficulties, mapId) {
    const playable = getPlayableFlatMaps(difficulties);
    const index = playable.findIndex((entry) => entry.id === mapId);
    if (index < 0) {
        // Not in the playable list (unknown id, or comingSoon track).
        return false;
    }
    if (index === 0) {
        return true;
    }
    if (session.completedMaps.has(mapId)) {
        return true;
    }
    return session.completedMaps.has(playable[index - 1].id);
}

/**
 * First unlocked-but-not-complete playable map, or null if all playable maps are done.
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {string | null}
 */
export function getCurrentProgressMapId(difficulties) {
    const playable = getPlayableFlatMaps(difficulties);
    for (const entry of playable) {
        if (!session.completedMaps.has(entry.id) && isMapUnlocked(difficulties, entry.id)) {
            return entry.id;
        }
    }
    return null;
}

/**
 * Mark a layout complete for this page visit. Also marks the difficulty track
 * complete when every map in that track is done. Never removes prior completions.
 * @param {SimNetworkDifficulty[]} difficulties
 * @param {string} mapId
 */
export function markMapComplete(difficulties, mapId) {
    if (typeof mapId !== 'string' || !mapId) {
        return;
    }
    session.completedMaps.add(mapId);

    const sorted = getSortedDifficulties(difficulties);
    for (const difficulty of sorted) {
        if (
            difficulty.maps.length > 0 &&
            difficulty.maps.every((map) => session.completedMaps.has(map.id))
        ) {
            session.completedDifficulties.add(difficulty.id);
        }
    }

    console.log(
        `[simNetworkSession.js]: [N/A] - [markMapComplete] - mapId has a value of ${mapId}, completedMapCount has a value of ${session.completedMaps.size}.`
    ); //This is logged when a network-test pass credits a layout for the session.
}

/**
 * @param {SimNetworkDifficulty[]} difficulties
 * @param {string} difficultyId
 * @returns {boolean}
 */
export function isDifficultyUnlocked(difficulties, difficultyId) {
    const sorted = getSortedDifficulties(difficulties);
    const index = sorted.findIndex((entry) => entry.id === difficultyId);
    if (index < 0) {
        return false;
    }
    const target = sorted[index];
    if (target.comingSoon) {
        return false;
    }
    // Only prior playable tracks must be complete (skip comingSoon neighbours).
    for (let i = 0; i < index; i += 1) {
        if (sorted[i].comingSoon) {
            continue;
        }
        if (!session.completedDifficulties.has(sorted[i].id)) {
            return false;
        }
    }
    return true;
}

/**
 * True when every playable (non-comingSoon) map is complete.
 * Used to route to 05-complete while later tracks are still flagged comingSoon.
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {boolean}
 */
export function allDifficultiesComplete(difficulties) {
    const playable = getPlayableFlatMaps(difficulties);
    return playable.length > 0 && playable.every((entry) => session.completedMaps.has(entry.id));
}

/**
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {SimNetworkDifficulty | null}
 */
export function getSelectedDifficulty(difficulties) {
    if (!session.selectedDifficultyId) {
        return null;
    }
    return difficulties.find((entry) => entry.id === session.selectedDifficultyId) || null;
}

/**
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {SimNetworkMapEntry | null}
 */
export function getCurrentMapEntry(difficulties) {
    const difficulty = getSelectedDifficulty(difficulties);
    if (!difficulty) {
        return null;
    }
    return difficulty.maps[session.mapIndex] || null;
}

/**
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {boolean}
 */
export function isLastMapInTrack(difficulties) {
    const difficulty = getSelectedDifficulty(difficulties);
    if (!difficulty || difficulty.maps.length === 0) {
        return true;
    }
    return session.mapIndex >= difficulty.maps.length - 1;
}
