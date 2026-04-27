# Control Room UX Specification

## Design Principle

The map is the interface. Everything else serves the map.

The Engineer's primary questions are:
1. Which of my runs need me right now?
2. Where in this mission am I?
3. What is being asked of me?

Every layout decision flows from answering these three questions with minimal interaction.

Operational clarity takes priority over deep introspection. The default Control Room experience is for triage, current-state understanding, blocked-reason visibility, checkpoint review, and decisive intervention. Structural understanding comes second. Deep diagnostics and replay-grade inspection are progressive disclosure for Engineers who need them, not table stakes for every run.

---

## Layout Zones

The shell is composed of five zones. Each has a single responsibility.

### Switchboard

Far-left vertical rail. Cross-project and cross-host triage. Always visible on every screen.

Shows every project the Engineer has access to as a compact icon with a status indicator. Projects are grouped by host and sorted within each group by attention priority:

1. Input needed
2. Error
3. Completed
4. Running

Clicking a project icon switches the entire right side of the shell to that project's active run.

Hovering a project icon shows a tooltip with: project name, mission name, current step, and status.

```
┌────┐
│ H1 │  Host icon (letter or emoji)
│ ●3 │  Aggregate attention count
├────┤
│ PA │  Project icon
│ ◀  │  Status: input needed
├────┤
│ PB │
│ ✓  │  Status: done
├────┤
│ PC │
│ ●  │  Status: running
├────┤
│ PD │
│ ✗  │  Status: error
├────┤
│    │
├────┤
│ H2 │  Second host
│ ●1 │
├────┤
│ +  │  Add host / project
└────┘
```

### Activity Bar

Narrow vertical rail adjacent to the Switchboard. In-project navigation. Provides access to:
- Mission list for the current project
- Run history
- Settings
- Current branch name
- Global run state toggle (Running / Paused)

This bar scopes to whichever project the Switchboard has selected. It does not show cross-project information.

### Metro Map

The primary canvas. Fills all remaining space. A read-only visualization of the mission's execution derived from:
1. The mission's TypeScript AST (call structure, concurrency, dependencies)
2. LLM-generated labels for each station (cached per mission content hash)
3. Live execution state from GoatDB (status of each station at runtime, dynamic tool calls, mission runtime flows (will be different than static preview), etc)

The map's primary job is operational orientation: show where the run is, what changed, why it is blocked, what needs human input, and which path the run is taking. It must be legible to an Engineer who is supervising work, not studying a compiler artifact. Rich graph semantics remain available and visible, but they must enter through progressive disclosure rather than dominating the default reading mode.

The map is not editable. Node positions are computed automatically from the mission structure. The Engineer cannot drag, connect, or rearrange stations. Interaction is limited to:
- Pan and zoom
- Tap a station to inspect it
- Tap an active input prompt anchored to its station
- Interact with individual stations (revert file edit, override default provider/model, rewind, etc)

The map includes a **Context Ruler** rendered subtly into the background behind the stations and edges. The Context Ruler is not an attention visualization. It is an advanced context-position and reliability cue that helps the Engineer see where each station lands within the active context window and how trustworthy model behavior is expected to be across that range. It should educate and reassure less informed users without requiring them to parse it in order to complete ordinary supervision tasks.

The Context Ruler is driven by empirical model-specific context profiles for the exact resolved provider/model used by each agent station. These profiles describe usable window size plus reliability bands, not internal attention truth. The UI must present the ruler as an operational cue, not as a rendering of the model's real internal weighting.

The ruler is grouped by actual runtime context lineage, not by static graph shape. Stations that continue the same context share the same Context Ruler. A station that starts a new context starts a new ruler. Each station is projected onto its ruler at the position its contribution lands within the active context window for that exact provider/model.

Context Ruler composition:
- **X-axis** — position in the active context window (0 → max for the resolved provider/model).
- **Reliability bands** — subtle good/warning/poor regions derived from the resolved model's context profile.
- **Stacked color bands** — token composition by category (system prompt, user content, assistant output, tool results) projected onto the same x-axis.
- **Station markers** — each station appears at the position its contribution lands.

Numeric token counts and percentages are intentionally absent from the primary glance. They are inspect-only and exposed when a station is selected (see Context Ruler Inspector in the Full Detail Panel). Default comprehension of the run must not depend on reading raw context telemetry.

#### Context Ruler Data Contract

Only behavior-changing data belongs in the profile. Window size, reliability bands, and optional notes affect rendering or inspect behavior. Confidence is allowed because it can change band strength or warning emphasis. Explanatory metadata that does not change runtime UI behavior does not belong in the profile.

```ts
type ContextProfile = {
  provider: string;
  model: string;
  window: number;
  reliabilityBands: Array<{
    start: number;
    end: number;
    level: "good" | "warning" | "poor";
    confidence: "high" | "medium" | "low";
  }>;
  notes?: string[];
};
```

**Semantics:** `window` is the active context size for the resolved provider/model. `reliabilityBands` are position ranges within that window used to render subtle strength and caution cues on the ruler. `notes` are optional short explanations surfaced only in inspect contexts when they help interpret the cues.

**Fallback:** When a model-specific profile is unavailable, the UI should still render a basic ruler using the resolved context window and a conservative trailing warning/poor treatment rather than leaving the Context Ruler blank.

**Responsibility:** Runtime/provider integration supplies the profile. The UI accepts and validates the schema, then renders only the position and reliability cues implied by it.

#### Map Header

A lightweight bar at the top of the map canvas showing run-level contextual info: running mission name, step progress (e.g. 3/5), and accumulated cost. This is not a separate zone — it is part of the map and scrolls with it on mobile.

The Map Header keeps run identity and urgent state persistently visible while staying visually subordinate to the map. It may remain sticky within the map container when needed for orientation, but it must not obscure stations, prompts, or the Context Ruler.

#### Stations

Each station represents a unit of execution: an `agent()` call, a `bash()` call, a Review Gate backed by `prompt()`, a `spawn(description, missionCode)` boundary, or an inferred station promoted from an opaque boundary when a known mission type crosses through arguments or return types.

Station labels use a two-layer system to bridge generated code and human comprehension:
- **Primary label** — an LLM-generated semantic label cached per mission content hash. This is what the Engineer reads at a glance.
- **Type chip** — a small monospace badge showing the user-facing station type (`agent`, `gate`, `bash`, `spawn`) so the map is readable at a glance. Inspect surfaces also show raw API metadata such as `API: prompt()` or `API: spawn`.
- **Inline semantic icon** — a small Phosphor regular-weight icon may appear inside the primary label when it reinforces station type: agent work, subprocess/spawn, Review Gate, or loop. Icons inherit `currentColor`, stay hidden from accessibility names when the text already carries the meaning, and are part of the label composition rather than floating decoration.

The same two-layer pattern applies to flow control junctions: a semantic label generated by the LLM plus a type chip showing the raw construct (`if`, `switch`, `for`, `while`, `Promise.all`, `for-await-of`, etc).

Station states:

| State   | Semantics              | Hierarchy        | Affordance                |
| ------- | ---------------------- | ---------------- | ------------------------- |
| Waiting | Engineer input needed  | Highest urgency  | Tap to reveal input       |
| Error   | Failed                 | High urgency     | Inspect, retry, rewind    |
| Running | Currently executing    | Mid prominence   | Inspect, pause after      |
| Done    | Completed successfully | Mid prominence   | Inspect results, rewind   |
| Pending | Not yet reached        | Low prominence   | Inspect only              |
| Skipped | Condition not met      | Lowest prominence| Inspect reason            |

When a Review Gate enters the Waiting state, the registered input view requested by the `prompt()` object animates into view without any explicit action from the Engineer. The motion sequence is normative:

1. **t = 0 ms** — Map auto-pans to center the waiting station.
2. **t = 100 ms** — Station elevation/glow animates up, signaling urgency via the design system's highest-priority attention affordance.
3. **t = 200 ms** — Input card slides in along the edge connecting the station to the Engineer's reading direction (rightward on desktop LTR; downward on mobile vertical). Easing: ease-out, duration ~250 ms.
4. **t = 450 ms** — Card settles and keyboard focus moves to the first interactive element inside it.

Accessibility requirements:
- The input container is `role="dialog" aria-modal="false"`. The station label is announced once via an `aria-live="assertive"` region.
- The Map Header text update ("Input needed: …") sits inside an `aria-live="polite"` region.
- When `prefers-reduced-motion: reduce` is set, the slide is skipped: the card fades in (~150 ms) at its final position and the auto-pan jumps instantly with no easing.
- No blinking, no flashing, no sound — these would violate WCAG 2.1 and the spec's existing "no modal, no sound" rule.

The 100 ms threshold for the first visible motion preserves the feeling of direct manipulation; directional entrance is appropriate here because the waiting state is interruptive by design.

Station visual weight varies by type to establish hierarchy at a glance. From largest to smallest: mission boundary, `agent()` call, Engineer input point, tool call. Tool calls are deemphasized and only fully visible on zoom.

All stations must meet minimum touch target accessibility guidelines regardless of visual size.

Pending stations expose previewable execution controls in inspect surfaces, including changing the provider/model for that station and capping the number of loop iterations or recursion depth. These controls are contextual to the selected station and affect only the current run unless explicitly promoted by an Architect into the mission code. See Per-Station Actions for the full list.

Flow control is part of the map grammar. Conditions render as labeled decision junctions. Function or mission boundaries render as grouped containers. Loops render as loop-marked process nodes with iteration state and an inline loop icon in the primary label composition. Recursion and other re-entry paths must be visually distinguished from ordinary sequential flow.

Iteration counts and per-iteration values are tracked by AST instrumentation at mission load time, not by runtime engine introspection. The instrumentation must do double duty: it both *measures* iteration counts for live UI display and *enforces* the per-station iteration cap that the Engineer can set via the inspect surface (see Per-Station Actions, "limiting loop iterations").

**Approach:**
- The mission's TypeScript source is parsed with **SWC**. SWC is preferred over Babel for ~20× single-thread throughput, native TypeScript support, integration with Deno's bundled tooling, and an equivalent `VisitMut` AST API.
- An AST visitor wraps every iteration construct with a runtime helper:
  ```
  __merlin.iter(stationId, runId, () => /* original body */)
  ```
  Wrapped constructs include `for`, `for-of`, `for-await-of`, `while`, `do-while`; the iteration callbacks of `forEach`/`map`/`filter`/`reduce`/`flatMap`/`some`/`every`/`find`; concurrency points `Promise.all`/`Promise.allSettled`/`Promise.race`/`Promise.any`; and recursion entry points detected via call-graph analysis.
- The helper increments a per-station, per-run counter held in GoatDB and emits live progress events the UI consumes. This requires a new GoatDB schema field for per-station execution metadata; no such field exists today.
- **Override enforcement.** Before invoking the body, the helper reads the per-station per-run iteration cap from GoatDB. If incrementing would exceed the cap, the helper throws a sentinel `IterationCapReached` exception. The surrounding instrumented loop frame catches the sentinel and converts it into a clean `break`; recursion entry helpers handle the same sentinel by returning the in-progress accumulator. The cap is set via the inspect surface affordance specified in Per-Station Actions and stored as `iterationCap?: number` on per-station execution metadata. Caps are scoped to the current run and cleared at run completion unless an Architect explicitly promotes the cap into mission code (mirrors the provider/model override pattern).
- Async context propagation uses `AsyncLocalStorage` so iterations counted inside `await`ed callbacks attribute to the correct station.
- Source maps are preserved end-to-end so error stack traces still point to user code lines.

Rejected alternatives:
- **V8 `Profiler.startPreciseCoverage`** is designed for global coverage collection. Its block-level counters cannot be cleanly bound to a specific run id or station id, and surfacing them live during long-lived agent runs requires holding an Inspector session open. It is unsuitable as the primary mechanism, though may be used as a debug aid.
- **Deno `async_hooks` alone** tracks Promise lifecycles, not loop iterations. It is used here only as a complement, for context propagation.

Accepted overhead: ~5–10% runtime cost. This is acceptable because mission execution is dominated by LLM latency.

LLM-generated labels (the primary layer above) aid scanning, but raw execution type and runtime state must remain inspectable via the type chip and the Context Panel.
#### Edges

Edges connect stations and communicate execution flow:

| Type       | Semantics                               | Hierarchy                                                 |
| ---------- | --------------------------------------- | --------------------------------------------------------- |
| Sequential | `await agent()` — serial dependency     | Primary weight                                            |
| Concurrent | `agent(); agent();` — parallel branches | Primary weight, must be visually distinct from sequential |
| Spawn      | `spawn(description, missionCode)` — subprocess / child mission boundary | Higher-order boundary, heavier than a regular edge |

Edges encode three progress states: completed, active, and pending. The visual treatment must make these three states distinguishable at a glance.

`spawn(description, missionCode)` is heavier than a regular agent or tool edge because it creates a sub-mission with its own internal execution graph. It must therefore render using standard subprocess semantics: a call-style boundary when only the child reference is known, and an expanded subprocess container when child graph structure is available.

The map grammar must produce a deterministic visual treatment for every JavaScript and TypeScript control-flow construct that can appear in mission code. The required coverage:

| Category        | Constructs                                                                                                | Map representation                  |
| --------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Sequential      | statements; `await` chains                                                                                | Sequential edge                     |
| Conditional     | `if`/`else`, `switch`, ternary, `&&` / `\|\|` / `??` short-circuits                                       | Decision junction                   |
| Loops           | `for`, `for-of`, `for-await-of`, `while`, `do-while`, recursion                                           | Loop-marked process node + iteration count |
| Array iteration | `forEach`, `map`, `filter`, `reduce`, `flatMap`, `some`, `every`, `find`                                  | Loop-marked process node (collapsed default) |
| Concurrent      | `Promise.all`, `Promise.allSettled`, `Promise.race`, `Promise.any`, bare unawaited calls                  | Fork/join concurrency bar           |
| Async streams   | `for-await-of` over async iterables, ReadableStream consumers                                             | Loop-marked process node + stream marker |
| Generators      | `function*`, `yield`, `yield*`, async generators                                                          | Loop-marked process node + pull marker |
| Error flow      | `try`/`catch`/`finally`, `throw`, Promise `.catch`                                                        | Error edge variant                  |
| Indirection     | `spawn(description, missionCode)`                                                                         | Call-style boundary or expanded subprocess container |
| Dependencies    | static and dynamic imports                                                                                | Dependency metadata / async process annotation |
| Cancellation    | `AbortSignal`, `AbortController`                                                                          | Edge annotation                     |

Each row is normative. Implementations must not silently fall back to "sequential edge" for unrecognized constructs; unhandled constructs must surface as a build-time warning so the grammar stays exhaustive.
#### Runtime Divergence

The static AST analysis produces the initial map structure. At runtime, `spawn(description, missionCode)` may produce sub-missions with their own station graphs not known at parse time. When this happens, new stations and edges are inserted into the map with an animated transition and the layout recomputes incrementally. Tool call stations are also by definition dynamic and known only at runtime.

Static analysis is only the starting point. Runtime execution is authoritative. When actual execution diverges from the static preview, the map must update to reflect the real graph, the real context lineage, and the real provider/model used at each station. These transitions must preserve orientation and make it clear which parts were known from static analysis, which parts were inferred from opaque boundaries, and which parts materialized only at runtime.

#### Map Orientation

On wide containers the map flows with reading direction: left to right for LTR locales and right to left for RTL locales. On narrow containers it flows top to bottom. This adapts to the map's own available space, not the viewport.

### Context Panel

The Context Panel uses progressive disclosure with two tiers: a quick-inspect popover and a full detail panel.

#### Quick Inspect (station tap)

Tapping a station opens a popover anchored to that station on the map canvas. It shows:
- Station label (LLM-generated)
- Provider + model used
- Token count and cost
- Elapsed time
- One-line output preview

The popover contains a "Details" action to expand to the full panel, and station-contextual actions (see Execution Controls). Dismissed by tapping elsewhere or pressing Escape. This quick-inspect layer is the default inspection mode for Level 1-2 supervision.

On devices that match `@media (hover: hover) and (pointer: fine)`, the quick-inspect popover appears on hover and the full Context Panel opens on click. Touch-only devices keep the existing tap-to-popover behavior.

- **Hover delay:** 400 ms before quick-inspect appears. Cancel on mouseout.
- **Anchoring:** the popover anchors to the hovered station with a small pointer offset and does not steal keyboard focus.
- **Click:** opens the full Context Panel and pins the station as selected. Hovering elsewhere no longer changes the panel; the panel stays until dismissed.
- **Keyboard equivalent:** focusing a station and pressing Enter opens quick-inspect; Enter again opens the full panel; Escape closes the innermost surface.

#### Full Detail Panel

A panel slides in from the right edge, maintaining a visual link to the selected station on the map. This is the advanced inspection layer: powerful enough for Architects and incident/debug work, but entered deliberately rather than forced into the default supervision flow. Contains:

**Header**
- Station label (LLM-generated, cached)
- Provider + model used and provider/model override control (allows the Engineer to change the provider/model for this step on the current run)
- Token count and cost
- Elapsed time

**Output** — The agent's response with syntax highlighting and auto detected language. Scrollable.

**Tools** — List of tool calls made during this station's execution. Each row shows tool name and a one-line summary. Expanding a row reveals full input and output. Tool calls are listed in execution order.

**Context Ruler Inspector** — A focused fragment of the map's Context Ruler for this station, with numeric values exposed: token budget consumption broken down by system prompt, user content, assistant output, and tool results; total tokens and percentage of the active context window; the active provider/model window; the station's position within that window; and whether this station continues an existing context lineage or starts a new one. This is the same visualization as the map-layer Context Ruler, scoped to the selected station and annotated with raw numbers plus any applicable profile notes.

#### Linked Navigation

Items in the Outputs Bar link to their source station. Clicking an output item selects the corresponding station on the map and opens the Context Panel to that station's details.

### Outputs Bar

Collapsed strip below the map area. Shows high-value results: files created or modified, warnings, insights, and other flagged outputs. Each item links to its source station on the map.

Expandable to show full output details. Includes a run rating control when a run completes.

---

## Execution Controls

Execution controls are station-contextual, not global. The Engineer thinks in terms of stations, not timestamps.

### Per-Station Actions

These actions appear in the quick-inspect popover or full Context Panel when a station is selected:

- **Rewind to here** — Available on completed or errored stations. Resets execution state to the point just before this station ran using GoatDB's version history. Requires confirmation (destructive action).
- **Re-run from here** — Available on completed or errored stations. Re-executes from this point forward with current inputs.
- **Pause after this** — Available on running or pending stations. Sets a breakpoint: the orchestrator halts after this station completes.
- **Override provider/model** — Available on pending, running, completed or errored agent stations. Changes the resolved provider/model for this station on the current run and updates the Context Ruler accordingly.
- **Limit iterations** — Available on any station containing an instrumented loop or recursion (see the control-flow coverage table under Stations). Sets an `iterationCap` for this station on the current run. Enforced at runtime by the SWC-injected helper, which converts the cap into a clean `break` for loops or an early return for recursion. Caps are scoped to the current run and cleared at run completion unless an Architect promotes them into mission code.

### Global Run State

The Activity Bar shows the current run state: Running, Paused, Completed, or Errored.

- Tapping the run state indicator toggles between Running and Paused.
- Pause halts the orchestrator after the current station completes. Resume continues from where it stopped.
- There is no global rewind scrubber. Rewind is always contextual to a specific station.

---

## Input Prompts

When a station enters the waiting state, the input view resolved from the mission's prompt request `id` renders anchored to that station on the metro map. The input appears as a card visually tethered to the waiting station.

The map auto-pans to center the waiting station and its input prompt when attention is needed.

Only one input prompt is focused at a time. If multiple stations are waiting:
- A queue indicator shows the position (e.g. "1 of 3 inputs needed")
- Paging through the queue (next/previous) triggers the map to auto-pan and center each waiting station in turn
- The currently focused waiting station is visually elevated above other waiting stations

### Attention Capture

When a station needs input:
1. The map auto-pans to center the waiting station
2. The station signals urgency using the design system's highest-priority attention affordance
3. The Map Header updates to show "Input needed: [station label]"
4. If the app is backgrounded: the browser tab title updates with a prefix indicator
5. A browser notification fires if the Engineer has granted permission

No sound. No modal. The spatial change on the map is the primary attention signal.

---

## Theme System

Customizable via design tokens. Pure CSS, no JavaScript runtime for theming.

- Light and dark modes with automatic toggle based on system preference
- Color tokens at two levels: primitives (raw palette) and semantic (role-based: accent, surface, status colors)
- Typography tokens for font family and scale
- All status colors are semantic tokens that adapt to light/dark mode

---

## Desktop Layout

Five-zone layout. Switchboard rail on far left, Activity Bar adjacent, Metro Map fills the center with its header row, Context Panel on right (toggled by station tap), Outputs Bar below the map.

```
┌──────────────────────────────────────────────────────────┐
│┌────┬──┬──────────────────────────────┬─────────────────┐│
││    │  │ Commando • main • 3/5 • $0.47│                 ││
││ S  │A ├──────────────────────────────┤   CONTEXT       ││
││ W  │C │                              │   PANEL         ││
││ I  │T │  ●━━━━●━━━━┳━━━●━━━━━━●      │                 ││
││ T  │I │  Rsch     ┃  P:Exec  [dyn]   │  [on station    ││
││ C  │V │  ✓        ┃  ✓        ◻      │   tap]          ││
││ H  │I │           ┃                  │                 ││
││ B  │T │           ┣━━━●━━━━━━━●      │                 ││
││ O  │Y │           ┃  P:Valid  Validate│                 ││
││ A  │  │           ┃  ✓       ◀ INPUT │                 ││
││ R  │  │           ┃  ┌────────────┐  │                 ││
││ D  │  │           ┃  │ prompt     │  │                 ││
││    │  │           ┃  └────────────┘  │                 ││
││    │  ├──────────────────────────────┤                 ││
││    │  │ OUTPUTS: 2 files • 1 warning │                 ││
│└────┴──┴──────────────────────────────┴─────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

## Tablet Layout

Switchboard and Activity Bar remain as narrow rails. The Context Panel is hidden by default and slides in as a right-side overlay when a station is tapped. Tapping outside or pressing Escape dismisses it.

---

## Mobile Layout

The Switchboard becomes a horizontal scroll strip at the top of the screen, sorted by attention priority. The leftmost item is always the most urgent.

The Activity Bar moves to a fixed bottom tab bar.

The Metro Map fills the screen between the Switchboard strip and the bottom tabs, flowing vertically (top to bottom). The Map Header sits directly below the Switchboard strip.

Input prompts render inline below their station in the vertical flow.

Tapping a station opens the Context Panel as a bottom sheet (half screen, swipeable to full screen).

The Outputs Bar collapses into the bottom sheet or becomes accessible via a tab in the bottom bar.

```
┌─────────────────────────┐
│ [PA◀] [PD✗] [PB✓] [PC●] │  Switchboard strip
├─────────────────────────┤
│ Commando • 3/5 • $0.47  │  Map Header
├─────────────────────────┤
│                         │
│  ● Research ✓           │
│  │                      │
│  ├─● Plan:Valid ✓       │
│  │ └─● Validate ◀       │
│  │   ┌───────────────┐  │
│  │   │ input prompt  │  │
│  │   └───────────────┘  │
│  └─● Plan:Exec ✓        │
│    └─● [dynamic] ◻      │
│                         │
├─────────────────────────┤
│ Outputs: 2 files        │
├─────────────────────────┤
│ Missions  Map  Settings │  Bottom tab bar
└─────────────────────────┘
```

No content is hidden on mobile. Every feature available on desktop is reachable on mobile through adapted interaction patterns (bottom sheets, inline rendering, horizontal scrolling).

---

## Input Components

Inputs range from one-tap confirmations to complex multi-field forms. The system supports both via a two-mode contract: schema-driven by default, component-slot when justified. The host shell always owns layout, chrome, and accessibility; the mission owns content.

### Mode A — Schema input (default)

The mission declares its input via a Zod schema. The host renders a built-in form using a fixed widget set: text, textarea, select, radio, checkbox, file, code, markdown. Widget selection is driven by the Zod type with an optional `ui` annotation for overrides.

Layout is owned by the host and adapts automatically:
- Desktop: inline card anchored to the waiting station.
- Tablet: slide-over from the right.
- Mobile: bottom sheet, swipeable to full screen.

This mode is responsive, accessible, themed, and animated by default. Use it whenever the input fits a flat or shallowly nested schema — which is the majority of cases.

### Mode B — Component slot (escape hatch)

For inputs that require custom canvas drawing, multi-pane editing, or interactive visualization, the mission may export a React component bound to the input. The component receives:

```
{ value, onChange, submit, surface }
```

where `surface ∈ 'inline' | 'sheet' | 'overlay'` so the component can adapt its own internal layout to the host's chosen presentation.

Slot rules:
- Components are loaded via dynamic `import()` from a per-mission bundle.
- Components are sandboxed (iframe or shadow DOM) for theme isolation and to prevent breaking the host shell.
- The host owns chrome: title bar, submit button, validation surface, focus management, ARIA attributes, and the attention animation sequence. The component owns the body content area only.
- Responsive contract: the component must render correctly inside `min-width: 320px`. This is a hard requirement; components that fail it cannot ship.

### Decision rule for mission authors

Use Mode A unless the input genuinely requires custom canvas, multi-pane editing, or interactive visualization. Mode B exists for those cases — not for cosmetic preferences.

Both modes participate in the existing input queue model: only one input is focused at a time, the queue indicator and auto-pan behavior are unchanged, and Mode B components must accept being mounted and unmounted as the queue advances.

---

## Persona Walkthroughs

### L1 Guided Engineer on Phone

1. Open Control Room URL
2. Switchboard strip shows proj-A with Input Needed badge — tap it
3. Map loads vertically, auto-scrolled to the waiting station
4. Input component is anchored to the station contextually
5. Fill in, tap Submit
6. Put phone away
7. Notification arrives when done, when next input is needed, or when an error happens
8. Return, Switchboard shows completed status — tap to review outputs

Three taps to provide input. No log reading. No navigation.

### L2 Informed Engineer on Desktop

1. Switchboard shows 5 projects across 2 hosts, sorted by urgency
2. proj-A shows input-needed status — click it
3. Metro Map shows the Commando mission with Validate station waiting
4. See spatially where this decision fits in the mission's flow
5. Tap the station, quick-inspect popover opens — see model is haiku, override to sonnet
6. Provide input in the anchored prompt
7. Use the quick-switch command to search "proj-D" — see it's errored at step 2 — jump there
8. Expand the full Context Panel to review error details and tool call outputs
9. Click proj-A in Switchboard to return

### L3 Architect on Desktop

1. Multiple runs across 2 hosts
2. Switchboard shows aggregate attention counts per host
3. Click into proj-A — map loads with mission visualization
4. Click the completed Research station — quick-inspect popover shows summary, expand to full Context Panel for agent output, 4 tool calls (each expandable), token usage, cost
5. Click Plan:Execution — see a spawn edge leading to a dynamic sub-mission with 3 runtime-added stations
6. Outputs Bar shows 2 files modified and 1 flagged insight
7. Click the insight — map jumps to its source station, Context Panel shows the relevant agent output
8. As the Architect editing the mission, inspect how multiple agent stations share one Context Ruler while a later station starts a fresh context on a new Context Ruler with a different provider/model profile
9. Mission completes — rate it via the run rating control in the Outputs Bar
