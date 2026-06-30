---
name: front-end-framework-use
description: Convention-first frontend editing. Use this skill when implementing, fixing, or reviewing frontend UI work in JavaScript, HTML, or CSS with frameworks such as React, Vue, Svelte, Next.js, Vite, or TanStack.
---

# Front-End Framework Use

Convention-first frontend editing: discover what the project already does, continue that pattern, verify the result. The
default instinct is to invent; this skill redirects to _match_ — match the styling system, the component structure, the
data layer, the test style — and invent only when no convention exists to follow.

## General guidance

When you start a session with agent-browser make sure you use the --headed flag so that you and the user can both see
the browser. The user can see the same page and elements as you and they can see any changes or navigation that you make
to the page as they happen. Do not use any other skills or tools to access or work with the browser, only agent-browser.

## Feedback Loop

1. Discover the stack before editing.
   - Identify the framework, framework version, package manager, JS runtime, dev-server command, test command, and
     relevant routes/components.
   - Completion: you can name the files and commands that govern the UI behavior you are changing.

2. Read the source before using the browser.
   - Prefer `code_*` tools for components, hooks, utilities, route definitions, and call sites.
   - Use file search for templates, styles, config, generated route manifests, and package metadata.
   - Completion: the current behavior is explained by source, config, or a reproducible browser observation.

3. Check current docs when framework behavior is uncertain.
   - Use the `ketch` skill for current framework, library, or browser API documentation.
   - Completion: the implementation choice is backed by project source or current external docs, not memory alone.

4. Use the browser only for visual, interactive, or browser-specific questions.
   - Use the `agent-browser-use` skill; start headed sessions so the user can see navigation and page changes.
   - Prefer screenshots over eval scripts for layout, spacing, responsive behavior, and visual styling.
   - Completion: the browser observation answers a question the source alone could not.

5. Implement convention-first.
   - Match the project's component structure, styling system, state management, data-loading pattern, accessibility
     conventions, and test style. Consult the reference sections below for domain-specific convention checks.
   - Do not restart dev servers for hot-reloading frameworks. If a restart is genuinely necessary, ask the user to do
     it.
   - Completion: the change is localized and consistent with neighboring code; no new pattern introduced where an
     existing convention covers the case.

6. Verify before finishing.
   - Run the project's CI, lint, tests, type checks, or formatter as appropriate.
   - Exercise the changed UI through `agent-browser` when behavior is visual, interactive, responsive, or
     browser-specific.
   - Check browser console errors, failed network requests, final URL/title, and screenshots when relevant.
   - Completion: command output and browser evidence support the same conclusion.

## Convention-First Reference

Consult these sections during step 5 (implement) and step 6 (verify). Each covers a domain where convention-first
editing requires domain-specific checks.

### Styling and CSS Systems

Treat styling as part of the app's design system, even when the system is informal.

1. Discover the styling model before adding CSS.
   - Identify whether the project uses CSS modules, global CSS, utility classes, CSS-in-JS, Tailwind, design tokens,
     component libraries, or plain stylesheets.
   - Completion: you know where reusable styles, tokens, theme variables, and component-level styles live.

2. Prefer existing primitives over new one-off styles.
   - Reuse existing components, layout wrappers, spacing scales, color tokens, typography classes, and interaction
     states.
   - Do not introduce a new color, spacing value, breakpoint, z-index, shadow, or font size until existing options are
     ruled out.
   - Completion: every new visual value is either reused from the system or intentionally introduced with justification.

3. Keep CSS organized by responsibility.
   - Put reusable decisions in tokens, variables, utilities, or shared components.
   - Put component-specific layout and states near the component.
   - Avoid leaking page-specific selectors into global CSS.
   - Completion: a future nearby component can reuse the shared part without copying the whole style block.

4. Make responsive and state styling explicit.
   - Check hover, focus, active, disabled, selected, loading, empty, error, long-content, narrow-width, and dark/light
     modes when relevant.
   - Prefer fluid layout primitives (flex, grid, clamp, min/max) over fixed pixel positioning.
   - Completion: the style works across the relevant viewport and UI states.

5. Keep selectors boring.
   - Prefer low-specificity selectors, class names with clear ownership, and predictable cascade boundaries.
   - Avoid `!important`, deep descendant chains, and styling through incidental DOM structure unless the project already
     uses that pattern.
   - Completion: no new specificity level introduced beyond what neighboring styles use; the style can be overridden by
     the same mechanisms the rest of the codebase uses.

### Accessibility

Build on browser semantics before adding custom behavior.

- Use buttons for actions, links for navigation, labels for inputs, and headings/lists/landmarks where they match the
  content.
- Keep keyboard behavior intact: tab order, visible focus, Enter/Space activation, and Escape dismissal where relevant.
- Check screen-reader-facing names through the accessibility snapshot when adding or changing controls.
- Do not rely on color alone for state, errors, selection, or priority.
- Completion: the changed UI has a semantic shape, keyboard path, and accessible names that match the visible
  experience.

### Responsive Behavior

Design for content and containers, not one viewport.

- Check realistic desktop and mobile widths when layout changes.
- Account for long text, wrapping, overflow, sticky regions, modals, and scroll containers.
- Completion: the layout does not clip, overlap, or hide content at the project's supported viewport widths, tested with
  realistic-length strings.

### Visual Quality

Convention-first applies to aesthetics, not just code.

- Compare nearby screens and components for spacing, rhythm, density, typography, icon use, and interaction patterns.
- Include all relevant interaction and UI states when the component supports them.
- Capture before/after screenshots when the change is visual.
- Completion: the change looks intentional beside adjacent UI, not merely functional in isolation.

### Data and Async UX

Make network and state transitions visible and stable.

- Use intentional loading states instead of accidental blank space.
- Avoid layout shift when data loads.
- Surface failures near the action or content that caused them.
- Guard duplicate submits or repeated actions while async work is pending.
- Completion: the UI remains understandable while data is loading, updating, or failing.

### Forms

Treat forms as interaction design, not just inputs.

- Use explicit labels, helper text, validation messages, and autocomplete where appropriate.
- Validate at useful times: not so early that typing feels broken, and not only after submit when earlier feedback is
  cheap.
- Keep validation errors actionable and preserve user input across failed submits.
- Completion: a user can understand what each field needs, recover from errors, and submit without losing work.

### Performance

Avoid frontend changes that make the UI feel slower or heavier.

- Avoid unnecessary rerenders, oversized client bundles, layout thrashing, and expensive effects.
- Lazy-load heavy UI only when it improves the user experience.
- Use the app's existing data layer instead of fetching the same data repeatedly from multiple components.
- Completion: the change does not introduce avoidable rendering, loading, or bundle-cost regressions.

### Frontend Safety

Preserve browser-side security boundaries.

- Render user content safely and avoid unsafe HTML injection unless the project already has a reviewed sanitizer path.
- Do not put secrets, private tokens, or privileged assumptions in client code.
- Preserve auth and permission checks expected by the existing app.
- Completion: the browser receives only data and capabilities it is allowed to expose.

## Escalation

If verification stalls, stop guessing. Report the exact command or browser step that failed, the observed output, and
the smallest manual check the user can perform, such as a screenshot, console log, or reproduction step.
