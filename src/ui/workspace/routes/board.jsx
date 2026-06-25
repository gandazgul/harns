import { BoardView } from "../components/Board.jsx";
import { loadBoard, serializePlanError } from "../server/plan-adapter.js";

const VIEW_COPY = {
    active: {
        title: "Board",
        description: "Active, implemented, and repair-needed Plans that still need attention.",
    },
    closed: {
        title: "Closed",
        description: "Verified Plans and Plans closed without verification.",
    },
    onHold: {
        title: "On Hold",
        description: "Plans explicitly parked with on_hold lifecycle status.",
    },
};

/**
 * @param {"active"|"closed"|"onHold"} view
 */
export function boardRoute(view) {
    return async (/** @type {any} */ ctx) => {
        const copy = VIEW_COPY[view];
        try {
            const board = await loadBoard(ctx.state.cwd);
            return ctx.render(
                <BoardView board={board} view={view} title={copy.title} description={copy.description} url={ctx.url} />,
            );
        } catch (error) {
            const body = serializePlanError(error);
            return ctx.render(
                <section class="error-panel">
                    <h2>{copy.title} failed to load</h2>
                    <p>{body.error}</p>
                    <p>{body.repair}</p>
                </section>,
                { status: 409 },
            );
        }
    };
}
