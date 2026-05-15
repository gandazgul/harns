/**
 * Regression tests for the persistent "Esc prints 'Agent run canceled.' when
 * nothing is running" bug. The root AgentSession is built once at chat start
 * and lives across turns, so `abortActiveSession()` must distinguish "session
 * exists" from "session is currently streaming". The keybindings layer relies
 * on the boolean to decide which (if any) message to print on Esc.
 */

import { assert, assertEquals } from "@std/assert";
import { abortActiveSession } from "./session.js";
import {
    addSubAgentSession,
    getSubAgentSessions,
    removeSubAgentSession,
    setRootAgentName,
    setRootAgentSession,
} from "./session-state.js";

/**
 * Build a minimal AgentSession stub that satisfies the `isStreaming` /
 * `abort()` surface `abortActiveSession()` touches.
 *
 * @param {{ isStreaming?: boolean, onAbort?: () => void }} [opts]
 */
function makeFakeSession(opts = {}) {
    const state = { isStreaming: !!opts.isStreaming, abortCalls: 0 };
    return /** @type {any} */ ({
        get isStreaming() {
            return state.isStreaming;
        },
        set isStreaming(value) {
            state.isStreaming = value;
        },
        abort() {
            state.abortCalls++;
            state.isStreaming = false;
            if (opts.onAbort) opts.onAbort();
        },
        get _abortCalls() {
            return state.abortCalls;
        },
    });
}

/** Reset session-state singletons after each test so order can't leak state. */
function resetSessionState() {
    setRootAgentSession(null);
    setRootAgentName(null);
    for (const sub of Array.from(getSubAgentSessions())) {
        removeSubAgentSession(sub);
    }
}

Deno.test("abortActiveSession returns false when root exists but is idle (regression: Esc on idle)", () => {
    resetSessionState();
    try {
        const idleRoot = makeFakeSession({ isStreaming: false });
        setRootAgentSession(idleRoot);
        setRootAgentName("router");

        // The whole point: idle root must not be treated as an active run.
        // If this flips to true, Esc will once again print the spurious
        // "Agent run canceled." message in the TUI.
        assertEquals(abortActiveSession(), false);
        assertEquals(idleRoot._abortCalls, 0, "must not call abort() on an idle root session");
    } finally {
        resetSessionState();
    }
});

Deno.test("abortActiveSession returns true and aborts when the root is streaming", () => {
    resetSessionState();
    try {
        const streamingRoot = makeFakeSession({ isStreaming: true });
        setRootAgentSession(streamingRoot);
        setRootAgentName("router");

        assertEquals(abortActiveSession(), true);
        assertEquals(streamingRoot._abortCalls, 1);
    } finally {
        resetSessionState();
    }
});

Deno.test("abortActiveSession returns true when a sub-agent is present, regardless of root state", () => {
    resetSessionState();
    try {
        const idleRoot = makeFakeSession({ isStreaming: false });
        const sub = makeFakeSession({ isStreaming: true });
        setRootAgentSession(idleRoot);
        setRootAgentName("router");
        addSubAgentSession(sub);

        assertEquals(abortActiveSession(), true);
        assertEquals(idleRoot._abortCalls, 0, "idle root must remain untouched even when sub-agents exist");
        assertEquals(sub._abortCalls, 1);
    } finally {
        resetSessionState();
    }
});

Deno.test("abortActiveSession returns false when no sessions exist at all", () => {
    resetSessionState();
    assertEquals(abortActiveSession(), false);
});

Deno.test("abortActiveSession swallows errors thrown by abort() and still reports true", () => {
    resetSessionState();
    try {
        const root = makeFakeSession({
            isStreaming: true,
            onAbort: () => {
                throw new Error("boom");
            },
        });
        setRootAgentSession(root);
        setRootAgentName("router");

        // Must not propagate; UI cancel paths assume this is safe to call.
        assertEquals(abortActiveSession(), true);
    } finally {
        resetSessionState();
    }
});

// ─── Message-priority guard ────────────────────────────────────────────
// Mirrors the keybindings.js Esc branch:
//   if (opCanceled)        → "Operation canceled."
//   else if (sessionAborted) → "Agent run canceled."
//   else if (planCanceled)   → "Plan review canceled."
// The regression we're guarding against: sessionAborted being true on idle
// would cause "Agent run canceled." to print with nothing actually running.

/**
 * @param {{ opCanceled: boolean, sessionAborted: boolean, planCanceled: boolean }} flags
 * @returns {string | null}
 */
function pickCancelMessage(flags) {
    if (flags.opCanceled) return "Operation canceled.";
    if (flags.sessionAborted) return "Agent run canceled.";
    if (flags.planCanceled) return "Plan review canceled.";
    return null;
}

Deno.test("Esc on a fully idle chat prints no cancellation message", () => {
    resetSessionState();
    const message = pickCancelMessage({
        opCanceled: false,
        sessionAborted: abortActiveSession(),
        planCanceled: false,
    });
    assertEquals(message, null);
});

Deno.test("Esc during a streaming root prints 'Agent run canceled.'", () => {
    resetSessionState();
    try {
        setRootAgentSession(makeFakeSession({ isStreaming: true }));
        setRootAgentName("router");
        const message = pickCancelMessage({
            opCanceled: false,
            sessionAborted: abortActiveSession(),
            planCanceled: false,
        });
        assertEquals(message, "Agent run canceled.");
    } finally {
        resetSessionState();
    }
});

Deno.test("Esc while an operation is active prefers 'Operation canceled.' over session/plan", () => {
    resetSessionState();
    try {
        setRootAgentSession(makeFakeSession({ isStreaming: true }));
        setRootAgentName("router");
        const message = pickCancelMessage({
            opCanceled: true,
            sessionAborted: abortActiveSession(),
            planCanceled: true,
        });
        assertEquals(message, "Operation canceled.");
    } finally {
        resetSessionState();
    }
});

Deno.test("Esc with only a plan review pending prints 'Plan review canceled.'", () => {
    resetSessionState();
    const message = pickCancelMessage({
        opCanceled: false,
        sessionAborted: abortActiveSession(),
        planCanceled: true,
    });
    assert(message === "Plan review canceled.");
});
