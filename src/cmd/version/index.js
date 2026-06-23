/**
 * @module cmd/version
 * Print runweild version and architecture.
 */

import { VERSION } from "../../shared/version.js";

const TARGET_ARCH = Deno.build.target;

/**
 * Run the version command — prints "runweild <version> (<target-triple>)" to stdout.
 *
 * @returns {Promise<void>}
 */
export function runVersionCommand() {
    console.log(`runweild ${VERSION} (${TARGET_ARCH})`);
    return Promise.resolve();
}
