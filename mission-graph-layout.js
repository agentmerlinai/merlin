export function createMissionGraphFixture({
    G = 32,
    measureTextWidth,
} = {}) {
    if (typeof measureTextWidth !== "function") {
        throw new Error("measureTextWidth is required");
    }

    const STATION_HPAD = G / 2;
    const STATION_HEIGHT = G;
    const CHIP_PAD_X = G / 4;
    const CHIP_GAP = G / 2;
    const CONTAINER_HEADER_HEIGHT = G;
    const CONTAINER_PADDING_X = G;
    const CONTAINER_PADDING_Y = G;
    const LANE_GAP = 1.5 * G;
    const CHILD_LANE_GAP = G / 2;
    const MIN_ARROW_LENGTH = G;
    const MARKER_CLEARANCE = G / 4;
    const NODE_CLEARANCE = G / 4;
    const LABEL_GAP = G / 4;
    const LABEL_GRID = G / 8;

    const nodes = [
        { id: "start", label: "Start", role: "start", kind: "terminal", missionId: "root", lane: 0, fallbackLayer: 0 },
        { id: "loadConfig", label: "loadConfig", role: "process", kind: "station", missionId: "root", lane: 0, fallbackLayer: 1 },
        { id: "env?", label: "env?", role: "decision", kind: "decision", missionId: "root", lane: 0, fallbackLayer: 2 },
        { id: "Analyze", label: "Analyze", role: "mission", kind: "station", missionId: "root", lane: 0, fallbackLayer: 3 },
        { id: "analysisMission", label: "analysisMission", role: "spawn", kind: "station", missionId: "root", lane: 0, fallbackLayer: 4 },
        { id: "Gap Review", label: "Gap Review", role: "loop", kind: "station", missionId: "root", lane: 0, fallbackLayer: 6 },
        { id: "Plan Fixes", label: "Plan Fixes", role: "mission", kind: "station", missionId: "root", lane: 0, fallbackLayer: 7 },
        { id: "fixAgents", label: "fixAgents", role: "spawn", kind: "station", missionId: "root", lane: 0, fallbackLayer: 8 },
        { id: "clean twice?", label: "clean twice?", role: "decision", kind: "decision", missionId: "root", lane: 0, fallbackLayer: 9 },
        { id: "end", label: "End", role: "end", kind: "terminal", missionId: "root", lane: 0, fallbackLayer: 10 },
        { id: "error", label: "Error", role: "error", kind: "terminal", missionId: "root", lane: 1, fallbackLayer: 2 },
        { id: "childStart", label: "Start", role: "child-start", kind: "terminal", missionId: "dependencyAudit", lane: 0, fallbackLayer: 0 },
        { id: "fork", label: "fork", role: "fork", kind: "fork", missionId: "dependencyAudit", lane: 0, fallbackLayer: 1 },
        { id: "research", label: "Research", role: "child-mission", kind: "child-mission", missionId: "dependencyAudit", lane: -1, fallbackLayer: 2 },
        { id: "researchDeepDiveSpawn", label: "researchDeepDive", role: "spawn", kind: "station", missionId: "dependencyAudit", lane: -1, fallbackLayer: 3 },
        { id: "synthesize", label: "Synthesize", role: "child-mission", kind: "child-mission", missionId: "dependencyAudit", lane: 1, fallbackLayer: 2 },
        { id: "join", label: "join", role: "join", kind: "join", missionId: "dependencyAudit", lane: 0, fallbackLayer: 4 },
        { id: "childEnd", label: "End", role: "child-end", kind: "terminal", missionId: "dependencyAudit", lane: 0, fallbackLayer: 5 },
        { id: "deepStart", label: "Start", role: "child-start", kind: "terminal", missionId: "researchDeepDive", lane: 0, fallbackLayer: 0 },
        { id: "collectSignals", label: "Collect Signals", role: "mission", kind: "station", missionId: "researchDeepDive", lane: 0, fallbackLayer: 1 },
        { id: "evidence?", label: "evidence?", role: "decision", kind: "decision", missionId: "researchDeepDive", lane: 0, fallbackLayer: 2 },
        { id: "deepEnd", label: "End", role: "child-end", kind: "terminal", missionId: "researchDeepDive", lane: 0, fallbackLayer: 3 },
    ].map((node) => measureNode(node, {
        G,
        STATION_HPAD,
        STATION_HEIGHT,
        measureTextWidth,
    }));

    const containers = [{
        id: "dependencyAudit",
        title: "DEPENDENCY AUDIT",
        chips: ["Inline code", "Static graph"],
        role: "container",
        kind: "container",
        lane: 2,
        fallbackLayer: 5,
        inputPort: "dependencyAudit.n.spawn",
        headerHeight: CONTAINER_HEADER_HEIGHT,
        paddingX: CONTAINER_PADDING_X,
        paddingY: CONTAINER_PADDING_Y,
        chipGap: CHIP_GAP,
        chipPadX: CHIP_PAD_X,
        parentMissionId: "root",
        layoutParentMissionId: "root",
        path: "dependencyAudit",
        depth: 1,
    }, {
        id: "researchDeepDive",
        title: "RESEARCH DEEP DIVE",
        chips: ["Hydrated", "Nested"],
        role: "container",
        kind: "container",
        lane: 3,
        fallbackLayer: 5,
        inputPort: "researchDeepDive.n.spawn",
        headerHeight: CONTAINER_HEADER_HEIGHT,
        paddingX: CONTAINER_PADDING_X,
        paddingY: CONTAINER_PADDING_Y,
        chipGap: CHIP_GAP,
        chipPadX: CHIP_PAD_X,
        parentMissionId: "dependencyAudit",
        layoutParentMissionId: "root",
        path: "dependencyAudit/researchDeepDive",
        depth: 2,
    }];
    const container = containers[0];

    const edges = [
        { id: "edge.start.loadConfig", type: "seq", missionId: "root", sourcePort: "start.e", targetPort: "loadConfig.w" },
        { id: "edge.loadConfig.env", type: "seq", missionId: "root", sourcePort: "loadConfig.e", targetPort: "env?.w" },
        { id: "edge.env.analyze.true", type: "branch", missionId: "root", sourcePort: "env?.e", targetPort: "Analyze.w", label: "true", labelPlacement: "above" },
        { id: "edge.env.error.false", type: "branch", missionId: "root", sourcePort: "env?.s.false", targetPort: "error.n", label: "false", labelPlacement: "left" },
        { id: "edge.analyze.analysisMission", type: "seq", missionId: "root", sourcePort: "Analyze.e", targetPort: "analysisMission.w" },
        { id: "edge.analysisMission.dependencyAudit", type: "spawn", missionId: "root", sourcePort: "analysisMission.s.spawn", targetPort: container.inputPort },
        { id: "edge.analysisMission.gapReview", type: "seq", missionId: "root", sourcePort: "analysisMission.e", targetPort: "Gap Review.w" },
        { id: "edge.gapReview.planFixes", type: "seq", missionId: "root", sourcePort: "Gap Review.e", targetPort: "Plan Fixes.w" },
        { id: "edge.planFixes.fixAgents", type: "seq", missionId: "root", sourcePort: "Plan Fixes.e", targetPort: "fixAgents.w" },
        { id: "edge.fixAgents.cleanReview", type: "seq", missionId: "root", sourcePort: "fixAgents.e", targetPort: "clean twice?.w" },
        { id: "edge.cleanReview.end.true", type: "branch", missionId: "root", sourcePort: "clean twice?.e", targetPort: "end.w", label: "true", labelPlacement: "above" },
        { id: "edge.cleanReview.gapReview.false", type: "loop", missionId: "root", sourcePort: "clean twice?.n.loop", targetPort: "Gap Review.n.loop", label: "false", labelPlacement: "above" },
        { id: "edge.childStart.fork", type: "seq", missionId: "dependencyAudit", sourcePort: "childStart.e", targetPort: "fork.w" },
        { id: "edge.fork.research", type: "seq", missionId: "dependencyAudit", sourcePort: "fork.e.research", targetPort: "research.w" },
        { id: "edge.fork.synthesize", type: "seq", missionId: "dependencyAudit", sourcePort: "fork.e.synthesize", targetPort: "synthesize.w" },
        { id: "edge.research.spawnDeepDive", type: "seq", missionId: "dependencyAudit", sourcePort: "research.e", targetPort: "researchDeepDiveSpawn.w" },
        { id: "edge.researchDeepDiveSpawn.deepDive", type: "spawn", missionId: "dependencyAudit", sourcePort: "researchDeepDiveSpawn.s.spawn", targetPort: "researchDeepDive.n.spawn" },
        { id: "edge.researchDeepDiveSpawn.join", type: "seq", missionId: "dependencyAudit", sourcePort: "researchDeepDiveSpawn.e", targetPort: "join.w.research" },
        { id: "edge.synthesize.join", type: "seq", missionId: "dependencyAudit", sourcePort: "synthesize.e", targetPort: "join.w.synthesize" },
        { id: "edge.join.childEnd", type: "seq", missionId: "dependencyAudit", sourcePort: "join.e", targetPort: "childEnd.w" },
        { id: "edge.deepStart.collectSignals", type: "seq", missionId: "researchDeepDive", sourcePort: "deepStart.e", targetPort: "collectSignals.w" },
        { id: "edge.collectSignals.evidence", type: "seq", missionId: "researchDeepDive", sourcePort: "collectSignals.e", targetPort: "evidence?.w" },
        { id: "edge.evidence.deepEnd", type: "branch", missionId: "researchDeepDive", sourcePort: "evidence?.e", targetPort: "deepEnd.w", label: "true", labelPlacement: "above" },
    ];

    const annotations = [
        { id: "anno.analyze", ownerId: "Analyze", lines: ["Finds circular refs and", "duplicate declarations"], side: "below" },
        { id: "anno.analysisMission", ownerId: "analysisMission", lines: ["inline code ·", "dual-agent run"], side: "above" },
        { id: "anno.gapReview", ownerId: "Gap Review", lines: ["Final report gap analysis", "odd Claude · even GPT"], side: "below" },
        { id: "anno.planFixes", ownerId: "Plan Fixes", lines: ["Plan fixes for major gaps"], side: "above" },
        { id: "anno.fixAgents", ownerId: "fixAgents", lines: ["Spawn focused fix agents"], side: "below" },
        { id: "anno.synthesize", ownerId: "synthesize", lines: ["Compile findings · MD report"], side: "below" },
        { id: "anno.collectSignals", ownerId: "collectSignals", lines: ["Nested hydrated mission"], side: "below" },
    ];

    const missions = [
        { id: "root", path: "root", depth: 0, parentMissionId: null },
        ...containers,
    ];

    return {
        G,
        columnGrid: G,
        trackGrid: G,
        labelGrid: LABEL_GRID,
        stationWidthGrid: 2 * G,
        minArrowLength: MIN_ARROW_LENGTH,
        markerClearance: MARKER_CLEARANCE,
        nodeClearance: NODE_CLEARANCE,
        laneGap: LANE_GAP,
        childLaneGap: CHILD_LANE_GAP,
        labelGap: LABEL_GAP,
        stationPadding: STATION_HPAD,
        chipPadX: CHIP_PAD_X,
        chipGap: CHIP_GAP,
        container,
        containers,
        containerMap: Object.fromEntries(containers.map((candidate) => [candidate.id, candidate])),
        missions,
        missionMap: Object.fromEntries(missions.map((mission) => [mission.id, mission])),
        nodes,
        edges,
        annotations,
        nodeMap: Object.fromEntries(nodes.map((node) => [node.id, node])),
    };
}

export function buildElkGraph(fixture) {
    return {
        id: "missionGraph",
        layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": "RIGHT",
            "elk.edgeRouting": "ORTHOGONAL",
            "elk.portConstraints": "FIXED_SIDE",
            "elk.layered.feedbackEdges": true,
            "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
            "elk.layered.crossingMinimization.forceNodeModelOrder": true,
            "elk.spacing.nodeNode": fixture.G,
            "elk.spacing.edgeNode": fixture.G / 2,
            "elk.spacing.edgeEdge": fixture.G / 4,
            "elk.layered.spacing.nodeNodeBetweenLayers": 2 * fixture.minArrowLength,
            "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        },
        children: elkMissionChildren(fixture, "root"),
        edges: fixture.edges
            .filter((edge) => edge.missionId === "root" && edge.type !== "loop")
            .map(elkEdge),
    };
}

export function buildMissionGraphGeometry(fixture, elkResult) {
    const layout = normalizeRecursiveGeometry(fixture, elkResult);
    const translated = translateIntoPaddedCanvas({
        fixture,
        nodes: layout.nodes,
        containers: layout.containers,
    });
    const initialAnnotations = placeAnnotations({ fixture, nodes: translated.nodes });
    const resizedContainers = containersFromSubMissionEnvelopes({
        fixture,
        containers: translated.containers,
        nodes: translated.nodes,
        annotations: initialAnnotations,
    });
    const nestedAligned = alignNestedContainers({
        fixture,
        nodes: translated.nodes,
        containers: resizedContainers,
    });
    const nestedResizedContainers = containersFromSubMissionEnvelopes({
        fixture,
        containers: nestedAligned.containers,
        nodes: nestedAligned.nodes,
        annotations: placeAnnotations({ fixture, nodes: nestedAligned.nodes }),
    });
    const realigned = alignRootContainers({
        fixture,
        nodes: nestedAligned.nodes,
        containers: nestedResizedContainers,
    });
    const finalNodes = realigned.nodes;
    const finalContainers = realigned.containers;
    const initialViewBox = initialViewBoxFor({
        fixture,
        nodes: finalNodes,
        containers: finalContainers,
        annotations: placeAnnotations({ fixture, nodes: finalNodes }),
    });
    const routedFixture = {
        ...fixture,
        viewWidth: initialViewBox.width,
        viewHeight: initialViewBox.height,
    };

    const ports = computePorts({ fixture: routedFixture, nodes: finalNodes, containers: finalContainers });
    const annotations = placeAnnotations({ fixture: routedFixture, nodes: finalNodes });
    const annotationObstacles = annotations.map((annotation) => annotation.box);
    const routed = routeEdges({
        fixture: routedFixture,
        nodes: finalNodes,
        containers: finalContainers,
        ports,
        annotationObstacles,
    });
    const edgeLabels = placeEdgeLabels({
        fixture: routedFixture,
        routes: routed,
        nodes: finalNodes,
        containers: finalContainers,
        annotations,
    });
    const viewBox = computeViewBox({
        fixture: routedFixture,
        nodes: finalNodes,
        containers: finalContainers,
        routes: routed,
        annotations,
        edgeLabels,
    });

    const geometry = {
        ok: true,
        G: fixture.G,
        viewBox,
        nodes: finalNodes,
        container: finalContainers[fixture.container.id],
        containers: finalContainers,
        routes: routed,
        portAnchors: ports,
        annotations,
        edgeLabels,
        labels: Object.fromEntries(edgeLabels.map((label) => [label.id, { x: label.x, y: label.y }])),
        layout: {
            recursiveLayout: layout,
        },
    };
    geometry.validationFailures = validateMissionGraphGeometry(fixture, geometry);
    geometry.ok = geometry.validationFailures.length === 0;
    return geometry;
}

export function validateMissionGraphGeometry(fixture, geometry) {
    const failures = [];
    const viewBounds = viewBoxBounds(geometry.viewBox);
    const routeObstacles = [
        ...Object.values(geometry.nodes).map((node) => boxOf(node)),
        ...Object.values(geometry.containers).map((container) => boxOf(container)),
        ...geometry.annotations.map((annotation) => annotation.box),
    ];

    for (const node of fixture.nodes) {
        if (node.kind === "station") {
            const expected = snapUp(
                node.labelWidth + fixture.stationPadding * 2,
                fixture.stationWidthGrid,
            );
            if (node.width !== expected) {
                failures.push(`${node.id} width ${node.width} != snapped measured width ${expected}`);
            }
        }
    }

    for (const node of Object.values(geometry.nodes)) {
        if (node.kind === "station") {
            if (!isValueOnGrid(node.left, fixture.columnGrid)) {
                failures.push(`${node.id}.left is off station column grid`);
            }
            if (!isValueOnGrid(node.right, fixture.columnGrid)) {
                failures.push(`${node.id}.right is off station column grid`);
            }
            if (!isValueOnGrid(node.cx, fixture.columnGrid)) {
                failures.push(`${node.id}.cx is off station column grid`);
            }
        }
    }
    for (const container of Object.values(geometry.containers)) {
        if (!isValueOnGrid(container.x, fixture.columnGrid)) {
            failures.push(`${container.id}.x is off column grid`);
        }
        if (!isValueOnGrid(container.top, fixture.trackGrid)) {
            failures.push(`${container.id}.top is off track grid`);
        }
        if (!isValueOnGrid(container.width, fixture.columnGrid)) {
            failures.push(`${container.id}.width is off column grid`);
        }
        if (!isValueOnGrid(container.height, fixture.trackGrid)) {
            failures.push(`${container.id}.height is off track grid`);
        }
    }

    for (const route of geometry.routes) {
        if (!/^M [\d.]+,[\d.]+(?: [HV] [\d.]+)+$/.test(route.d)) {
            failures.push(`${route.id} path is not Manhattan`);
        }
        if (!samePoint(route.startAnchor, geometry.portAnchors[route.sourcePort])) {
            failures.push(`${route.id} source anchor drifted from ${route.sourcePort}`);
        }
        if (!samePoint(route.endAnchor, geometry.portAnchors[route.targetPort])) {
            failures.push(`${route.id} target anchor drifted from ${route.targetPort}`);
        }
        for (const point of route.points) {
            if (!pointWithinBounds(point, viewBounds)) {
                failures.push(`${route.id} point ${point.x},${point.y} leaves viewBox`);
            }
        }
        for (const point of route.trackPoints) {
            if (!isPointOnGrid(point, fixture.trackGrid)) {
                failures.push(`${route.id} track point ${point.x},${point.y} is off track grid`);
            }
        }
        const routeDefect = routePathDefect(route.points);
        if (routeDefect) {
            failures.push(`${route.id} ${routeDefect}`);
        }
        for (const segment of segmentsOf(route.trackPoints)) {
            if (segment.axis === "H" && !isValueOnGrid(segment.start.y, fixture.trackGrid)) {
                failures.push(`${route.id} horizontal segment is off track row`);
            }
            if (segment.axis === "V" && !isValueOnGrid(segment.start.x, fixture.trackGrid)) {
                failures.push(`${route.id} vertical segment is off track column`);
            }
        }
        if (!isBoundarySegmentValid(route.startAnchor, route.entryStubEnd, geometry.portAnchors[route.sourcePort].side, fixture.minArrowLength)) {
            failures.push(`${route.id} source entry misses clearance or heading`);
        }
        if (!isBoundarySegmentValid(route.endAnchor, route.exitStubEnd, geometry.portAnchors[route.targetPort].side, fixture.markerClearance)) {
            failures.push(`${route.id} target exit misses clearance or heading`);
        }
        if (route.markerId && !samePoint(route.points.at(-1), route.endAnchor)) {
            failures.push(`${route.id} arrowhead misses target boundary`);
        }
        const unrelated = routeObstacles.filter((obstacle) => {
            if (route.missionId && containerAncestryIds(fixture, route.missionId).has(obstacle.id)) {
                return false;
            }
            if (route.nodeIds?.has(obstacle.id)) return false;
            return true;
        });
        if (pathHitsAny(route.points, unrelated)) {
            failures.push(`${route.id} intersects an unrelated box`);
        }
        if (route.type === "loop" && route.points.some((point) => point.y >= geometry.nodes["Gap Review"].cy)) {
            failures.push(`${route.id} loop dropped below the main lane`);
        }
        if (route.type === "spawn") {
            if (!samePoint(route.startAnchor, geometry.portAnchors[route.sourcePort]) ||
                !samePoint(route.endAnchor, geometry.portAnchors[route.targetPort])) {
                failures.push(`${route.id} spawn route is not anchored to computed spawn ports`);
            }
        }
        const expectedStyle = route.targetRole === "error" ? "error" : route.type;
        if (route.renderType !== expectedStyle) {
            failures.push(`${route.id} style ${route.renderType} != ${expectedStyle}`);
        }
    }

    for (let leftIndex = 0; leftIndex < geometry.routes.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < geometry.routes.length; rightIndex += 1) {
            const left = geometry.routes[leftIndex];
            const right = geometry.routes[rightIndex];
            if (routesOverlap(left, right)) {
                failures.push(`${left.id} overlaps route ${right.id}`);
            }
        }
    }

    for (const label of geometry.edgeLabels) {
        if (!isPointOnGrid(label, fixture.labelGrid)) {
            failures.push(`${label.id} is off label grid`);
        }
        if (!boxWithinBounds(label.box, viewBounds)) {
            failures.push(`${label.id} label leaves viewBox`);
        }
    }

    for (const annotation of geometry.annotations) {
        if (!isPointOnGrid({ x: annotation.x, y: annotation.textY }, fixture.labelGrid)) {
            failures.push(`${annotation.id} is off label grid`);
        }
        if (!boxWithinBounds(annotation.box, viewBounds)) {
            failures.push(`${annotation.id} annotation leaves viewBox`);
        }
        for (const node of Object.values(geometry.nodes)) {
            if (node.id !== annotation.ownerId && boxesOverlap(annotation.box, boxOf(node))) {
                failures.push(`${annotation.id} overlaps non-owner node ${node.id}`);
            }
        }
    }

    for (const container of Object.values(geometry.containers)) {
        if (!boxWithinBounds(boxOf(container), viewBounds)) {
            failures.push(`${container.id} container leaves viewBox`);
        }
    }
    for (const node of Object.values(geometry.nodes)) {
        if (!boxWithinBounds(boxOf(node), viewBounds)) {
            failures.push(`${node.id} leaves viewBox`);
        }
    }
    for (const container of Object.values(geometry.containers)) {
        const contentBounds = childContentBounds(container, fixture);
        for (const node of nodesInMission(fixture, container.id)) {
            if (!boxWithinBounds(boxOf(geometry.nodes[node.id]), contentBounds)) {
                failures.push(`${node.id} overflows ${container.id} content`);
            }
        }
        for (const nested of childContainers(fixture, container.id)) {
            if (!boxWithinBounds(boxOf(geometry.containers[nested.id]), boxOf(container))) {
                failures.push(`${nested.id} overflows ${container.id} container`);
            }
        }
        for (const annotation of missionOwnedAnnotations(fixture, geometry.annotations, container.id)) {
            if (!boxWithinBounds(annotation.box, boxOf(container))) {
                failures.push(`${annotation.id} overflows ${container.id} container`);
            }
        }
    }
    for (const outer of Object.values(geometry.containers)) {
        for (const inner of Object.values(geometry.containers)) {
            if (outer.id === inner.id) continue;
            if (boxWithinBounds(boxOf(inner), boxOf(outer))) {
                failures.push(`${inner.id} is rendered inside ${outer.id}`);
            }
        }
    }

    for (const mission of fixture.missions) {
        const missionNodes = nodesInMission(fixture, mission.id).map((node) => geometry.nodes[node.id]);
        failures.push(
            ...findOverlaps(missionNodes, (left, right) => `${left.id} overlaps ${right.id} as siblings in ${mission.id}`),
        );
        const container = geometry.containers[mission.id];
        if (!container) continue;
        const containerHeader = {
            id: `${container.id}.header`,
            left: container.left,
            right: container.right,
            top: container.top,
            bottom: container.top + container.headerHeight,
        };
        for (const childNode of missionNodes) {
            if (boxesOverlap(boxOf(childNode), containerHeader)) {
                failures.push(`${childNode.id} intersects the ${container.id} header`);
            }
        }
    }

    return failures;
}

function measureNode(node, { G, STATION_HPAD, STATION_HEIGHT, measureTextWidth }) {
    const labelWidth = measureTextWidth(node.label, labelClass(node));
    if (node.kind === "terminal") {
        return { ...node, labelWidth, width: 2 * G, height: G };
    }
    if (node.kind === "decision") {
        const halfWidth = snapUp((labelWidth + G) / 2, G / 2);
        return { ...node, labelWidth, width: halfWidth * 2, height: 2 * G };
    }
    if (node.kind === "fork" || node.kind === "join") {
        return { ...node, labelWidth, width: G / 4, height: 3 * G };
    }
    if (node.kind === "child-mission") {
        return { ...node, labelWidth, width: 3 * G, height: G };
    }
    return {
        ...node,
        labelWidth,
        width: snapUp(labelWidth + STATION_HPAD * 2, 2 * G),
        height: STATION_HEIGHT,
    };
}

function labelClass(node) {
    if (node.role === "start" || node.role === "end" || node.role === "child-start" || node.role === "child-end") {
        return "terminal-label";
    }
    return "node-label";
}

function elkNode(node) {
    return {
        id: node.id,
        width: node.width,
        height: node.height,
        layoutOptions: {
            "elk.portConstraints": "FIXED_POS",
            "elk.nodeSize.constraints": "FIXED",
        },
        ports: portsForNode(node),
    };
}

function elkEdge(edge) {
    return { id: edge.id, sources: [edge.sourcePort], targets: [edge.targetPort] };
}

function elkMissionChildren(fixture, missionId) {
    const children = nodesInMission(fixture, missionId).map((node) => elkNode(node, fixture));
    for (const container of childContainers(fixture, missionId)) {
        children.splice(container.fallbackLayer, 0, elkContainerNode(fixture, container));
    }
    return children;
}

function elkContainerNode(fixture, container) {
    return {
        id: container.id,
        layoutOptions: {
            "elk.portConstraints": "FIXED_SIDE",
            "elk.padding": `[top=${container.headerHeight},left=${container.paddingX},bottom=${container.paddingY},right=${container.paddingX}]`,
            "elk.layered.spacing.nodeNodeBetweenLayers": 2 * fixture.minArrowLength,
        },
        ports: [
            port(container.inputPort, "NORTH"),
        ],
        children: elkMissionChildren(fixture, container.id),
        edges: fixture.edges
            .filter((edge) => edge.missionId === container.id && edge.type !== "loop")
            .map(elkEdge),
    };
}

function normalizeRecursiveGeometry(fixture, elkResult) {
    const flattened = flattenElkNodes(elkResult);
    const byId = Object.fromEntries(flattened.map((node) => [node.id, node]));
    const nodes = {};
    const containers = {};
    for (const node of fixture.nodes) {
        const raw = requiredElkNode(byId, node.id);
        nodes[node.id] = withBounds({
            ...node,
            x: raw.absoluteX,
            y: raw.absoluteY,
            width: raw.width,
            height: raw.height,
        }, fixture);
    }
    for (const container of fixture.containers) {
        const raw = requiredElkNode(byId, container.id);
        containers[container.id] = withBounds(createContainerBox(fixture, {
            ...container,
            x: raw.absoluteX,
            y: raw.absoluteY,
            width: snapUp(raw.width, fixture.columnGrid),
            height: snapUp(raw.height, fixture.trackGrid),
        }), fixture);
    }

    const normalized = normalizeMissionBoxes(fixture, { nodes, containers });
    return {
        nodes: normalized.nodes,
        containers: normalized.containers,
    };
}

function normalizeMissionBoxes(fixture, geometry) {
    let result = geometry;
    for (const mission of fixture.missions) {
        const missionNodes = nodesInMission(fixture, mission.id);
        const containers = childContainers(fixture, mission.id);
        const missionItems = [
            ...missionNodes.map((node) => result.nodes[node.id]),
            ...containers.map((container) => result.containers[container.id]),
        ];
        if (missionItems.length === 0) continue;
        const itemById = Object.fromEntries([
            ...missionNodes.map((node) => [node.id, result.nodes[node.id]]),
            ...containers.map((container) => [container.id, result.containers[container.id]]),
        ]);
        const normalized = mission.id === "root"
            ? normalizeRootMissionLanes(fixture, missionNodes, containers, itemById)
            : normalizeNestedMissionLayers(fixture, missionNodes, containers, itemById);
        result = applyNormalizedMissionItems(result, normalized);
    }
    return result;
}

function applyNormalizedMissionItems(geometry, items) {
    const nodes = { ...geometry.nodes };
    const containers = { ...geometry.containers };
    for (const item of Object.values(items)) {
        if (item.kind === "container") containers[item.id] = item;
        else nodes[item.id] = item;
    }
    return { nodes, containers };
}

function requiredElkNode(byId, id) {
    const node = byId[id];
    if (!node) {
        throw new Error(`Missing ELK geometry for ${id}`);
    }
    return node;
}

function normalizeRootMissionLanes(fixture, missionNodes, containers, boxes) {
    return normalizeParentLanes(fixture, missionNodes, containers, normalizeParentColumns(fixture, missionNodes, containers, boxes));
}

function normalizeParentLanes(fixture, missionNodes, containers, parentBoxes) {
    const byLane = new Map();
    for (const item of [...missionNodes, ...containers]) {
        if (!byLane.has(item.lane)) byLane.set(item.lane, []);
        byLane.get(item.lane).push(item);
    }
    const normalized = { ...parentBoxes };
    let previousLaneBottom = -Infinity;
    for (const lane of [...byLane.keys()].sort((a, b) => a - b)) {
        const nodes = byLane.get(lane);
        if (lane > 0) {
            const laneTop = Math.min(...nodes.map((node) => normalized[node.id].y));
            const desiredTop = snapUp(previousLaneBottom + fixture.laneGap, fixture.trackGrid);
            if (laneTop < desiredTop) {
                const dy = desiredTop - laneTop;
                for (const node of nodes) {
                    normalized[node.id] = {
                        ...normalized[node.id],
                        y: normalized[node.id].y + dy,
                    };
                }
            }
        }
        previousLaneBottom = Math.max(
            previousLaneBottom,
            ...nodes.map((node) => normalized[node.id].y + normalized[node.id].height),
        );
    }
    return normalized;
}

function normalizeParentColumns(fixture, missionNodes, containers, parentBoxes) {
    const byLayer = new Map();
    for (const item of [...missionNodes, ...containers]) {
        if (!byLayer.has(item.fallbackLayer)) byLayer.set(item.fallbackLayer, []);
        byLayer.get(item.fallbackLayer).push(item);
    }

    const normalized = { ...parentBoxes };
    let previousLayerRight = null;
    for (const layer of [...byLayer.keys()].sort((a, b) => a - b)) {
        const nodes = byLayer.get(layer);
        const x = previousLayerRight === null
            ? Math.min(...nodes.map((node) => snapUp(normalized[node.id].x, fixture.columnGrid)))
            : snapUp(previousLayerRight + 2 * fixture.G, fixture.columnGrid);
        for (const node of nodes) {
            normalized[node.id] = {
                ...normalized[node.id],
                x,
            };
        }
        previousLayerRight = Math.max(...nodes.map((node) => x + normalized[node.id].width));
    }

    return normalized;
}

function normalizeNestedMissionLayers(fixture, missionNodes, containers, boxes) {
    return normalizeHorizontalLayers(fixture, [...missionNodes, ...containers], boxes);
}

function normalizeHorizontalLayers(fixture, items, boxes) {
    const byLayer = new Map();
    for (const item of items) {
        if (!byLayer.has(item.fallbackLayer)) byLayer.set(item.fallbackLayer, []);
        byLayer.get(item.fallbackLayer).push(item);
    }
    const normalized = { ...boxes };
    let previousLayerRight = -Infinity;
    for (const layer of [...byLayer.keys()].sort((a, b) => a - b)) {
        const nodes = byLayer.get(layer);
        const layerLeft = Math.min(...nodes.map((node) => snapUp(normalized[node.id].x, fixture.columnGrid)));
        const desiredLeft = snapUp(previousLayerRight + 2 * fixture.G, fixture.columnGrid);
        if (layerLeft < desiredLeft) {
            const dx = desiredLeft - layerLeft;
            for (const node of nodes) {
                normalized[node.id] = {
                    ...normalized[node.id],
                    x: normalized[node.id].x + dx,
                };
            }
        }
        previousLayerRight = Math.max(
            previousLayerRight,
            ...nodes.map((node) => snapUp(normalized[node.id].x, fixture.columnGrid) + normalized[node.id].width),
        );
    }
    return normalized;
}

function createContainerBox(fixture, box) {
    return {
        ...box,
        chips: box.chips.map((chip) => ({
            label: chip,
            width: snapUp(fixture.nodeMap.start.width / 4 + chip.length * (fixture.G / 6), fixture.labelGrid),
        })),
    };
}

function nodesInMission(fixture, missionId) {
    return fixture.nodes.filter((node) => node.missionId === missionId);
}

function childContainers(fixture, missionId) {
    return fixture.containers.filter((container) => layoutParentMissionId(container) === missionId);
}

function descendantNodeIds(fixture, missionId) {
    const ids = new Set(nodesInMission(fixture, missionId).map((node) => node.id));
    for (const container of childContainers(fixture, missionId)) {
        for (const id of descendantNodeIds(fixture, container.id)) {
            ids.add(id);
        }
    }
    return ids;
}

function containerIdsForMission(fixture, missionId) {
    const ids = new Set();
    for (const container of childContainers(fixture, missionId)) {
        ids.add(container.id);
        for (const id of containerIdsForMission(fixture, container.id)) {
            ids.add(id);
        }
    }
    return ids;
}

function containerAncestryIds(fixture, missionId) {
    const ids = new Set();
    let cursor = fixture.containerMap[missionId];
    while (cursor) {
        ids.add(cursor.id);
        cursor = fixture.containerMap[layoutParentMissionId(cursor)];
    }
    return ids;
}

function layoutParentMissionId(container) {
    return container.layoutParentMissionId ?? container.parentMissionId;
}

function port(id, side, x, y) {
    return {
        id,
        ...(x === undefined ? {} : { x }),
        ...(y === undefined ? {} : { y }),
        width: 0,
        height: 0,
        layoutOptions: { "elk.port.side": side },
    };
}

function portsForNode(node) {
    if (node.kind === "fork") {
        return [
            port(`${node.id}.w`, "WEST", 0, node.height / 2),
            port(`${node.id}.e.research`, "EAST", node.width, node.height / 2 - node.height / 3),
            port(`${node.id}.e.synthesize`, "EAST", node.width, node.height / 2 + node.height / 3),
        ];
    }
    if (node.kind === "join") {
        return [
            port(`${node.id}.w.research`, "WEST", 0, node.height / 2 - node.height / 3),
            port(`${node.id}.w.synthesize`, "WEST", 0, node.height / 2 + node.height / 3),
            port(`${node.id}.e`, "EAST", node.width, node.height / 2),
        ];
    }
    const base = [
        port(`${node.id}.w`, "WEST", 0, node.height / 2),
        port(`${node.id}.e`, "EAST", node.width, node.height / 2),
    ];
    if (node.kind === "decision") {
        base.push(
            port(`${node.id}.s.false`, "SOUTH", node.width / 2, node.height),
            port(`${node.id}.n.loop`, "NORTH", node.width / 2, 0),
        );
    }
    if (node.role === "spawn") {
        base.push(port(`${node.id}.s.spawn`, "SOUTH", node.width / 2, node.height));
    }
    if (node.id === "Gap Review") {
        base.push(port(`${node.id}.n.loop`, "NORTH", node.width / 2, 0));
    }
    if (node.role === "error") {
        base.push(port(`${node.id}.n`, "NORTH", node.width / 2, 0));
    }
    return base;
}

function flattenElkNodes(node, origin = { x: 0, y: 0 }, result = []) {
    if (!node?.children) return result;
    for (const child of node.children) {
        const absolute = {
            x: origin.x + (child.x || 0),
            y: origin.y + (child.y || 0),
        };
        result.push({
            id: child.id,
            absoluteX: absolute.x,
            absoluteY: absolute.y,
            width: child.width || 0,
            height: child.height || 0,
        });
        flattenElkNodes(child, absolute, result);
    }
    return result;
}

function computePorts({ fixture, nodes, containers }) {
    const ports = {};
    for (const node of fixture.nodes) {
        for (const descriptor of concretePortDescriptors(node, nodes)) {
            ports[descriptor.id] = { ...descriptor.point, side: descriptor.side, ownerId: node.id };
        }
    }
    for (const container of Object.values(containers)) {
        ports[container.inputPort] = {
            x: snapUp(container.cx, fixture.columnGrid),
            y: container.top,
            side: "NORTH",
            ownerId: container.id,
        };
    }
    return ports;
}

function concretePortDescriptors(node, nodes) {
    const box = nodes[node.id];
    if (node.kind === "fork") {
        return [
            { id: `${node.id}.w`, side: "WEST", point: { x: box.left, y: box.cy } },
            { id: `${node.id}.e.research`, side: "EAST", point: { x: box.right, y: nodes.research.cy } },
            { id: `${node.id}.e.synthesize`, side: "EAST", point: { x: box.right, y: nodes.synthesize.cy } },
        ];
    }
    if (node.kind === "join") {
        return [
            { id: `${node.id}.w.research`, side: "WEST", point: { x: box.left, y: nodes.research.cy } },
            { id: `${node.id}.w.synthesize`, side: "WEST", point: { x: box.left, y: nodes.synthesize.cy } },
            { id: `${node.id}.e`, side: "EAST", point: { x: box.right, y: box.cy } },
        ];
    }
    const descriptors = [
        { id: `${node.id}.w`, side: "WEST", point: { x: box.left, y: box.cy } },
        { id: `${node.id}.e`, side: "EAST", point: { x: box.right, y: box.cy } },
    ];
    if (node.kind === "decision") {
        descriptors.push(
            { id: `${node.id}.s.false`, side: "SOUTH", point: { x: box.cx, y: box.bottom } },
            { id: `${node.id}.n.loop`, side: "NORTH", point: { x: box.cx, y: box.top } },
        );
    }
    if (node.role === "spawn") {
        descriptors.push({ id: `${node.id}.s.spawn`, side: "SOUTH", point: { x: box.cx, y: box.bottom } });
    }
    if (node.id === "Gap Review") {
        descriptors.push({ id: `${node.id}.n.loop`, side: "NORTH", point: { x: box.cx, y: box.top } });
    }
    if (node.role === "error") {
        descriptors.push({ id: `${node.id}.n`, side: "NORTH", point: { x: box.cx, y: box.top } });
    }
    return descriptors;
}

function placeAnnotations({ fixture, nodes }) {
    return fixture.annotations.map((annotation) => {
        const owner = nodes[annotation.ownerId];
        const width = snapUp(
            Math.max(...annotation.lines.map((line) => line.length * (fixture.G / 6))),
            fixture.labelGrid,
        );
        const lineHeight = Math.round((fixture.G * 3) / 8);
        const height = lineHeight * annotation.lines.length;
        const below = annotation.side === "below";
        const x = snapUp(owner.cx, fixture.labelGrid);
        const stubStartY = below ? owner.bottom : owner.top;
        const stubEndY = below ? owner.bottom + fixture.G / 2 : owner.top - fixture.G / 2;
        const textY = snapUp(
            below
                ? stubEndY + fixture.labelGap
                : stubEndY - fixture.labelGap - height + lineHeight,
            fixture.labelGrid,
        );
        return {
            ...annotation,
            x,
            y1: stubStartY,
            y2: stubEndY,
            textY,
            box: {
                id: annotation.id,
                left: x - width / 2,
                right: x + width / 2,
                top: below ? textY - lineHeight * 0.8 : textY - lineHeight * 0.8,
                bottom: below ? textY - lineHeight * 0.8 + height : textY - lineHeight * 0.8 + height,
            },
        };
    });
}

function routeEdges({ fixture, nodes, containers, ports, annotationObstacles }) {
    const boxes = [
        ...Object.values(nodes).map((node) => inflateBox(boxOf(node), fixture.nodeClearance)),
        ...Object.values(containers).map((container) => inflateBox(boxOf(container), fixture.nodeClearance)),
        ...annotationObstacles.map((box) => inflateBox(box, fixture.labelGap)),
    ];

    const routesById = new Map();
    const routeEdge = (edge) => {
        const source = ports[edge.sourcePort];
        const target = ports[edge.targetPort];
        const ownerContainer = containers[edge.missionId];
        const targetNode = containers[target.ownerId] || nodes[target.ownerId];
        const entryPath = pathFromAnchorToTrack(source, fixture.minArrowLength, fixture);
        const exitPath = pathFromAnchorToTrack(target, fixture.markerClearance, fixture);
        const start = entryPath[0];
        const entryStubEnd = entryPath[1];
        const entryPoint = entryPath.at(-1);
        const markerEnd = exitPath[1];
        const exitStubEnd = exitPath[1];
        const exitPoint = exitPath.at(-1);
        const bounds = snapBoundsToTrackGrid(
            ownerContainer
                ? {
                    left: ownerContainer.left + ownerContainer.paddingX / 2,
                    right: ownerContainer.right - ownerContainer.paddingX / 2,
                    top: ownerContainer.top + ownerContainer.headerHeight,
                    bottom: ownerContainer.bottom - ownerContainer.paddingY / 2,
                }
                : { left: 0, right: fixture.viewWidth, top: 0, bottom: fixture.viewHeight },
            fixture.trackGrid,
        );

        const obstacleIdsToSkip = new Set([source.ownerId, target.ownerId]);
        const obstacles = boxes.filter(
            (box) =>
                !obstacleIdsToSkip.has(box.id) &&
                !(ownerContainer && box.id === ownerContainer.id),
        );
        let middlePoints;
        if (edge.type === "spawn") {
            middlePoints = routeSpawn({
                edge,
                fixture,
                entryPoint,
                exitPoint,
                bounds,
                existingRoutes: [...routesById.values()],
            });
        } else if (edge.type === "loop") {
            middlePoints = routeLoop({
                fixture,
                startTrack: entryPoint,
                endTrack: exitPoint,
                obstacles,
                fallbackTop: Math.min(nodes["Gap Review"].top, nodes["clean twice?"].top) - fixture.minArrowLength,
            });
        } else {
            middlePoints = routeAStar({
                fixture,
                start: entryPoint,
                end: exitPoint,
                obstacles,
                bounds,
            });
            if (!middlePoints) {
                throw new Error(`Unable to route ${edge.id} without crossing obstacles`);
            }
        }

        const trackPoints = dedupePoints([entryPoint, ...middlePoints, exitPoint]);
        const points = simplifyRoutePoints(dedupePoints([
            ...entryPath,
            ...trackPoints.slice(1),
            ...exitPath.slice().reverse(),
        ]), edge.id);
        const routeNodeIds = new Set([source.ownerId, target.ownerId]);
        if (containers[target.ownerId]) {
            for (const id of descendantNodeIds(fixture, target.ownerId)) routeNodeIds.add(id);
            for (const id of containerIdsForMission(fixture, target.ownerId)) routeNodeIds.add(id);
        }
        if (edge.type === "spawn" && containers[target.ownerId]) {
            for (const sibling of nodesInMission(fixture, edge.missionId)) {
                routeNodeIds.add(sibling.id);
            }
        }
        return {
            id: edge.id,
            type: edge.type,
            missionId: edge.missionId,
            sourcePort: edge.sourcePort,
            targetPort: edge.targetPort,
            startAnchor: start,
            endAnchor: { x: target.x, y: target.y },
            entryStubEnd,
            entryPoint,
            exitStubEnd,
            exitPoint,
            trackPoints,
            targetRole: containers[target.ownerId] ? "container" : targetNode.role,
            points,
            d: pathFromPoints(points),
            renderType: target.ownerId === "error" ? "error" : edge.type,
            markerId: markerIdForEdge(edge, target.ownerId === "error"),
            label: edge.label,
            labelPlacement: edge.labelPlacement,
            nodeIds: routeNodeIds,
        };
    };

    for (const edge of fixture.edges.filter((candidate) => candidate.type !== "spawn")) {
        routesById.set(edge.id, routeEdge(edge));
    }
    for (const edge of fixture.edges.filter((candidate) => candidate.type === "spawn")) {
        routesById.set(edge.id, routeEdge(edge));
    }
    return fixture.edges.map((edge) => routesById.get(edge.id));
}

function markerIdForEdge(edge, isError) {
    if (isError) return "arr-error";
    if (edge.type === "branch" || edge.type === "loop") return "arr-branch";
    if (edge.type === "spawn") return "arr-spawn";
    return "arr-seq";
}

function routeLoop({ fixture, startTrack, endTrack, obstacles, fallbackTop }) {
    const top = findHorizontalTrack({
        fixture,
        obstacles,
        minY: fixture.G,
        maxY: snapUp(fallbackTop, fixture.trackGrid),
        startX: Math.min(startTrack.x, endTrack.x),
        endX: Math.max(startTrack.x, endTrack.x),
    });
    return [
        { x: startTrack.x, y: top },
        { x: endTrack.x, y: top },
    ];
}

function routeSpawn({ edge, fixture, entryPoint, exitPoint, bounds, existingRoutes }) {
    const minY = Math.max(entryPoint.y, bounds.top);
    for (let y = snapUp(minY, fixture.trackGrid); y <= bounds.bottom; y += fixture.trackGrid) {
        const middlePoints = [
            { x: entryPoint.x, y },
            { x: exitPoint.x, y },
        ];
        const trackPoints = dedupePoints([entryPoint, ...middlePoints, exitPoint]);
        const candidate = { id: edge.id, points: trackPoints };
        if (!existingRoutes.some((route) => routesOverlap(candidate, route))) {
            return middlePoints;
        }
    }
    throw new Error(`Unable to route ${edge.id} without overlapping an existing route`);
}

function routeAStar({ fixture, start, end, obstacles, bounds }) {
    if (samePoint(start, end)) return [];
    if (segmentIsClear(start, end, obstacles)) {
        return [end];
    }
    const startKey = keyOf(start);
    const targetKey = keyOf(end);
    const open = new Map([[startKey, { point: start, score: heuristic(start, end), cost: 0, dir: null }]]);
    const cameFrom = new Map();
    const best = new Map([[startKey, 0]]);

    while (open.size > 0) {
        const current = [...open.values()].sort((a, b) => a.score - b.score)[0];
        open.delete(keyOf(current.point));
        if (keyOf(current.point) === targetKey) {
            return reconstructAStarPath(cameFrom, current.point).slice(1, -1);
        }
        for (const { point: next, dir } of neighbors(current.point, fixture.trackGrid, bounds)) {
            if (!segmentIsClear(current.point, next, obstacles)) continue;
            const nextKey = keyOf(next);
            const turnPenalty = current.dir && current.dir !== dir ? 0.2 : 0;
            const cost = current.cost + 1 + turnPenalty;
            if (best.has(nextKey) && best.get(nextKey) <= cost) continue;
            best.set(nextKey, cost);
            cameFrom.set(nextKey, { point: current.point, dir });
            open.set(nextKey, {
                point: next,
                dir,
                cost,
                score: cost + heuristic(next, end),
            });
        }
    }

    return null;
}

function simplifyRoutePoints(points, routeId) {
    const simplified = [points[0]];
    for (const point of points.slice(1)) {
        const previous = simplified[simplified.length - 1];
        if (samePoint(previous, point)) continue;
        const beforePrevious = simplified[simplified.length - 2];
        if (beforePrevious && sameAxis(beforePrevious, previous, point)) {
            const firstDirection = segmentDirection(beforePrevious, previous);
            const nextDirection = segmentDirection(previous, point);
            if (firstDirection !== nextDirection) {
                throw new Error(`${routeId} path backtracks at ${previous.x},${previous.y} between ${beforePrevious.x},${beforePrevious.y} and ${point.x},${point.y}`);
            }
            simplified[simplified.length - 1] = point;
        } else {
            simplified.push(point);
        }
    }
    return simplified;
}

function placeEdgeLabels({ fixture, routes, nodes, containers, annotations }) {
    const reserved = [
        ...Object.values(nodes).map((node) => inflateBox(boxOf(node), fixture.labelGap)),
        ...Object.values(containers).map((container) => inflateBox(boxOf(container), fixture.labelGap)),
        ...annotations.map((annotation) => inflateBox(annotation.box, fixture.labelGap)),
    ];
    const labels = [];
    for (const route of routes.filter((candidate) => candidate.label)) {
        const width = snapUp(route.label.length * (fixture.G / 5), fixture.labelGrid);
        const height = fixture.G / 3;
        const segments = segmentsOf(route.points)
            .map((segment) => ({ ...segment, length: segmentLength(segment) }))
            .sort((a, b) => b.length - a.length);
        let chosen = null;
        for (const segment of segments) {
            const candidates = candidateLabelBoxes(segment, route.labelPlacement, width, height, fixture);
            chosen = candidates.find((candidate) => !reserved.some((box) => boxesOverlap(candidate.box, box)));
            if (chosen) break;
        }
        if (!chosen) {
            const segment = segments[0];
            chosen = candidateLabelBoxes(segment, route.labelPlacement, width, height, fixture)[0];
        }
        reserved.push(inflateBox(chosen.box, fixture.labelGap / 2));
        labels.push({
            id: route.id,
            routeId: route.id,
            text: route.label,
            x: snapUp(chosen.x, fixture.labelGrid),
            y: snapUp(chosen.y, fixture.labelGrid),
            textAnchor: chosen.textAnchor,
            box: chosen.box,
        });
    }
    return labels;
}

function candidateLabelBoxes(segment, preferredPlacement, width, height, fixture) {
    const center = midpoint(segment.start, segment.end);
    const placements =
        segment.axis === "H"
            ? [preferredPlacement === "below" ? "below" : "above", "below"]
            : [preferredPlacement === "right" ? "right" : "left", "right"];
    return placements.map((placement) => {
        if (segment.axis === "H") {
            const y = placement === "below" ? center.y + fixture.labelGap + height : center.y - fixture.labelGap;
            return {
                x: center.x,
                y,
                textAnchor: "middle",
                box: {
                    left: center.x - width / 2,
                    right: center.x + width / 2,
                    top: placement === "below" ? y - height * 0.8 : y - height,
                    bottom: placement === "below" ? y - height * 0.8 + height : y,
                },
            };
        }
        const x = placement === "right" ? center.x + fixture.labelGap : center.x - fixture.labelGap;
        return {
            x,
            y: center.y,
            textAnchor: placement === "right" ? "start" : "end",
            box: {
                left: placement === "right" ? x : x - width,
                right: placement === "right" ? x + width : x,
                top: center.y - height / 2,
                bottom: center.y + height / 2,
            },
        };
    });
}

function pathFromPoints(points) {
    const [first, ...rest] = points;
    return rest.reduce((path, point, index) => {
        const previous = index === 0 ? first : rest[index - 1];
        if (point.x === previous.x) return `${path} V ${point.y}`;
        if (point.y === previous.y) return `${path} H ${point.x}`;
        throw new Error(`diagonal segment ${previous.x},${previous.y} -> ${point.x},${point.y}`);
    }, `M ${first.x},${first.y}`);
}

function translateIntoPaddedCanvas({ fixture, nodes, containers }) {
    const bounds = contentBounds([
        ...Object.values(containers).map(boxOf),
        ...Object.values(nodes).map(boxOf),
    ]);
    const padding = fixture.G;
    const dx = snapUp(padding - bounds.left, fixture.columnGrid);
    const dy = snapUp(padding - bounds.top, fixture.trackGrid);
    const translatedNodes = Object.fromEntries(
        Object.entries(nodes).map(([id, node]) => [id, translateBox(node, dx, dy, fixture)]),
    );
    const translatedContainers = Object.fromEntries(
        Object.entries(containers).map(([id, item]) => [id, translateBox(item, dx, dy, fixture)]),
    );
    const laneAligned = alignRootContainers({ fixture, nodes: translatedNodes, containers: translatedContainers });
    const overlapResolved = resolveMissionSiblingSnapOverlaps(laneAligned, fixture);

    return {
        nodes: overlapResolved.nodes,
        containers: overlapResolved.containers,
    };
}

function alignRootContainers({ fixture, nodes, containers }) {
    let alignedNodes = nodes;
    let alignedContainers = containers;
    const parentBottom = Math.max(
        ...nodesInMission(fixture, "root").map((node) => alignedNodes[node.id].bottom),
    );
    const desiredTop = snapUp(parentBottom + fixture.laneGap, fixture.trackGrid);
    const rootContainers = childContainers(fixture, "root").map((container) => alignedContainers[container.id]);
    const containerTop = Math.min(...rootContainers.map((container) => container.top));
    if (containerTop < desiredTop) {
        ({ nodes: alignedNodes, containers: alignedContainers } = translateRootContainerSubtrees({
            fixture,
            nodes: alignedNodes,
            containers: alignedContainers,
            containerFixtures: childContainers(fixture, "root"),
            dy: desiredTop - containerTop,
        }));
    }

    let previousLaneBottom = parentBottom;
    for (const containerFixture of childContainers(fixture, "root").sort((a, b) => a.lane - b.lane)) {
        const container = alignedContainers[containerFixture.id];
        const laneTop = container.top;
        const laneTopMin = snapUp(previousLaneBottom + fixture.laneGap, fixture.trackGrid);
        if (laneTop < laneTopMin) {
            ({ nodes: alignedNodes, containers: alignedContainers } = translateRootContainerSubtrees({
                fixture,
                nodes: alignedNodes,
                containers: alignedContainers,
                containerFixtures: [containerFixture],
                dy: laneTopMin - laneTop,
            }));
        }
        previousLaneBottom = Math.max(previousLaneBottom, alignedContainers[containerFixture.id].bottom);
    }

    return { nodes: alignedNodes, containers: alignedContainers };
}

function translateRootContainerSubtrees({ fixture, nodes, containers, containerFixtures, dy }) {
    const shiftedNodeIds = new Set();
    const shiftedContainerIds = new Set();
    for (const container of containerFixtures) {
        shiftedContainerIds.add(container.id);
        for (const id of descendantNodeIds(fixture, container.id)) shiftedNodeIds.add(id);
        for (const id of containerIdsForMission(fixture, container.id)) shiftedContainerIds.add(id);
    }
    return {
        nodes: Object.fromEntries(
            Object.entries(nodes).map(([id, node]) => [
                id,
                shiftedNodeIds.has(id) ? translateBox(node, 0, dy, fixture) : node,
            ]),
        ),
        containers: Object.fromEntries(
            Object.entries(containers).map(([id, container]) => [
                id,
                shiftedContainerIds.has(id) ? translateBox(container, 0, dy, fixture) : container,
            ]),
        ),
    };
}

function alignNestedContainers({ fixture, nodes, containers }) {
    let alignedNodes = nodes;
    let alignedContainers = containers;
    for (const container of fixture.containers.filter((candidate) => layoutParentMissionId(candidate) !== "root")) {
        const parentNodes = nodesInMission(fixture, layoutParentMissionId(container));
        if (parentNodes.length === 0) continue;
        const parentBottom = Math.max(...parentNodes.map((node) => alignedNodes[node.id].bottom));
        const desiredTop = snapUp(parentBottom + fixture.childLaneGap, fixture.trackGrid);
        const current = alignedContainers[container.id];
        if (current.top >= desiredTop) continue;
        const dy = desiredTop - current.top;
        const shiftedNodeIds = descendantNodeIds(fixture, container.id);
        const shiftedContainerIds = new Set([container.id, ...containerIdsForMission(fixture, container.id)]);
        alignedNodes = Object.fromEntries(
            Object.entries(alignedNodes).map(([id, node]) => [
                id,
                shiftedNodeIds.has(id) ? translateBox(node, 0, dy, fixture) : node,
            ]),
        );
        alignedContainers = Object.fromEntries(
            Object.entries(alignedContainers).map(([id, item]) => [
                id,
                shiftedContainerIds.has(id) ? translateBox(item, 0, dy, fixture) : item,
            ]),
        );
    }
    return { nodes: alignedNodes, containers: alignedContainers };
}

function resolveMissionSiblingSnapOverlaps({ nodes, containers }, fixture) {
    const resolved = { ...nodes };
    for (const mission of fixture.missions) {
        const placed = [];
        for (const item of nodesInMission(fixture, mission.id)) {
            let node = resolved[item.id];
            while (placed.some((candidate) => boxesOverlap(boxOf(node), boxOf(candidate)))) {
                node = translateBox(node, fixture.columnGrid, 0, fixture);
            }
            resolved[item.id] = node;
            placed.push(node);
        }
    }

    return {
        nodes: resolved,
        containers,
    };
}

function missionOwnedAnnotations(fixture, annotations, missionId) {
    const ids = descendantNodeIds(fixture, missionId);
    return annotations.filter((annotation) => ids.has(annotation.ownerId));
}

function subMissionEnvelope({ fixture, nodes, containers, annotations, missionId }) {
    const childBoxes = nodesInMission(fixture, missionId)
        .map((node) => boxOf(nodes[node.id]));
    const nestedContainerBoxes = childContainers(fixture, missionId)
        .map((container) => boxOf(containers[container.id]));
    const annotationBoxes = missionOwnedAnnotations(fixture, annotations, missionId)
        .map((annotation) => annotation.box);
    return contentBounds([...childBoxes, ...nestedContainerBoxes, ...annotationBoxes]);
}

function containersFromSubMissionEnvelopes({ fixture, containers, nodes, annotations }) {
    let resized = { ...containers };
    for (const container of [...fixture.containers].sort((a, b) => b.depth - a.depth)) {
        resized = {
            ...resized,
            [container.id]: containerFromSubMissionEnvelope({
                fixture,
                container: resized[container.id],
                containers: resized,
                nodes,
                annotations,
            }),
        };
    }
    return resized;
}

function containerFromSubMissionEnvelope({ fixture, container, containers, nodes, annotations }) {
    const envelope = subMissionEnvelope({ fixture, nodes, containers, annotations, missionId: container.id });
    const padding = 2 * fixture.minArrowLength;
    const left = snapDown(envelope.left - padding, fixture.columnGrid);
    const right = snapUp(envelope.right + padding, fixture.columnGrid);
    const top = snapDown(envelope.top - container.headerHeight - padding, fixture.trackGrid);
    const bottom = snapUp(envelope.bottom + padding, fixture.trackGrid);
    return withBounds({
        ...container,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    }, fixture);
}

function initialViewBoxFor({ fixture, nodes, containers, annotations }) {
    const bounds = contentBounds([
        ...Object.values(containers).map(boxOf),
        ...Object.values(nodes).map(boxOf),
        ...annotations.map((annotation) => annotation.box),
    ]);
    const padding = fixture.G;
    return {
        width: snapUp(bounds.right + padding, fixture.columnGrid),
        height: snapUp(bounds.bottom + padding, fixture.trackGrid),
    };
}

function translateBox(box, dx, dy, fixture) {
    return withBounds({
        ...box,
        x: box.x + dx,
        y: box.y + dy,
    }, fixture);
}

function computeViewBox({ fixture, nodes, containers, routes, annotations, edgeLabels }) {
    const routePoints = routes.flatMap((route) => route.points);
    const routeBoxes = routePoints.map((point) => ({
        left: point.x,
        right: point.x,
        top: point.y,
        bottom: point.y,
    }));
    const bounds = contentBounds([
        ...Object.values(containers).map(boxOf),
        ...Object.values(nodes).map(boxOf),
        ...annotations.map((annotation) => annotation.box),
        ...edgeLabels.map((label) => label.box),
        ...routeBoxes,
    ]);
    const padding = fixture.G;
    const width = snapUp(bounds.right + padding, fixture.columnGrid);
    const height = snapUp(bounds.bottom + padding, fixture.trackGrid);
    return `0 0 ${width} ${height}`;
}

function contentBounds(boxes) {
    return {
        left: Math.min(...boxes.map((box) => box.left)),
        right: Math.max(...boxes.map((box) => box.right)),
        top: Math.min(...boxes.map((box) => box.top)),
        bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
}

function withBounds(box, fixture) {
    const { x, y } = normalizeLayoutBox(box, fixture);
    return {
        ...box,
        x,
        y,
        left: x,
        right: x + box.width,
        top: y,
        bottom: y + box.height,
        cx: x + box.width / 2,
        cy: y + box.height / 2,
        textX: x + box.width / 2,
        chipX: x + box.width - fixture.G - fixture.G / 4,
        chipY: y - fixture.G / 4,
        markerX: x + fixture.G / 4,
    };
}

function normalizeLayoutBox(box, fixture) {
    return {
        ...box,
        x: snapUp(box.x, fixture.columnGrid),
        y: box.kind === "container"
            ? snapUp(box.y, fixture.trackGrid)
            : snapNodeY(box.y, box.height, fixture.trackGrid),
    };
}

function snapNodeY(y, height, trackGrid) {
    return snapUp(y + height / 2, trackGrid) - height / 2;
}

function snapUp(value, unit) {
    return Math.ceil(value / unit) * unit;
}

function snapDown(value, unit) {
    return Math.floor(value / unit) * unit;
}

function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dedupePoints(points) {
    return points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]));
}

function samePoint(a, b) {
    return a.x === b.x && a.y === b.y;
}

function offsetPoint(point, side, distance) {
    if (side === "WEST") return { x: point.x - distance, y: point.y };
    if (side === "EAST") return { x: point.x + distance, y: point.y };
    if (side === "NORTH") return { x: point.x, y: point.y - distance };
    return { x: point.x, y: point.y + distance };
}

function pathFromAnchorToTrack(anchor, clearance, fixture) {
    const point = { x: anchor.x, y: anchor.y };
    const offset = offsetPoint(point, anchor.side, clearance);
    const projected = projectAnchorToTrack(anchor, clearance, fixture);
    const elbow = offset.x === projected.x || offset.y === projected.y
        ? null
        : { x: projected.x, y: offset.y };
    return dedupePoints([
        point,
        offset,
        ...(elbow ? [elbow] : []),
        projected,
    ]);
}

function projectAnchorToTrack(anchor, clearance, fixture) {
    if (anchor.side === "WEST") {
        return {
            x: snapDown(anchor.x - clearance, fixture.trackGrid),
            y: snapToNearest(anchor.y, fixture.trackGrid),
        };
    }
    if (anchor.side === "EAST") {
        return {
            x: snapUp(anchor.x + clearance, fixture.trackGrid),
            y: snapToNearest(anchor.y, fixture.trackGrid),
        };
    }
    if (anchor.side === "NORTH") {
        return {
            x: snapToNearest(anchor.x, fixture.trackGrid),
            y: snapDown(anchor.y - clearance, fixture.trackGrid),
        };
    }
    return {
        x: snapToNearest(anchor.x, fixture.trackGrid),
        y: snapUp(anchor.y + clearance, fixture.trackGrid),
    };
}

function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function keyOf(point) {
    return `${point.x},${point.y}`;
}

function neighbors(point, step, bounds) {
    const raw = [
        { point: { x: point.x + step, y: point.y }, dir: "H" },
        { point: { x: point.x - step, y: point.y }, dir: "H" },
        { point: { x: point.x, y: point.y + step }, dir: "V" },
        { point: { x: point.x, y: point.y - step }, dir: "V" },
    ];
    return raw.filter(({ point: next }) =>
        next.x >= bounds.left &&
        next.x <= bounds.right &&
        next.y >= bounds.top &&
        next.y <= bounds.bottom,
    );
}

function snapBoundsToTrackGrid(bounds, trackGrid) {
    return {
        left: snapUp(bounds.left, trackGrid),
        right: snapDown(bounds.right, trackGrid),
        top: snapUp(bounds.top, trackGrid),
        bottom: snapDown(bounds.bottom, trackGrid),
    };
}

function reconstructAStarPath(cameFrom, current) {
    const path = [current];
    let cursor = cameFrom.get(keyOf(current));
    while (cursor) {
        path.unshift(cursor.point);
        cursor = cameFrom.get(keyOf(cursor.point));
    }
    return simplifyPath(path);
}

function simplifyPath(points) {
    if (points.length <= 2) return points;
    const simplified = [points[0]];
    for (let index = 1; index < points.length - 1; index += 1) {
        const prev = simplified[simplified.length - 1];
        const current = points[index];
        const next = points[index + 1];
        if ((prev.x === current.x && current.x === next.x) || (prev.y === current.y && current.y === next.y)) {
            continue;
        }
        simplified.push(current);
    }
    simplified.push(points.at(-1));
    return simplified;
}

function routePathDefect(points) {
    for (let index = 2; index < points.length; index += 1) {
        const previousPrevious = points[index - 2];
        const previous = points[index - 1];
        const current = points[index];
        if (!sameAxis(previousPrevious, previous, current)) continue;
        const firstDirection = segmentDirection(previousPrevious, previous);
        const nextDirection = segmentDirection(previous, current);
        if (firstDirection !== nextDirection) {
            return `path backtracks at ${previous.x},${previous.y}`;
        }
        return `path has redundant collinear point at ${previous.x},${previous.y}`;
    }
    return null;
}

function sameAxis(a, b, c) {
    return (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
}

function segmentDirection(start, end) {
    if (start.x === end.x) return Math.sign(end.y - start.y);
    return Math.sign(end.x - start.x);
}

function segmentIsClear(start, end, obstacles) {
    return !obstacles.some((box) => segmentHitsBox(start, end, box));
}

function segmentHitsBox(start, end, box) {
    if (start.x === end.x) {
        const x = start.x;
        if (x <= box.left || x >= box.right) return false;
        const top = Math.min(start.y, end.y);
        const bottom = Math.max(start.y, end.y);
        return bottom > box.top && top < box.bottom;
    }
    if (start.y === end.y) {
        const y = start.y;
        if (y <= box.top || y >= box.bottom) return false;
        const left = Math.min(start.x, end.x);
        const right = Math.max(start.x, end.x);
        return right > box.left && left < box.right;
    }
    return true;
}

function findHorizontalTrack({ fixture, obstacles, minY, maxY, startX, endX }) {
    for (let y = snapUp(maxY, fixture.trackGrid); y >= minY; y -= fixture.trackGrid) {
        const clear = !obstacles.some((box) =>
            y > box.top &&
            y < box.bottom &&
            endX > box.left &&
            startX < box.right,
        );
        if (clear) return y;
    }
    return minY;
}

function segmentsOf(points) {
    return points.slice(1).map((point, index) => {
        const start = points[index];
        return {
            start,
            end: point,
            axis: start.x === point.x ? "V" : "H",
        };
    });
}

function segmentLength(segment) {
    return Math.abs(segment.start.x - segment.end.x) + Math.abs(segment.start.y - segment.end.y);
}

function routesOverlap(left, right) {
    return segmentsOf(left.points).some((leftSegment) =>
        segmentsOf(right.points).some((rightSegment) =>
            positiveLengthCollinearOverlap(leftSegment, rightSegment),
        ),
    );
}

function positiveLengthCollinearOverlap(left, right) {
    if (left.axis !== right.axis) return false;
    if (left.axis === "H") {
        if (left.start.y !== right.start.y) return false;
        return intervalOverlapLength(left.start.x, left.end.x, right.start.x, right.end.x) > 0;
    }
    if (left.start.x !== right.start.x) return false;
    return intervalOverlapLength(left.start.y, left.end.y, right.start.y, right.end.y) > 0;
}

function intervalOverlapLength(leftStart, leftEnd, rightStart, rightEnd) {
    const leftMin = Math.min(leftStart, leftEnd);
    const leftMax = Math.max(leftStart, leftEnd);
    const rightMin = Math.min(rightStart, rightEnd);
    const rightMax = Math.max(rightStart, rightEnd);
    return Math.min(leftMax, rightMax) - Math.max(leftMin, rightMin);
}

function boxOf(node) {
    return {
        id: node.id,
        left: node.left,
        right: node.right,
        top: node.top,
        bottom: node.bottom,
    };
}

function inflateBox(box, amount) {
    return {
        ...box,
        left: box.left - amount,
        right: box.right + amount,
        top: box.top - amount,
        bottom: box.bottom + amount,
    };
}

function boxesOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function findOverlaps(nodes, messageForPair) {
    const failures = [];
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        const left = nodes[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
            const right = nodes[rightIndex];
            if (boxesOverlap(boxOf(left), boxOf(right))) {
                failures.push(messageForPair(left, right));
            }
        }
    }
    return failures;
}

function pathHitsAny(points, boxes) {
    return segmentsOf(points).some((segment) =>
        boxes.some((box) => segmentHitsBox(segment.start, segment.end, box)),
    );
}

function childContentBounds(container, fixture) {
    const padding = 2 * fixture.minArrowLength;
    return {
        left: container.left + padding,
        right: container.right - padding,
        top: container.top + container.headerHeight + padding,
        bottom: container.bottom - padding,
    };
}

function viewBoxBounds(viewBox) {
    const [minX, minY, width, height] = viewBox.trim().split(/\s+/).map(Number);
    return {
        left: minX,
        top: minY,
        right: minX + width,
        bottom: minY + height,
    };
}

function pointWithinBounds(point, bounds) {
    return (
        point.x >= bounds.left - 0.001 &&
        point.x <= bounds.right + 0.001 &&
        point.y >= bounds.top - 0.001 &&
        point.y <= bounds.bottom + 0.001
    );
}

function boxWithinBounds(box, bounds) {
    return (
        box.left >= bounds.left - 0.001 &&
        box.right <= bounds.right + 0.001 &&
        box.top >= bounds.top - 0.001 &&
        box.bottom <= bounds.bottom + 0.001
    );
}

function isPointOnGrid(point, grid) {
    return (
        Math.abs(point.x / grid - Math.round(point.x / grid)) < 0.001 &&
        Math.abs(point.y / grid - Math.round(point.y / grid)) < 0.001
    );
}

function isValueOnGrid(value, grid) {
    return Math.abs(value / grid - Math.round(value / grid)) < 0.001;
}

function isBoundarySegmentValid(anchor, trackPoint, side, clearance) {
    if (!trackPoint) return false;
    if (anchor.x !== trackPoint.x && anchor.y !== trackPoint.y) return false;
    if (side === "WEST") return trackPoint.x <= anchor.x - clearance + 0.001;
    if (side === "EAST") return trackPoint.x >= anchor.x + clearance - 0.001;
    if (side === "NORTH") return trackPoint.y <= anchor.y - clearance + 0.001;
    return trackPoint.y >= anchor.y + clearance - 0.001;
}

function snapToNearest(value, unit) {
    return Math.round(value / unit) * unit;
}

function measureApproxTitle(title, G) {
    return snapUp(title.length * (G / 5), G / 2);
}
