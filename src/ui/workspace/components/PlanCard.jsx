import { PLAN_UI_TOKEN_QUERY } from "../../../constants.js";

/**
 * @param {any} plan
 * @param {URL} url
 */
export function detailHref(plan, url) {
    const next = new URL(`/plans/${encodeURIComponent(plan.planId)}`, url);
    const token = url.searchParams.get(PLAN_UI_TOKEN_QUERY) || "";
    if (token) next.searchParams.set(PLAN_UI_TOKEN_QUERY, token);
    return `${next.pathname}${next.search}`;
}

/** @param {{ plan: any, url: URL, compact?: boolean }} props */
export function PlanCard({ plan, url, compact = false }) {
    return (
        <article class={compact ? "plan-card compact" : "plan-card"} data-plan-id={plan.planId}>
            <div class="card-header">
                <a class="card-title" href={detailHref(plan, url)}>{plan.planName}</a>
                <span class="status">{plan.status}</span>
            </div>
            <p>{plan.summary || "No summary provided."}</p>
            <dl class="meta-list">
                <div>
                    <dt>Class</dt>
                    <dd>{plan.classification}</dd>
                </div>
                {plan.complexity
                    ? (
                        <div>
                            <dt>Complexity</dt>
                            <dd>{plan.complexity}</dd>
                        </div>
                    )
                    : null}
                {plan.parentPlan
                    ? (
                        <div>
                            <dt>Epic</dt>
                            <dd>{plan.parentPlan}</dd>
                        </div>
                    )
                    : null}
                {plan.relativePath
                    ? (
                        <div>
                            <dt>Path</dt>
                            <dd>{plan.relativePath}</dd>
                        </div>
                    )
                    : null}
            </dl>
        </article>
    );
}
