/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function directoryExists(path) {
    try {
        const stat = await Deno.stat(path);
        return stat.isDirectory;
    } catch {
        return false;
    }
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function fileExists(path) {
    try {
        const stat = await Deno.stat(path);
        return stat.isFile;
    } catch {
        return false;
    }
}
