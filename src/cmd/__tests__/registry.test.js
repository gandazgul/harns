import { assertEquals } from "@std/assert";
import { parseArgs } from "@std/cli/parse-args";
import {
    findCliFlagCommand,
    getCliCommandDefinitions,
    getCliParseConfig,
    getCommandDefinition,
    getSlashCommandDefinition,
    getSlashCommandDefinitions,
    hasCommandSurface,
} from "../registry.js";

Deno.test("getCommandDefinition resolves alias", () => {
    const command = getCommandDefinition("agents");
    assertEquals(command?.name, "agent");
});

Deno.test("getCliCommandDefinitions excludes slash-only commands", () => {
    const commands = getCliCommandDefinitions();
    assertEquals(commands.some((command) => command.name === "export"), false);
    assertEquals(commands.some((command) => command.name === "router"), true);
});

Deno.test("getSlashCommandDefinitions excludes cli-only commands", () => {
    const commands = getSlashCommandDefinitions();
    assertEquals(commands.some((command) => command.name === "plans"), false);
    assertEquals(commands.some((command) => command.name === "theme"), true);
});

Deno.test("registry surfaces capture theme and model CLI support", () => {
    const theme = getCommandDefinition("theme");
    const model = getCommandDefinition("model");
    assertEquals(theme ? hasCommandSurface(theme, "cli") : false, true);
    assertEquals(theme ? hasCommandSurface(theme, "slash") : false, true);
    assertEquals(model ? hasCommandSurface(model, "cli") : false, true);
    assertEquals(model ? hasCommandSurface(model, "slash") : false, true);
});

Deno.test("getCliParseConfig is derived from command definitions", () => {
    const config = getCliParseConfig();
    assertEquals(config.string.includes("agent"), true);
    assertEquals(config.string.includes("theme"), true);
    assertEquals(config.boolean.includes("plans"), true);
    assertEquals(config.alias.a, "agent");
});

Deno.test("findCliFlagCommand resolves aliases", () => {
    const match = findCliFlagCommand({ agent: "engineer" });
    assertEquals(match?.command.name, "agent");
    assertEquals(match?.flagValue, "engineer");
});

Deno.test("derived CLI parse config works with parseArgs", () => {
    const config = getCliParseConfig();
    const parsed = parseArgs(["--agents", "engineer", "build", "thing"], {
        stopEarly: true,
        string: config.string,
        boolean: ["help", "continue", ...config.boolean],
        alias: { h: "help", c: "continue", ...config.alias },
    });
    const match = findCliFlagCommand(parsed);
    assertEquals(match?.command.name, "agent");
    assertEquals(match?.flagValue, "engineer");
    assertEquals(parsed._.map(String), ["build", "thing"]);
});

Deno.test("getSlashCommandDefinition resolves slash aliases", () => {
    const command = getSlashCommandDefinition("models");
    assertEquals(command?.name, "model");
});
