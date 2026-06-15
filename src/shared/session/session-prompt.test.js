import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { getGlobalAgentMdPaths, readGlobalAgentMd } from "./session.js";

Deno.test("readGlobalAgentMd falls back from ~/.hns/HARNS.md to ~/.hns/AGENTS.md", async () => {
    const tempHome = await Deno.makeTempDir({ prefix: "harns-agents-md-" });

    try {
        await Deno.mkdir(join(tempHome, ".hns"), { recursive: true });
        await Deno.writeTextFile(join(tempHome, ".hns", "AGENTS.md"), "Global AGENTS fallback");

        const prompt = await readGlobalAgentMd(tempHome);

        assertEquals(prompt, "Global AGENTS fallback");
    } finally {
        await Deno.remove(tempHome, { recursive: true });
    }
});

Deno.test("getGlobalAgentMdPaths stays inside ~/.hns", () => {
    assertEquals(getGlobalAgentMdPaths("/tmp/home"), [
        "/tmp/home/.hns/HARNS.md",
        "/tmp/home/.hns/AGENTS.md",
    ]);
});
