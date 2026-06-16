/**
 * @module scripts/write-version.test
 */

import { assertEquals } from "@std/assert";
import { getGitHubTagName, resolveBuildVersion } from "./write-version.js";

/**
 * @param {Record<string, string | undefined>} values
 * @returns {(name: string) => string | undefined}
 */
function env(values) {
    return (name) => values[name];
}

/**
 * @param {Record<string, string | undefined>} values
 * @returns {(args: string[]) => string | undefined}
 */
function git(values) {
    return (args) => values[args.join(" ")];
}

Deno.test("getGitHubTagName prefers the explicit GitHub tag ref name", () => {
    const tag = getGitHubTagName(env({
        GITHUB_REF_TYPE: "tag",
        GITHUB_REF_NAME: "v1.2.3",
        GITHUB_REF: "refs/tags/ignored",
    }));

    assertEquals(tag, "v1.2.3");
});

Deno.test("getGitHubTagName falls back to parsing GITHUB_REF tag refs", () => {
    const tag = getGitHubTagName(env({
        GITHUB_REF: "refs/tags/release/v1.2.3",
    }));

    assertEquals(tag, "release/v1.2.3");
});

Deno.test("resolveBuildVersion uses GitHub tag before git metadata", () => {
    const version = resolveBuildVersion({
        readEnv: env({
            GITHUB_REF_TYPE: "tag",
            GITHUB_REF_NAME: "v2.0.0",
        }),
        runGit: git({
            "describe --tags --exact-match HEAD": "v1.9.0",
            "rev-parse --short HEAD": "abc1234",
        }),
    });

    assertEquals(version, "v2.0.0");
});

Deno.test("resolveBuildVersion uses exact local tag before short hash", () => {
    const version = resolveBuildVersion({
        readEnv: env({}),
        runGit: git({
            "describe --tags --exact-match HEAD": "v1.2.3",
            "rev-parse --short HEAD": "abc1234",
        }),
    });

    assertEquals(version, "v1.2.3");
});

Deno.test("resolveBuildVersion falls back to short hash and then dev", () => {
    assertEquals(
        resolveBuildVersion({ readEnv: env({}), runGit: git({ "rev-parse --short HEAD": "abc1234" }) }),
        "abc1234",
    );
    assertEquals(resolveBuildVersion({ readEnv: env({}), runGit: git({}) }), "dev");
});
