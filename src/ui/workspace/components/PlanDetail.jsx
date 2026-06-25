/** @param {{ plan: any }} props */
export function PlanDetail({ plan }) {
    const frontMatterEntries = Object.entries(plan.frontMatter || {}).filter(([, value]) =>
        value !== undefined && value !== ""
    );
    return (
        <article class="detail" data-plan-id={plan.planId}>
            <header class="page-header">
                <p class="eyebrow">{plan.classification} · {plan.status}</p>
                <h2>{plan.planName}</h2>
                <p>{plan.summary || "No summary provided."}</p>
                <p class="readonly-note">
                    This Workspace milestone is read-only. It provides no edit, move, or lifecycle controls.
                </p>
            </header>
            <section class="detail-grid">
                <div>
                    <h3>Plan body</h3>
                    <pre class="markdown-body">{plan.body || "(No Plan body content.)"}</pre>
                </div>
                <aside>
                    <h3>Metadata</h3>
                    <dl class="meta-list stacked">
                        <div>
                            <dt>Plan ID</dt>
                            <dd>{plan.planId}</dd>
                        </div>
                        <div>
                            <dt>Path</dt>
                            <dd>{plan.relativePath}</dd>
                        </div>
                        {plan.parentPlan
                            ? (
                                <div>
                                    <dt>Epic</dt>
                                    <dd>{plan.parentPlan}</dd>
                                </div>
                            )
                            : null}
                        {plan.worktreeStatus
                            ? (
                                <div>
                                    <dt>Worktree</dt>
                                    <dd>
                                        {plan.worktreeStatus} {plan.worktreeBranch ? `(${plan.worktreeBranch})` : ""}
                                    </dd>
                                </div>
                            )
                            : null}
                        {plan.dependsOn?.length
                            ? (
                                <div>
                                    <dt>Depends on</dt>
                                    <dd>{plan.dependsOn.join(", ")}</dd>
                                </div>
                            )
                            : null}
                    </dl>
                    <h3>Front matter</h3>
                    <dl class="meta-list stacked">
                        {frontMatterEntries.map(([key, value]) => (
                            <div key={key}>
                                <dt>{key}</dt>
                                <dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
                            </div>
                        ))}
                    </dl>
                </aside>
            </section>
        </article>
    );
}
