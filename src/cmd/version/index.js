/**
 * @module cmd/version
 * Print runwield version and architecture.
 */

import { VERSION } from "../../shared/version.js";

const TARGET_ARCH = Deno.build.target;

/**
 * Run the version command — prints "runwield <version> (<target-triple>)" to stdout.
 *
 * @returns {Promise<void>}
 */
export function runVersionCommand() {
    console.log(`runwield ${VERSION} (${TARGET_ARCH})`);
    return Promise.resolve();
}
