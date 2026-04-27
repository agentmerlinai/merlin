# Mission Graph ELK Layout Design

## Summary

`mission-graph.html` currently renders the demo graph with manual SVG coordinates. The page describes the result as an approximation of ELK orthogonal layout output, but the active implementation is a fixed grid layout built from JavaScript constants.

The replacement should use `elkjs` for layered ordering, compound layout, semantic port attachment, and orthogonal route candidates while preserving the existing Merlin visual contract exactly: grid alignment, measured label padding, fixed node sizes, custom SVG shapes, comment placement, loop routing, sub-mission containers, edge styles, and paint order.

The correct architecture is not "ELK output with rounded coordinates." The grid is a layout invariant, not a cosmetic final pass. Merlin must pre-snap layout inputs, let ELK solve ordering and candidate geometry, then recompute exact snapped anchors and final Manhattan SVG paths from the snapped boxes.

```text
measure labels -> snap layout inputs -> run ELK -> Merlin geometry/router -> validate/render
```

ELK ports answer "which side or point of this node does this edge use." Merlin geometry answers "which exact grid coordinate and path does the visual grammar render." `FIXED_SIDE` is enough for ordinary sequence flow, but visually exact anchors need fixed-position or fixed-ratio ports.

## Known Implementation Risks

- ELK layered may reorder nodes to reduce crossings unless Merlin supplies explicit ordering constraints and validates the demo spine order after layout.
- Compound containers may resize unless Merlin passes fixed dimensions and keeps ELK node-size behavior explicit.
- ELK route sections are candidates only. They cannot replace Merlin's final SVG edge grammar when the visual contract requires specific loop, spawn, branch, and fork/join shapes.
- A runtime CDN dependency is acceptable for the standalone static demo only. App/runtime code should use a pinned package through the normal build and lockfile.

## Current Layout Contract

The current demo is explicitly documented as:

- ELK-like orthogonal output.
- Direction `LEFT -> RIGHT`.
- L-shaped or Z-shaped paths only.
- Horizontal and vertical SVG path commands only.
- No diagonal edges.

Source evidence: `mission-graph.html` describes the demo as a "hand-authored approximation of ELK orthogonal layout output" and states that all edges are L-shaped or Z-shaped.

The implemented layout rules are historical evidence for the visual grammar. The ELK migration must preserve the semantic behavior, grid discipline, and paint order, but future dimensions and routes must be derived from tokens, measured content, hierarchy depth, and graph bounds rather than copied fixture constants.

- **Grid unit:** `G = --space-8`, falling back to `32`.
- **Canvas:** currently `W = 41G`, `H = 15G` (`1312 x 480`) in the manual demo; the replacement derives the viewBox from snapped graph bounds plus token padding and reserved tracks.
- **Grid:** background grid lines are drawn every `G` horizontally and vertically.
- **Station sizing:** station height is `G`; width is measured label width plus `G` total horizontal padding, snapped up to `G / 2`.
- **Decision sizing:** diamond height is `2G`; half-width is snapped from `(measuredLabel + G) / 2`.
- **Terminal sizing:** start/end/error terminators are `2G x G`.
- **Chip sizing:** role chips are `G x G/2`; sub-mission header chips measure text plus padding and snap to `G / 8`.
- **Main spine:** parent nodes share a stable centerline in the manual demo; the replacement derives the centerline from layout direction, graph bounds, and reserved tracks.
- **Parent flow:** fixed left-to-right sequence: Start -> loadConfig -> env? -> Analyze -> analysisMission -> Gap Review -> Plan Fixes -> fixAgents -> clean twice? -> End.
- **False branch:** `env?` false exits to an Error terminator on a derived branch track.
- **Loop branch:** `clean twice?` false exits north, routes above the spine on a derived loop track, then returns to `Gap Review`.
- **Sub-mission containers:** the root mission owns the canvas without container chrome; every non-root sub-mission renders as a compound container with header chrome and a child execution region.
- **Spawn edge:** each spawn edge connects the parent spawn port to the computed entry port of the target non-root container.
- **Child graph:** child nodes are relative to the owning container content origin, with recursive sub-mission containers using the same rules at every depth.
- **Parallel rows:** Research remains ordered above Synthesize, with row centerlines derived from token spacing and the owning content box.
- **Fork/join bars:** vertical bars are `G / 4` wide and `3G` high.
- **Annotations:** comment/intent blocks are not layout nodes. They are rendered with dashed vertical stubs from the owning node, then centered text above or below.
- **Annotation spacing:** stub length is `G / 2`; label gap is `G / 4`; line height is `round(3G / 8)`.
- **Annotation alternation:** some parent annotations are below, others above, specifically to avoid collisions with the sub-mission container and loop path.
- **Edge validation:** the first segment of any manually generated edge warns if shorter than `G`.
- **Paint order:** background and geometry render first; labels and annotations render last.

These rules must survive the ELK migration as invariants where they describe semantics, grid alignment, ordering, and rendering behavior. Coordinate examples from the manual fixture must not become hardcoded layout constants.

## Evidence And Source Constraints

ArguSeek research found:

- `elkjs` is the JavaScript port of Eclipse Layout Kernel and computes graph layout; it does not render or style diagrams.
- The official `elkjs` repository documents direct browser usage through `elk.bundled.js`, which exposes a global `ELK` object.
- jsDelivr lists `elkjs` version `0.11.1`, while npm metadata may differ by tag. Verify package/CDN state immediately before implementation, then pin the exact tested URL.
- ELK layered supports orthogonal routing, ports, edge labels, compound graphs, and hierarchy-crossing edges when configured correctly.
- ELK JSON edge output contains edge sections with start points, end points, and bend points. Those points are routed geometry, not merely decorative output.
- ELK spacing options influence layout, but spacing base values do not force coordinates onto a grid.
- ELK port constraints include `FIXED_SIDE`, `FIXED_ORDER`, `FIXED_RATIO`, and `FIXED_POS`; `Port Side` must be set for fixed-side/fixed-order ports when specific positions are not supplied.
- Orthogonal routing practice treats edge routing after fixed node placement as a separate concern. This maps directly to Merlin's post-ELK snapped geometry/router stage.

Pinned CDN candidate:

```html
<script src="https://cdn.jsdelivr.net/npm/elkjs@0.11.1/lib/elk.bundled.js"></script>
```

Use a pinned URL rather than `@latest`; layout changes from dependency updates would be visible regressions. This CDN path is only the static `mission-graph.html` demo candidate. Production app code should import a pinned npm package through the normal build and lockfile instead of loading the layout engine from a runtime CDN.

Relevant evidence:

- `elkjs` official repository: https://github.com/kieler/elkjs
- jsDelivr package page: https://www.jsdelivr.com/package/npm/elkjs
- Candidate bundle URL: https://cdn.jsdelivr.net/npm/elkjs@0.11.1/lib/elk.bundled.js
- ELK layered algorithm reference: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
- ELK JSON graph format: https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html
- ELK spacing documentation: https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/spacingdocumentation.html
- ELK spacing base value: https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-spacing-baseValue.html
- ELK port constraints: https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html
- ELK port side option: https://eclipse.dev/elk/reference/options/org-eclipse-elk-port-side.html
- ELK hierarchy handling: https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html
- ELK node size constraints: https://eclipse.dev/elk/reference/options/org-eclipse-elk-nodeSize-constraints.html
- ELK layered model constraints: https://eclipse.dev/elk/blog/posts/2023/23-01-09-constraining-the-model.html
- Orthogonal edge routing with fixed nodes: https://yed.yworks.com/support/manual/layout/router_orthogonal.html
- Orthogonal grid drawing practice: https://leda.uni-trier.de/leda/guide/graph_algorithms/orthogonal.html

Repo evidence:

- `Mission-Visualizer-Spec.md` already specifies ELK `layered`, `RIGHT`, `ORTHOGONAL`, `FIXED_SIDE`, feedback edges, and spacing based on `32`.
- The same spec requires compound/hierarchy handling so sub-mission child regions behave as real containers.

## Target Architecture

Replace the manual coordinate section with a five-stage pipeline:

```text
measure semantic graph -> build constrained ELK graph -> run ELK -> normalize snapped Merlin geometry -> render/validate SVG
```

The graph model describes semantic nodes and edges, not SVG details. The implementation should keep the current renderer functions where possible:

- `process`
- `mission`
- `spawn`
- `diamond`
- `forkBar`
- `container`
- `annoStub`
- `edge`
- `gridLines`

Minimum graph model:

- Parent nodes: Start, loadConfig, env?, Analyze, analysisMission, Gap Review, Plan Fixes, fixAgents, clean twice?, End, Error.
- Compound nodes: one non-root sub-mission container plus a nested sub-sub-mission container used as the acceptance fixture.
- Child nodes: child Start, fork, Research, Synthesize, join, child End.
- Edge types: `seq`, `branch`, `loop`, `spawn`.
- Edge labels: `true`, `false`.
- Annotation records attached to owning nodes, not included as ELK nodes.

## ELK Graph Shape

Use stable ids for every semantic node, ELK node, port, compound node, and edge. The ids are the bridge between semantic graph records, ELK output, Merlin geometry, and SVG rendering.

Ports must be real ELK port objects on the node that owns the attachment side or exact attachment point. Do not rely on node-to-node edges when the attachment matters.

Ordinary flow ports may use fixed sides:

```js
{
  id: "analysisMission",
  width: analysisMission.width,
  height: analysisMission.height,
  layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
  ports: [
    {
      id: "analysisMission.w",
      width: 0,
      height: 0,
      layoutOptions: { "elk.port.side": "WEST" },
    },
    {
      id: "analysisMission.e",
      width: 0,
      height: 0,
      layoutOptions: { "elk.port.side": "EAST" },
    },
  ],
}
```

Visually exact anchors should use fixed position or fixed ratio ports, with coordinates derived from the pre-snapped node dimensions:

```js
{
  id: "cleanReview",
  width: cleanReview.width,
  height: cleanReview.height,
  layoutOptions: { "elk.portConstraints": "FIXED_POS" },
  ports: [
    {
      id: "cleanReview.n.loop",
      x: cleanReview.width / 2,
      y: 0,
      width: 0,
      height: 0,
      layoutOptions: { "elk.port.side": "NORTH" },
    },
    {
      id: "cleanReview.e.true",
      x: cleanReview.width,
      y: cleanReview.height / 2,
      width: 0,
      height: 0,
      layoutOptions: { "elk.port.side": "EAST" },
    },
  ],
}
```

Edge records reference port ids directly:

```js
[
  {
    id: "edge.analyze.analysisMission",
    sources: ["analyze.e"],
    targets: ["analysisMission.w"],
    metadata: { type: "seq" },
  },
  {
    id: "edge.env.error",
    sources: ["env.s.false"],
    targets: ["error.n"],
    metadata: { type: "branch", label: "false" },
  },
  {
    id: "edge.clean.gapReview.loop",
    sources: ["cleanReview.n.loop"],
    targets: ["gapReview.n.loop"],
    metadata: { type: "loop", label: "false" },
  },
  {
    id: "edge.analysisMission.dependencyAudit",
    sources: ["analysisMission.s.spawn"],
    targets: ["dependencyAudit.entry"],
    metadata: { type: "spawn" },
  },
]
```

Required port contract:

- Main flow nodes expose west/east ports.
- `env?` exposes east for `true` and south for `false`.
- Error terminator exposes north.
- `clean twice?` exposes east for `true` and a fixed top-center north port for `false`.
- `Gap Review` exposes a fixed top-center north port for the loop target.
- Spawn nodes expose a fixed south spawn port when connected to an expanded child container.
- Every non-root sub-mission container exposes a computed fixed-position entry port. The default entry side is north for wide LTR/RTL layouts and the side may change with layout direction; ids remain stable while coordinates are derived from the final snapped container box.
- Sub-mission containers expose west/east ports only when they participate in normal flow.
- The root mission is the canvas scope and does not render container chrome, even though the same hierarchy model may represent it internally.
- Child fork/join bars expose fixed row-specific ports for child flow; branch rows use distinct port ids even when the rendered bar is one SVG shape.

Ports are not grid snapping. They define attachment semantics and, where required, exact local attachment coordinates. Merlin still owns final snapped global coordinates and final rendered paths.

## ELK Configuration

Use one ELK instance after confirming `window.ELK` exists:

```js
const elk = new ELK({
  defaultLayoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.portConstraints": "FIXED_SIDE",
    "elk.layered.feedbackEdges": true,
    "elk.spacing.nodeNode": G,
    "elk.spacing.edgeNode": G / 2,
    "elk.spacing.edgeEdge": G / 4,
    "elk.layered.spacing.nodeNodeBetweenLayers": 1.5 * G,
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.crossingMinimization.forceNodeModelOrder": true,
  },
});
```

Important constraints:

- Pre-snap every explicit size and spacing option to the Merlin grid before calling ELK.
- Use fixed-side ports for ordinary flow edges whose side matters.
- Use fixed-position or fixed-ratio ports for loop, spawn, fork/join, and child row anchors whose exact rendered location matters.
- Keep annotations out of ELK unless there is a deliberate future decision to let comments affect layout.
- Global options may live on the ELK instance or the root graph. Port side and port position options belong on port objects or on the owning node's port-constraint configuration.
- Do not rely on `elk.layered.spacing.baseValue` for grid alignment. It changes spacing defaults; it does not snap coordinates.
- Apply `elk.hierarchyHandling: "INCLUDE_CHILDREN"` at the root or top-level graph that owns the parent flow and open child container. ELK defaults can otherwise trigger separate layout runs for compound nodes, which breaks hierarchy-crossing routes.
- Feed nodes and edges in semantic visual order and validate that ELK preserves the parent spine order required by the graph model. If ELK violates that order, fail validation instead of accepting a misleading layout.
- Preserve child order explicitly inside every expanded container. Fork/join row ports use fixed positions or fixed ratios so crossing minimization cannot swap rendered rows.

## Preservation Rules

### Grid And Geometry

Grid alignment must be part of the layout contract before and after ELK:

- Measure labels before ELK.
- Snap node widths, node heights, container dimensions, content padding, and spacing options before ELK.
- Run ELK on these pre-snapped dimensions.
- Snap node and container `x`/`y` positions to `G / 2` after ELK.
- Recompute global port anchors from the snapped node/container boxes.
- Reconstruct final edge paths from snapped anchors using Merlin's edge grammar.
- Use ELK edge sections and bend points as route candidates only when they already satisfy all invariants after snapping.
- Reject or repair any candidate route that introduces zero-length segments, diagonal segments, node-edge intersections, label collisions, or a first segment shorter than `G`.
- Derive the final viewBox from snapped graph bounds, token-derived padding, and reserved routing tracks. Do not encode fixture-specific canvas constants as layout requirements.
- Preserve the background grid at `G`.

This is required because ELK can produce valid orthogonal layouts that are not aligned to the page's design-token grid, and rounding routed edge sections after the fact can invalidate ELK's collision and spacing decisions.

### Label Padding And Node Dimensions

Do all label measurement before ELK and pass exact node sizes into ELK.

- Station width remains `snap(measuredLabelWidth + STATION_HPAD * 2)`.
- Station height remains `G`.
- Decision width remains `2 * snap((measuredLabelWidth + G) / 2)`.
- Decision height remains `2G`.
- Terminal width remains `2G`.
- Terminal height remains `G`.
- Child agent boxes remain `3G x G`.
- Role chip positions are derived after layout from the final snapped node box.

Do not let ELK resize nodes based on labels.

### Recursive Container Size Contract

Container dimensions are derived layout inputs, not fixture constants.

- The root mission occupies the graph canvas and renders no container chrome.
- Every non-root sub-mission renders with container chrome: header, boundary, child execution region, state/source chips, and an entry port.
- Derive header height, content padding, minimum content size, and inter-container spacing from Merlin spacing and typography tokens before ELK runs.
- Measure and snap every child node, nested container, container padding, and spacing value before ELK.
- Pass non-root containers to ELK as compound nodes whose dimensions are computed from their visible children, collapsed summaries, header, padding, and reserved ports.
- Runtime-hydrated child graph data renders recursively by default: if a child contains a hydrated child, the nested non-root container is included in the same hierarchy model unless collapsed by an explicit readability rule.
- Collapsed recursive or repeated instances still use the same container chrome and stable identity, but summarize children as counted recurrences instead of expanding indefinitely.
- After ELK, assert that all child node boxes, nested container boxes, and route points fit inside the owning content box. If they overflow, report the owning container id plus overflowing child ids and bounds rather than stretching silently.

### Edge Routing

Rendered SVG paths are a Merlin responsibility.

- Sequence edges are straight horizontal or vertical `M/H/V` paths between recomputed anchors when unobstructed.
- Branch edges are L-shaped or Z-shaped paths with labels derived from the final segment geometry.
- Spawn edges route from the parent spawn port to the computed entry port on the target non-root container. The route may be vertical in wide LTR fixtures, but the router must derive the path from snapped anchors and active direction.
- Loop-back edges route above the parent spine and must never be accepted below the spine.
- ELK orthogonal sections may be adopted only when the snapped section points pass validation unchanged.
- If a candidate route fails validation, reroute from snapped anchors with the mission graph's deterministic Manhattan routing rules.

Minimum Merlin router contract:

- **Inputs:** snapped node boxes, snapped container boxes, snapped port anchors, edge metadata, obstacle boxes, reserved label boxes, and reserved annotation boxes.
- **Outputs:** ordered points that serialize only to `M`, `H`, and `V` commands.
- **Route families:** straight sequence, L/Z branch, vertical spawn, top loop, and child fork/join row routes.
- **Reserved tracks:** loop, spawn, and child row tracks are derived from token spacing, graph direction, snapped node bounds, and container depth. Do not reserve tracks by naming a fixture container.
- **Validation:** reject zero-length segments, diagonal segments, node/container intersections, label/annotation intersections, first segments shorter than `G`, child overflow, and any loop candidate that crosses through nodes or routes below the spine.
- **Failure behavior:** emit an explicit console warning with the edge id, source/target port ids, and failed invariant, then render a deterministic fallback path only if it satisfies all remaining invariants.

### Comment And Intent Blocks

Comment blocks remain a Merlin rendering concern.

Keep annotation records as metadata:

```js
{
  ownerId: "analysisMission",
  lines: ["inline code ·", "dual-agent run"],
  preferredSide: "above"
}
```

Placement rules:

- Default to below the node.
- Preserve existing explicit above/below choices.
- Force above when below would collide with a sub-mission container.
- Force below when above would collide with loop routing.
- If both sides collide, keep the explicit side and surface a visible console warning with the node id.
- Do not allow comments to move the main execution spine.

The current `analysisMission` annotation is above because the child container occupies the area below. That behavior must be encoded directly, not left to ELK.

### Recursive Sub-Mission Containers

Represent the sub-mission as an ELK compound node, but keep custom rendering.

- Header height, header gaps, content padding, and boundary stroke offsets are derived from Merlin tokens and snapped to `G / 2` or the smaller token-defined subdivision already used for chips.
- Header title and chips are rendered by `container` for every non-root sub-mission.
- The root mission has no header, boundary, or container background.
- Child content starts after the header plus padding for non-root containers; root content starts at the graph content origin.
- Child coordinates are relative to the owning container content origin after layout, recursively.
- Mission hierarchy and layout hierarchy are distinct. `parentMissionId` records semantic ownership; `layoutParentMissionId` selects the visual/ELK compound parent.
- Hydrated child graphs participate in the composed hierarchy by default at every depth. A nested sub-sub-mission renders inside its semantic parent only when its layout parent also points at that parent.
- A nested mission path may render as a separate root lane when `layoutParentMissionId` is set to `root`; the acceptance fixture uses this for `dependencyAudit/researchDeepDive`.
- The parent execution spine remains the visual anchor for each local scope.
- Spawn edges connect to the target non-root container entry port, not to a child node inside that container.
- Provide computed container dimensions, header offset, child padding, entry-port side/position, and child content constraints before the ELK run.
- Treat post-layout normalization as translation, snapping, validation, and deterministic path reconstruction, not semantic resizing that can invalidate routes.

### Loop Arrows

Loop routing must be explicit and validated.

- The false edge from `clean twice?` exits the fixed top-center north port.
- It routes above the spine.
- It returns to the fixed top-center north port of `Gap Review`.
- It uses `edge-loop`, dashed accent styling, and the branch marker.
- The `false` label remains centered on the top horizontal segment.

ELK feedback edges can produce the candidate route, but the Merlin router must reject or correct any route that crosses through nodes, goes below the spine, or loses the top-loop shape.

### Edge Labels

Edge labels should remain SVG text generated after geometry.

- `env? true` label stays near the right branch.
- `env? false` label stays on the downward branch.
- `clean twice? true` label stays near the right branch to End.
- `clean twice? false` label stays above the loop's horizontal segment.

Do not use ELK edge label placement until there is a separate decision to change label behavior.

### Paint Order

Preserve current paint order:

1. map background
2. grid
3. edges
4. node shapes and containers
5. chips and markers
6. labels
7. annotations

This prevents edge strokes from covering text and keeps annotations readable.

### Automatic Layout Stability

Runtime rerenders must preserve the Engineer's mental map.

- Keep stable semantic ids, ELK ids, port ids, edge ids, and annotation ids across rerenders.
- Feed nodes and edges to ELK in deterministic model order.
- Use ELK model-order options where they improve stability without creating worse crossings.
- When prior layout exists, provide previous positions as hints for semi-interactive or interactive layout modes where available.
- Preserve unaffected node/container positions during runtime child hydration unless the changed subtree requires movement.
- Snapshot hydration scenarios so layout stability is tested, not assumed.

Incremental stability is a product behavior Merlin must design for. It is not guaranteed by enabling ELK.

## Implementation Plan

Use separate work streams only if implementation context grows large enough to justify it. Keep each stream bounded and dependency-aware.

1. **Verification stream:** re-check official ELK option names, current `elkjs` package/CDN state, hierarchy handling defaults, node-size constraints, and model-order constraints immediately before coding.
2. **Semantic model stream:** extract semantic node, edge, recursive compound-container, port, annotation, and model-order data. Preserve current text measurement and size calculations.
3. **Constrained ELK stream:** build the ELK graph from pre-snapped dimensions, fixed/fixed-side ports, computed non-root container dimensions, deterministic model order, hierarchy handling, and orthogonal routing options.
4. **Merlin geometry stream:** normalize ELK output by translating to the current canvas origin, snapping boxes to `G / 2`, recomputing port anchors, validating or rejecting ELK route candidates, and generating final router-owned `M/H/V` paths.
5. **Rendering stream:** render through the existing SVG helper functions and CSS classes, with labels, chips, markers, and annotations recomputed from snapped geometry and painted after geometry.
6. **Validation stream:** fail visibly when ELK is missing, option verification fails, node/container geometry leaves the grid, route validation fails, child content overflows, root chrome appears, non-root chrome is missing, spawn edges miss computed container entry ports, or the loop is not above the spine.

## Acceptance Criteria

### Recursive Acceptance Fixture

- The fixture includes a root mission, one hydrated sub-mission, and a nested hydrated sub-sub-mission.
- The root mission renders directly on the canvas with no container chrome.
- Every non-root sub-mission, including the nested sub-sub-mission, renders with container chrome.
- The graph is deterministic at the default `G = 32`, within an approved visual-regression tolerance.
- The SVG viewBox is derived from snapped graph bounds plus token-derived padding and reserved tracks.
- A geometry golden snapshot captures semantic ids, node boxes, container boxes, port anchors, edge route points, label anchors, annotation anchors, and the viewBox.
- All visible node labels, chips, annotations, and edge labels remain at the same intended snapped anchors.
- All rendered graph edges use only `M`, `H`, and `V` commands.
- The `clean twice?` loop arrow remains above the spine.
- The `analysisMission` comment remains above the node and does not collide with the sub-mission container.
- Hydrated child graph data renders recursively by default, so a nested sub-sub-mission appears inside the first sub-mission unless `layoutParentMissionId` intentionally selects a different visual parent.
- The `dependencyAudit/researchDeepDive` fixture remains semantically nested under `dependencyAudit`, but renders as a root-lane sibling because its `layoutParentMissionId` is `root`.
- Each child graph remains inside its owning content box.
- Spawn edges target computed entry ports on non-root containers.
- Container dimensions, padding, reserved tracks, and entry ports are derived from Merlin tokens and measured content, not fixture-specific constants.
- Theme toggling continues to recolor through existing design tokens without changing geometry.
- Missing ELK CDN produces an explicit visible failure, not a blank graph.

### General Automatic Layout

- Main flow uses the active direction from `Mission-Visualizer-Spec.md`: `RIGHT` for wide LTR, `LEFT` for wide RTL, and `DOWN` for narrow/mobile containers.
- Semantic edge attachments are preserved through explicit ports.
- Rendered routes are orthogonal and grid-snapped by Merlin after ELK.
- Loop-back edges route around the outside of the main execution spine.
- Hydrated open child containers participate recursively in compound layout and preserve the local parent spine as the visual anchor.
- Root canvas scope never renders container chrome; every non-root sub-mission does.
- Rerenders preserve stable ordering and avoid moving unaffected nodes when runtime child graph data hydrates.
- Comments and intent annotations do not displace the main execution spine and do not overlap nodes, containers, labels, or loop routes.

## Testing And Verification

Use browser-driven visual and geometry checks because this migration changes user-visible SVG layout.

- Render `mission-graph.html` with `agent-browser`.
- Snapshot the normalized geometry model and compare it against an approved geometry golden before running visual comparison.
- Snapshot the graph SVG and compare the recursive acceptance fixture against an approved visual baseline after geometry invariants pass.
- Check the browser console and fail on uncaught errors or missing-ELK blank output.
- Inspect SVG paths and assert only `M`, `H`, and `V` commands are emitted for graph edges.
- Assert parent spine order and child row order match the semantic model order at every expanded depth.
- Assert every node box, container box, port anchor, edge point, and visible label anchor is aligned to `G / 2` after snapping.
- Assert no zero-length edge segments, no first segment shorter than `G`, no node-edge intersections, no annotation/container collisions, no edge-label collisions, and no child overflow.
- Verify runtime hydration fixtures preserve stable ids, render hydrated child graphs recursively by default, and do not move unaffected nodes.
- Assert the root scope has no container header/border/background and every non-root sub-mission has container chrome.
- Assert spawn edges terminate at computed non-root container entry ports, including the nested sub-sub-mission edge.
- Verify theme toggling still recolors through existing CSS tokens without changing geometry.

## Conclusion

The correct migration is not "replace manual coordinates with ELK defaults." The correct migration is:

```text
current visual contract + ELK ordering/compound solving + Merlin snapped geometry/router
```

ELK should provide layered ordering, compound layout, semantic port routing, and orthogonal route candidates. Merlin must enforce the design-token grid, measured label sizing, exact port anchors, final Manhattan SVG paths, custom node shapes, annotation placement, loop shape, sub-mission footprint, paint order, and geometry validation.

Without that Merlin geometry/router layer, ELK will produce a valid graph, but it will not preserve the current mission graph behavior or visual identity.
