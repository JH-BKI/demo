/**
 * Sim Network session progress — survives scene switches for the page visit.
 * Not cleared when leaving in-game (only Play again / explicit reset).
 */

/** @typedef {{ id: string, kind: string, title: string, url: string, description?: string, sequenceFileName?: string }} SimNetworkMapEntry */
/** @typedef {{ id: string, title: string, sortOrder: number, maps: SimNetworkMapEntry[] }} SimNetworkDifficulty */

/** @type {{ selectedDifficultyId: string | null, mapIndex: number, completedDifficulties: Set<string> }} */
const session = {
    selectedDifficultyId: null,
    mapIndex: 0,
    completedDifficulties: new Set()
};

export function getSimNetworkSession() {
    return session;
}

export function resetSimNetworkSession() {
    session.selectedDifficultyId = null;
    session.mapIndex = 0;
    session.completedDifficulties.clear();
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
                maps
            };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {SimNetworkDifficulty[]}
 */
export function getSortedDifficulties(difficulties) {
    return [...difficulties].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * @param {SimNetworkDifficulty[]} difficulties
 * @param {string} difficultyId
 * @returns {boolean}
 */
export function isDifficultyUnlocked(difficulties, difficultyId) {
    const sorted = getSortedDifficulties(difficulties);
    const index = sorted.findIndex((entry) => entry.id === difficultyId);
    if (index <= 0) {
        return index === 0;
    }
    for (let i = 0; i < index; i += 1) {
        if (!session.completedDifficulties.has(sorted[i].id)) {
            return false;
        }
    }
    return true;
}

/**
 * @param {SimNetworkDifficulty[]} difficulties
 * @returns {boolean}
 */
export function allDifficultiesComplete(difficulties) {
    const sorted = getSortedDifficulties(difficulties);
    return (
        sorted.length > 0 && sorted.every((entry) => session.completedDifficulties.has(entry.id))
    );
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
