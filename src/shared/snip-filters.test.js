import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
    cleanupRunWeildSnipFiltersForUser,
    getRunWeildSnipFilterInstallStatus,
    getRunWeildSnipPaths,
    installRunWeildSnipFiltersForUser,
} from "./snip-filters.js";

Deno.test("user Snip filter install and cleanup only manage RunWeild-owned files", async () => {
    const homeDir = await Deno.makeTempDir({ prefix: "runweild-snip-home-" });
    const bundledDir = await Deno.makeTempDir({ prefix: "runweild-snip-bundled-" });
    try {
        await Deno.writeTextFile(join(bundledDir, "deno-check.yaml"), "name: deno-check\n");
        await Deno.writeTextFile(join(bundledDir, "deno-fmt.yaml"), "name: deno-fmt\n");
        await Deno.writeTextFile(join(bundledDir, "deno-lint.yaml"), "name: deno-lint\n");
        await Deno.writeTextFile(join(bundledDir, "deno-test.yaml"), "name: deno-test\n");

        const paths = getRunWeildSnipPaths({ homeDir });
        await Deno.mkdir(paths.userFiltersDir, { recursive: true });
        await Deno.writeTextFile(join(paths.userFiltersDir, "deno-lint.yaml"), "name: user-deno-lint\n");

        const install = await installRunWeildSnipFiltersForUser({ homeDir, bundledDir });
        assertEquals(install.filtersDir, paths.userFiltersDir);
        assertEquals(install.installed.length, 3);
        assertEquals(install.skipped, [{
            path: join(paths.userFiltersDir, "deno-lint.yaml"),
            reason: "existing non-RunWeild filter",
        }]);

        const installedFmt = await Deno.readTextFile(join(paths.userFiltersDir, "deno-fmt.yaml"));
        assertStringIncludes(installedFmt, "Managed by RunWeild");
        assertStringIncludes(installedFmt, "name: deno-fmt");

        const status = await getRunWeildSnipFilterInstallStatus({ homeDir });
        assertEquals(status.installed.length, 3);
        assertEquals(status.conflicts, [join(paths.userFiltersDir, "deno-lint.yaml")]);
        assertEquals(status.missing, []);

        const cleanup = await cleanupRunWeildSnipFiltersForUser({ homeDir });
        assertEquals(cleanup.removed.length, 3);
        assertEquals(cleanup.skipped, [{
            path: join(paths.userFiltersDir, "deno-lint.yaml"),
            reason: "existing non-RunWeild filter",
        }]);
        assertEquals(await Deno.readTextFile(join(paths.userFiltersDir, "deno-lint.yaml")), "name: user-deno-lint\n");
    } finally {
        await Deno.remove(homeDir, { recursive: true }).catch(() => {});
        await Deno.remove(bundledDir, { recursive: true }).catch(() => {});
    }
});
