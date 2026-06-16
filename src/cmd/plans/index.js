/**
 * @module cmd/plans
 * List saved plans.
 */

import { parseArgs as parseArgsFn } from "@std/cli/parse-args";
import { CWD } from "../../constants.js";
import { listPlans as listPlansFn } from "../../plan-store.js";
import { printCommandHelp as printCommandHelpFn } from "../help/index.js";

/**
 * @typedef {Object} CommandDependencies
 * @property {typeof parseArgsFn} [parseArgs]
 * @property {typeof listPlansFn} [listPlans]
 * @property {typeof printCommandHelpFn} [printCommandHelp]
 */

/**
 * Handle `plans` command.
 *
 * @param {string[]} argv
 * @param {import('../registry.js').CommandContext & { __testDeps?: CommandDependencies }} [options]
 */
export async function runPlansCommand(argv, options = {}) {
    const deps = /** @type {CommandDependencies} */ options.__testDeps || {};
    const {
        parseArgs: parseArgsDep,
        listPlans: listPlansDep,
        printCommandHelp: printCommandHelpDep,
    } = deps;

    /** @type {typeof parseArgsFn} */
    const parseArgs = parseArgsDep || parseArgsFn;
    /** @type {typeof listPlansFn} */
    const listPlans = listPlansDep || listPlansFn;
    /** @type {typeof printCommandHelpFn} */
    const printCommandHelp = printCommandHelpDep || printCommandHelpFn;

    const parsed = parseArgs(argv, {
        boolean: ["help"],
        alias: { h: "help" },
    });

    if (parsed.help) {
        printCommandHelp("plans");
        return;
    }

    const plans = await listPlans(CWD);
    if (plans.length === 0) {
        console.log("[Harns] No saved plans found.");
        return;
    }

    console.log("\n[Harns] Saved plans:\n");
    for (const p of plans) {
        console.log(`  ${p.name}`);
        console.log(
            `    Status: ${p.attrs.status} | Classification: ${p.attrs.classification} | Complexity: ${p.attrs.complexity}`,
        );
        console.log(`    Summary: ${p.attrs.summary || "(none)"}`);
        if (p.attrs.worktreeStatus || p.attrs.worktreeBranch || p.attrs.worktreePath) {
            const ref = p.attrs.worktreeBranch || p.attrs.worktreePath || "unknown";
            console.log(`    Worktree: ${p.attrs.worktreeStatus || "unknown"} (${ref})`);
        }
        console.log(`    Created: ${p.attrs.createdAt}`);
        console.log();
    }
}
