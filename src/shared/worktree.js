/**
 * @module shared/worktree
 * Git worktree helpers for isolated plan execution.
 */

import { basename, dirname, join } from "@std/path";
import { WORKTREE_BRANCH_PREFIX, WORKTREE_PATH_PREFIX } from "../constants.js";
import { getWorkflowDiff } from "./workflow/git-snapshot.js";
import { addEntry, listEntries, pruneStaleEntries, removeEntry } from "./worktree-registry.js";

/**
 * @param {string} cwd
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function runGit(cwd, args) {
    const command = new Deno.Command("git", { args, cwd, stdout: "piped", stderr: "piped" });
    const { code, stdout, stderr } = await command.output();
    const decoder = new TextDecoder();
    const out = decoder.decode(stdout);
    const err = decoder.decode(stderr);
    if (code !== 0) throw new Error(`git ${args.join(" ")} failed: ${err || out}`.trim());
    return out;
}

/** @param {string} value */
function slugify(value) {
    const slug = value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return slug.slice(0, 48) || "plan";
}

/** @param {string} path */
async function pathExists(path) {
    try {
        await Deno.stat(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * @param {string} statusText
 * @returns {string[]}
 */
function parseStatusPaths(statusText) {
    return statusText.trim().split("\n").filter(Boolean).map((line) => line.slice(3).trim()).filter(Boolean);
}

/**
 * @param {string} dirtyPath
 * @param {Set<string>} allowedPaths
 */
function isAllowedDirtyPath(dirtyPath, allowedPaths) {
    if (allowedPaths.has(dirtyPath)) return true;
    for (const allowedPath of allowedPaths) {
        const normalizedAllowed = allowedPath.endsWith("/") ? allowedPath : `${allowedPath}/`;
        const normalizedDirty = dirtyPath.endsWith("/") ? dirtyPath : `${dirtyPath}/`;
        if (dirtyPath.startsWith(normalizedAllowed)) return true;
        if (normalizedAllowed.startsWith(normalizedDirty)) return true;
    }
    return false;
}

/**
 * @param {string} porcelainText
 * @param {string} branch
 * @returns {string | null}
 */
function findWorktreePathForBranch(porcelainText, branch) {
    const records = porcelainText.trim().split("\n\n").filter(Boolean);
    for (const record of records) {
        const lines = record.split("\n");
        const worktreePath = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
        const recordBranch = lines.find((line) => line.startsWith("branch "))?.slice("branch ".length);
        if (recordBranch === `refs/heads/${branch}`) return worktreePath || null;
    }
    return null;
}

/**
 * @param {string} worktreePath
 * @param {string} branch
 */
async function commitDirtyWorktreeState(worktreePath, branch) {
    const currentBranch = (await runGit(worktreePath, ["branch", "--show-current"])).trim();
    if (currentBranch !== branch) {
        throw new Error(`Worktree path ${worktreePath} is on ${currentBranch || "detached HEAD"}, not ${branch}`);
    }
    await runGit(worktreePath, ["add", "-A", "--", "."]);
    const stagedDiff = await runGit(worktreePath, ["diff", "--cached", "--name-only"]);
    if (!stagedDiff.trim()) return;
    await runGit(worktreePath, ["commit", "-m", "Apply execution worktree changes"]);
}

/**
 * @param {{ projectRoot: string, planName: string, baseRef?: string }} opts
 */
export async function createExecutionWorktree({ projectRoot, planName, baseRef = "HEAD" }) {
    const id = crypto.randomUUID().slice(0, 8);
    const slug = slugify(planName);
    const branch = `${WORKTREE_BRANCH_PREFIX}${slug}-${id}`;
    const parent = dirname(projectRoot);
    const repoName = basename(projectRoot);
    const path = join(parent, `${repoName}-${WORKTREE_PATH_PREFIX}${slug}-${id}`);
    const now = new Date().toISOString();
    const baseBranch = (await runGit(projectRoot, ["branch", "--show-current"])).trim() || "HEAD";
    const baseCommit = (await runGit(projectRoot, ["rev-parse", baseRef])).trim();
    const baseTree = (await runGit(projectRoot, ["rev-parse", `${baseRef}^{tree}`])).trim();

    await runGit(projectRoot, ["worktree", "add", "-b", branch, path, baseRef]);

    /** @type {import('./worktree-registry.js').WorktreeRegistryEntry} */
    const entry = {
        id,
        planName,
        baseBranch,
        baseRef,
        baseCommit,
        baseTree,
        branch,
        path,
        status: "active",
        createdAt: now,
        updatedAt: now,
    };
    await addEntry(projectRoot, entry);
    return entry;
}

/**
 * @param {{ projectRoot: string, path: string, branch?: string, baseTree?: string }} opts
 */
export async function getWorktreeStatus({ path, branch, baseTree }) {
    if (!await pathExists(path)) {
        return { exists: false, clean: false, statusText: "missing", diff: "" };
    }
    const statusText = await runGit(path, ["status", "--porcelain"]);
    const clean = statusText.trim() === "";
    let currentBranch = "";
    try {
        currentBranch = (await runGit(path, ["branch", "--show-current"])).trim();
    } catch {
        currentBranch = "";
    }
    let diff = "";
    if (baseTree) {
        try {
            diff = await getWorkflowDiff(path, baseTree);
        } catch {
            diff = await runGit(path, ["diff"]);
        }
    } else {
        diff = await getWorkflowDiff(path, undefined);
    }
    return {
        exists: true,
        clean,
        branch: currentBranch,
        expectedBranch: branch,
        statusText,
        diff,
    };
}

/**
 * @param {{ projectRoot: string, branch: string, worktreePath?: string, allowedDirtyPaths?: string[] }} opts
 */
export async function mergeExecutionWorktree({ projectRoot, branch, worktreePath, allowedDirtyPaths = [] }) {
    const statusText = await runGit(projectRoot, ["status", "--porcelain"]);
    const allowed = new Set(allowedDirtyPaths);
    const blockingDirtyPaths = parseStatusPaths(statusText).filter((path) => !isAllowedDirtyPath(path, allowed));
    if (blockingDirtyPaths.length > 0) {
        throw new Error(
            "Primary checkout has uncommitted changes; refusing to merge execution worktree: " +
                blockingDirtyPaths.join(", "),
        );
    }

    let resolvedWorktreePath = worktreePath;
    if (!resolvedWorktreePath) {
        const worktreeList = await runGit(projectRoot, ["worktree", "list", "--porcelain"]);
        resolvedWorktreePath = findWorktreePathForBranch(worktreeList, branch) || undefined;
    }
    if (resolvedWorktreePath) {
        await commitDirtyWorktreeState(resolvedWorktreePath, branch);
    }

    await runGit(projectRoot, ["merge", "--no-ff", branch]);
}

/**
 * @param {{ projectRoot: string, path: string, branch?: string, force?: boolean }} opts
 */
export async function removeExecutionWorktree({ projectRoot, path, branch, force = false }) {
    const args = ["worktree", "remove"];
    if (force) args.push("--force");
    args.push(path);
    await runGit(projectRoot, args).catch(async (error) => {
        if (!force || await pathExists(path)) throw error;
    });
    if (branch) await runGit(projectRoot, ["branch", "-D", branch]).catch(() => {});
}

/** @param {{ projectRoot: string }} opts */
export async function pruneMissingWorktrees({ projectRoot }) {
    await runGit(projectRoot, ["worktree", "prune"]).catch(() => {});
    return await pruneStaleEntries(projectRoot);
}

/**
 * @param {{ projectRoot: string, planName: string }} opts
 */
export async function findReusableWorktree({ projectRoot, planName }) {
    await pruneStaleEntries(projectRoot);
    const entries = await listEntries(projectRoot);
    for (const entry of entries) {
        if (entry.planName !== planName) continue;
        if (["active", "completed", "execution_failed", "validation_failed", "merge_conflict"].includes(entry.status)) {
            if (await pathExists(entry.path)) return entry;
        }
    }
    return null;
}

export { removeEntry as removeWorktreeRegistryEntry };
