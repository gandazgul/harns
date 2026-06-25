import { PlanCard } from "./PlanCard.jsx";

/** @param {{ label: string }} props */
function EmptyState({ label }) {
    return <p class="empty">No {label} Plans found in this checkout.</p>;
}

/** @param {{ epic: any, url: URL }} props */
function EpicCard({ epic, url }) {
    const progress = epic.childProgress || { verified: 0, total: 0, active: 0, remaining: 0, failed: 0 };
    return (
        <section class="epic-card">
            <PlanCard plan={epic} url={url} />
            <p class="progress">
                {progress.verified}/{progress.total} child features verified
                {progress.active ? ` — ${progress.active} active/implemented` : ""}
                {progress.failed ? ` — ${progress.failed} failed` : ""}
            </p>
            {epic.children?.length
                ? (
                    <div class="children">
                        <h4>Child FEATURE Plans</h4>
                        {epic.children.map(/** @param {any} child */ (child) => (
                            <PlanCard key={child.planId} plan={child} url={url} compact />
                        ))}
                    </div>
                )
                : null}
        </section>
    );
}

/** @param {{ board: any, view: "active"|"closed"|"onHold", title: string, description: string, url: URL }} props */
export function BoardView({ board, view, title, description, url }) {
    const group = board.groups[view];
    const total = group.epics.length + group.standalone.length + group.orphanChildren.length;
    return (
        <section class="board-view" data-view={view}>
            <header class="page-header">
                <h2>{title}</h2>
                <p>{description}</p>
            </header>
            {total === 0 ? <EmptyState label={title.toLowerCase()} /> : null}
            {group.epics.length
                ? (
                    <section class="lane">
                        <h3>Epics</h3>
                        <div class="card-grid">
                            {group.epics.map(/** @param {any} epic */ (epic) => (
                                <EpicCard key={epic.planId} epic={epic} url={url} />
                            ))}
                        </div>
                    </section>
                )
                : null}
            {group.standalone.length
                ? (
                    <section class="lane">
                        <h3>Standalone Plans</h3>
                        <div class="card-grid">
                            {group.standalone.map(/** @param {any} plan */ (plan) => (
                                <PlanCard key={plan.planId} plan={plan} url={url} />
                            ))}
                        </div>
                    </section>
                )
                : null}
            {group.orphanChildren.length
                ? (
                    <section class="lane repair-lane">
                        <h3>Orphaned child Plans</h3>
                        <p>These child FEATURE Plans reference a missing Epic and remain visible for repair.</p>
                        <div class="card-grid">
                            {group.orphanChildren.map(/** @param {any} plan */ (plan) => (
                                <PlanCard key={plan.planId} plan={plan} url={url} />
                            ))}
                        </div>
                    </section>
                )
                : null}
        </section>
    );
}
