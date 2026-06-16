/**
 * @module cmd/version
 * Print harns version and architecture.
 */

import { HNS_VERSION } from "../../shared/version.js";

const TARGET_ARCH = Deno.build.target;

/**
 * Run the version command — prints "harns <version> (<target-triple>)" to stdout.
 *
 * @returns {Promise<void>}
 */
export function runVersionCommand() {
    console.log(`harns ${HNS_VERSION} (${TARGET_ARCH})`);
    return Promise.resolve();
}
