# Mission Visualizer Spec

## Status

There is no concrete mission visualizer module in the repo today. The current source of truth is architectural and UX intent in [Architecture.md](./Architecture.md) and [Control-Room-UX.md](./Control-Room-UX.md), plus the tokenized UI foundation in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and `ui/src/components/`.

This spec defines the first real visualizer module for Merlin.

## Goal

Render a single mission TypeScript file as a readable execution map for Engineers.

The visualizer's primary success criterion is operational legibility: it should make mission progress, blocking points, approvals, and major control structure easy to supervise at a glance. Structural richness matters, but only when it improves trust, orientation, or intervention. Deep graph semantics and context telemetry remain part of the system through progressive disclosure rather than as mandatory default reading.

The module must:
- use SWC
- parse one file only
- analyze only root-level structure
- surface imports as dependency metadata
- extract root-level flow control
- detect mission API calls and summarize their arguments
- surface comments as annotations
- lay out the graph with ELK using a container-aware Sugiyama-style layered layout with orthogonal routing
- use standard flowchart semantics, styled through Merlin design tokens

The module must not:
- drill into imported files
- build full interprocedural control-flow graphs
- analyze function/class internals beyond labeling them as opaque boundaries
- silently collapse unsupported root-level constructs into plain sequential flow

## Fit With Current Repo

- `Architecture.md` already requires mission AST analysis, concurrency extraction, execution graph generation, and cached visualization metadata.
- `Control-Room-UX.md` already defines the map as the primary interface, makes flow-control rendering normative, and explicitly prefers SWC-based instrumentation and AST analysis.
- `ui/` currently provides only base primitives (`Button`, `Badge`, `Input`, `CodeBlock`, `AgentCard`) and design tokens, so the visualizer should be a new module built on the existing token system rather than a retrofit of an existing graph component.

The visualizer exists to support the Control Room's operational-first UX. It should help Engineers answer "where is the run, what needs me, and what path is it taking?" before it asks them to interpret rich structural detail.

## Context Ruler Contract

When the visualizer participates in the Control Room map, any context-position overlay must use `Context Ruler` semantics.

The overlay contract is behavior-only:

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

Rules:
- `window`, `reliabilityBands`, and optional `notes` are the only allowed profile fields in this spec because they affect rendering or inspect behavior.
- `confidence` is allowed because it changes visual strength or warning emphasis.
- Do not add explanatory metadata that does not change rendering or inspect behavior.
- The ruler communicates empirical model-specific positioning and reliability cues, not internal attention truth.
- Main-canvas rendering should remain subtle and ruler-like. Detailed numbers and explanatory notes belong in inspect surfaces, not the primary glance state. Default comprehension of the map must not depend on reading the ruler.

## Architecture

Use a strict two-stage pipeline:

1. `parseMissionFile(source) -> MissionAstSnapshot`
2. `buildVisualization(snapshot) -> MissionGraph`

Optional later stage:

3. `layoutMissionGraph(graph) -> LaidOutMissionGraph`

Keep parsing, semantic extraction, and layout separate. ELK is a layout engine, not the semantic model.

## Parsing Boundary

Parse with `@swc/core.parse` or `parseSync` as a `Module`, not a `Script`, using TypeScript syntax in module mode with comments enabled. That preserves imports and matches top-level `await`. SWC returns a `Module` whose `body` is `ModuleItem[]`; each item is either `ModuleDecl` or `Stmt`. That is the exact analysis boundary for this module.

Recommended parser options:

```ts
{
  syntax: "typescript",
  tsx: false,
  decorators: true,
  dynamicImport: true,
  comments: true,
  script: false,
}
```

Comments must be captured from SWC comment storage and attached by span/position to the nearest root-level item or edge anchor. Preserve leading and trailing comments separately so the renderer can distinguish “section heading” comments from “inline note” comments.

Do not build this extractor around SWC's deprecated JS `Visitor` API. A shallow root-item extractor with targeted descent is simpler and better matches the module boundary.

`prompt()` is analyzed as a typed JSON request, not as a custom React component. User-facing graph surfaces present these stations as **Review Gate**; inspect surfaces may still show `API: prompt()`. The visualizer summarizes the prompt request object by:
- showing the registered input view `id`
- listing important `props` keys
- listing other notable config keys
- treating the underlying React input view as opaque runtime registry data

## Root-Level Semantic Model

Normalize the SWC AST into a small graph-first model:

```ts
type MissionGraph = {
  file: string;
  rootMissionId: string;
  imports: ImportNode[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  comments: CommentAnnotation[];
  warnings: GraphWarning[];
};
```

Sub-missions are not modeled as loose child nodes. They are first-class hierarchical containers with stable runtime identity:

```ts
type SubMissionContainer = {
  id: string;
  callsiteId: string;
  executionId?: string;
  parentExecutionId?: string;
  parentContainerId?: string;
  missionRef?: string;
  isRoot: boolean;
  chrome: "none" | "container";
  sourceKind: "spawn-inline" | "persisted-child";
  materialization: "static-known" | "runtime-materialized" | "inferred";
  depth: number;
  defaultExpansion: "expanded" | "collapsed";
  groupedInstanceCount?: number;
};
```

Core node kinds:
- `start`
- `end`
- `process`
- `decision`
- `loop`
- `concurrency`
- `mission-call`
- `spawn-boundary`
- `sub-mission-container`
- `opaque-declaration`
- `error`
- `comment`

Core edge kinds:
- `sequential`
- `branch-true`
- `branch-false`
- `branch-case`
- `loop-back`
- `parallel`
- `error`
- `annotation`

## SWC Mapping Rules

Only root-level `ModuleItem`s are traversed. Nested statements inside functions, classes, object literals, and callback bodies are not expanded. They become opaque summaries.

Targeted descent is allowed only to classify root-level flow:
- `ExprStmt.expr`
- `IfStmt.test`, `cons`, `alt`
- loop headers and bodies
- `SwitchStmt` cases
- `TryStmt` branches
- arguments of root-level mission or concurrency calls

Nested calls are not flattened into the main graph. The visualizer stays single-file and root-level by default, but opaque callsites may be promoted to inferred stations when known mission types cross the boundary through arguments and/or declared return types.

### Imports and Declarations

- `ModuleDecl::Import` -> dependency metadata entry, not an execution node.
  Summarize source module and import shape: default, named, namespace, side-effect.
- Other `ModuleDecl`s -> `process` or `opaque-declaration` nodes, unless later promoted to a first-class mission construct.
- `Stmt::Decl` for `function`, `class`, `const`, `let`, `var` -> `opaque-declaration` by default.
  If the initializer is a root-level mission API call, model the call, not the declaration shell.
  If a known mission type crosses the declaration boundary through arguments or a declared return type, promote the opaque declaration to an inferred station instead of expanding the body.

### Root-Level Flow Control

- `IfStmt` -> `decision` node with two outgoing edges: `true` and `false`.
- `SwitchStmt` -> `decision` node with one outgoing edge per case/default.
- `ForStmt`, `ForOfStmt`, `ForInStmt`, `WhileStmt`, `DoWhileStmt` -> `loop` node.
- Root-level conditional expression (`Expr::Cond`) -> `decision` node.
- Root-level short-circuit expressions (`&&`, `||`, `??`) -> collapsed `decision` node when used as top-level expression statements or top-level initializers that drive mission calls.
- `TryStmt` -> `process` node with `error` edges to `catch` and a finalizing edge to `finally`.
- Root-level `ThrowStmt` -> terminal `error` node.
- Root-level `AwaitExpr` is not its own station. It modifies the containing process/call node to be blocking.
- Root-level concurrency patterns such as `Promise.all`, `Promise.allSettled`, `Promise.any`, `Promise.race` -> `concurrency` node with one child branch per argument.
### Mission API Calls

Mission API calls are first-class nodes. Detect them at direct root-level call sites:
- direct expression statements
- top-level variable initializers
- top-level await chains
- elements inside root-level `Promise.*` concurrency calls

Opaque/helper/imported callsites may additionally be promoted to inferred stations when a known mission type crosses the boundary:
- prompt request object shape with a known `id` -> inferred `prompt` station
- sub-mission code argument shape and/or declared `MissionResult` return type -> inferred `spawn-boundary`
- additional inferred mission-call kinds are allowed only when their mapping is explicit in the semantic model

Inferred stations must be visibly marked as inferred so the map never implies that an opaque body was statically expanded.

Recognized APIs:
- `agent(...)`
- `prompt(...)`
- `spawn(description, missionCode)`
- `run(...)` and `run<ToolName>(...)`

Mapping:
- `agent(...)` -> `mission-call`
- `prompt(...)` -> `mission-call` with user-facing type `Review Gate`
- `run(...)` -> `mission-call`
- `spawn(description, missionCode)` -> `spawn-boundary` plus a `sub-mission-container` placeholder owned by the callsite. The required `description` argument is the deterministic primary label; `missionCode` remains the executable child mission source.

Sub-mission expansion rules:
- the static parser stays single-file and never recursively analyzes imported files just because a sub-mission exists
- the root mission is the canvas scope and does not render container chrome
- every non-root sub-mission renders with container chrome when visible, including nested sub-sub-missions
- sub-missions render as open containers by default when their child graph is available from the same file, cached visualization metadata, or runtime hydration
- persisted/imported child missions without available child graph metadata still render as sub-mission containers, but begin as deferred placeholders rather than fake-expanded graphs
- hydrated child graph data renders recursively by default; a hydrated child that spawns another hydrated child appears as a nested non-root container unless collapsed by an explicit readability rule
- collapse rules may summarize lower-priority recursive branches when depth, repetition, or viewport size makes full expansion unreadable, but collapse must be an explicit rendering decision rather than the default hydration behavior
- recursive or repeated self-similar child executions are grouped into instance summaries and never expanded infinitely

Argument summarization rules:
- capture literal strings, template literal heads, object keys, provider/model/tool identifiers, and obvious label-like fields
- for `spawn(description, missionCode)`, use the required short `description` as the primary label before any identifier or LLM fallback
- preserve whether an argument is literal, object, identifier, or opaque expression
- never expand callback bodies or imported symbols
- when the argument is complex, render a short structural summary like `object{id,props,options}` or `identifier: buildPrompt`

`CallExpr` should be classified by callee shape:
- identifier callee -> direct API match candidate
- member callee -> only classify as concurrency or utility if it matches known root-level patterns like `Promise.all`
- everything else -> generic `process` unless explicitly supported

## Visualization Grammar

Use standard engineering shapes with meaning carried mostly by label, scale, typography, and token color:

- `start` / `end`: terminator
- `process`, `mission-call`, `opaque-declaration`: process rectangle
- `decision`: diamond
- `loop`: process rectangle with a loop marker inside the primary label composition
- `concurrency`: fork/join bar
- `error`: terminal/error shape
- `comment`: annotation box
- `spawn-boundary`: subprocess boundary with inline subprocess icon and type chip
- `sub-mission-container`: expanded subprocess container with an explicit boundary, header, and child execution region

Notation rules:
- shape carries control-flow meaning
- labels carry exact mission meaning
- color reinforces runtime state and priority, but never defines semantics on its own
- markers refine a standard shape, but do not create a second competing shape vocabulary
- the same semantic kind must never swap between alternate shapes across missions or rerenders
- decorative glyphs and custom iconography do not belong on the primary execution canvas; semantic Phosphor regular-weight icons are allowed inside primary station labels for Agent, Spawn, Review Gate, and Loop when they improve type recognition without becoming a separate shape vocabulary

Comments are first-class annotations. They should sit off the main path and connect back to the owning node or edge with annotation edges. Keep inline edge labels short; move explanation into comment boxes.

Sub-mission visualization rules:
- `spawn(description, missionCode)` is rendered as a higher-order boundary transition using standard subprocess semantics, not as a plain heavy node
- inline or hydrated child execution renders as an expanded subprocess container attached to the callsite
- imported or persisted child execution without hydrated graph data renders first as a subprocess boundary with a deferred child container placeholder
- the root mission renders directly on the graph canvas without container chrome
- every non-root sub-mission renders with container chrome: boundary, header, child execution region, state/source chips, and entry port
- hydrated sub-missions are open by default on desktop/tablet and participate directly in the composed layout, recursively
- narrow/mobile containers may auto-collapse sub-mission containers to preserve readability while keeping inspect/drill-in access
- a sub-mission container header must expose label, state, source kind, and whether the child graph is static-known, runtime-materialized, or inferred
- multiple child executions from the same callsite should group under one container when rendering every instance separately would destabilize the map
- repeated or recursive child executions must render as grouped summaries or counted recurrences, never as infinitely expanding nested diagrams
- nested sub-sub-missions are normal non-root containers, not special cases. The acceptance fixture must include one hydrated nested sub-sub-mission so recursive rendering is tested.

## ELK Layout

Use ELK `layered` as the default algorithm with orthogonal routing and direction selected from container size plus locale:
- wide LTR containers -> `RIGHT`
- wide RTL containers -> `LEFT`
- narrow/mobile containers -> `DOWN`

Baseline configuration:

```ts
{
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.portConstraints": "FIXED_SIDE",
  "elk.layered.feedbackEdges": true,
  "elk.spacing.nodeNode": 32,
  "elk.layered.spacing.nodeNodeBetweenLayers": 48,
}
```

Layout rules:
- main path flows with the active layout direction
- loop-back edges route around the outside
- parallel branches split symmetrically and rejoin explicitly through the same fork/join shape family
- imports occupy a dependency band outside the execution spine
- comments never displace the main execution spine more than necessary
- preserve stable ordering between rerenders so runtime updates do not destroy the Engineer’s mental map
- open hydrated sub-mission containers participate recursively in the same composed layout pass as the parent graph
- preserve the parent execution spine as the anchor and expand child execution regions orthogonally into the available second dimension
- on wide containers, prefer opening child containers sideways off the parent spine; on narrow containers, prefer stacking them downward
- use ELK compound/hierarchy handling so child regions behave as real containers rather than flattened sibling nodes
- layout uses derived design-token geometry for container header height, padding, spacing, reserved tracks, and entry ports; do not encode fixture-specific constants
- spawn edges target computed entry ports on non-root containers, not child nodes inside those containers
- runtime-added child graphs should reflow incrementally, preserving existing node and container positions unless the changed subtree requires movement
- when sibling count, depth, or container size makes full expansion unreadable, collapse lower-priority child containers automatically before collapsing the parent spine

## Runtime Hydration And Nesting

Static analysis only defines the initial shell of a sub-mission container. Runtime execution is authoritative for child execution instances.

Rules:
- a `spawn(description, missionCode)` callsite always creates a stable container identity even before child runtime data exists
- when runtime child graph data arrives, hydrate the container in place instead of replacing it with unrelated nodes
- child executions must retain stable `callsiteId` and `executionId` values across rerenders so selections, animations, and inspect panels do not jump
- runtime hydration may enrich a child from subprocess boundary to expanded subprocess container, but must not change the underlying semantic identity of the callsite
- runtime hydration renders recursively by default: if a hydrated child mission invokes another hydrated child mission, the descendant renders as a nested non-root container with chrome
- if a persisted mission directly invokes multiple child missions, each child gets its own open non-root container when space permits
- nested descendants are summarized only by explicit readability, repetition, or viewport collapse rules; depth alone is not a reason to hide hydrated data
- imported or external child missions may render open only when cached or runtime graph metadata is available; the parser still does not drill into imported files on its own
- inferred child mission boundaries must remain visibly inferred even after runtime hydration fills in the real child graph
- the acceptance fixture must include root -> sub-mission -> sub-sub-mission hydration and assert that root chrome is absent, both non-root containers have chrome, and both spawn edges terminate at computed non-root entry ports

## Design System Application

The visualizer must use Merlin semantic tokens, not local palette choices.

Visual hierarchy:
- mission boundaries: largest, `--font-heading`
- mission API calls: medium-large, `--font-body`
- raw API/type chips: compact monospace, `--font-agent`
- comments/notes: `--font-prose` or `--font-caption`
- dependency metadata: smaller than mission calls but always visible in its own band or inspect surface

Semantic color usage:
- running / primary path: `--color-primary`
- input or notable metadata: `--color-accent`
- success/done: `--color-success`
- error/failure edges: `--color-error`
- muted declarations / pending structure: `--text-muted`, `--bg-muted`, `--border-muted`

Meaning should come primarily from:
- shape for control-flow class
- size for hierarchy
- typography for human-vs-machine semantics
- labels for exact meaning

Color should reinforce meaning, not carry it alone.

## Warnings and Exhaustiveness

Unhandled root-level constructs must generate explicit warnings in the semantic model and in development builds.

Warn for:
- unsupported root-level `ModuleDecl`
- unsupported root-level `Stmt`
- mission-like calls with non-recognized callee forms
- ambiguous inferred stations hidden inside opaque declarations or imported helper callsites
- argument summaries that were truncated or reduced to opaque form

This module should fail visibly on unknown grammar rather than pretending the graph is complete.

## Deliverable Shape

The first implementation should expose:

```ts
parseMissionFile(source: string, fileName: string): MissionAstSnapshot
buildMissionGraph(snapshot: MissionAstSnapshot): MissionGraph
layoutMissionGraph(graph: MissionGraph): Promise<LaidOutMissionGraph>
```

That keeps the system usable for:
- static preview
- cached mission summaries
- runtime graph hydration
- later LLM labeling without coupling parsing to presentation

## Sources

- Repo sources: [Architecture.md](./Architecture.md), [Control-Room-UX.md](./Control-Room-UX.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [ui/src/index.ts](./ui/src/index.ts)
- SWC core parse API: https://swc.rs/docs/usage/core
- SWC `ModuleItem`: https://rustdoc.swc.rs/swc_ecma_ast/enum.ModuleItem.html
- SWC `ModuleDecl`: https://rustdoc.swc.rs/swc_core/ecma/ast/enum.ModuleDecl.html
- SWC `Expr`: https://rustdoc.swc.rs/swc_ecma_ast/enum.Expr.html
- SWC `CallExpr`: https://rustdoc.swc.rs/swc_ecma_ast/struct.CallExpr.html
- SWC comments: https://rustdoc.swc.rs/swc_core/common/comments/struct.SingleThreadedComments.html
- ELK layered layout: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
- ELK edge routing: https://eclipse.dev/elk/reference/options/org-eclipse-elk-edgeRouting.html
- ELK direction: https://eclipse.dev/elk/reference/options/org-eclipse-elk-direction.html
- ELK port constraints: https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html
- ELK feedback edges: https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-feedbackEdges.html
- Microsoft flowchart guidance: https://support.microsoft.com/en-us/office/create-a-basic-flowchart-in-visio-e207d975-4a51-4bfa-a356-eeec314bd276
