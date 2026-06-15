/**
 * @module shared/ui/tui-manager
 * Injectable TUI singleton lifecycle.
 */

/**
 * @param {{
 *     TerminalCtor: new () => any,
 *     TuiCtor: new (terminal: any) => any,
 *     installCrashGuards: () => void,
 *     uninstallCrashGuards: () => void,
 * }} deps
 */
export function createTuiManager({
    TerminalCtor,
    TuiCtor,
    installCrashGuards,
    uninstallCrashGuards,
}) {
    /** @type {any | null} */
    let tuiInstance = null;
    /** @type {any | null} */
    let terminalInstance = null;

    function initTUI() {
        if (tuiInstance) return tuiInstance;
        terminalInstance = new TerminalCtor();
        tuiInstance = new TuiCtor(terminalInstance);
        tuiInstance.start();
        installCrashGuards();
        return tuiInstance;
    }

    function getTUI() {
        if (!tuiInstance || !terminalInstance) {
            throw new Error("TUI not initialized. Call initTUI() first.");
        }
        return { tui: tuiInstance, terminal: terminalInstance };
    }

    function stopTUI() {
        uninstallCrashGuards();
        if (tuiInstance) {
            if (typeof tuiInstance.stop === "function") {
                tuiInstance.stop();
            }
            tuiInstance = null;
            terminalInstance = null;
        }
    }

    return { initTUI, getTUI, stopTUI };
}
