/**
 * @module shared/session-state
 * Single source of truth for interactive session state.
 */

/**
 * @typedef {Object} PendingRootSwap
 * @property {string} agentName  Internal agent name (lowercase, matches agent definition filename).
 * @property {string} displayName  Display name as shown in the UI.
 * @property {string} [model]  Optional explicit model in provider/id format.
 */

/** @type {{
 * activeAgentName: string,
 * activeModel: string,
 * activeModelProvider: string,
 * userModelOverride: boolean,
 * activeThinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
 * activeOnMessage: import('./types.js').AgentMessageHandler | null,
 * rootSessionManager: import('./session/types.js').SessionManagerLike | null,
 * activeUiAPI: import('./ui/types.js').UiAPI | null,
 * rootAgentSession: import('@earendil-works/pi-coding-agent').AgentSession | null,
 * rootAgentName: string | null,
 * subAgentSessions: Set<import('@earendil-works/pi-coding-agent').AgentSession>,
 * pendingRootSwap: PendingRootSwap | null,
 * }} */
const state = {
    activeAgentName: "Router",
    activeModel: "",
    activeModelProvider: "",
    userModelOverride: false,
    activeThinkingLevel: "off",
    activeOnMessage: null,
    rootSessionManager: null, // conversation history / persistence (pi SessionManager)
    rootAgentSession: null, // long-lived AgentSession for the user-facing agent (pi AgentSession)
    rootAgentName: null, // internal name of the agent the rootAgentSession was built for
    subAgentSessions: new Set(), // transient AgentSessions (workflow sub-agents, switch_agent triggers)
    pendingRootSwap: null, // recorded when setActiveAgent is called during an in-flight turn
    activeUiAPI: null,
};

export function getActiveAgentName() {
    return state.activeAgentName;
}

/** @param {string} name */
export function setActiveAgentName(name) {
    state.activeAgentName = name;
}

/**
 * @param {string} model
 * @param {string} [provider]
 * @param {boolean} [isUserOverride] - true when set explicitly via /model
 */
export function setActiveModelState(model, provider = "", isUserOverride = false) {
    state.activeModel = model;
    if (provider) state.activeModelProvider = provider;
    state.userModelOverride = isUserOverride;
}

export function getActiveModelState() {
    return { model: state.activeModel, provider: state.activeModelProvider };
}

/** @returns {boolean} true when the active model was explicitly chosen by the user via /model */
export function isUserModelOverride() {
    return state.userModelOverride;
}

export function clearUserModelOverride() {
    state.userModelOverride = false;
}

/** @param {import('./types.js').AgentMessageHandler | null} handler */
export function setActiveOnMessage(handler) {
    state.activeOnMessage = handler;
}

export function getActiveOnMessage() {
    return state.activeOnMessage;
}

/** @param {import('./types.js').SessionManagerLike | null} sessionManager */
export function setRootSessionManager(sessionManager) {
    state.rootSessionManager = sessionManager;
}

export function getRootSessionManager() {
    return state.rootSessionManager;
}

/** @param {import('../ui/types.js').UiAPI | null} uiAPI */
export function setActiveUiAPI(uiAPI) {
    state.activeUiAPI = uiAPI;
}

export function getActiveUiAPIState() {
    return state.activeUiAPI;
}

/** @param {import('@earendil-works/pi-coding-agent').AgentSession | null} session */
export function setRootAgentSession(session) {
    state.rootAgentSession = session;
}

export function getRootAgentSession() {
    return state.rootAgentSession;
}

/** @param {string | null} agentName */
export function setRootAgentName(agentName) {
    state.rootAgentName = agentName;
}

export function getRootAgentName() {
    return state.rootAgentName;
}

/** @param {import('@earendil-works/pi-coding-agent').AgentSession} session */
export function addSubAgentSession(session) {
    state.subAgentSessions.add(session);
}

/** @param {import('@earendil-works/pi-coding-agent').AgentSession} session */
export function removeSubAgentSession(session) {
    state.subAgentSessions.delete(session);
}

export function getSubAgentSessions() {
    return state.subAgentSessions;
}

/** @param {PendingRootSwap | null} swap */
export function setPendingRootSwap(swap) {
    state.pendingRootSwap = swap;
}

export function getPendingRootSwap() {
    return state.pendingRootSwap;
}

/**
 * @returns {"off" | "minimal" | "low" | "medium" | "high" | "xhigh"}
 */
export function getThinkingLevel() {
    return state.activeThinkingLevel;
}

/**
 * @param {"off" | "minimal" | "low" | "medium" | "high" | "xhigh"} level
 */
export function setThinkingLevel(level) {
    state.activeThinkingLevel = level;
}
